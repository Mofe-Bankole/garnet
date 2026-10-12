import { type Db, nowIso } from "../db";
import type { EvidencePacket } from "../verification/evidence";
import type { Verification } from "../verification/verifier";
import type { AttemptContract, JobContract } from "./contract";
import { type AttemptStatus, type JobStatus, assertAttemptTransition, assertJobTransition } from "./states";

export type Stage =
  | "intake"
  | "select_provider"
  | "create_contract"
  | "reserve"
  | "seller_execute"
  | "verify"
  | "create_dispute"
  | "refund_or_release"
  | "reconcile"
  | "fallback"
  | "finalize";

export interface JobRow {
  id: string;
  idempotency_key: string;
  status: JobStatus;
  stage: Stage;
  contract_json: string;
  contract_hash: string;
  fault_injection: number;
  planner: string;
  final_attempt_id: string | null;
  outcome_json: string | null;
  trace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptRow {
  id: string;
  job_id: string;
  seq: number;
  provider_id: string;
  quote_micro: string;
  status: AttemptStatus;
  decision_json: string;
  delivery_json: string | null;
  verification_json: string | null;
  dispute_json: string | null;
  reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  job_id: string;
  seq: number;
  ts: string;
  stage: Stage;
  type: string;
  message: string;
  data_json: string | null;
}

export class JobRepo {
  constructor(private db: Db) {}

  insertJob(j: { id: string; idempotencyKey: string; contract: JobContract; contractHash: string; fault: boolean; planner: string }) {
    const t = nowIso();
    this.db
      .prepare(
        "INSERT INTO jobs (id, idempotency_key, status, stage, contract_json, contract_hash, fault_injection, planner, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .run(j.id, j.idempotencyKey, "open", "intake", JSON.stringify(j.contract), j.contractHash, j.fault ? 1 : 0, j.planner, t, t);
  }

  getJob(id: string): JobRow | undefined {
    return this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  }
  getJobByKey(key: string): JobRow | undefined {
    return this.db.prepare("SELECT * FROM jobs WHERE idempotency_key = ?").get(key) as JobRow | undefined;
  }
  listJobs(limit = 20): JobRow[] {
    return this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC, rowid DESC LIMIT ?").all(limit) as unknown as JobRow[];
  }

  setStage(id: string, stage: Stage) {
    this.db.prepare("UPDATE jobs SET stage = ?, updated_at = ? WHERE id = ?").run(stage, nowIso(), id);
  }
  setPlanner(id: string, planner: string) {
    this.db.prepare("UPDATE jobs SET planner = ?, updated_at = ? WHERE id = ?").run(planner, nowIso(), id);
  }
  setTraceId(id: string, traceId: string) {
    this.db.prepare("UPDATE jobs SET trace_id = COALESCE(trace_id, ?), updated_at = ? WHERE id = ?").run(traceId, nowIso(), id);
  }

  finishJob(id: string, to: JobStatus, outcome: unknown, finalAttemptId: string | null) {
    const j = this.getJob(id)!;
    if (j.status !== to) assertJobTransition(j.status, to);
    this.db
      .prepare("UPDATE jobs SET status = ?, stage = 'finalize', outcome_json = ?, final_attempt_id = ?, updated_at = ? WHERE id = ?")
      .run(to, JSON.stringify(outcome), finalAttemptId, nowIso(), id);
  }

  insertAttempt(a: { id: string; jobId: string; seq: number; providerId: string; quoteMicro: bigint; decision: unknown; engagement: AttemptContract }) {
    const t = nowIso();
    this.db
      .prepare(
        "INSERT INTO attempts (id, job_id, seq, provider_id, quote_micro, status, decision_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(a.id, a.jobId, a.seq, a.providerId, a.quoteMicro.toString(), "contracted", JSON.stringify({ ...(a.decision as object), engagement: a.engagement }), t, t);
  }
  attempts(jobId: string): AttemptRow[] {
    return this.db.prepare("SELECT * FROM attempts WHERE job_id = ? ORDER BY seq").all(jobId) as unknown as AttemptRow[];
  }
  getAttempt(id: string): AttemptRow {
    return this.db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as unknown as AttemptRow;
  }

  transitionAttempt(
    id: string,
    to: AttemptStatus,
    patch: { reservationId?: string; delivery?: unknown; verification?: Verification; dispute?: EvidencePacket } = {},
  ) {
    const a = this.getAttempt(id);
    assertAttemptTransition(a.status, to);
    this.db
      .prepare(
        `UPDATE attempts SET status = ?,
           reservation_id = COALESCE(?, reservation_id),
           delivery_json = COALESCE(?, delivery_json),
           verification_json = COALESCE(?, verification_json),
           dispute_json = COALESCE(?, dispute_json),
           updated_at = ? WHERE id = ?`,
      )
      .run(
        to,
        patch.reservationId ?? null,
        patch.delivery !== undefined ? JSON.stringify(patch.delivery) : null,
        patch.verification ? JSON.stringify(patch.verification) : null,
        patch.dispute ? JSON.stringify(patch.dispute) : null,
        nowIso(),
        id,
      );
  }

  addEvent(jobId: string, stage: Stage, type: string, message: string, data?: unknown) {
    const row = this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM events WHERE job_id = ?").get(jobId) as { n: number };
    this.db
      .prepare("INSERT INTO events (job_id, seq, ts, stage, type, message, data_json) VALUES (?,?,?,?,?,?,?)")
      .run(jobId, row.n, nowIso(), stage, type, message, data === undefined ? null : JSON.stringify(data, bigintReplacer));
  }
  events(jobId: string): EventRow[] {
    return this.db.prepare("SELECT * FROM events WHERE job_id = ? ORDER BY seq").all(jobId) as unknown as EventRow[];
  }
}

export function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}
