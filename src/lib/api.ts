import { InputError } from "./agent/engine";
import { serverRuntime } from "./runtime";
import { flushTelemetry, initTelemetry, telemetryStatus } from "./telemetry/neatlogs";

export async function ready() {
  await initTelemetry({ runtime: "server" });
  return serverRuntime();
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function errorResponse(e: unknown) {
  if (e instanceof InputError) return json({ error: { code: "invalid_input", message: e.message } }, 400);
  if (e instanceof SyntaxError) return json({ error: { code: "invalid_json", message: "Request body must be valid JSON" } }, 400);
  console.error("[garnet] unhandled", e);
  return json({ error: { code: "internal", message: "Internal error. The job state is persisted; retrying is safe." } }, 500);
}

/** Drive a job in the background, then flush traces (server lifecycle: never shutdown per request). */
export async function driveAndFlush(jobId: string) {
  const { engine } = serverRuntime();
  try {
    await engine.drive(jobId);
  } catch (e) {
    console.error(`[garnet] job ${jobId} drive error (state persisted; resumable)`, e);
  } finally {
    await flushTelemetry();
  }
}

export function systemStatus() {
  return {
    planner: process.env.ANTHROPIC_API_KEY ? { kind: "llm", model: process.env.GARNET_MODEL || "claude-opus-5-5" } : { kind: "scripted", model: null },
    verifier: process.env.GARNET_VERIFIER_MODE === "fixture" ? "fixture" : "rpc",
    payment: "SIMULATED",
    chain: "Base Sepolia (84532)",
    telemetry: telemetryStatus(),
  };
}
