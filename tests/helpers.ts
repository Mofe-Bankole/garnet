import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Observation, Planner, PlannerResult } from "../src/lib/agent/planner";
import { ScriptedPlanner } from "../src/lib/agent/planner";
import { type RuntimeOptions, createRuntime } from "../src/lib/runtime";
import { FIXTURE_TX_HASHES } from "../src/lib/verification/chain";

export const TX = FIXTURE_TX_HASHES[0];
export const TX2 = FIXTURE_TX_HASHES[1];

export function tmpDb() {
  return join(mkdtempSync(join(tmpdir(), "garnet-")), "test.db");
}

export function rt(o: RuntimeOptions = {}) {
  return createRuntime({ dbPath: ":memory:", verifierMode: "fixture", planner: new ScriptedPlanner(), ...o });
}

export function releaseCount(r: ReturnType<typeof rt>, jobId: string) {
  return (r.db.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE job_id = ? AND kind = 'release'").get(jobId) as { n: number }).n;
}

/** A planner that returns whatever the test dictates (simulates a misbehaving LLM). */
export class FakePlanner implements Planner {
  kind = "llm" as const;
  calls: Observation[] = [];
  constructor(private impl: (obs: Observation) => PlannerResult["decision"] | Error) {}
  async decide(obs: Observation): Promise<PlannerResult> {
    this.calls.push(obs);
    const d = this.impl(obs);
    if (d instanceof Error) throw d;
    return { decision: d, planner: "llm", model: "fake-model", latencyMs: 1 };
  }
}
