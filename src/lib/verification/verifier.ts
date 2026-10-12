import type { AcceptanceField, JobContract } from "../jobs/contract";
import { hashOf } from "../jobs/contract";
import { TxAnalysisSchema } from "../providers/types";
import type { ChainSource, SourceDescriptor } from "./chain";

export type CheckResult = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface Assertion {
  field: AcceptanceField | "schema";
  result: CheckResult;
  expected: string | null;
  actual: string | null;
  source: string;
  reason: string;
}

export interface Verification {
  verdict: CheckResult;
  evaluator: string;
  source: SourceDescriptor | null;
  assertions: Assertion[];
  deliveryHash: string;
  verifiedAt: string;
}

const norm = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  return String(v).toLowerCase();
};

/**
 * Independently verifies a seller delivery against facts fetched by the verifier's OWN chain source.
 * Never trusts seller output; never consults an LLM. A failed lookup is INCONCLUSIVE, never PASS.
 */
export async function verifyDelivery(contract: JobContract, delivery: unknown, source: ChainSource): Promise<Verification> {
  const verifiedAt = new Date().toISOString();
  const deliveryHash = hashOf(delivery ?? null);
  const evaluator = contract.evaluator.id;

  const parsed = TxAnalysisSchema.safeParse(delivery);
  if (!parsed.success) {
    return {
      verdict: "FAIL",
      evaluator,
      source: null,
      deliveryHash,
      verifiedAt,
      assertions: [
        {
          field: "schema",
          result: "FAIL",
          expected: contract.expectedResultSchema,
          actual: "invalid",
          source: "zod schema",
          reason: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      ],
    };
  }
  const a = parsed.data.analysis;

  const lookup = await source.lookup(contract.input.txHash, contract.input.chainId);
  if (!lookup.ok) {
    const label = `${lookup.source.kind}:${lookup.source.endpoint}`;
    return {
      verdict: "INCONCLUSIVE",
      evaluator,
      source: lookup.source,
      deliveryHash,
      verifiedAt,
      assertions: contract.acceptanceCriteria.fields.map((field) => ({
        field,
        result: "INCONCLUSIVE" as const,
        expected: null,
        actual: norm((a as Record<string, unknown>)[field]),
        source: label,
        reason: `independent lookup ${lookup.reason}: ${lookup.detail}`,
      })),
    };
  }

  const f = lookup.facts;
  const label = `${lookup.source.kind}:${lookup.source.endpoint} @ ${lookup.source.fetchedAt}`;
  const expected: Record<AcceptanceField, string | null> = {
    txHash: contract.input.txHash,
    chainId: String(contract.input.chainId),
    from: f.from,
    to: f.to,
    blockNumber: f.blockNumber,
    status: f.status,
    valueWei: f.valueWei,
  };
  // chainId must also match what the independent source reports.
  if (String(f.chainId) !== String(contract.input.chainId)) expected.chainId = String(f.chainId);
  if (f.txHash !== contract.input.txHash) expected.txHash = f.txHash;

  const assertions: Assertion[] = contract.acceptanceCriteria.fields.map((field) => {
    const exp = norm(expected[field]);
    const act = norm((a as Record<string, unknown>)[field]);
    const pass = exp === act;
    return {
      field,
      result: pass ? "PASS" : "FAIL",
      expected: exp,
      actual: act,
      source: field === "txHash" || field === "chainId" ? `job contract + ${label}` : label,
      reason: pass ? "delivered value equals independently fetched value" : "delivered value differs from independently fetched value",
    };
  });

  const verdict: CheckResult = assertions.some((x) => x.result === "FAIL")
    ? "FAIL"
    : assertions.every((x) => x.result === "PASS")
      ? "PASS"
      : "INCONCLUSIVE";

  return { verdict, evaluator, source: lookup.source, assertions, deliveryHash, verifiedAt };
}
