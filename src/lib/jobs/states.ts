// Explicit, legal state transitions. Anything not listed here is rejected.

export type JobStatus = "open" | "settled" | "escalated" | "exhausted";
export const TERMINAL_JOB: readonly JobStatus[] = ["settled", "escalated", "exhausted"];

export type AttemptStatus =
  | "contracted" // seller selected, engagement frozen, no funds yet
  | "reserved" // funds reserved in escrow
  | "delivered" // seller returned a result
  | "seller_error" // seller failed to deliver
  | "verified_pass"
  | "verified_fail"
  | "inconclusive"
  | "released" // seller paid (terminal, job settled)
  | "refunded" // reservation returned to buyer (terminal for attempt)
  | "held" // funds frozen pending human review (terminal, job escalated)
  | "settlement_unknown"; // payment outcome not known; must reconcile, never re-send blindly

const ATTEMPT_TRANSITIONS: Record<AttemptStatus, readonly AttemptStatus[]> = {
  contracted: ["reserved", "refunded"],
  reserved: ["delivered", "seller_error"],
  delivered: ["verified_pass", "verified_fail", "inconclusive"],
  seller_error: ["refunded"],
  verified_pass: ["released", "settlement_unknown"],
  verified_fail: ["refunded"],
  inconclusive: ["held"],
  settlement_unknown: ["released", "verified_pass"],
  released: [],
  refunded: [],
  held: [],
};

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  open: ["settled", "escalated", "exhausted"],
  escalated: ["settled"], // only via reconciliation of an unknown settlement that turned out released
  settled: [],
  exhausted: [],
};

export class IllegalTransition extends Error {
  constructor(kind: string, from: string, to: string) {
    super(`Illegal ${kind} transition ${from} -> ${to}`);
    this.name = "IllegalTransition";
  }
}

export function assertAttemptTransition(from: AttemptStatus, to: AttemptStatus) {
  if (!ATTEMPT_TRANSITIONS[from].includes(to)) throw new IllegalTransition("attempt", from, to);
}
export function assertJobTransition(from: JobStatus, to: JobStatus) {
  if (!JOB_TRANSITIONS[from].includes(to)) throw new IllegalTransition("job", from, to);
}
