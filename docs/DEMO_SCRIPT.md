# Garnet — 3-minute demo script

Before recording: `npm run build && npm start` (or `npm run dev`), with `.env.local` containing `ANTHROPIC_API_KEY` and `NEATLOGS_API_KEY` if available. Have the Neatlogs dashboard open in a second tab. Only say "LLM agent" if the modes panel on `/demo` shows `LLM · claude-opus-5-5`.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Landing hero | "Agents can already pay each other. Garnet makes sure they only pay for work that's provably right." |
| 0:15–0:35 | Scroll to the console, then Problem | "A payment receipt only proves money moved. This recorded run shows Seller A returning a wrong block number. Garnet caught it, refunded, and paid Seller B once." |
| 0:35–0:50 | Click **Launch the demo** | Point at the modes panel: "The verifier uses live Base Sepolia RPC. Escrow is simulated, and every receipt says so." |
| 0:50–1:30 | Fault switch ON, **Run Agent** | Narrate the stages: the agent picks the cheapest seller, funds are reserved but not payable, Seller A delivers, and verification fails on `blockNumber`, showing the expected value from the chain next to the delivered one. Then the evidence packet, the refund, and the fallback to Seller B. |
| 1:30–1:50 | Verification table + ledger | "7 of 7 fields pass for B. One release, $0.65. Seller A's $0.40 was refunded. Total spend stayed within the $1.50 budget." |
| 1:50–2:05 | Evidence trail → **Replay safely** | "Replaying is idempotent. Still exactly one release." |
| 2:05–2:35 | Neatlogs dashboard | Open the trace for this job id (`trace …` in the trail): WORKFLOW → AGENT select_provider → TOOL reserve → GUARDRAIL verify FAIL → create_dispute → fallback → verify PASS → release. |
| 2:35–2:50 | Terminal: `docs/evidence/benchmark-*.json` | "Before and after, same scenarios: the naive buyer paid for wrong work 5 times out of 20 and attempted 5 new-key double payments. Garnet had 0 and 0, and recovered from the fault 5 of 5 times." |
| 2:50–3:00 | Landing CTA | "Garnet. Agents can transact. Every outcome should be provable." |

Optional (if time allows): set the budget to `$0.50` with the fault ON to show a budget-safe stop with nothing paid.
