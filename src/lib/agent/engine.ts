import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { type AttemptContract, type JobContract, JobRequestSchema, type JobRequest, SUPPORTED_CHAINS, buildJobContract, hashOf } from "../jobs/contract";
import { type AttemptRow, JobRepo, type JobRow, type Stage } from "../jobs/repo";
import { TERMINAL_JOB } from "../jobs/states";
import { formatUsd, parseUsd } from "../money";
import { LedgerError, LostAckError, type SimulatedEscrowLedger } from "../payments/ledger";
import type { SellerProvider } from "../providers/types";
import { telemetryStatus, tspan } from "../telemetry/neatlogs";
import type { ChainSource } from "../verification/chain";
import { buildEvidencePacket } from "../verification/evidence";
import { verifyDelivery } from "../verification/verifier";
import { type Observation, type Planner, ScriptedPlanner, guardDecision } from "./planner";

export const GOAL = "Obtain an independently verified analysis of the given transaction at the lowest safe cost within budget.";
const MAX_STEPS = 24;

export interface EngineDeps {
  db: Db;
  repo: JobRepo;
  ledger: SimulatedEscrowLedger;
  sellers: SellerProvider[];
  verifierSource: ChainSource;
  planner: Planner;
}

export class InputError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InputError";
  }
}

const locks = new Map<string, Promise<unknown>>();

export class GarnetEngine {
  constructor(private d: EngineDeps) {}

  get repo() {
    return this.d.repo;
  }

  /** Validate input, create (or return existing, by idempotency key) job. Never moves money twice. */
  createJob(raw: JobRequest): { job: JobRow; created: boolean } {
    const parsed = JobRequestSchema.safeParse(raw);
    if (!parsed.success) throw new InputError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
    const req = parsed.data;
    let budgetMicro: bigint;
    try {
      budgetMicro = parseUsd(req.budget);
    } catch (e) {
      throw new InputError((e as Error).message);
    }
    if (budgetMicro <= 0n) throw new InputError("budget must be greater than $0");
    if (budgetMicro > parseUsd("100")) throw new InputError("demo budget is capped at $100.00");

    const idempotencyKey = req.idempotencyKey ?? `job:${randomUUID()}`;
    const existing = this.d.repo.getJobByKey(idempotencyKey);
    if (existing) {
      const c = JSON.parse(existing.contract_json) as JobContract;
      if (c.input.txHash !== req.txHash.toLowerCase() || c.budgetMicro !== budgetMicro.toString() || !!existing.fault_injection !== req.injectSellerAFault) {
        throw new InputError("idempotency key reused with different job parameters");
      }
      return { job: existing, created: false };
    }

    const jobId = `job_${randomUUID().slice(0, 12)}`;
    const contract = buildJobContract({
      jobId,
      txHash: req.txHash,
      chainId: req.chainId,
      budgetMicro,
      idempotencyKey,
      verifierSource: this.d.verifierSource.kind,
    });
    const contractHash = hashOf(contract);
    this.d.db.exec("BEGIN IMMEDIATE");
    try {
      this.d.repo.insertJob({ id: jobId, idempotencyKey, contract, contractHash, fault: req.injectSellerAFault, planner: this.d.planner.kind });
      this.d.db.exec("COMMIT");
    } catch (e) {
      this.d.db.exec("ROLLBACK");
      throw e;
    }
    this.d.ledger.fundBudget(jobId, budgetMicro, `${jobId}:budget`);
    this.d.repo.addEvent(jobId, "intake", "contract_frozen", `Job contract frozen (${contractHash.slice(0, 19)}…). Budget ${formatUsd(budgetMicro)} recorded in SIMULATED escrow.`, {
      contractHash,
      faultInjection: req.injectSellerAFault,
    });
    if (req.injectSellerAFault) {
      this.d.repo.addEvent(jobId, "intake", "demo_fault_armed", "DEMO ONLY: Seller A fault injection armed. Seller A will corrupt one field; Garnet is not told which.");
    }
    return { job: this.d.repo.getJob(jobId)!, created: true };
  }

  /** Drive a job to a terminal state. Safe to call repeatedly / concurrently / after a restart. */
  async drive(jobId: string): Promise<JobRow> {
    const prev = locks.get(jobId);
    if (prev) {
      await prev.catch(() => {});
      return this.d.repo.getJob(jobId)!;
    }
    const p = this.driveUnlocked(jobId);
    locks.set(jobId, p);
    try {
      return await p;
    } finally {
      locks.delete(jobId);
    }
  }

  private async driveUnlocked(jobId: string): Promise<JobRow> {
    const job = this.d.repo.getJob(jobId);
    if (!job) throw new InputError(`job ${jobId} not found`);
    if (TERMINAL_JOB.includes(job.status)) return job;
    const contract = JSON.parse(job.contract_json) as JobContract;

    return tspan(
      "WORKFLOW",
      "garnet.job",
      {
        input: { jobId, txHash: contract.input.txHash, chain: SUPPORTED_CHAINS[contract.input.chainId], budget: formatUsd(BigInt(contract.budgetMicro)), faultInjection: !!job.fault_injection, paymentMode: this.d.ledger.mode },
        attributes: { "garnet.job_id": jobId, "garnet.payment_mode": this.d.ledger.mode },
        summarize: (j) => ({ jobId, status: j.status, outcome: j.outcome_json ? JSON.parse(j.outcome_json).summary : null }),
      },
      async (h) => {
        if (h.traceId) this.d.repo.setTraceId(jobId, h.traceId);
        for (let i = 0; i < MAX_STEPS; i++) {
          const j = this.d.repo.getJob(jobId)!;
          if (TERMINAL_JOB.includes(j.status)) return j;
          await this.step(j, contract);
        }
        throw new Error(`job ${jobId} did not converge within ${MAX_STEPS} steps`);
      },
    );
  }

  /** One state-machine step, decided purely from persisted state (so restarts resume correctly). */
  private async step(job: JobRow, contract: JobContract): Promise<void> {
    const attempts = this.d.repo.attempts(job.id);
    const active = attempts.find((a) => !["refunded"].includes(a.status));
    if (!active) return this.selectNext(job, contract, attempts);

    switch (active.status) {
      case "contracted":
        return this.reserve(job, active);
      case "reserved":
        return this.execute(job, contract, active);
      case "delivered":
        return this.verify(job, contract, active);
      case "verified_pass":
        return this.release(job, active);
      case "settlement_unknown":
        return this.reconcile(job, active);
      case "verified_fail":
      case "seller_error":
        return this.disputeAndRefund(job, active);
      case "inconclusive":
        return this.holdAndEscalate(job, active);
      case "released":
        return this.finalize(job, "settled", active);
      case "held":
        return this.finalize(job, "escalated", active);
    }
  }

  private observation(job: JobRow, contract: JobContract, attempts: AttemptRow[]): Observation {
    const b = this.d.ledger.balances(job.id);
    return {
      goal: GOAL,
      txHash: contract.input.txHash,
      chainName: SUPPORTED_CHAINS[contract.input.chainId],
      budget: { totalMicro: b.budgetMicro, availableMicro: b.availableMicro },
      providers: this.d.sellers.map((s) => {
        const q = s.quote(contract.input.txHash, contract.input.chainId);
        return { id: s.info.id, name: s.info.name, description: s.info.description, priceMicro: q.priceMicro, etaMs: q.etaMs };
      }),
      history: attempts.map((a) => ({
        seq: a.seq,
        providerId: a.provider_id,
        outcome: a.status,
        detail: a.dispute_json ? `verification ${JSON.parse(a.dispute_json).verdict}; refunded` : a.status,
      })),
    };
  }

  private async selectNext(job: JobRow, contract: JobContract, attempts: AttemptRow[]) {
    const isFallback = attempts.length > 0;
    const stage: Stage = isFallback ? "fallback" : "select_provider";
    this.d.repo.setStage(job.id, stage);

    if (Date.now() > Date.parse(contract.deadline)) {
      this.d.repo.addEvent(job.id, stage, "deadline_passed", "Job deadline passed before a verified delivery. Stopping.");
      return this.finalize(job, "exhausted", null);
    }

    const obs = this.observation(job, contract, attempts);
    if (isFallback) {
      this.d.repo.addEvent(job.id, "fallback", "fallback_started", `Previous attempt rejected. Re-planning under the same budget: ${formatUsd(obs.budget.availableMicro)} of ${formatUsd(obs.budget.totalMicro)} available.`);
    }

    const result = await tspan(
      "AGENT",
      isFallback ? "fallback" : "select_provider",
      {
        input: { goal: obs.goal, available: formatUsd(obs.budget.availableMicro), providers: obs.providers.map((p) => `${p.id}@${formatUsd(p.priceMicro)}`), history: obs.history },
        summarize: (r) => ({ planner: r.planner, model: r.model, decision: r.decision, error: r.error ?? null }),
        attributes: { "garnet.planner": this.d.planner.kind },
      },
      async () => {
        try {
          return await this.d.planner.decide(obs);
        } catch (e) {
          // LLM unavailable/malformed → labeled deterministic fallback, never silent.
          const r = await new ScriptedPlanner().decide(obs);
          return { ...r, error: `LLM planner failed (${(e as Error).message.slice(0, 160)}); used scripted fallback` };
        }
      },
    );
    if (result.planner !== job.planner) this.d.repo.setPlanner(job.id, result.planner);
    if (result.error) this.d.repo.addEvent(job.id, stage, "planner_fallback", result.error);

    const violation = await tspan(
      "GUARDRAIL",
      "budget_and_policy_guard",
      { input: { decision: result.decision, available: formatUsd(obs.budget.availableMicro) }, summarize: (v) => ({ allowed: v === null, violation: v }) },
      async () => guardDecision(result.decision, obs),
    );

    const who = result.planner === "llm" ? `LLM agent (${result.model})` : "Scripted planner (no LLM key)";
    if (violation) {
      this.d.repo.addEvent(job.id, stage, "decision_rejected", `${who} proposed ${result.decision.providerId}; guard rejected: ${violation}.`, result.decision);
      // Deterministic recovery: ask the scripted policy, which cannot violate the guard.
      const safe = await new ScriptedPlanner().decide(obs);
      return this.applyDecision(job, contract, attempts, safe.decision, "scripted", obs);
    }
    this.d.repo.addEvent(job.id, stage, "decision", `${who}: ${result.decision.action === "hire" ? `hire ${result.decision.providerId}` : "stop"} — ${result.decision.reason}`, {
      ...result.decision,
      planner: result.planner,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
    });
    return this.applyDecision(job, contract, attempts, result.decision, result.planner, obs);
  }

  private async applyDecision(job: JobRow, contract: JobContract, attempts: AttemptRow[], decision: { action: string; providerId: string | null; reason: string }, planner: string, obs: Observation) {
    if (decision.action !== "hire" || !decision.providerId) {
      return this.finalize(job, "exhausted", null);
    }
    const provider = obs.providers.find((p) => p.id === decision.providerId)!;
    const seq = attempts.length + 1;
    const attemptId = `att_${job.id.slice(4)}_${seq}`;
    const engagement: AttemptContract = {
      version: "garnet.engagement/1",
      jobId: job.id,
      jobContractHash: job.contract_hash,
      attemptSeq: seq,
      seller: provider.id,
      quotedFeeMicro: provider.priceMicro.toString(),
      deadline: contract.deadline,
      idempotencyKey: `${job.id}:attempt:${seq}`,
    };
    await tspan("TOOL", "create_contract", { input: { attemptId, seller: provider.id, fee: formatUsd(provider.priceMicro) }, summarize: () => ({ engagementHash: hashOf(engagement) }) }, async () => {
      this.d.repo.insertAttempt({ id: attemptId, jobId: job.id, seq, providerId: provider.id, quoteMicro: provider.priceMicro, decision: { ...decision, planner }, engagement });
    });
    this.d.repo.setStage(job.id, "create_contract");
    this.d.repo.addEvent(job.id, "create_contract", "engagement", `Engaged ${provider.name} for ${formatUsd(provider.priceMicro)} (attempt ${seq}). Acceptance criteria unchanged.`, { engagementHash: hashOf(engagement) });
  }

  private async reserve(job: JobRow, a: AttemptRow) {
    this.d.repo.setStage(job.id, "reserve");
    try {
      const { reservationId, receipt } = await tspan(
        "TOOL",
        "reserve",
        { input: { attemptId: a.id, amount: formatUsd(BigInt(a.quote_micro)), mode: this.d.ledger.mode }, summarize: (r) => ({ receiptId: r.receipt.receiptId, mode: r.receipt.mode }) },
        async () => this.d.ledger.reserve(job.id, a.id, a.provider_id, BigInt(a.quote_micro), `${a.id}:reserve`),
      );
      this.d.repo.transitionAttempt(a.id, "reserved", { reservationId });
      this.d.repo.addEvent(job.id, "reserve", "reserved", `SIMULATED escrow reserved ${formatUsd(BigInt(a.quote_micro))} for ${a.provider_id}. Not payable until verification passes.`, receipt);
    } catch (e) {
      if (e instanceof LedgerError && e.code === "BUDGET_EXCEEDED") {
        this.d.repo.transitionAttempt(a.id, "refunded");
        this.d.repo.addEvent(job.id, "reserve", "budget_blocked", `Budget guard blocked reservation: ${e.message}`);
        return;
      }
      throw e;
    }
  }

  private async execute(job: JobRow, contract: JobContract, a: AttemptRow) {
    this.d.repo.setStage(job.id, "seller_execute");
    const seller = this.d.sellers.find((s) => s.info.id === a.provider_id)!;
    const inject = !!job.fault_injection && seller.info.id === "seller-a";
    const r = await tspan(
      "TOOL",
      "seller_execute",
      {
        input: { seller: seller.info.id, txHash: contract.input.txHash, demoFaultInjection: inject },
        summarize: (x) => (x.ok ? { ok: true, latencyMs: x.latencyMs, demoFault: x.demoFault ? `${x.demoFault.field} corrupted (DEMO)` : null } : { ok: false, error: x.error }),
        attributes: { "garnet.seller": seller.info.id },
      },
      async () => seller.execute(contract.input.txHash, contract.input.chainId, { injectFault: inject }),
    );
    if (!r.ok) {
      this.d.repo.transitionAttempt(a.id, "seller_error", { delivery: { error: r.error } });
      this.d.repo.addEvent(job.id, "seller_execute", "seller_error", `${seller.info.name} failed to deliver: ${r.error}`);
      return;
    }
    this.d.repo.transitionAttempt(a.id, "delivered", { delivery: r.delivery });
    this.d.repo.addEvent(job.id, "seller_execute", "delivered", `${seller.info.name} delivered an analysis in ${r.latencyMs} ms. Treating it as untrusted until verified.`, {
      deliveryHash: hashOf(r.delivery),
    });
    if (r.demoFault) {
      // Recorded for audit/UI honesty only. The verifier never reads this.
      this.d.repo.addEvent(job.id, "seller_execute", "demo_fault_applied", `DEMO FAULT INJECTION applied inside Seller A (hidden from verifier): ${r.demoFault.field} ${r.demoFault.original} → ${r.demoFault.injected}.`, r.demoFault);
    }
  }

  private async verify(job: JobRow, contract: JobContract, a: AttemptRow) {
    this.d.repo.setStage(job.id, "verify");
    const delivery = JSON.parse(a.delivery_json!);
    const v = await tspan(
      "GUARDRAIL",
      "verify",
      {
        input: { attemptId: a.id, seller: a.provider_id, evaluator: contract.evaluator.id, source: this.d.verifierSource.kind, fields: contract.acceptanceCriteria.fields },
        summarize: (x) => ({ verdict: x.verdict, checks: x.assertions.map((c) => `${c.field}:${c.result}`), source: x.source ? `${x.source.kind}:${x.source.endpoint}` : null }),
      },
      async () => verifyDelivery(contract, delivery, this.d.verifierSource),
    );
    const to = v.verdict === "PASS" ? "verified_pass" : v.verdict === "FAIL" ? "verified_fail" : "inconclusive";
    this.d.repo.transitionAttempt(a.id, to, { verification: v });
    const fails = v.assertions.filter((x) => x.result === "FAIL");
    const msg =
      v.verdict === "PASS"
        ? `Independent verification PASS: ${v.assertions.length}/${v.assertions.length} fields match ${v.source?.kind} data from ${v.source?.endpoint}.`
        : v.verdict === "FAIL"
          ? `Independent verification FAIL: ${fails.map((f) => `${f.field} expected ${f.expected}, got ${f.actual}`).join("; ")}.`
          : `Verification INCONCLUSIVE: ${v.assertions[0]?.reason ?? "independent source unavailable"}. No payment will be released.`;
    this.d.repo.addEvent(job.id, "verify", `verify_${v.verdict.toLowerCase()}`, msg, { verdict: v.verdict });
  }

  private async disputeAndRefund(job: JobRow, a: AttemptRow) {
    if (a.status === "verified_fail") {
      this.d.repo.setStage(job.id, "create_dispute");
      const v = JSON.parse(a.verification_json!);
      const packet = await tspan(
        "TOOL",
        "create_dispute",
        { input: { attemptId: a.id, seller: a.provider_id }, summarize: (p) => ({ disputeId: p.disputeId, packetHash: p.packetHash, failed: p.failedAssertions.map((f) => f.field) }) },
        async () => buildEvidencePacket({ disputeId: `dsp_${a.id.slice(4)}`, jobId: job.id, attemptId: a.id, seller: a.provider_id, jobContractHash: job.contract_hash, verification: v }),
      );
      // persist the packet before money moves
      this.d.db.prepare("UPDATE attempts SET dispute_json = ? WHERE id = ?").run(JSON.stringify(packet), a.id);
      this.d.repo.addEvent(job.id, "create_dispute", "dispute_created", `Evidence packet ${packet.disputeId} sealed (${packet.packetHash.slice(0, 19)}…): ${packet.rule}`, { packetHash: packet.packetHash });
    }
    this.d.repo.setStage(job.id, "refund_or_release");
    const receipt = await tspan(
      "TOOL",
      "refund_or_release",
      { input: { action: "refund", attemptId: a.id, mode: this.d.ledger.mode }, summarize: (r) => ({ receiptId: r.receiptId, amount: formatUsd(BigInt(r.amountMicro)), mode: r.mode }) },
      async () => this.d.ledger.refund(a.reservation_id!, `${a.id}:refund`),
    );
    this.d.repo.transitionAttempt(a.id, "refunded");
    this.d.repo.addEvent(job.id, "refund_or_release", "refunded", `SIMULATED refund of ${formatUsd(BigInt(receipt.amountMicro))} returned to budget. ${a.provider_id} unpaid.`, receipt);
  }

  private async release(job: JobRow, a: AttemptRow) {
    this.d.repo.setStage(job.id, "refund_or_release");
    const key = `${a.id}:release`; // stable per attempt: retries can never create a second payment
    try {
      const receipt = await tspan(
        "TOOL",
        "refund_or_release",
        { input: { action: "release", attemptId: a.id, payee: a.provider_id, mode: this.d.ledger.mode }, summarize: (r) => ({ receiptId: r.receiptId, amount: formatUsd(BigInt(r.amountMicro)), mode: r.mode }) },
        async () => this.d.ledger.release(a.reservation_id!, key),
      );
      this.d.repo.transitionAttempt(a.id, "released");
      this.d.repo.addEvent(job.id, "refund_or_release", "released", `SIMULATED payment of ${formatUsd(BigInt(receipt.amountMicro))} released to ${a.provider_id} — exactly once, after PASS.`, receipt);
    } catch (e) {
      if (e instanceof LostAckError) {
        this.d.repo.transitionAttempt(a.id, "settlement_unknown");
        this.d.repo.addEvent(job.id, "refund_or_release", "settlement_unknown", `Release outcome unknown (${e.message}). Will reconcile by idempotency key; will NOT send a new payment.`);
        return;
      }
      throw e;
    }
  }

  private async reconcile(job: JobRow, a: AttemptRow) {
    this.d.repo.setStage(job.id, "reconcile");
    const key = `${a.id}:release`;
    const found = await tspan("GUARDRAIL", "reconcile_settlement", { input: { attemptId: a.id, key }, summarize: (f) => ({ status: f.status }) }, async () => this.d.ledger.lookup(key));
    if (found.status === "succeeded") {
      this.d.repo.transitionAttempt(a.id, "released");
      this.d.repo.addEvent(job.id, "reconcile", "reconciled_released", `Reconciliation found release ${found.receipt?.receiptId} already committed. No second payment sent.`, found.receipt);
    } else if (found.status === "absent") {
      this.d.repo.transitionAttempt(a.id, "verified_pass");
      this.d.repo.addEvent(job.id, "reconcile", "reconciled_absent", "Reconciliation found no committed release. Retrying with the SAME idempotency key.");
    } else {
      // unknown/pending: do not guess. Escalate with funds still reserved.
      this.d.repo.addEvent(job.id, "reconcile", "reconcile_unknown", `Settlement state ${found.status}; escalating to human.`);
      return this.finalize(job, "escalated", a);
    }
  }

  private async holdAndEscalate(job: JobRow, a: AttemptRow) {
    this.d.repo.setStage(job.id, "refund_or_release");
    const v = JSON.parse(a.verification_json!);
    const packet = buildEvidencePacket({ disputeId: `esc_${a.id.slice(4)}`, jobId: job.id, attemptId: a.id, seller: a.provider_id, jobContractHash: job.contract_hash, verification: v });
    this.d.db.prepare("UPDATE attempts SET dispute_json = ? WHERE id = ?").run(JSON.stringify(packet), a.id);
    const receipt = await tspan(
      "TOOL",
      "refund_or_release",
      { input: { action: "hold", attemptId: a.id, mode: this.d.ledger.mode }, summarize: (r) => ({ receiptId: r.receiptId, mode: r.mode }) },
      async () => this.d.ledger.hold(a.reservation_id!, `${a.id}:hold`),
    );
    this.d.repo.transitionAttempt(a.id, "held");
    this.d.repo.addEvent(job.id, "refund_or_release", "held", `Funds HELD (${formatUsd(BigInt(receipt.amountMicro))}). Correctness could not be independently established; escalating instead of paying or re-hiring.`, { packetHash: packet.packetHash });
  }

  private async finalize(job: JobRow, status: "settled" | "escalated" | "exhausted", a: AttemptRow | null) {
    await tspan("CHAIN", "finalize", { input: { jobId: job.id, status }, summarize: () => ({ status }) }, async () => {
      const b = this.d.ledger.balances(job.id);
      const attempts = this.d.repo.attempts(job.id);
      const summary =
        status === "settled"
          ? `Verified analysis delivered by ${a!.provider_id}. Paid ${formatUsd(b.releasedMicro)} of ${formatUsd(b.budgetMicro)} budget (SIMULATED).`
          : status === "escalated"
            ? `Escalated for human review. ${formatUsd(b.heldMicro + b.reservedMicro)} held; nothing released.`
            : `No verified delivery within budget. ${formatUsd(b.refundedMicro)} refunded; nothing released.`;
      const outcome = {
        status,
        summary,
        attempts: attempts.length,
        recovered: status === "settled" && attempts.length > 1,
        paidTo: status === "settled" ? a!.provider_id : null,
        balances: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.toString()])),
        paymentMode: this.d.ledger.mode,
        planner: this.d.repo.getJob(job.id)!.planner,
      };
      this.d.repo.finishJob(job.id, status, outcome, a?.id ?? null);
      this.d.repo.addEvent(job.id, "finalize", `job_${status}`, summary);
    });
  }

  /** Full, UI-safe snapshot of a job. */
  snapshot(jobId: string) {
    const job = this.d.repo.getJob(jobId);
    if (!job) return null;
    const contract = JSON.parse(job.contract_json) as JobContract;
    const b = this.d.ledger.balances(jobId);
    return {
      job: {
        id: job.id,
        status: job.status,
        stage: job.stage,
        planner: job.planner,
        faultInjection: !!job.fault_injection,
        contractHash: job.contract_hash,
        traceId: job.trace_id,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        outcome: job.outcome_json ? JSON.parse(job.outcome_json) : null,
      },
      contract,
      providers: this.d.sellers.map((s) => ({ ...s.info, priceMicro: s.info.priceMicro.toString(), price: formatUsd(s.info.priceMicro) })),
      attempts: this.d.repo.attempts(jobId).map((a) => ({
        id: a.id,
        seq: a.seq,
        providerId: a.provider_id,
        quote: formatUsd(BigInt(a.quote_micro)),
        status: a.status,
        decision: JSON.parse(a.decision_json),
        delivery: a.delivery_json ? JSON.parse(a.delivery_json) : null,
        verification: a.verification_json ? JSON.parse(a.verification_json) : null,
        dispute: a.dispute_json ? JSON.parse(a.dispute_json) : null,
      })),
      balances: {
        budget: formatUsd(b.budgetMicro),
        available: formatUsd(b.availableMicro),
        reserved: formatUsd(b.reservedMicro),
        held: formatUsd(b.heldMicro),
        released: formatUsd(b.releasedMicro),
        refunded: formatUsd(b.refundedMicro),
      },
      receipts: this.d.ledger.receipts(jobId),
      events: this.d.repo.events(jobId).map((e) => ({ seq: e.seq, ts: e.ts, stage: e.stage, type: e.type, message: e.message })),
      modes: { payment: this.d.ledger.mode, verifier: this.d.verifierSource.kind, planner: job.planner, telemetry: telemetryStatus() },
    };
  }
}

export type JobSnapshot = NonNullable<ReturnType<GarnetEngine["snapshot"]>>;
