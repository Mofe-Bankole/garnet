# Garnet — business model inputs (for cfo.ai)

> These are **planning assumptions**, not measured results or real customers. Use this file as the input for an actual plan in cfo.ai (https://cfo.ai/). A Markdown file does not by itself meet the sponsor requirement. The human must create the cfo.ai plan or export and attach it.

## Product and customer
- **What is sold:** verified outcomes for agent-to-agent purchases. Garnet sits between a buyer agent and seller agents. It enforces the budget, verifies delivery independently, and settles or recovers payment.
- **Initial segment:** teams building autonomous agents that buy data or API work, such as onchain analytics, research agents and wallet-ops agents, and that need audit trails before they let agents spend money.
- **Later segment:** agent marketplaces that want a neutral evaluator/escrow layer.

## Pricing model (assumption)
| Line | Assumption |
|---|---|
| Take rate on verified settlements | 3.0% of seller fee |
| Per-job verification fee | $0.02 per job (covers RPC + compute) |
| Platform plan | $49 / month per team (dashboards, evidence export, trace links) |
| Disputes | No extra fee to buyer; seller pays $0.05 per rejected delivery (evidence packet) |

## Unit costs (assumption — replace with your own quotes)
| Cost | Per job | Notes |
|---|---|---|
| RPC calls (verifier: chainId + tx + receipt) | ~$0.0005 | 3 calls; public/free tier at small volume |
| LLM planning (Claude Opus 5.5, ~1.5k in / 300 out tokens, 1–2 calls) | ~$0.012–0.024 | $4/MTok in, $20/MTok out (published pricing) |
| Infra (DB, hosting, Neatlogs) | ~$0.002 | amortized |
| Avg seller fee paid through Garnet | $0.50 | demo quotes: $0.40 / $0.65 |
| Dispute rate | 10% | demo fault rate is synthetic; real rate unknown |

## Scenarios (monthly, to model in cfo.ai)
| Jobs / month | Seller volume | Take (3%) | Verify fees | Dispute fees | Plans | Revenue | Variable cost | Gross margin |
|---|---|---|---|---|---|---|---|---|
| 100 | $50 | $1.50 | $2 | $0.50 | 1 × $49 | ~$53 | ~$2.70 | ~95% |
| 1,000 | $500 | $15 | $20 | $5 | 5 × $49 | ~$285 | ~$27 | ~90% |
| 10,000 | $5,000 | $150 | $200 | $50 | 25 × $49 | ~$1,625 | ~$270 | ~83% |

Variable cost uses $0.027/job (LLM $0.024 at the upper bound, plus RPC and infra). It excludes seller fees, which pass through.

## Runway assumptions
- Solo founder, $0 salary during the hackathon/MVP phase; fixed infra ~$40/month.
- Break-even on fixed infra at roughly the 100-jobs/month scenario plus one plan.
- Biggest sensitivities: LLM cost per decision (can drop with a cheaper planner model or the scripted policy for simple cases), the real dispute rate, and the take rate that sellers will accept.

## Known unknowns
- Real demand and willingness to pay. Not yet validated with any user.
- On-chain escrow gas costs. Not modeled; escrow is simulated today.
- Liability for wrong PASS verdicts. Today these are limited to objectively checkable fields.
