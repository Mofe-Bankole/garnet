# Garnet — neatHack 2026 submission checklist

Deadline: Mon 12 Oct 2026, 7:25 PM WAT (final cutoff per Discord). Planned feature freeze: 3:30 PM WAT.

## Links
- Repo: https://github.com/Mofe-Bankole/garnet
- Demo URL: _not deployed. Local demo only, unless the human approves a deployment with a managed DB_
- Demo video: _TODO (human records it using docs/DEMO_SCRIPT.md)_
- Neatlogs trace(s): _TODO: run with `NEATLOGS_API_KEY` set, then paste the trace IDs printed by `npm run demo` and shown in the /demo evidence trail_
- cfo.ai plan: _TODO: human creates it in cfo.ai from economics/garnet-business-model.md_

## Evidence already in the repo
- `docs/evidence/benchmark-*.json`: measured naive-vs-Garnet comparison (offline fixtures of real Base Sepolia records, n=5 × 4 scenarios). Latest: baseline had 5/20 false acceptances, 5 new-key double-pay attempts and 0/5 fault recovery. Garnet had 0/20, 0 and 5/5.
- `src/content/recorded-run.json`: real recovery run against live Base Sepolia RPC (scripted planner, simulated escrow). Shown on the landing page as "RECORDED RUN".
- `npm test`: acceptance tests.

## Manual actions (human only)
- [ ] Add `ANTHROPIC_API_KEY` to `.env.local` and confirm `/api/status` shows `llm`
- [ ] Add `NEATLOGS_API_KEY`, then run `npm run demo -- --scenario recovery` and `npx tsx scripts/benchmark.ts --n 5`; record the trace IDs here
- [ ] Install and enable Entire (https://entire.io) for this repo; save checkpoints; verify the graph
- [ ] Create the cfo.ai plan and attach an export or screenshot
- [x] Code pushed to https://github.com/Mofe-Bankole/garnet
- [ ] Record the ≤3-minute demo
- [ ] Post build-in-public updates and the quote-post (drafts below)
- [ ] Submit the form

## Known limits
- Escrow is simulated. No on-chain settlement.
- Verification covers objective fields only.
- Local SQLite. Not deployed.

## Draft #neatHack posts (do not auto-publish)
1. "Building Garnet for #neatHack: a buyer agent that won't pay another agent until it has independently verified the work against Base Sepolia. The core loop runs: select → verify → settle or recover."
2. "Garnet's naive baseline paid for wrong work 5 of 20 times and tried 5 double-payments after a lost ack. With independent verification and idempotent settlement, that's 0 and 0, and it recovered 5 of 5 times. Neatlogs traces every step. #neatHack"

## Quote-post draft (for the organizer's official post)
"Garnet: agents can transact, and every outcome should be provable. A buyer agent hires a seller within budget, verifies the delivered analysis against the chain itself, refunds and recovers when the work is wrong, and pays exactly once when it's right. Traced end-to-end in Neatlogs. #neatHack [repo] [video]"
