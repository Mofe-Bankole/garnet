import { describe, expect, it } from "vitest";
import { openDb } from "../src/lib/db";
import { formatUsd, parseUsd } from "../src/lib/money";
import { LedgerError, SimulatedEscrowLedger } from "../src/lib/payments/ledger";

function setup(budget = "1.00") {
  const db = openDb(":memory:");
  const t = new Date().toISOString();
  db.prepare("INSERT INTO jobs (id, idempotency_key, status, stage, contract_json, contract_hash, fault_injection, planner, created_at, updated_at) VALUES ('j','k','open','intake','{}','h',0,'scripted',?,?)").run(t, t);
  const l = new SimulatedEscrowLedger(db);
  l.fundBudget("j", parseUsd(budget), "j:budget");
  return { db, l };
}

describe("money", () => {
  it("parses and formats exactly", () => {
    expect(parseUsd("0.1") + parseUsd("0.2")).toBe(parseUsd("0.3"));
    expect(formatUsd(parseUsd("1.5"))).toBe("$1.50");
    expect(formatUsd(parseUsd("0.000001"))).toBe("$0.000001");
    expect(() => parseUsd("-1")).toThrow();
    expect(() => parseUsd("1e3")).toThrow();
  });
});

describe("simulated escrow ledger", () => {
  it("never lets reservations exceed the budget", () => {
    const { l } = setup("1.00");
    l.reserve("j", "a1", "s", parseUsd("0.60"), "a1:r");
    expect(() => l.reserve("j", "a2", "s", parseUsd("0.60"), "a2:r")).toThrow(LedgerError);
    const b = l.balances("j");
    expect(b.availableMicro).toBe(parseUsd("0.40"));
  });

  it("refund returns capacity; release is idempotent by key", () => {
    const { l } = setup("1.00");
    const { reservationId } = l.reserve("j", "a1", "s", parseUsd("0.60"), "a1:r");
    l.refund(reservationId, "a1:refund");
    const r2 = l.reserve("j", "a2", "s", parseUsd("0.90"), "a2:r");
    const rec1 = l.release(r2.reservationId, "a2:release");
    const rec2 = l.release(r2.reservationId, "a2:release");
    expect(rec2.receiptId).toBe(rec1.receiptId);
    expect(l.receipts("j").filter((x) => x.op === "release")).toHaveLength(1);
    expect(l.balances("j")).toMatchObject({ releasedMicro: parseUsd("0.90"), refundedMicro: parseUsd("0.60"), availableMicro: parseUsd("0.10") });
  });

  it("a second release with a NEW key is refused (one settlement per job)", () => {
    const { l } = setup("2.00");
    const a = l.reserve("j", "a1", "s", parseUsd("0.50"), "a1:r");
    const b = l.reserve("j", "a2", "s", parseUsd("0.50"), "a2:r");
    l.release(a.reservationId, "a1:release");
    expect(() => l.release(b.reservationId, "a2:release")).toThrow(/already/);
    expect(() => l.release(a.reservationId, "a1:release-retry")).toThrow(/cannot release/);
    expect(() => l.reserve("j", "a3", "s", parseUsd("0.10"), "a3:r")).toThrow(/settled/);
  });

  it("held funds can be neither released nor refunded", () => {
    const { l } = setup();
    const a = l.reserve("j", "a1", "s", parseUsd("0.50"), "a1:r");
    l.hold(a.reservationId, "a1:hold");
    expect(() => l.release(a.reservationId, "a1:release")).toThrow();
    expect(() => l.refund(a.reservationId, "a1:refund")).toThrow();
    expect(l.balances("j").heldMicro).toBe(parseUsd("0.50"));
  });

  it("reusing a key for a different operation is a conflict", () => {
    const { l } = setup();
    const a = l.reserve("j", "a1", "s", parseUsd("0.50"), "a1:r");
    expect(() => l.refund(a.reservationId, "a1:r")).toThrow(/already used/);
  });

  it("invariant holds under many interleaved repeated callbacks", async () => {
    const { l } = setup("1.00");
    const ops: Promise<unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      ops.push(
        Promise.resolve().then(() => {
          try {
            const r = l.reserve("j", `a${i % 7}`, "s", parseUsd("0.30"), `a${i % 7}:r`);
            if (i % 3 === 0) l.refund(r.reservationId, `a${i % 7}:refund`);
            else if (i % 3 === 1) l.release(r.reservationId, `a${i % 7}:release`);
          } catch {
            /* expected rejections */
          }
        }),
      );
    }
    await Promise.all(ops);
    const b = l.balances("j");
    expect(b.reservedMicro + b.heldMicro + b.releasedMicro).toBeLessThanOrEqual(b.budgetMicro);
    expect(l.receipts("j").filter((x) => x.op === "release").length).toBeLessThanOrEqual(1);
  });
});
