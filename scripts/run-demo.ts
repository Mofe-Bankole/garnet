/**
 * CLI demo runner.
 *   npm run demo -- --scenario happy|recovery [--tx 0x...] [--budget 1.50] [--fixture]
 * Loads .env.local if present. Prints the event trail, balances and trace id.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  loadEnv();
  const { initTelemetry, shutdownTelemetry, telemetryStatus } = await import("../src/lib/telemetry/neatlogs");
  const { createRuntime } = await import("../src/lib/runtime");
  const { FIXTURE_TX_HASHES } = await import("../src/lib/verification/chain");

  await initTelemetry({ runtime: "cli" });
  try {
    const scenario = arg("scenario") ?? "happy";
    const fixture = process.argv.includes("--fixture");
    const rt = createRuntime({ verifierMode: fixture ? "fixture" : undefined });
    const txHash = arg("tx") ?? FIXTURE_TX_HASHES[0];
    const { job } = rt.engine.createJob({
      txHash,
      budget: arg("budget") ?? "1.50",
      injectSellerAFault: scenario === "recovery",
    });
    const t0 = Date.now();
    await rt.engine.drive(job.id);
    const s = rt.engine.snapshot(job.id)!;
    console.log(`\nGarnet job ${s.job.id}  scenario=${scenario}  planner=${s.modes.planner}  verifier=${s.modes.verifier}  payment=${s.modes.payment}`);
    console.log(`telemetry: ${telemetryStatus().reason}${s.job.traceId ? `  traceId=${s.job.traceId}` : ""}\n`);
    for (const e of s.events) console.log(`  ${String(e.seq).padStart(2)} [${e.stage}] ${e.message}`);
    console.log(`\nbalances: ${JSON.stringify(s.balances)}`);
    console.log(`outcome: ${s.job.status} — ${s.job.outcome?.summary}  (${Date.now() - t0} ms)`);
    const save = arg("save");
    if (save) {
      writeFileSync(save, JSON.stringify({ recordedAt: new Date().toISOString(), scenario, snapshot: s }, null, 2) + "\n");
      console.log(`saved snapshot → ${save}`);
    }
    console.log(JSON.stringify({ jobId: s.job.id, status: s.job.status, attempts: s.attempts.length, released: s.balances.released, refunded: s.balances.refunded, traceId: s.job.traceId, planner: s.modes.planner, latencyMs: Date.now() - t0 }));
  } finally {
    await shutdownTelemetry();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
