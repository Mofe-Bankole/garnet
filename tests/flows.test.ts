import { describe, expect, it } from "vitest";
import { InputError } from "../src/lib/agent/engine";
import { createRuntime } from "../src/lib/runtime";
import { ScriptedPlanner } from "../src/lib/agent/planner";
import { type ChainSource, FixtureChainSource, UnreachableChainSource } from "../src/lib/verification/chain";
import { FakePlanner, TX, TX2, releaseCount, rt, tmpDb } from "./helpers";

describe("happy path", () => {
  it("correct work verifies PASS and releases exactly one simulated payment", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("settled");
    const s = r.engine.snapshot(job.id)!;
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].verification.verdict).toBe("PASS");
    expect(s.attempts[0].verification.assertions.every((a: { result: string }) => a.result === "PASS")).toBe(true);
    expect(s.balances.released).toBe("$0.40");
    expect(releaseCount(r, job.id)).toBe(1);
    expect(s.receipts.every((x) => x.mode === "SIMULATED")).toBe(true);
  });
});

describe("failure → recovery", () => {
  it("fault injection is detected, refunded with evidence, and Seller B settles under one budget", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50", injectSellerAFault: true });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("settled");
    const s = r.engine.snapshot(job.id)!;
    const [a, b] = s.attempts;
    expect(a.providerId).toBe("seller-a");
    expect(a.status).toBe("refunded");
    expect(a.verification.verdict).toBe("FAIL");
    const failed = a.verification.assertions.filter((x: { result: string }) => x.result === "FAIL");
    expect(failed.map((x: { field: string }) => x.field)).toEqual(["blockNumber"]);
    expect(failed[0].source).toMatch(/^fixture:/);
    expect(a.dispute.kind).toBe("garnet.dispute/1");
    expect(a.dispute.packetHash).toMatch(/^sha256:/);
    expect(b.providerId).toBe("seller-b");
    expect(b.status).toBe("released");
    expect(s.balances).toMatchObject({ budget: "$1.50", released: "$0.65", refunded: "$0.40", reserved: "$0.00", available: "$0.85" });
    expect(releaseCount(r, job.id)).toBe(1);
    // labeled and visibly detected
    expect(s.events.some((e) => e.type === "demo_fault_armed")).toBe(true);
    expect(s.events.some((e) => e.type === "verify_fail")).toBe(true);
  });

  it("recovery stops (no overspend) when the remaining budget cannot cover Seller B", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "0.50", injectSellerAFault: true });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("exhausted");
    const s = r.engine.snapshot(job.id)!;
    expect(s.balances.released).toBe("$0.00");
    expect(s.balances.available).toBe("$0.50");
    expect(releaseCount(r, job.id)).toBe(0);
  });
});

describe("inconclusive verification", () => {
  it("RPC unreachable → INCONCLUSIVE, funds held, escalated, no release and no re-hire", async () => {
    const r = rt({ verifierSource: new UnreachableChainSource() });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("escalated");
    const s = r.engine.snapshot(job.id)!;
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].verification.verdict).toBe("INCONCLUSIVE");
    expect(s.balances).toMatchObject({ released: "$0.00", held: "$0.40", available: "$1.10" });
    expect(releaseCount(r, job.id)).toBe(0);
    // driving again must not change anything
    await r.engine.drive(job.id);
    expect(releaseCount(r, job.id)).toBe(0);
    expect(r.engine.snapshot(job.id)!.attempts).toHaveLength(1);
  });

  it("wrong chain → INCONCLUSIVE", async () => {
    const wrongChain: ChainSource = {
      kind: "rpc",
      lookup: async () => ({ ok: false, reason: "wrong_chain", detail: "RPC reports chainId 1", source: { kind: "rpc", endpoint: "x", chainId: 1, fetchedAt: "" } }),
    };
    const r = rt({ verifierSource: wrongChain });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    expect((await r.engine.drive(job.id)).status).toBe("escalated");
    expect(releaseCount(r, job.id)).toBe(0);
  });

  it("unknown transaction → seller error, refunded, and no payment anywhere", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: "0x" + "ab".repeat(32), budget: "1.50" });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("exhausted");
    expect(releaseCount(r, job.id)).toBe(0);
    expect(r.engine.snapshot(job.id)!.balances.available).toBe("$1.50");
  });
});

describe("idempotency, replay and restarts", () => {
  it("repeated and concurrent drive() calls never double-pay", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50", injectSellerAFault: true });
    await Promise.all([r.engine.drive(job.id), r.engine.drive(job.id), r.engine.drive(job.id)]);
    await r.engine.drive(job.id);
    expect(releaseCount(r, job.id)).toBe(1);
    expect(r.engine.snapshot(job.id)!.attempts).toHaveLength(2);
  });

  it("same idempotency key returns the same job; different params with same key are rejected", async () => {
    const r = rt();
    const a = r.engine.createJob({ txHash: TX, budget: "1.50", idempotencyKey: "demo-key-123" });
    const b = r.engine.createJob({ txHash: TX, budget: "1.50", idempotencyKey: "demo-key-123" });
    expect(b.created).toBe(false);
    expect(b.job.id).toBe(a.job.id);
    expect(() => r.engine.createJob({ txHash: TX2, budget: "1.50", idempotencyKey: "demo-key-123" })).toThrow(InputError);
  });

  it("process crash mid-job → a fresh runtime on the same DB resumes and settles exactly once", async () => {
    const dbPath = tmpDb();
    let calls = 0;
    const crashing: ChainSource = {
      kind: "fixture",
      lookup: async () => {
        calls++;
        throw new Error("process killed during verification");
      },
    };
    const r1 = createRuntime({ dbPath, verifierMode: "fixture", verifierSource: crashing, planner: new ScriptedPlanner() });
    const { job } = r1.engine.createJob({ txHash: TX, budget: "1.50" });
    await expect(r1.engine.drive(job.id)).rejects.toThrow(/killed/);
    expect(calls).toBe(1);
    expect(r1.engine.snapshot(job.id)!.attempts[0].status).toBe("delivered");
    expect(r1.engine.snapshot(job.id)!.balances.reserved).toBe("$0.40");
    r1.db.close();

    const r2 = createRuntime({ dbPath, verifierMode: "fixture", verifierSource: new FixtureChainSource(), planner: new ScriptedPlanner() });
    const done = await r2.engine.drive(job.id);
    expect(done.status).toBe("settled");
    expect(releaseCount(r2, job.id)).toBe(1);
    expect(r2.engine.snapshot(job.id)!.attempts).toHaveLength(1); // seller not re-hired / re-paid
    r2.db.close();
  });

  it("lost release acknowledgement → settlement_unknown → reconciled by key, never re-sent", async () => {
    const r = rt();
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    r.ledger.simulateLostReleaseAck();
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("settled");
    const s = r.engine.snapshot(job.id)!;
    expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(["settlement_unknown", "reconciled_released"]));
    expect(releaseCount(r, job.id)).toBe(1);
  });
});

describe("LLM agent is constrained by deterministic guards", () => {
  it("an over-budget or repeated LLM choice is rejected and replaced by the safe policy", async () => {
    const planner = new FakePlanner(() => ({ action: "hire", providerId: "seller-a", reason: "always A" }));
    const r = rt({ planner });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50", injectSellerAFault: true });
    const done = await r.engine.drive(job.id);
    expect(done.status).toBe("settled");
    const s = r.engine.snapshot(job.id)!;
    expect(s.events.some((e) => e.type === "decision_rejected" && /already attempted/.test(e.message))).toBe(true);
    expect(s.attempts.map((a) => a.providerId)).toEqual(["seller-a", "seller-b"]);
    expect(releaseCount(r, job.id)).toBe(1);
  });

  it("hallucinated provider is rejected", async () => {
    const planner = new FakePlanner(() => ({ action: "hire", providerId: "seller-z", reason: "made up" }));
    const r = rt({ planner });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    await r.engine.drive(job.id);
    expect(r.engine.snapshot(job.id)!.events.some((e) => e.type === "decision_rejected")).toBe(true);
    expect(releaseCount(r, job.id)).toBe(1);
  });

  it("LLM failure falls back to the labeled scripted planner", async () => {
    const planner = new FakePlanner(() => new Error("401 invalid x-api-key"));
    const r = rt({ planner });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50" });
    await r.engine.drive(job.id);
    const s = r.engine.snapshot(job.id)!;
    expect(s.events.some((e) => e.type === "planner_fallback")).toBe(true);
    expect(s.job.planner).toBe("scripted");
  });

  it("the LLM is never consulted about payment: a hire decision cannot release a FAIL", async () => {
    const planner = new FakePlanner((obs) => ({ action: "hire", providerId: obs.history.length ? "seller-b" : "seller-a", reason: "x" }));
    const r = rt({ planner });
    const { job } = r.engine.createJob({ txHash: TX, budget: "1.50", injectSellerAFault: true });
    await r.engine.drive(job.id);
    const s = r.engine.snapshot(job.id)!;
    expect(s.attempts[0].status).toBe("refunded");
    expect(s.receipts.filter((x) => x.op === "release").map((x) => x.payee)).toEqual(["seller-b"]);
  });
});

describe("input validation", () => {
  it.each([
    [{ txHash: "0x123", budget: "1" }, /txHash/],
    [{ txHash: TX, budget: "abc" }, /Invalid USD/],
    [{ txHash: TX, budget: "0" }, /greater than/],
    [{ txHash: TX, budget: "1.1234567" }, /Invalid USD/],
    [{ txHash: TX, budget: "1000" }, /capped/],
    [{ txHash: TX, budget: "1", chainId: 1 }, /chainId/],
  ])("rejects %j", (input, re) => {
    const r = rt();
    expect(() => r.engine.createJob(input as never)).toThrow(re);
  });
});
