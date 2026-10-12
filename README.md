# Garnet

**Agents can transact. Every outcome should be provable.**

Garnet is a buyer agent that hires a specialist seller agent to analyse a Base Sepolia transaction, within a user's budget. It **independently verifies** the delivered analysis against the chain, then settles, recovers or escalates the payment based on that evidence.

Built for neatHack 2026.

## What actually works
- Buyer agent with two callable seller adapters (A: $0.40, B: $0.65). Both fetch and transform real Base Sepolia data.
- LLM planner (`claude-opus-5-5`, structured output + Zod) when `ANTHROPIC_API_KEY` is set. Otherwise a **labeled scripted planner** runs. Deterministic guards constrain both.
- Independent verifier (viem, its own RPC client) with PASS / FAIL / INCONCLUSIVE checks per field on txHash, chainId, from, to, blockNumber, status and value.
- **SIMULATED** escrow ledger (bigint micro-USD) with idempotency keys and one release per job enforced by the database.
- Recovery: a demo-labeled fault in Seller A is caught by the verifier. Garnet writes an evidence packet, refunds, and falls back to Seller B under the same budget.
- INCONCLUSIVE results (RPC down, wrong chain) hold the funds and escalate. A lost payment acknowledgement is reconciled by key and never re-sent.
- Persistent, resumable state in SQLite (`node:sqlite`).
- Neatlogs spans for each step (WORKFLOW / AGENT / TOOL / GUARDRAIL), exported when `NEATLOGS_API_KEY` is set.

## Not done / simulated
- Escrow is simulated. No funds move on any chain.
- Not deployed. Local SQLite is for local demo use only.

## Run
```bash
npm install
cp .env.example .env.local      # optional: ANTHROPIC_API_KEY, NEATLOGS_API_KEY, BASE_SEPOLIA_RPC_URL
npm run dev                     # http://localhost:3000 and /demo
npm test                        # vitest
npm run demo -- --scenario recovery          # CLI run against live RPC
npm run demo -- --scenario happy --fixture   # offline
npx tsx scripts/benchmark.ts --n 5           # naive vs Garnet evidence → docs/evidence/
```

Requires Node ≥ 22.5 (built-in `node:sqlite`). Developed on Node 26.

## API
- `POST /api/jobs` `{ txHash, budget, injectSellerAFault?, idempotencyKey? }` → 201 with snapshot (job runs in background)
- `GET /api/jobs/:id` → snapshot · `POST /api/jobs/:id` → idempotent resume
- `GET /api/status` → truthful execution modes

See `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`, `docs/SUBMISSION.md`, `economics/garnet-business-model.md`.
