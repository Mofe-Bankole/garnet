import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterAll, describe, expect, it } from "vitest";
import { flushTelemetry, initTelemetry, shutdownTelemetry } from "../src/lib/telemetry/neatlogs";
import { TX, releaseCount, rt } from "./helpers";

describe("Neatlogs instrumentation (local capture, no network)", () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  afterAll(async () => {
    await shutdownTelemetry();
  });

  it("emits one WORKFLOW root with AGENT/TOOL/GUARDRAIL children and no secrets/payloads", async () => {
    process.env.ANTHROPIC_API_KEY_SENTINEL = "sk-should-never-appear";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await initTelemetry({ runtime: "test", tracerProvider: provider as any });
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50", injectSellerAFault: true });
    await r.engine.drive(job.id);
    await flushTelemetry();
    expect(releaseCount(r, job.id)).toBe(1);

    const spans = exporter.getFinishedSpans();
    const kind = (s: (typeof spans)[number]) => String(s.attributes["openinference.span.kind"] ?? "");
    const names = spans.map((s) => s.name);
    const root = spans.find((s) => s.name === "garnet.job")!;
    expect(root).toBeDefined();
    expect(kind(root)).toBe("WORKFLOW");
    const traceId = root.spanContext().traceId;
    expect(spans.every((s) => s.spanContext().traceId === traceId)).toBe(true);
    expect(r.engine.snapshot(job.id)!.job.traceId).toBe(traceId);

    for (const n of ["select_provider", "create_contract", "reserve", "seller_execute", "verify", "create_dispute", "refund_or_release", "fallback", "finalize"]) {
      expect(names, n).toContain(n);
    }
    expect(kind(spans.find((s) => s.name === "select_provider")!)).toBe("AGENT");
    expect(kind(spans.find((s) => s.name === "verify")!)).toBe("GUARDRAIL");
    expect(kind(spans.find((s) => s.name === "budget_and_policy_guard")!)).toBe("GUARDRAIL");
    expect(kind(spans.find((s) => s.name === "reserve")!)).toBe("TOOL");

    const verifySpans = spans.filter((s) => s.name === "verify");
    expect(String(verifySpans[0].attributes["output.value"])).toContain("FAIL");
    expect(String(verifySpans[1].attributes["output.value"])).toContain("PASS");

    const dump = JSON.stringify(spans.map((s) => s.attributes));
    expect(dump).not.toContain("sk-should-never-appear");
    expect(dump).not.toContain("\"summary\""); // seller payload text is not captured
  });
});
