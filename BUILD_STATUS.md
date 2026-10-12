# Garnet — Build Status

_Last updated: 2026-10-12 ~01:55 WAT. P0–P3 done; P4/P5 docs drafted. Waiting on human-provided keys and sponsor actions._

## Implemented
- Frozen job contract + engagement hashes; explicit state machine; SQLite persistence (resumable).
- Seller A / Seller B adapters (real Base Sepolia RPC or captured fixtures). Seller A has a labeled demo fault.
- Independent viem verifier: PASS/FAIL/INCONCLUSIVE per field, with evidence packets.
- SIMULATED escrow ledger: bigint, idempotent, one release per job (DB index), hold on inconclusive, reconcile on lost ack.
- LLM planner (Opus 5.5 structured output) with deterministic guards; labeled scripted fallback.
- Neatlogs instrumentation (WORKFLOW/AGENT/TOOL/GUARDRAIL/CHAIN), sanitized I/O.
- API routes, `/demo` dashboard, landing page (Tempo × Kepler editorial direction, original emblem).
- CLI `npm run demo`, benchmark `scripts/benchmark.ts`.

## Verified (commands run)
- `npm test`: 37/37 pass (happy, recovery, budget stop, RPC down, wrong chain, unknown tx, concurrency, idempotency, crash-restart, lost ack, LLM guard cases, inputs, ledger invariants, span tree).
- `npm run typecheck`, `eslint`: clean. `npm run build`: success.
- Live Base Sepolia RPC recovery run via CLI and API; production-server restart preserved job state with 1 release.
- Browser (Playwright): 360px and 1440px have no horizontal overflow and no console errors; CTA reaches /demo; Run Agent reaches settled; keyboard tab order is correct.
- Benchmark (n=5×4, fixtures): baseline 5 false acceptances / 5 double-pay attempts / 0/5 recovery; Garnet 0 / 0 / 5/5.

## Simulated
- Escrow and payments (all receipts labeled SIMULATED).
- Seller A fault (labeled DEMO FAULT INJECTION).
- Planner is scripted until `ANTHROPIC_API_KEY` is set.

## Blocked / needs human
- `ANTHROPIC_API_KEY`: the real LLM agent has not been demonstrated yet.
- `NEATLOGS_API_KEY`: no real Neatlogs trace exists yet. Instrumentation has only been verified locally (in-memory exporter, doctor --local pass).
- Entire CLI is not installed. Needs a human to install and authenticate.
- cfo.ai plan must be created by the human.
- Code pushed to https://github.com/Mofe-Bankole/garnet (main).
