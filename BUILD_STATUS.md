# Garnet — Build Status

_Last updated: P0 (2026-10-12, ~01:15 WAT)_

## Inventory at start
- Folder contained only `Garnet_Opus_Master_Build_Payload.md`. No app code.
- The folder sat inside an unrelated home-directory dotfiles Git repo (`/home/mofebanks`). Garnet now has its **own** Git repo (`main`) so history is genuine and isolated.
- Env vars present (names only): none relevant. `ANTHROPIC_API_KEY`, `NEATLOGS_API_KEY`, `BASE_SEPOLIA_RPC_URL` are **not set**.
- Tooling: Node 26.10 (built-in `node:sqlite`), npm 12, `gh` installed, `entire` CLI **not installed**.

## Implemented
- Next.js 16.4 App Router + TypeScript strict + Tailwind 4 scaffold (Cache Components on by default).
- Deps: zod, viem, @anthropic-ai/sdk, neatlogs 1.1.28, vitest, tsx.
- `.env.example`, `.gitignore` (env + local DB excluded), scripts `typecheck`, `test`, `demo`.

## Verified
- `next dev` serves `/` with HTTP 200.

## Simulated
- Nothing yet. Escrow will be an explicitly SIMULATED ledger.

## Blocked / needs human
- `ANTHROPIC_API_KEY` — required to demonstrate the real LLM agent (scripted fallback otherwise, labeled).
- `NEATLOGS_API_KEY` — required for real traces.
- Entire CLI not installed — needs human install/auth.
- cfo.ai plan must be created by the human in the sponsor product.

## Plan
P1 vertical slice → P2 recovery + Neatlogs → P3 UI → P4 sponsor proof → P5 freeze.
