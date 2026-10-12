import { createHash } from "node:crypto";
import { z } from "zod";

export const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export const SUPPORTED_CHAINS = { 84532: "Base Sepolia" } as const;
export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

/** User-facing job request (validated at the API / CLI boundary). */
export const JobRequestSchema = z.object({
  txHash: z.string().regex(TX_HASH_RE, "txHash must be a 0x-prefixed 32-byte hex string"),
  chainId: z.literal(84532).default(84532),
  budget: z.string().min(1, "budget is required"), // decimal USD string, parsed exactly
  injectSellerAFault: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export type JobRequest = z.input<typeof JobRequestSchema>;

/** Fields the independent verifier checks. Frozen into the contract before work begins. */
export const ACCEPTANCE_FIELDS = ["txHash", "chainId", "from", "to", "blockNumber", "status", "valueWei"] as const;
export type AcceptanceField = (typeof ACCEPTANCE_FIELDS)[number];

export const CONTRACT_VERSION = "garnet.job/1";
export const RESULT_SCHEMA_ID = "garnet.tx-analysis/1";
export const EVALUATOR_ID = "garnet-verifier/viem-rpc@1";

export interface JobContract {
  version: typeof CONTRACT_VERSION;
  jobId: string;
  input: { txHash: `0x${string}`; chainId: SupportedChainId };
  budgetMicro: string; // bigint as string
  deadline: string; // ISO
  acceptanceCriteria: {
    fields: readonly AcceptanceField[];
    rule: string;
  };
  expectedResultSchema: typeof RESULT_SCHEMA_ID;
  evaluator: { id: typeof EVALUATOR_ID; independentOf: "seller"; source: "rpc" | "fixture" };
  idempotencyKey: string;
  createdAt: string;
}

/** Per-attempt engagement: binds one seller + quoted fee to the frozen job contract. */
export interface AttemptContract {
  version: "garnet.engagement/1";
  jobId: string;
  jobContractHash: string;
  attemptSeq: number;
  seller: string;
  quotedFeeMicro: string;
  deadline: string;
  idempotencyKey: string;
}

/** Stable JSON (sorted keys) for hashing. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export const sha256 = (s: string) => "sha256:" + createHash("sha256").update(s).digest("hex");
export const hashOf = (v: unknown) => sha256(canonicalJson(v));

export function buildJobContract(args: {
  jobId: string;
  txHash: string;
  chainId: SupportedChainId;
  budgetMicro: bigint;
  idempotencyKey: string;
  verifierSource: "rpc" | "fixture";
  now?: Date;
  ttlMs?: number;
}): JobContract {
  const now = args.now ?? new Date();
  const contract: JobContract = {
    version: CONTRACT_VERSION,
    jobId: args.jobId,
    input: { txHash: args.txHash.toLowerCase() as `0x${string}`, chainId: args.chainId },
    budgetMicro: args.budgetMicro.toString(),
    deadline: new Date(now.getTime() + (args.ttlMs ?? 10 * 60_000)).toISOString(),
    acceptanceCriteria: {
      fields: ACCEPTANCE_FIELDS,
      rule: "Every listed field in the delivered analysis must equal the value independently fetched from the chain. Any mismatch fails. Any field that cannot be independently established is inconclusive; inconclusive work is never paid automatically.",
    },
    expectedResultSchema: RESULT_SCHEMA_ID,
    evaluator: { id: EVALUATOR_ID, independentOf: "seller", source: args.verifierSource },
    idempotencyKey: args.idempotencyKey,
    createdAt: now.toISOString(),
  };
  return Object.freeze(contract);
}
