import { hashOf } from "../jobs/contract";
import type { Verification } from "./verifier";

export interface EvidencePacket {
  kind: "garnet.dispute/1";
  disputeId: string;
  jobId: string;
  attemptId: string;
  seller: string;
  jobContractHash: string;
  deliveryHash: string;
  verdict: Verification["verdict"];
  failedAssertions: Verification["assertions"];
  inconclusiveAssertions: Verification["assertions"];
  source: Verification["source"];
  decision: "reject_and_refund" | "hold_for_review";
  rule: string;
  createdAt: string;
  packetHash: string;
}

export function buildEvidencePacket(args: {
  disputeId: string;
  jobId: string;
  attemptId: string;
  seller: string;
  jobContractHash: string;
  verification: Verification;
}): EvidencePacket {
  const v = args.verification;
  const decision = v.verdict === "FAIL" ? "reject_and_refund" : "hold_for_review";
  const body = {
    kind: "garnet.dispute/1" as const,
    disputeId: args.disputeId,
    jobId: args.jobId,
    attemptId: args.attemptId,
    seller: args.seller,
    jobContractHash: args.jobContractHash,
    deliveryHash: v.deliveryHash,
    verdict: v.verdict,
    failedAssertions: v.assertions.filter((a) => a.result === "FAIL"),
    inconclusiveAssertions: v.assertions.filter((a) => a.result === "INCONCLUSIVE"),
    source: v.source,
    decision,
    rule:
      decision === "reject_and_refund"
        ? "Objective mismatch against independently fetched chain data: reservation refunded to buyer, seller unpaid."
        : "Correctness could not be independently established: funds held, job escalated to a human. No automatic release or re-funding.",
    createdAt: new Date().toISOString(),
  };
  return { ...body, packetHash: hashOf(body) } as EvidencePacket;
}
