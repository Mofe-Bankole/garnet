import { randomUUID } from "node:crypto";
import { type Db, nowIso, tx } from "../db";

/**
 * SIMULATED escrow ledger. No funds move on any chain. Every receipt is labeled mode=SIMULATED.
 *
 * Invariants (enforced inside a single SQLite write transaction):
 *  - reserved + held + released <= budget   (refunds return capacity)
 *  - at most one 'released' reservation per job (unique partial index)
 *  - every value-moving op carries an idempotency key; replays return the original receipt
 */

export const PAYMENT_MODE = "SIMULATED" as const;

export type ReservationStatus = "reserved" | "released" | "refunded" | "held";
export type LedgerOp = "budget" | "reserve" | "release" | "refund" | "hold";

export interface Receipt {
  mode: typeof PAYMENT_MODE;
  receiptId: string;
  op: LedgerOp;
  jobId: string;
  reservationId: string | null;
  payee: string | null;
  amountMicro: string;
  idempotencyKey: string;
  at: string;
  note: string;
}

export interface Balances {
  budgetMicro: bigint;
  availableMicro: bigint;
  reservedMicro: bigint;
  heldMicro: bigint;
  releasedMicro: bigint;
  refundedMicro: bigint;
}

export class LedgerError extends Error {
  constructor(public code: "BUDGET_EXCEEDED" | "NOT_FOUND" | "BAD_STATE" | "ALREADY_SETTLED" | "IDEMPOTENCY_CONFLICT" | "NO_BUDGET", msg: string) {
    super(msg);
    this.name = "LedgerError";
  }
}

interface ReservationRow {
  id: string;
  job_id: string;
  attempt_id: string;
  payee: string;
  amount_micro: string;
  status: ReservationStatus;
}

export class SimulatedEscrowLedger {
  readonly mode = PAYMENT_MODE;
  /** Test/demo hook: makes the NEXT release commit but then throw as if the acknowledgement was lost. */
  private loseNextReleaseAck = false;

  constructor(private db: Db) {}

  simulateLostReleaseAck() {
    this.loseNextReleaseAck = true;
  }

  fundBudget(jobId: string, budgetMicro: bigint, idempotencyKey: string): Receipt {
    if (budgetMicro <= 0n) throw new LedgerError("NO_BUDGET", "budget must be positive");
    return this.idempotent(idempotencyKey, "budget", () => {
      const existing = this.db.prepare("SELECT budget_micro FROM budgets WHERE job_id = ?").get(jobId) as { budget_micro: string } | undefined;
      if (existing) throw new LedgerError("BAD_STATE", "budget already funded for this job");
      this.db.prepare("INSERT INTO budgets (job_id, budget_micro) VALUES (?, ?)").run(jobId, budgetMicro.toString());
      return this.entry(jobId, null, "budget", budgetMicro, null, idempotencyKey, "Buyer budget recorded in simulated escrow account.");
    });
  }

  reserve(jobId: string, attemptId: string, payee: string, amountMicro: bigint, idempotencyKey: string): { reservationId: string; receipt: Receipt } {
    const receipt = this.idempotent(idempotencyKey, "reserve", () => {
      if (amountMicro <= 0n) throw new LedgerError("BAD_STATE", "reservation must be positive");
      const dup = this.db.prepare("SELECT id FROM reservations WHERE attempt_id = ?").get(attemptId);
      if (dup) throw new LedgerError("BAD_STATE", `attempt ${attemptId} already has a reservation`);
      const released = this.db.prepare("SELECT 1 FROM reservations WHERE job_id = ? AND status = 'released'").get(jobId);
      if (released) throw new LedgerError("ALREADY_SETTLED", "job already settled; refusing new reservation");
      const b = this.balancesUnsafe(jobId);
      if (amountMicro > b.availableMicro) {
        throw new LedgerError("BUDGET_EXCEEDED", `reservation ${amountMicro} exceeds available ${b.availableMicro}`);
      }
      const id = `res_${randomUUID()}`;
      const t = nowIso();
      this.db
        .prepare("INSERT INTO reservations (id, job_id, attempt_id, payee, amount_micro, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(id, jobId, attemptId, payee, amountMicro.toString(), "reserved", t, t);
      return this.entry(jobId, id, "reserve", amountMicro, payee, idempotencyKey, `Funds reserved for ${payee}. Not yet payable.`);
    });
    return { reservationId: receipt.reservationId!, receipt };
  }

  release(reservationId: string, idempotencyKey: string): Receipt {
    const receipt = this.idempotent(idempotencyKey, "release", () => {
      const r = this.getReservation(reservationId);
      if (r.status !== "reserved") throw new LedgerError("BAD_STATE", `cannot release reservation in status ${r.status}`);
      try {
        this.setStatus(reservationId, "released");
      } catch (e) {
        if (String(e).includes("UNIQUE")) throw new LedgerError("ALREADY_SETTLED", "job already has a released payment");
        throw e;
      }
      return this.entry(r.job_id, r.id, "release", BigInt(r.amount_micro), r.payee, idempotencyKey, `Payment released to ${r.payee} after verification PASS.`);
    });
    if (this.loseNextReleaseAck) {
      this.loseNextReleaseAck = false;
      throw new LostAckError("simulated network timeout after release committed (acknowledgement lost)");
    }
    return receipt;
  }

  refund(reservationId: string, idempotencyKey: string): Receipt {
    return this.idempotent(idempotencyKey, "refund", () => {
      const r = this.getReservation(reservationId);
      if (r.status !== "reserved") throw new LedgerError("BAD_STATE", `cannot refund reservation in status ${r.status}`);
      this.setStatus(reservationId, "refunded");
      return this.entry(r.job_id, r.id, "refund", BigInt(r.amount_micro), null, idempotencyKey, "Reservation refunded to buyer budget. Seller unpaid.");
    });
  }

  hold(reservationId: string, idempotencyKey: string): Receipt {
    return this.idempotent(idempotencyKey, "hold", () => {
      const r = this.getReservation(reservationId);
      if (r.status !== "reserved") throw new LedgerError("BAD_STATE", `cannot hold reservation in status ${r.status}`);
      this.setStatus(reservationId, "held");
      return this.entry(r.job_id, r.id, "hold", BigInt(r.amount_micro), null, idempotencyKey, "Funds frozen pending human review. Neither released nor refunded.");
    });
  }

  /** Reconciliation: look up what actually happened for an idempotency key. */
  lookup(idempotencyKey: string): { status: "succeeded" | "failed" | "pending" | "unknown" | "absent"; receipt: Receipt | null } {
    const row = this.db.prepare("SELECT status, result_json FROM idempotency WHERE key = ?").get(idempotencyKey) as
      | { status: "succeeded" | "failed" | "pending" | "unknown"; result_json: string | null }
      | undefined;
    if (!row) return { status: "absent", receipt: null };
    return { status: row.status, receipt: row.result_json ? (JSON.parse(row.result_json) as Receipt) : null };
  }

  balances(jobId: string): Balances {
    return this.balancesUnsafe(jobId);
  }

  receipts(jobId: string): Receipt[] {
    const rows = this.db.prepare("SELECT receipt_json FROM ledger_entries WHERE job_id = ? ORDER BY created_at, rowid").all(jobId) as { receipt_json: string }[];
    return rows.map((r) => JSON.parse(r.receipt_json) as Receipt);
  }

  getReservationStatus(reservationId: string): ReservationStatus {
    return this.getReservation(reservationId).status;
  }

  // --- internals ---

  private balancesUnsafe(jobId: string): Balances {
    const b = this.db.prepare("SELECT budget_micro FROM budgets WHERE job_id = ?").get(jobId) as { budget_micro: string } | undefined;
    if (!b) throw new LedgerError("NO_BUDGET", `no budget for job ${jobId}`);
    const rows = this.db.prepare("SELECT status, amount_micro FROM reservations WHERE job_id = ?").all(jobId) as { status: ReservationStatus; amount_micro: string }[];
    const sum = (s: ReservationStatus) => rows.filter((r) => r.status === s).reduce((acc, r) => acc + BigInt(r.amount_micro), 0n);
    const budgetMicro = BigInt(b.budget_micro);
    const reservedMicro = sum("reserved");
    const heldMicro = sum("held");
    const releasedMicro = sum("released");
    const refundedMicro = sum("refunded");
    const availableMicro = budgetMicro - reservedMicro - heldMicro - releasedMicro;
    if (availableMicro < 0n) throw new Error(`LEDGER INVARIANT VIOLATED for ${jobId}`);
    return { budgetMicro, availableMicro, reservedMicro, heldMicro, releasedMicro, refundedMicro };
  }

  private getReservation(id: string): ReservationRow {
    const r = this.db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as ReservationRow | undefined;
    if (!r) throw new LedgerError("NOT_FOUND", `reservation ${id} not found`);
    return r;
  }

  private setStatus(id: string, status: ReservationStatus) {
    this.db.prepare("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
  }

  private entry(jobId: string, reservationId: string | null, op: LedgerOp, amount: bigint, payee: string | null, key: string, note: string): Receipt {
    const receipt: Receipt = {
      mode: PAYMENT_MODE,
      receiptId: `sim_${op}_${randomUUID().slice(0, 8)}`,
      op,
      jobId,
      reservationId,
      payee,
      amountMicro: amount.toString(),
      idempotencyKey: key,
      at: nowIso(),
      note: `SIMULATED — ${note}`,
    };
    this.db
      .prepare("INSERT INTO ledger_entries (id, job_id, reservation_id, kind, amount_micro, mode, receipt_json, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(receipt.receiptId, jobId, reservationId, op, amount.toString(), PAYMENT_MODE, JSON.stringify(receipt), receipt.at);
    return receipt;
  }

  /**
   * Executes fn at most once per key. The key row and the side effects commit atomically,
   * so a crash can never leave money moved without a recorded key (or vice versa).
   */
  private idempotent(key: string, scope: LedgerOp, fn: () => Receipt): Receipt {
    return tx(this.db, () => {
      const row = this.db.prepare("SELECT scope, status, result_json FROM idempotency WHERE key = ?").get(key) as
        | { scope: string; status: string; result_json: string | null }
        | undefined;
      if (row) {
        if (row.scope !== scope) throw new LedgerError("IDEMPOTENCY_CONFLICT", `key ${key} already used for ${row.scope}`);
        if (row.status === "succeeded" && row.result_json) return JSON.parse(row.result_json) as Receipt;
        throw new LedgerError("BAD_STATE", `key ${key} in status ${row.status}`);
      }
      const receipt = fn();
      const t = nowIso();
      this.db
        .prepare("INSERT INTO idempotency (key, scope, status, result_json, created_at, updated_at) VALUES (?,?,?,?,?,?)")
        .run(key, scope, "succeeded", JSON.stringify(receipt), t, t);
      return receipt;
    });
  }
}

export class LostAckError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "LostAckError";
  }
}
