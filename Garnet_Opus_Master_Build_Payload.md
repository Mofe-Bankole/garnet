# GARNET — OPUS MASTER BUILD PAYLOAD

**neatHack 2026 | Solo builder | October 12, 2026 (WAT)**

**Paste everything below this note into Claude Code or OpenCode with Claude Opus 5.5 selected.** Run the agent from the Garnet repository root. Do not paste credentials into the conversation or commit them. This is an implementation order, not a request for a plan-only response.

---

## ROLE / MISSION

You are the principal engineer, agent architect, design director and QA lead for **Garnet**, a hackathon product. Our objective is to SHIP a compelling, working, independently verifiable demonstration of autonomous agent commerce before the neatHack submission deadline.

**Official project name: Garnet.** Old working names PayProof, AgentRoute and ProofRoute are retired from all user-facing copy.

**Product thesis:** *An agent that can hire or purchase services, work within a user's budget, independently verify what was delivered, and make evidence-backed decisions to settle, recover or escalate.* The user buys an outcome, not a payment receipt.

**Signature line:** **Agents can transact. Every outcome should be provable.**

**Hard deadline:** Monday October 12, 2026. The official planned submission close is **7:25 PM WAT** (11:55 PM IST); the organizers say the *final cutoff is controlled by Discord*. Aim for a feature freeze by **3:30 PM WAT**, allowing time for evidence collection, demo recording, cfo.ai, publication and submission. Read the current clock and adjust priorities accordingly.

**HACKATHON PRIORITY:** working agent (30%), meaningful Neatlogs+Entire+cfo.ai use (25%), 3-minute demo (20%), build in public (15%), usefulness/originality (10%). The project must be coded during this hackathon and have genuine Git history. The final X quote-post is done by the human, not by you.

## WORKING RULES — IMPORTANT

1. **Inspect the repository FIRST.** Report what actually exists, which features already work, which files changed, available environment variables by *name only*, and whether Git is clean. Never assume this is a blank repo. Reuse/fix existing work rather than rebuilding it. Work only in this repository; never overwrite user code blindly.
2. **DO NOT STOP AFTER PLANNING.** Deliver executable vertical slices, run tests and smoke demos, fix defects, make honest incremental commits, then continue to the next milestone. No repeated confirmation requests for routine local development.
3. Do not misrepresent simulated escrow or fault injection as mainnet transactions or real provider outages. Don't invent trace links, transaction hashes, business-model exports, security guarantees, users or audit claims.
4. No mainnet funds, automatic real payments, external account creation, live deployment, public post or irreversible actions without human approval. Testnet integration may be proposed and prepared, but ask before authorizing any value-moving transaction. Default to **simulated escrow** with clearly labeled receipts.
5. Never expose private keys, model keys or credentials in source, UI, trace captures, screenshots or commits. Use `.env.local`, `.gitignore` and `.env.example`. Secrets are server-side only. Use sanitized inputs/outputs in Neatlogs.
6. Keep the code compact and testable. No speculative framework, multi-chain support, full marketplace, auctions, tokenomics, DAO, reputation system, elaborate arbitration or unnecessary Rust.
7. If an external integration is blocked, create a genuine adapter boundary and use a prominently labeled simulator. Do not stall the working core. Be candid about the limitation.
8. Use current official docs for SDK calls and protocol behavior. Never guess imports, CLI flags or API contracts.

## NON-NEGOTIABLE CORE MVP — ONE USE CASE

Build a *goal-driven buyer agent* that buys a **verifiable blockchain transaction analysis** from a specialist seller agent.

**User input:** an EVM testnet transaction hash (prefer Base Sepolia), a maximum budget, and an optional **Inject Seller A Error — demo only** switch.

**Services:** exactly TWO independently callable seller service adapters, A and B, each with clear pricing and response schemas. A is normally capable of returning correct data but can be configured to return a deliberately wrong field in demo mode. B is an alternative provider. Seller logic must actually retrieve/transform chain data or fixtures, not just return prewritten prose.

**Agent's genuine autonomy:** Given the task, providers, quotes, budget and observations, the buyer agent uses the available LLM (Claude Opus 5.5 via `@anthropic-ai/sdk`, if configured) to choose a provider and a next action after failures; use structured tool calls or constrained JSON with Zod parsing. Record reasons for choices. **Deterministic application code** alone enforces spending caps, job-state transitions, idempotency and independent verification. Never let the LLM unilaterally approve a disputed payment or override budget policy. A deterministic scripted fallback is allowed in fixture mode but must be explicitly labeled, and the actual LLM agent must be demonstrated if credentials work.

**Job contract:** immutable versioned record containing jobId, input txHash, chainId, budget, quoted fee, seller, deadline, acceptance criteria, expected result schema, evaluator identity and idempotency key. Freeze the acceptance criteria before work starts.

**Independent verifier:** use `viem` to independently fetch the transaction and receipt through a configured RPC (or explicit offline fixture test mode). Compare normalized expected vs delivered fields, including transaction hash, from/to, block number, status and value; ERC-20 log checks only if safe and practical. For each assertion produce `PASS | FAIL | INCONCLUSIVE`, expected/actual, reliable source and reason. NEVER infer correctness merely from the seller output or another model's opinion. A failed RPC is **inconclusive**, not a pass.

**Payment/accounting:** implement an *explicitly simulated* escrow ledger first. Use integer minor units / bigint or exact decimal arithmetic, not floating-point money. State must distinguish available funds, reserved liability, released funds, and refunded funds. Record transaction-like receipts clearly marked `SIMULATED`. No duplicate debit on retries. Only pay a seller after verification passes. For invalid work, create evidence and follow configured rejection/refund rules; for unknown facts or uncertain settlement, ESCALATE and do not blindly retry/fund again. Total paid + outstanding reservations must never exceed the original budget. If real testnet escrow can be reliably added *after* the core works, create a separately labeled Base Sepolia adapter behind the same interface, verify on-chain receipts, and require explicit approval for value-moving operations; ERC-8183-style escrow is a stretch goal, not a prerequisite.

**Happy path:** Buyer chooses seller → reserves simulated funds → seller delivers correct structured data → verifier independently passes → one payment releases → show verified report and evidence.

**Failure/recovery path:** Buyer selects Seller A → demo fault injects one incorrect field → independent checks FAIL → create a timestamped evidence packet and reject/refund simulated reservation → buyer selects Seller B under the same global budget → Seller B delivers valid data → verify PASS → release funds once → show final report and recovery history. An *INCONCLUSIVE* run must never trigger an unearned release or unguarded duplicate payment.

**Persistent state:** job records, provider attempts, ledger movements, events, acceptance criteria, verification results, dispute packets and idempotency keys must survive a process restart. SQLite is fine for a **local demo**. If deploying to serverless/Vercel, do not use ephemeral local SQLite for production persistence: choose an available managed database or keep the demonstrable version local. Implement explicit legal transitions; one final settlement per job.

## NEATLOGS / ENTIRE / CFO.AI — MUST NOT BE DECORATIVE

**Neatlogs**: install its current TypeScript SDK from `neatlogs`. Initialize with `await init({ apiKey, workflowName: 'garnet' })`, instrument one top-level `WORKFLOW` per run, `AGENT` planning, `TOOL` provider quote/execution/payment, and `GUARDRAIL` verification/budget checks. Use `wrapAnthropic()` where the model client is compatible. Trace: `select_provider`, `create_contract`, `reserve`, `seller_execute`, `verify`, `create_dispute`, `refund_or_release`, `fallback`, `finalize`. Follow documented lifecycle: short-lived CLI flush/shutdown in `finally`; server runtime initialization once and safe flushing. Explicitly turn off captured inputs/outputs for sensitive spans or use a mask. Record actual failed and successful/improved traces and their verifiable identifiers, not imagined screenshots. See https://docs.neatlogs.com/sdk/typescript.

**Entire**: configure the current official integration for the coding agent/repository, save real checkpoints representing engineering decisions and a recovery improvement, and preserve true Git commit history. If automatic integration can't work, document exact manual steps and mark it blocked, not completed.

**cfo.ai**: produce `economics/garnet-business-model.md` with pricing model, customer segment, plausible adoption scenarios (100/1,000/10,000 jobs), seller payments, transaction fees, RPC/infrastructure, model usage, disputes, gross margins and runway assumptions. The user must create an **actual cfo.ai plan/export or screenshot** in the sponsor product; do not forge one or claim a Markdown file fulfills the sponsor requirement.

**Prove improvement**: capture an initial failure or naive unsafe path, make a real code/config correction, then compare repeatable before/after tests and Neatlogs traces. Report actual N/N recovery rate, duplicates, false acceptance, latency and spending; do not fabricate numbers.

## PRODUCT EXPERIENCE — PREMIUM GARNET BRAND

Visual inspiration is **ONLY Tempo and Kepler** (not generic fintech galleries):
- https://www.seesaw.website/websites/tempo and https://tempo.xyz/
- https://www.seesaw.website/websites/keplr and https://www.kepler.ai/

Study their composition, editorial rhythm, restrained motion, typographic hierarchy and product-as-proof storytelling. Do NOT reproduce layouts, assets, trademarks or source code. Produce Garnet's own design system and visually distinctive identity.

**Design language:** editorial finance/infrastructure, restrained and highly crafted. Dark graphite `#19171B`, deep garnet `#982E48`, vivid garnet `#B7455D`, warm ivory `#F7EFEA`, soft rose `#E68B9B`; strong typography (legible sans for UI, modest elegant serif for editorial moments, mono for technical details), thin structural lines, subtle geometric/faceted gemstone accents; purposeful animation, high contrast, clean spacing. Avoid generic purple-glow AI landing pages, hovering crypto coins, gratuitous gradients, heavy WebGL/3D, giant fake dashboards and stock photos.

**Landing page `/'`:**
1. Responsive brand navbar (Garnet wordmark/geometry, Product, How it works, GitHub, **Launch Demo**).
2. Hero: **“Agents can transact. Every outcome should be provable.”** Supporting copy explains *agent hiring, independent verification and payment decisions* in plain English; CTA **Launch live demo** (only call it live if actually live) and **See proof**.
3. Signature centerpiece: a visually gorgeous **agent execution console** embedded in the hero or just beneath it, using actual recent run data when available; otherwise unmistakably labeled **Illustrative demo**. Show chosen seller, budget, payment/escrow mode, evidence checks, failure/recovery and final status. This is the memorable piece judges should screenshot.
4. Problem section: payment success is not proof of completed work.
5. Three-step system: **Select → Verify → Settle/Recover**. Include concise diagrams/animations.
6. Proof and safety section: explain budget guardrails, independent receipts, evidence packets, and honest simulated-vs-testnet distinctions.
7. Developer mini-section: how agent, verifier, escrow adapter and Neatlogs fit together; link actual repo.
8. Focused final CTA, minimal footer.

**Application `/demo`:** an accessible responsive dashboard with transaction-hash input, budget input, fault-injection switch, **Run Agent**, readable current stage, agent choices, provider quotes, ledger balances, delivery, individual verification checks, outcome and a collapsible evidence trail. Use polling or SSE only if it works reliably; otherwise run server action/API and display results. No inert buttons. Correct empty, loading, error and completed states. Never expose credentials in browser code. A demo reset/replay should be safe and idempotent.

**Branding:** all public-facing names are Garnet, not PayProof, AgentRoute or ProofRoute. Ensure page metadata, favicon/monogram, OpenGraph description and README align. Any proposed emblem must be original and recognizably garnet-inspired but not overly literal.

**Accessibility/quality:** mobile-first 360px layout, desktop 1440px, no horizontal overflow, working keyboard navigation, semantic HTML, visibly focused buttons, prefers-reduced-motion support, lightweight assets, fast first load. No invented customer logos, partners, audits, performance metrics or testimonials. If the backend is incomplete, be explicit rather than masking it with a fabricated UI.

## STACK / MODULES

Prefer Next.js App Router + TypeScript strict mode + Tailwind + Zod + viem + Vitest and the smallest viable persistence library. Anthropic client with model `claude-opus-5-5` when configured. Avoid adding package ecosystems unless required. Suggested module separation, adapt to current repo:
- `src/lib/agent/` planner, constrained action loop, tool definitions
- `src/lib/providers/` two seller adapters and quoted capabilities
- `src/lib/jobs/` immutable contracts and states
- `src/lib/payments/` ledger, payment adapter, idempotency
- `src/lib/verification/` RPC verifier, evidence and dispute
- `src/lib/telemetry/` Neatlogs instrumentation
- `src/app/` Garnet marketing route and interactive demo
- `tests/` happy/failure/restart/budget/verification
- `economics/` cfo.ai planning input
- `docs/` architecture, demo and submission proofs

Deploy only after confirming safe env configuration, persistent storage and explicit human authorization. If the user has an existing Next.js codebase, extend it; do not scaffold over it.

## EXECUTION CHECKPOINTS — DO THESE IN ORDER

**P0: Inspect + smoke (target <25 min)**
- Inventory repository, package scripts, source, Git, keys by name only, and existing working behavior.
- Verify docs as needed, identify fastest viable path, create a concise `BUILD_STATUS.md` (not a lengthy speculative architecture report).
- If no app exists, scaffold minimum TypeScript Next.js app. Start dev server and run a smoke check.
- Report status in four headings: Implemented / Verified / Simulated / Blocked. Commit working changes.

**P1: Runnable vertical slice (highest priority)**
- Contract schema, two callable providers, buyer agent, RPC/fixture verifier, simulated ledger, minimal API/CLI flow and persistent jobs.
- Run happy path with verified transaction source, log evidence, enforce budget. No landing-page rabbit hole yet.
- Add tests, fix errors, commit.

**P2: Failure/recovery + Neatlogs**
- Introduce clearly labeled Seller A fault injection, true independent detection, disputed/rejected work, budget-safe fallback to Seller B, successful final verification.
- Implement Neatlogs tracing and get real traces into the dashboard; log identifiers. Fix one demonstrable issue and capture comparable before/after run evidence.
- Confirm replay/idempotency and unknown-payment handling, commit.

**P3: Garnet UI and premium landing page**
- Follow Tempo × Kepler direction above. Build one polished mobile-ready marketing page and a real clickable demo page; connect hero execution proof to functioning state.
- Prioritize hero, original wordmark, execution console, functioning CTA, demo readability, then supporting sections. Timebox design refinement to ~2 hours once P1/P2 work.
- Test layout at 360px and 1440px, reduced motion, broken links and metadata, commit.

**P4: Sponsor proof + optional transaction adapter**
- Verify Entire checkpoints/graph, capture actual Neatlogs traces, prepare cfo.ai inputs and guide the human to create real plan evidence. Optional Base Sepolia settlement only if all core functionality is stable and enough time remains; otherwise keep clearly labeled simulation.
- Ensure all claims match implemented functionality, commit.

**P5: Final freeze + submission preparation**
- Run `npm run build`, typecheck, lint (if configured), tests and a real end-to-end demo. Fix severe defects.
- Create `README.md`, `.env.example`, `docs/DEMO_SCRIPT.md` (<=3 minutes with timecodes), `docs/SUBMISSION.md` (repo URL, demo URL, evidence links, known limits, checkboxes for manual actions), `economics/garnet-business-model.md`, and `docs/ARCHITECTURE.md`.
- Record instructions for the user to capture demo with an actual result and explain Neatlogs, Entire and cfo.ai. Prepare short genuine #neatHack public updates and a **quote-post draft** for the organizer's official submission post. DO NOT publish automatically.
- Stop feature work before the deadline; preserve a working demo. Do not claim a video was recorded, plan was exported, X was posted, or project submitted unless the human actually did it.

## ACCEPTANCE TESTS — NON-NEGOTIABLE

- Correct work verifies PASS and releases exactly one simulated payment.
- Incorrect transaction fields FAIL with independently sourced evidence.
- RPC unreachable / bad chain / indeterminate data => INCONCLUSIVE, no unsafe payment release.
- Fault injection is labeled and visibly detected.
- Seller A reject/refund + Seller B success happens under one original budget.
- Repeated funding/release requests and agent restarts never double-pay.
- Payment invariants hold with parallel/repeated callbacks.
- Invalid inputs and missing keys yield controlled errors, not silent crashes.
- All displayed claims of real vs simulated execution are accurate.
- Neatlogs trace of a real app run exists (if API key provided) and can be located.
- Marketing CTA opens working `/demo`; mobile UI remains usable.
- Run and show exact commands and outcomes for tests, build and smoke.

## RESEARCH LINKS (OFFICIAL PRIMARY SOURCES)

- Hackathon rules: https://neatlogs.com/hackathon
- Neatlogs TS SDK: https://docs.neatlogs.com/sdk/typescript
- Claude model ID: https://platform.claude.com/docs/en/models/opus-5-5/overview
- ERC-8183: https://ercs.ethereum.org/ERCS/erc-8183
- Reference implementation: https://github.com/erc8183/erc8183-reference
- Tempo design: https://www.seesaw.website/websites/tempo and https://tempo.xyz/
- Kepler design: https://www.seesaw.website/websites/keplr and https://www.kepler.ai/
- cfo.ai: https://cfo.ai/

## EXECUTION PROTOCOL / START NOW

At the beginning, return only a concise repo inventory, current milestone, the first exact command or edit you will perform, and any **single genuinely blocking** credential requirement. Then start implementing immediately. Do not deliver a proposal instead of code. After each checkpoint, report: files changed, tests and commands run, what's actually verified, what's simulated, what's blocked, commit hash, and the next action. Proceed automatically through routine coding tasks without waiting for repeated confirmation. Do not fake status or force irreversible financial/deployment/publishing actions.

**Protect the core above all else: one buyer agent, two seller providers, objective independent verification, budget-safe settlement/recovery, an actual Neatlogs trace, and a demo that proves it. Garnet's beautiful landing page should amplify that working proof, never replace it.**

**BEGIN P0 AND IMPLEMENT NOW.**
