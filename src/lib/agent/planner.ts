import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { formatUsd } from "../money";
import { wrapModelClient } from "../telemetry/neatlogs";

/** What the buyer agent sees. All money already formatted; no secrets. */
export interface Observation {
  goal: string;
  txHash: string;
  chainName: string;
  budget: { totalMicro: bigint; availableMicro: bigint };
  providers: { id: string; name: string; description: string; priceMicro: bigint; etaMs: number }[];
  history: { seq: number; providerId: string; outcome: string; detail: string }[];
}

export const DecisionSchema = z.object({
  action: z.enum(["hire", "stop"]),
  providerId: z.string().nullable().describe("Provider to hire when action is hire, else null"),
  reason: z.string().describe("One or two sentences explaining the choice, citing price, budget and history"),
});
export type Decision = z.infer<typeof DecisionSchema>;

export interface PlannerResult {
  decision: Decision;
  planner: PlannerKind;
  model: string | null;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export type PlannerKind = "llm" | "scripted";

export interface Planner {
  kind: PlannerKind;
  decide(obs: Observation): Promise<PlannerResult>;
}

const SYSTEM = `You are Garnet's buyer agent. You hire specialist seller agents to deliver a verified blockchain transaction analysis for a user.
Rules you must follow:
- You may only hire a provider listed in "providers" whose price is <= the available budget.
- Do not re-hire a provider whose previous attempt failed verification or errored.
- You do NOT approve payments. An independent verifier and deterministic escrow rules decide payment after delivery.
- If no eligible provider remains, choose action "stop".
- Prefer the lowest price among eligible providers unless history gives a reason not to.
Respond only with the requested JSON.`;

function render(obs: Observation): string {
  return JSON.stringify(
    {
      goal: obs.goal,
      txHash: obs.txHash,
      chain: obs.chainName,
      budget: { total: formatUsd(obs.budget.totalMicro), available: formatUsd(obs.budget.availableMicro) },
      providers: obs.providers.map((p) => ({ id: p.id, name: p.name, description: p.description, price: formatUsd(p.priceMicro), etaMs: p.etaMs })),
      history: obs.history,
    },
    null,
    2,
  );
}

export class LlmPlanner implements Planner {
  readonly kind = "llm" as const;
  private client: Anthropic;
  constructor(
    apiKey: string,
    readonly model: string = process.env.GARNET_MODEL || "claude-opus-5-5",
  ) {
    this.client = wrapModelClient(new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 }));
  }

  async decide(obs: Observation): Promise<PlannerResult> {
    const t0 = Date.now();
    const msg = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(DecisionSchema) },
      messages: [{ role: "user", content: `Decide the next action.\n\n${render(obs)}` }],
    });
    const parsed = msg.parsed_output;
    if (!parsed) throw new Error(`model returned no parseable decision (stop_reason=${msg.stop_reason})`);
    return {
      decision: DecisionSchema.parse(parsed),
      planner: "llm",
      model: this.model,
      latencyMs: Date.now() - t0,
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
    };
  }
}

/** Deterministic fallback. Clearly labeled "scripted" everywhere it appears. */
export class ScriptedPlanner implements Planner {
  readonly kind = "scripted" as const;
  async decide(obs: Observation): Promise<PlannerResult> {
    const tried = new Set(obs.history.map((h) => h.providerId));
    const eligible = obs.providers
      .filter((p) => !tried.has(p.id) && p.priceMicro <= obs.budget.availableMicro)
      .sort((a, b) => (a.priceMicro < b.priceMicro ? -1 : a.priceMicro > b.priceMicro ? 1 : 0));
    const pick = eligible[0];
    return {
      decision: pick
        ? { action: "hire", providerId: pick.id, reason: `Scripted policy: cheapest untried provider within budget (${formatUsd(pick.priceMicro)} of ${formatUsd(obs.budget.availableMicro)} available).` }
        : { action: "stop", providerId: null, reason: "Scripted policy: no untried provider fits the remaining budget." },
      planner: "scripted",
      model: null,
      latencyMs: 0,
    };
  }
}

export function createPlanner(): Planner {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new LlmPlanner(key) : new ScriptedPlanner();
}

/**
 * Deterministic guard on any planner output. The LLM proposes; code disposes.
 * Returns null if the decision is acceptable, else the reason it was rejected.
 */
export function guardDecision(d: Decision, obs: Observation): string | null {
  if (d.action === "stop") return null;
  const p = obs.providers.find((x) => x.id === d.providerId);
  if (!p) return `unknown provider "${d.providerId}"`;
  if (obs.history.some((h) => h.providerId === p.id)) return `provider ${p.id} was already attempted for this job`;
  if (p.priceMicro > obs.budget.availableMicro) return `price ${formatUsd(p.priceMicro)} exceeds available ${formatUsd(obs.budget.availableMicro)}`;
  return null;
}
