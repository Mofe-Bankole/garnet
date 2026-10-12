import Link from "next/link";
import { Emblem } from "@/components/brand";
import { ExecutionConsole } from "@/components/console";
import { Nav, REPO_URL } from "@/components/nav";
import type { Snapshot } from "@/components/types";
import recorded from "@/content/recorded-run.json";

const run = recorded as unknown as { recordedAt: string; snapshot: Snapshot };

export default function Home() {
  const recordedAt = new Date(run.recordedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return (
    <>
      <Nav current="home" />
      <main id="main">
        {/* ---------- HERO ---------- */}
        <section className="relative overflow-hidden border-b hairline">
          <div className="facet-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-16 sm:pt-24">
            <p className="rise font-mono text-[11px] uppercase tracking-[0.2em] text-rose">Outcome-verified agent commerce</p>
            <h1 className="rise mt-5 max-w-4xl font-serif text-[2.75rem] leading-[0.98] tracking-[-0.02em] sm:text-7xl lg:text-[5.5rem]">
              Agents can transact.
              <br />
              <em className="text-rose">Every outcome</em> should be provable.
            </h1>
            <p className="rise mt-6 max-w-xl text-[17px] leading-relaxed text-ivory/65">
              Garnet is a buyer agent. It hires a specialist agent within your budget, checks the delivered work against an independent source, and only then pays, recovers
              the money, or stops and asks a human.
            </p>
            <div className="rise mt-8 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="rounded-full bg-garnet px-5 py-2.5 text-sm font-medium text-ivory transition hover:bg-garnet-vivid">
                Launch the demo
              </Link>
              <Link href="#proof" className="rounded-full border hairline px-5 py-2.5 text-sm text-ivory/80 transition hover:border-rose/50 hover:text-ivory">
                See proof
              </Link>
              <span className="font-mono text-[11px] text-ivory/40">Base Sepolia · simulated escrow</span>
            </div>

            {/* Signature centerpiece */}
            <div id="product" className="mt-14 scroll-mt-24 sm:mt-20">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px] text-ivory/45">
                <span>Agent execution console</span>
                <span>Recorded run · {recordedAt} · real Base Sepolia data · escrow SIMULATED</span>
              </div>
              <ExecutionConsole snap={run.snapshot} label="RECORDED RUN" />
              <p className="mt-3 font-mono text-[11px] text-ivory/40">
                Seller A delivered a wrong block number (demo fault injection). Garnet&apos;s verifier caught it against the chain, refunded the reservation, hired Seller B
                under the same budget, verified and paid once.{" "}
                <Link href="/demo" className="inline-block py-1 text-rose underline-offset-2 hover:underline">
                  Run it yourself →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ---------- PROBLEM ---------- */}
        <section className="border-b hairline bg-ivory text-graphite">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-[1fr_1.1fr] md:py-28">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-garnet">The problem</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.01em] sm:text-6xl">
                A payment receipt is not proof of work.
              </h2>
            </div>
            <div className="space-y-5 self-end text-[17px] leading-relaxed text-graphite/75">
              <p>
                Agents can already pay each other. What they can&apos;t do is know whether they got what they paid for. A confirmed transfer proves money moved. It says nothing
                about whether the analysis was right.
              </p>
              <p>
                If a buyer agent trusts the seller&apos;s output, it pays for wrong answers. If it retries a payment after a timeout, it can pay twice. Garnet is built to prevent both.
              </p>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border hairline-dark bg-graphite/10 font-mono text-xs">
                <div className="bg-ivory p-4">
                  <dt className="text-graphite/50">Naive buyer agent</dt>
                  <dd className="mt-1 text-graphite">pays on delivery</dd>
                </div>
                <div className="bg-ivory p-4">
                  <dt className="text-graphite/50">Garnet</dt>
                  <dd className="mt-1 text-garnet">pays on verified delivery</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section id="how" className="scroll-mt-16 border-b hairline">
          <div className="mx-auto max-w-[1240px] px-5 py-20 md:py-28">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose">How it works</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.02] sm:text-6xl">Select. Verify. Settle or recover.</h2>
            <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border hairline bg-ivory/10 md:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Select",
                  d: "The buyer agent reads the quotes and your budget, picks a seller and explains why. Code then checks the choice: no unknown sellers, no repeat of a failed seller, nothing over budget.",
                  svg: <SelectGlyph />,
                },
                {
                  n: "02",
                  t: "Verify",
                  d: "The acceptance criteria are fixed before work starts. When the seller delivers, Garnet fetches the transaction and receipt from Base Sepolia itself and compares every field. Each check gets PASS, FAIL or INCONCLUSIVE.",
                  svg: <VerifyGlyph />,
                },
                {
                  n: "03",
                  t: "Settle / Recover",
                  d: "PASS releases the reserved funds, exactly once. FAIL produces an evidence packet, refunds the reservation and hires the next seller under the same budget. If the check is inconclusive, funds are held and a human is asked.",
                  svg: <SettleGlyph />,
                },
              ].map((s) => (
                <li key={s.n} className="flex flex-col bg-graphite p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-ivory/40">{s.n}</span>
                    {s.svg}
                  </div>
                  <h3 className="mt-8 font-serif text-3xl">{s.t}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ivory/60">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- PROOF & SAFETY ---------- */}
        <section id="proof" className="scroll-mt-16 border-b hairline bg-graphite-2">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 md:grid-cols-[0.9fr_1.1fr] md:py-28">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose">Proof &amp; safety</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.02] sm:text-5xl">Guardrails in code, not in the prompt.</h2>
              <p className="mt-5 text-[15px] leading-relaxed text-ivory/60">
                The model can pick a seller. It can&apos;t approve a payment, raise the budget or overrule the verifier. Those rules run as ordinary code with tests behind them.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl border hairline bg-ivory/10 sm:grid-cols-2">
              {[
                ["Budget guardrail", "Payments plus open reservations can never exceed the original budget. All amounts are exact integers; there is no floating-point money."],
                ["Independent receipts", "The verifier makes its own RPC calls and never reads the seller's data source. If the RPC fails, the result is INCONCLUSIVE, never PASS."],
                ["Evidence packets", "Each rejection is saved as a hashed record: the frozen contract, the delivery hash, the failed checks, their source and timestamps."],
                ["Exactly-once settlement", "Every money movement carries an idempotency key. The database allows one release per job. If an acknowledgement is lost, Garnet looks the payment up by key instead of sending it again."],
                ["Restart-safe", "Jobs, attempts, ledger entries and events are written to SQLite. If the process restarts, the job continues from the last saved step."],
                ["Honest modes", "Escrow is simulated, and every receipt is labeled SIMULATED. Fault injection is labeled as a demo. When no model key is set, the scripted planner is labeled as scripted."],
              ].map(([t, d]) => (
                <li key={t} className="bg-graphite-2 p-6">
                  <h3 className="flex items-center gap-2 text-[15px] text-ivory">
                    <span className="h-1.5 w-1.5 rotate-45 bg-garnet-vivid" aria-hidden="true" />
                    {t}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ivory/55">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- DEVELOPERS ---------- */}
        <section className="border-b hairline">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-2 md:py-28">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose">For developers</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.02] sm:text-5xl">Four parts, connected through small interfaces.</h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ivory/60">
                The agent plans. Providers do the work. The verifier checks it. The payment adapter moves money. Neatlogs records each step as a span, so any run can be traced
                from decision to settlement.
              </p>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="mt-7 inline-block rounded-full border hairline px-5 py-2.5 text-sm text-ivory/80 hover:border-rose/50 hover:text-ivory">
                Read the source →
              </a>
            </div>
            <pre className="overflow-x-auto rounded-xl border hairline bg-graphite-2 p-5 font-mono text-[12px] leading-6 text-ivory/70" aria-label="Architecture outline">
{`src/lib/
  agent/          planner (Claude Opus 5.5) · engine
  providers/      seller-a · seller-b
  verification/   viem RPC verifier · evidence
  payments/       SIMULATED escrow ledger
  jobs/           frozen contract · state machine
  telemetry/      Neatlogs spans

garnet.job                     WORKFLOW
├─ select_provider             AGENT
├─ budget_and_policy_guard     GUARDRAIL
├─ reserve · seller_execute    TOOL
├─ verify                      GUARDRAIL
├─ create_dispute · refund     TOOL
├─ fallback → … → release      AGENT/TOOL
└─ finalize                    CHAIN`}
            </pre>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="relative overflow-hidden">
          <div className="facet-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1240px] px-5 py-24 text-center md:py-32">
            <Emblem size={40} className="mx-auto" />
            <h2 className="mx-auto mt-6 max-w-3xl font-serif text-4xl leading-[1.02] sm:text-6xl">Don&apos;t pay for a receipt. Pay for the outcome.</h2>
            <Link href="/demo" className="mt-9 inline-block rounded-full bg-garnet px-6 py-3 text-sm font-medium text-ivory transition hover:bg-garnet-vivid">
              Launch the demo
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[11px] text-ivory/40">
          <span>Garnet · built for neatHack 2026</span>
          <span>Testnet data · simulated escrow · no real funds</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ivory">
            GitHub
          </a>
        </div>
      </footer>
    </>
  );
}

function SelectGlyph() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true" className="text-ivory/50">
      <circle cx="6" cy="20" r="4" fill="#B7455D" />
      <path d="M10 20 C 28 20, 30 8, 50 8" fill="none" stroke="currentColor" strokeWidth="1" className="draw" style={{ ["--len" as string]: 60 }} />
      <path d="M10 20 C 28 20, 30 32, 50 32" fill="none" stroke="#E68B9B" strokeWidth="1.4" className="draw" style={{ ["--len" as string]: 60 }} />
      <rect x="50" y="4" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" />
      <rect x="50" y="28" width="10" height="8" rx="1.5" fill="#982E48" />
    </svg>
  );
}
function VerifyGlyph() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true" className="text-ivory/50">
      {[6, 14, 22, 30].map((y, i) => (
        <g key={y}>
          <path d={`M4 ${y + 2} H30`} stroke="currentColor" strokeWidth="1" />
          <path d={`M36 ${y + 2} H44`} stroke={i === 2 ? "#B7455D" : "#8FC9A3"} strokeWidth="2.4" className="draw" style={{ ["--len" as string]: 10 }} />
        </g>
      ))}
      <path d="M50 8 58 20 50 32" fill="none" stroke="currentColor" />
    </svg>
  );
}
function SettleGlyph() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true" className="text-ivory/50">
      <path d="M4 20 H24" stroke="currentColor" />
      <path d="M24 20 L40 8 H60" fill="none" stroke="#8FC9A3" strokeWidth="1.4" className="draw" style={{ ["--len" as string]: 40 }} />
      <path d="M24 20 L40 32 H52" fill="none" stroke="#B7455D" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M20 16 24 20 20 24" fill="none" stroke="currentColor" />
    </svg>
  );
}
