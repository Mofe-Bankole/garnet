import { z } from "zod";
import { RESULT_SCHEMA_ID } from "../jobs/contract";

/** Schema every seller must deliver. Verified structurally before field checks. */
export const TxAnalysisSchema = z.object({
  schema: z.literal(RESULT_SCHEMA_ID),
  provider: z.string(),
  analysis: z.object({
    txHash: z.string(),
    chainId: z.number().int(),
    from: z.string(),
    to: z.string().nullable(),
    blockNumber: z.string().regex(/^\d+$/),
    status: z.enum(["success", "reverted"]),
    valueWei: z.string().regex(/^\d+$/),
    gasUsed: z.string().regex(/^\d+$/),
    logCount: z.number().int().nonnegative(),
    classification: z.enum(["native_transfer", "contract_call", "contract_call_with_value"]),
    methodSelector: z.string(),
    summary: z.string(),
  }),
  producedAt: z.string(),
});
export type TxAnalysis = z.infer<typeof TxAnalysisSchema>;

export interface Quote {
  providerId: string;
  priceMicro: bigint;
  etaMs: number;
  /** What the seller claims; the buyer cannot trust this without verification. */
  claims: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  priceMicro: bigint;
  dataSource: string;
}

export interface ExecuteOptions {
  /** DEMO ONLY: deliberately corrupt one field so the verifier must catch it. */
  injectFault?: boolean;
}

export interface FaultRecord {
  field: string;
  original: string;
  injected: string;
  label: "DEMO FAULT INJECTION";
}

export type ExecuteResult =
  | { ok: true; delivery: unknown; latencyMs: number; demoFault?: FaultRecord }
  | { ok: false; error: string; latencyMs: number };

export interface SellerProvider {
  info: ProviderInfo;
  quote(txHash: string, chainId: number): Quote;
  execute(txHash: string, chainId: number, opts?: ExecuteOptions): Promise<ExecuteResult>;
}
