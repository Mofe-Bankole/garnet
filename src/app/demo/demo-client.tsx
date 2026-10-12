"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExecutionConsole, ResultBadge, StatusPill } from "@/components/console";
import type { Snapshot } from "@/components/types";

interface SystemStatus {
  planner: { kind: string; model: string | null };
  verifier: string;
  payment: string;
  chain: string;
  telemetry: { enabled: boolean; reason: string };
}

const SAMPLE_TXS = [
  { hash: "0xe29f23ac5fe63039eeb442bed3cf84d87c9b72893b00929e3082983e8548f320", label: "Contract call with value" },
  { hash: "0x8575f7f21fa49d03dcb75dc3066c6f779b3dee6c5fca8d1a0d0d8457383344fb", label: "Contract call" },
];

export function DemoClient() {
  const [txHash, setTxHash] = useState(SAMPLE_TXS[0].hash);
  const [budget, setBudget] = useState("1.50");
  const [fault, setFault] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const poll = useCallback((id: string) => {
    let n = 0;
    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
        setSnap(body.snapshot);
        if (body.snapshot.job.status !== "open") return;
        if (++n >= 240) return setError("Job is still running after 2 minutes. State is persisted — use Resume to continue.");
        timer.current = setTimeout(tick, 500);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    timer.current = setTimeout(tick, 400);
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    setSnap(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash, budget, injectSellerAFault: fault, idempotencyKey: `ui:${crypto.randomUUID()}` }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
      setSnap(body.snapshot);
      poll(body.snapshot.job.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resume() {
    if (!snap) return;
    setError(null);
    const r = await fetch(`/api/jobs/${snap.job.id}`, { method: "POST" });
    const body = await r.json();
    if (!r.ok) return setError(body?.error?.message ?? "resume failed");
    setSnap(body.snapshot);
    poll(snap.job.id);
  }

  const running = submitting || snap?.job.status === "open";

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* ---- controls ---- */}
      <aside className="min-w-0 space-y-5">
        <form onSubmit={run} className="space-y-4 rounded-xl border hairline bg-graphite-2 p-5" aria-describedby="modes">
          <div>
            <label htmlFor="tx" className="block font-mono text-[11px] uppercase tracking-[0.14em] text-ivory/55">
              Base Sepolia transaction hash
            </label>
            <input
              id="tx"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value.trim())}
              spellCheck={false}
              autoComplete="off"
              className="mt-1.5 w-full rounded-md border hairline bg-graphite px-3 py-2 font-mono text-xs text-ivory placeholder:text-ivory/30 focus:border-rose/60 focus:outline-none"
              placeholder="0x…"
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SAMPLE_TXS.map((s) => (
                <button key={s.hash} type="button" onClick={() => setTxHash(s.hash)} className="rounded border hairline px-2 py-0.5 font-mono text-[10px] text-ivory/60 hover:border-rose/50 hover:text-ivory">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="budget" className="block font-mono text-[11px] uppercase tracking-[0.14em] text-ivory/55">
              Maximum budget (USD, simulated)
            </label>
            <div className="mt-1.5 flex items-center rounded-md border hairline bg-graphite focus-within:border-rose/60">
              <span className="pl-3 font-mono text-xs text-ivory/40">$</span>
              <input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className="w-full bg-transparent px-2 py-2 font-mono text-sm text-ivory focus:outline-none" required />
            </div>
            <p className="mt-1 text-[11px] text-ivory/40">Seller A quotes $0.40, Seller B $0.65. Try $0.50 to see a budget-safe stop.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-warn/25 bg-warn/5 p-3">
            <input type="checkbox" checked={fault} onChange={(e) => setFault(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#B7455D]" />
            <span>
              <span className="block text-sm text-ivory">Inject Seller A error — demo only</span>
              <span className="block text-[11px] leading-snug text-ivory/50">Seller A will corrupt one field. Garnet is not told which; it must catch it independently.</span>
            </span>
          </label>
          <button type="submit" disabled={running} className="w-full rounded-md bg-garnet px-4 py-2.5 text-sm font-medium text-ivory transition hover:bg-garnet-vivid disabled:cursor-not-allowed disabled:opacity-60">
            {running ? "Agent running…" : "Run Agent"}
          </button>
        </form>

        <section id="modes" className="rounded-xl border hairline p-5 font-mono text-[11px] leading-6 text-ivory/65" aria-label="Execution modes">
          <h2 className="mb-1 text-[10px] uppercase tracking-[0.16em] text-ivory/40">Execution modes (truthful)</h2>
          {status ? (
            <ul>
              <li>
                Agent: <b className="font-normal text-ivory">{status.planner.kind === "llm" ? `LLM · ${status.planner.model}` : "Scripted planner (no ANTHROPIC_API_KEY)"}</b>
              </li>
              <li>
                Verifier: <b className="font-normal text-ivory">{status.verifier === "rpc" ? "Live Base Sepolia RPC" : "Offline fixtures"}</b>
              </li>
              <li>
                Escrow: <b className="font-normal text-warn">SIMULATED — no real funds move</b>
              </li>
              <li>
                Neatlogs: <b className="font-normal text-ivory">{status.telemetry.enabled ? "exporting traces" : status.telemetry.reason}</b>
              </li>
            </ul>
          ) : (
            <p>Loading…</p>
          )}
        </section>
      </aside>

      {/* ---- results ---- */}
      <section aria-live="polite" aria-busy={running} className="min-w-0 space-y-5">
        {error && (
          <div role="alert" className="rounded-xl border border-garnet-vivid/50 bg-garnet/10 p-4 text-sm text-rose">
            {error}
            {snap && (
              <button onClick={resume} className="ml-3 underline underline-offset-2">
                Resume job
              </button>
            )}
          </div>
        )}
        {!snap && !error && (
          <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed hairline p-8 text-center">
            <div>
              <p className="font-serif text-2xl text-ivory/85">Nothing has run yet.</p>
              <p className="mt-2 max-w-sm text-sm text-ivory/50">Pick a transaction, set a budget and run the agent. Every decision, check and simulated payment will appear here.</p>
            </div>
          </div>
        )}
        {snap && (
          <>
            <ExecutionConsole snap={snap} label="LIVE RUN" />
            <Details snap={snap} onResume={resume} />
          </>
        )}
      </section>
    </div>
  );
}

function Details({ snap, onResume }: { snap: Snapshot; onResume: () => void }) {
  const final = snap.attempts.find((a) => a.status === "released");
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
      <Card title="Ledger · SIMULATED escrow">
        <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
          {Object.entries(snap.balances).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-ivory/40">{k}</dt>
              <dd className="mt-0.5 text-ivory">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 space-y-1.5 border-t hairline pt-3">
          {snap.receipts.map((r) => (
            <li key={r.receiptId} className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
              <span className="text-ivory/70">
                <span className="text-warn">{r.mode}</span> {r.op}
                {r.payee ? ` → ${r.payee}` : ""}
              </span>
              <span className="text-ivory/45">
                ${(Number(r.amountMicro) / 1e6).toFixed(2)} · {r.receiptId}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Agent decisions">
        <ul className="space-y-3">
          {snap.attempts.map((a) => (
            <li key={a.id} className="text-sm">
              <p className="font-mono text-[11px] text-ivory/45">
                attempt {a.seq} · {a.decision.planner === "llm" ? "LLM" : "scripted"} → {a.providerId}
              </p>
              <p className="mt-0.5 leading-snug text-ivory/80">{a.decision.reason}</p>
            </li>
          ))}
          {snap.attempts.length === 0 && <li className="text-sm text-ivory/45">Planning…</li>}
        </ul>
        <p className="mt-4 border-t hairline pt-3 font-mono text-[11px] text-ivory/45">Quotes: {snap.providers.map((p) => `${p.name} ${p.price}`).join(" · ")}</p>
      </Card>

      {snap.attempts
        .filter((a) => a.verification)
        .map((a) => (
          <Card key={a.id} title={`Verification · attempt ${a.seq} · ${a.providerId}`} className="xl:col-span-2">
            <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ivory/55">
              <ResultBadge r={a.verification!.verdict} />
              <span>
                independent source: {a.verification!.source ? `${a.verification!.source.kind}:${a.verification!.source.endpoint} @ ${a.verification!.source.fetchedAt}` : "none (schema check)"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left font-mono text-[11px]">
                <thead className="text-[10px] uppercase tracking-[0.12em] text-ivory/40">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Field</th>
                    <th className="py-1 pr-3 font-normal">Result</th>
                    <th className="py-1 pr-3 font-normal">Expected (chain)</th>
                    <th className="py-1 font-normal">Delivered (seller)</th>
                  </tr>
                </thead>
                <tbody>
                  {a.verification!.assertions.map((c) => (
                    <tr key={c.field} className={`border-t hairline ${c.result === "FAIL" ? "bg-garnet/10" : ""}`}>
                      <td className="py-1.5 pr-3 text-ivory/80">{c.field}</td>
                      <td className="py-1.5 pr-3">
                        <ResultBadge r={c.result} />
                      </td>
                      <td className="max-w-[220px] truncate py-1.5 pr-3 text-ivory/70" title={c.expected ?? ""}>
                        {c.expected ?? "—"}
                      </td>
                      <td className={`max-w-[220px] truncate py-1.5 ${c.result === "FAIL" ? "text-rose" : "text-ivory/70"}`} title={c.actual ?? ""}>
                        {c.actual ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {a.dispute && (
              <p className="mt-3 rounded border border-garnet-vivid/35 bg-garnet/10 p-2.5 font-mono text-[11px] leading-relaxed text-rose">
                Evidence packet {a.dispute.disputeId} · {a.dispute.packetHash.slice(0, 23)}… — {a.dispute.rule}
              </p>
            )}
          </Card>
        ))}

      {final?.delivery?.analysis && (
        <Card title="Verified report" className="xl:col-span-2">
          <p className="font-serif text-xl leading-snug text-ivory">{String(final.delivery.analysis.summary)}</p>
          <p className="mt-2 font-mono text-[11px] text-ivory/45">
            classification {String(final.delivery.analysis.classification)} · delivered by {final.providerId} · verified by {snap.contract.evaluator.id}
          </p>
        </Card>
      )}

      <details className="group rounded-xl border hairline bg-graphite-2 p-5 xl:col-span-2">
        <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.14em] text-ivory/55 group-open:mb-3">
          Evidence trail · {snap.events.length} events <span className="text-ivory/30">(click to expand)</span>
        </summary>
        <ol className="space-y-1.5">
          {snap.events.map((e) => (
            <li key={e.seq} className="grid grid-cols-[2rem_7.5rem_1fr] gap-2 font-mono text-[11px] leading-relaxed">
              <span className="text-ivory/30">{e.seq}</span>
              <span className="truncate text-ivory/45">{e.stage}</span>
              <span className={e.type.includes("fail") || e.type.includes("demo_fault") ? "text-rose" : "text-ivory/75"}>{e.message}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t hairline pt-3 font-mono text-[11px] text-ivory/45">
          <span>contract {snap.job.contractHash.slice(0, 23)}…</span>
          <span>trace {snap.job.traceId ?? (snap.modes.telemetry.enabled ? "pending" : "not exported")}</span>
          <StatusPill status={snap.job.status} />
          <button onClick={onResume} className="rounded border hairline px-2 py-0.5 text-ivory/70 hover:border-rose/50 hover:text-ivory">
            Replay safely (idempotent)
          </button>
        </div>
      </details>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border hairline bg-graphite-2 p-5 ${className}`}>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ivory/55">{title}</h3>
      {children}
    </section>
  );
}
