import { flush, init, shutdown, trace, wrapAnthropic, type TraceSpanKind } from "neatlogs";

/**
 * Neatlogs instrumentation boundary.
 * - Initialized once per process (server) or per CLI run.
 * - If NEATLOGS_API_KEY is absent, spans are not exported (status reported honestly as "disabled").
 * - Inputs/outputs are sanitized explicitly: we pass curated `input` and set `output.value` ourselves,
 *   so seller payloads, keys and RPC URLs never reach the trace.
 */

type State = { enabled: boolean; initPromise: Promise<void> | null; reason: string };
const g = globalThis as unknown as { __garnetNeatlogs?: State };
const state: State = (g.__garnetNeatlogs ??= { enabled: false, initPromise: null, reason: "not initialized" });

export function telemetryStatus() {
  return { enabled: state.enabled, reason: state.reason };
}

export async function initTelemetry(opts: {
  runtime: "server" | "cli" | "test";
  /** Tests only: caller-owned provider with an in-memory exporter (no network). */
  tracerProvider?: Parameters<typeof init>[0] extends infer O ? (O extends { tracerProvider?: infer P } ? P : never) : never;
}): Promise<void> {
  if (state.initPromise) return state.initPromise;
  if (opts.tracerProvider) {
    state.initPromise = init({ apiKey: "test-local-only", workflowName: "garnet", disableExport: true, tracerProvider: opts.tracerProvider, registerShutdownHandlers: false }).then(() => {
      state.enabled = true;
      state.reason = "local in-memory capture (test)";
    });
    return state.initPromise;
  }
  const apiKey = process.env.NEATLOGS_API_KEY;
  if (!apiKey || opts.runtime === "test") {
    state.enabled = false;
    state.reason = apiKey ? "disabled in tests" : "NEATLOGS_API_KEY not set — traces not exported";
    state.initPromise = Promise.resolve();
    return state.initPromise;
  }
  state.initPromise = init({
    apiKey,
    workflowName: "garnet",
    endpoint: process.env.NEATLOGS_ENDPOINT || undefined,
    tags: ["neathack-2026", "garnet"],
    metadata: { app: "garnet", runtime: opts.runtime },
    // Next.js owns server shutdown; CLI uses SDK handlers plus explicit flush/shutdown in finally.
    registerShutdownHandlers: opts.runtime === "cli",
  }).then(
    () => {
      state.enabled = true;
      state.reason = "exporting to Neatlogs";
    },
    (e: unknown) => {
      state.enabled = false;
      state.reason = `init failed: ${e instanceof Error ? e.message : String(e)}`;
    },
  );
  return state.initPromise;
}

export interface SpanHandle {
  traceId: string | null;
  spanId: string | null;
  setAttr(key: string, value: string | number | boolean): void;
}

/**
 * Run fn inside a Neatlogs span. `input` and `summarize(result)` are the ONLY content captured.
 * When telemetry is disabled, fn runs unchanged.
 */
export async function tspan<T>(
  kind: TraceSpanKind,
  name: string,
  opts: { input?: Record<string, unknown>; summarize?: (r: T) => unknown; attributes?: Record<string, string | number | boolean> },
  fn: (h: SpanHandle) => Promise<T>,
): Promise<T> {
  if (!state.enabled) {
    return fn({ traceId: null, spanId: null, setAttr: () => {} });
  }
  return trace({ name, kind, input: opts.input, attributes: { "garnet.step": name, ...(opts.attributes ?? {}) } }, async (span) => {
    const ctx = span.spanContext();
    const handle: SpanHandle = {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      setAttr: (k, v) => span.setAttribute(k, v),
    };
    const result = await fn(handle);
    // Always set output ourselves so raw return values (which may contain payloads) are never auto-captured.
    span.setAttribute("output.value", JSON.stringify(opts.summarize ? opts.summarize(result) : { ok: true }));
    return result;
  });
}

export function wrapModelClient<T extends object>(client: T): T {
  return state.enabled ? wrapAnthropic(client) : client;
}

/** Server: call after each job so traces land promptly without shutting down the warm runtime. */
export async function flushTelemetry(): Promise<boolean> {
  if (!state.enabled) return false;
  try {
    return await flush();
  } catch {
    return false;
  }
}

/** CLI: call in finally. */
export async function shutdownTelemetry(): Promise<void> {
  if (!state.enabled) return;
  await flush().catch(() => false);
  await shutdown().catch(() => false);
}
