// Client-side view of GET /api/jobs/:id snapshot (kept structurally loose on purpose).
export interface Assertion {
  field: string;
  result: "PASS" | "FAIL" | "INCONCLUSIVE";
  expected: string | null;
  actual: string | null;
  source: string;
  reason: string;
}

export interface AttemptView {
  id: string;
  seq: number;
  providerId: string;
  quote: string;
  status: string;
  decision: { action: string; providerId: string | null; reason: string; planner?: string };
  delivery: { analysis?: Record<string, unknown>; error?: string } | null;
  verification: { verdict: "PASS" | "FAIL" | "INCONCLUSIVE"; assertions: Assertion[]; source: { kind: string; endpoint: string; fetchedAt: string } | null; deliveryHash: string } | null;
  dispute: { disputeId: string; packetHash: string; decision: string; rule: string; createdAt: string } | null;
}

export interface Snapshot {
  job: {
    id: string;
    status: "open" | "settled" | "escalated" | "exhausted";
    stage: string;
    planner: string;
    faultInjection: boolean;
    contractHash: string;
    traceId: string | null;
    createdAt: string;
    updatedAt: string;
    outcome: { status: string; summary: string; attempts: number; recovered: boolean; paidTo: string | null } | null;
  };
  contract: { input: { txHash: string; chainId: number }; deadline: string; acceptanceCriteria: { fields: string[]; rule: string }; evaluator: { id: string; source: string } };
  providers: { id: string; name: string; description: string; price: string; dataSource: string }[];
  attempts: AttemptView[];
  balances: { budget: string; available: string; reserved: string; held: string; released: string; refunded: string };
  receipts: { mode: string; receiptId: string; op: string; payee: string | null; amountMicro: string; at: string; note: string; idempotencyKey: string }[];
  events: { seq: number; ts: string; stage: string; type: string; message: string }[];
  modes: { payment: string; verifier: string; planner: string; telemetry: { enabled: boolean; reason: string } };
}
