# Garnet architecture

```
 user ──► /demo ──► POST /api/jobs ──► GarnetEngine.createJob  (freeze contract, fund SIMULATED budget)
                                    └► after(): engine.drive(jobId) ──► flush Neatlogs
          poll GET /api/jobs/:id ◄── engine.snapshot(jobId)
```

## Modules (`src/lib`)
| Module | Responsibility |
|---|---|
| `jobs/contract.ts` | Versioned, frozen `JobContract` (jobId, txHash, chainId, budget, deadline, acceptance fields, result schema, evaluator id, idempotency key) and per-attempt `AttemptContract` (seller, quoted fee). Both are hashed with canonical JSON. |
| `jobs/states.ts` | Explicit legal transitions for jobs and attempts. Anything else throws. |
| `jobs/repo.ts` | SQLite persistence of jobs, attempts and the event trail. |
| `agent/planner.ts` | `LlmPlanner` (Claude `claude-opus-5-5`, structured output via `zodOutputFormat`, wrapped by `wrapAnthropic`), `ScriptedPlanner` (labeled fallback), `guardDecision` (deterministic policy). |
| `agent/engine.ts` | Resumable state machine. Each `step()` is decided only from persisted state, so a restart continues where it stopped. |
| `providers/sellers.ts` | Seller A (cheap, supports labeled demo fault: block number +1) and Seller B. Each reads chain data through its **own** source instance and produces `garnet.tx-analysis/1`. |
| `verification/chain.ts` | `RpcChainSource` (viem, Base Sepolia, endpoint host only in evidence), `FixtureChainSource` (real records captured by `scripts/capture-fixture.mjs`), `UnreachableChainSource`. |
| `verification/verifier.ts` | Zod schema check, then a per-field comparison against independently fetched facts. Lookup failure gives INCONCLUSIVE. |
| `verification/evidence.ts` | Hashed dispute/escalation packet. |
| `payments/ledger.ts` | **SIMULATED** escrow: budget / reserve / release / refund / hold. Bigint micro-USD. Each operation is idempotent by key, with the operation and its key committed in one transaction. A unique partial index gives one release per job. |
| `telemetry/neatlogs.ts` | `init` once, then `trace()` spans with curated input/output only. Flush per job on the server; flush and shutdown in `finally` for the CLI. |

## Who decides what
- **LLM:** which seller to hire next, with a reason.
- **Code:** whether that choice is allowed (known seller, not previously attempted, within available budget), all ledger movements, verification verdicts, and refund/hold/release. The LLM is never asked about payment.

## Failure handling
| Situation | Behavior |
|---|---|
| Field mismatch | FAIL → evidence packet → refund → fallback planning under the same budget |
| Seller cannot deliver | refund → fallback |
| Verifier RPC down / wrong chain | INCONCLUSIVE → funds **held** → job escalated; no release, no re-hire |
| Release acknowledgement lost | `settlement_unknown` → reconcile by the same idempotency key → never re-sent with a new key |
| Process crash | `drive()` on the same DB resumes from the persisted attempt status |
| Concurrent `drive()` calls | in-process lock per job; DB constraints are the final backstop |
| Remaining budget too small | guard rejects; job `exhausted` with nothing paid |

## Neatlogs span tree (one trace per job)
```
garnet.job (WORKFLOW)
 ├ select_provider (AGENT) [+ LLM span from wrapAnthropic when a key is set]
 ├ budget_and_policy_guard (GUARDRAIL)
 ├ create_contract · reserve · seller_execute (TOOL)
 ├ verify (GUARDRAIL)
 ├ create_dispute · refund_or_release (TOOL)
 ├ fallback (AGENT) → … → refund_or_release (release)
 ├ reconcile_settlement (GUARDRAIL, only on lost ack)
 └ finalize (CHAIN)
```

## Limits
- Escrow is simulated. There is no on-chain settlement yet. A Base Sepolia escrow adapter would implement the same `reserve/release/refund/hold` interface.
- SQLite on the local disk works for a local demo. It is not suitable for serverless deployment without a managed database.
- Verification covers objectively checkable fields only. It does not judge the free-text `summary` or `classification`.
