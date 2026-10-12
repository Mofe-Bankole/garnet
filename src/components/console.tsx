import type { Snapshot } from "./types";

export const STAGES = [
  { key: "select_provider", label: "Select" },
  { key: "reserve", label: "Reserve" },
  { key: "seller_execute", label: "Deliver" },
  { key: "verify", label: "Verify" },
  { key: "refund_or_release", label: "Settle" },
] as const;

const short = (h: string | null | undefined, a = 6, b = 4) => (h ? (h.length > a + b + 1 ? `${h.slice(0, a)}…${h.slice(-b)}` : h) : "—");

export function StatusPill({ status }: { status: Snapshot["job"]["status"] | "idle" | "running" }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle: { label: "Ready", cls: "border-ivory/20 text-ivory/70" },
    running: { label: "Running", cls: "border-rose/40 text-rose" },
    open: { label: "Running", cls: "border-rose/40 text-rose" },
    settled: { label: "Settled · verified", cls: "border-pass/40 text-pass" },
    escalated: { label: "Escalated · funds held", cls: "border-warn/40 text-warn" },
    exhausted: { label: "Stopped · nothing paid", cls: "border-ivory/30 text-ivory/70" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${m.cls}`}>
      {(status === "running" || status === "open") && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-rose" />}
      {m.label}
    </span>
  );
}

export function ResultBadge({ r }: { r: "PASS" | "FAIL" | "INCONCLUSIVE" }) {
  const cls = r === "PASS" ? "text-pass border-pass/35" : r === "FAIL" ? "text-garnet-vivid border-garnet-vivid/50 bg-garnet/10" : "text-warn border-warn/40";
  return <span className={`inline-block min-w-[3.6rem] rounded border px-1.5 py-px text-center font-mono text-[10px] tracking-wider ${cls}`}>{r === "INCONCLUSIVE" ? "UNSURE" : r}</span>;
}

/**
 * Compact, screenshot-worthy execution console. Renders a real job snapshot.
 * `label` must honestly describe the data source (live run vs. recorded run).
 */
export function ExecutionConsole({ snap, label }: { snap: Snapshot; label: string }) {
  const stageIdx = STAGES.findIndex((s) => s.key === snap.job.stage || (snap.job.stage === "create_contract" && s.key === "select_provider") || (snap.job.stage === "create_dispute" && s.key === "verify") || (snap.job.stage === "fallback" && s.key === "select_provider") || (snap.job.stage === "reconcile" && s.key === "refund_or_release"));
  const done = snap.job.status !== "open";
  const tx = snap.contract.input.txHash;
  return (
    <div className="overflow-hidden rounded-xl border hairline bg-graphite-2/90 text-left shadow-[0_40px_120px_-40px_rgba(152,46,72,0.45)] backdrop-blur">
      {/* chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b hairline px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-ivory/55">
          <span className="h-2 w-2 rounded-full bg-garnet-vivid" />
          <span>garnet · {snap.job.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-ivory/15 px-1.5 py-px font-mono text-[10px] tracking-wider text-ivory/60">{label}</span>
          <StatusPill status={snap.job.status} />
        </div>
      </div>

      {/* header facts */}
      <dl className="grid grid-cols-2 border-b hairline font-mono text-[11px] sm:grid-cols-4">
        {[
          ["Task", `Analyse tx ${short(tx, 8, 6)}`],
          ["Budget", `${snap.balances.budget} · ${snap.balances.released} paid`],
          ["Escrow", snap.modes.payment],
          ["Agent", snap.modes.planner === "llm" ? "LLM planner" : "Scripted planner"],
        ].map(([k, v], i) => (
          <div key={k} className={`px-4 py-2.5 ${i % 2 === 1 ? "border-l hairline" : ""} ${i >= 2 ? "border-t hairline sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-ivory/40">{k}</dt>
            <dd className="mt-0.5 truncate text-ivory/90">{v}</dd>
          </div>
        ))}
      </dl>

      {/* stage rail */}
      <ol className="flex items-center gap-1 overflow-x-auto border-b hairline px-4 py-3" aria-label="Pipeline stages">
        {STAGES.map((s, i) => {
          const state = done ? "done" : i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
          return (
            <li key={s.key} className="flex shrink-0 items-center gap-1">
              <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${state === "active" ? "bg-garnet text-ivory" : state === "done" ? "text-ivory/80" : "text-ivory/30"}`}>
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className={`h-px w-4 ${state === "done" ? "bg-ivory/40" : "bg-ivory/12"}`} />}
            </li>
          );
        })}
      </ol>

      {/* attempts */}
      <div className="divide-y divide-ivory/10">
        {snap.attempts.length === 0 && <p className="px-4 py-6 font-mono text-xs text-ivory/45">Planning… choosing a seller within budget.</p>}
        {snap.attempts.map((a) => {
          const p = snap.providers.find((x) => x.id === a.providerId);
          const fails = a.verification?.assertions.filter((x) => x.result !== "PASS") ?? [];
          return (
            <div key={a.id} className="rise px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm">
                  <span className="font-mono text-[11px] text-ivory/40">#{a.seq}</span> <span className="text-ivory">{p?.name ?? a.providerId}</span>{" "}
                  <span className="font-mono text-[11px] text-ivory/50">quote {a.quote}</span>
                  {snap.job.faultInjection && a.providerId === "seller-a" && <span className="ml-2 rounded bg-warn/15 px-1.5 py-px font-mono text-[10px] text-warn">DEMO FAULT ON</span>}
                </p>
                <AttemptOutcome status={a.status} />
              </div>
              {a.verification && (
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4" aria-label="Verification checks">
                  {a.verification.assertions.map((c) => (
                    <li key={c.field} className="flex items-center gap-1.5 font-mono text-[11px]">
                      <ResultBadge r={c.result} />
                      <span className={c.result === "FAIL" ? "text-rose" : "text-ivory/65"}>{c.field}</span>
                    </li>
                  ))}
                </ul>
              )}
              {fails.length > 0 && a.verification?.verdict === "FAIL" && (
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-rose/90">
                  {fails.map((f) => `${f.field}: expected ${short(f.expected, 10, 4)} · got ${short(f.actual, 10, 4)}`).join(" · ")} — source {a.verification.source?.kind}:{a.verification.source?.endpoint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* outcome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t hairline bg-graphite/60 px-4 py-3 font-mono text-[11px]">
        <span className="text-ivory/70">{snap.job.outcome?.summary ?? "Awaiting verified delivery…"}</span>
        <span className="text-ivory/40">
          refunded {snap.balances.refunded} · held {snap.balances.held}
        </span>
      </div>
    </div>
  );
}

function AttemptOutcome({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    contracted: ["contracted", "text-ivory/50"],
    reserved: ["funds reserved", "text-ivory/60"],
    delivered: ["delivered · verifying", "text-rose"],
    verified_pass: ["verified · releasing", "text-pass"],
    verified_fail: ["verification failed", "text-garnet-vivid"],
    inconclusive: ["inconclusive", "text-warn"],
    released: ["verified · paid once", "text-pass"],
    refunded: ["rejected · refunded", "text-garnet-vivid"],
    held: ["held for review", "text-warn"],
    seller_error: ["seller error", "text-garnet-vivid"],
    settlement_unknown: ["settlement unknown · reconciling", "text-warn"],
  };
  const [l, c] = map[status] ?? [status, "text-ivory/60"];
  return <span className={`font-mono text-[11px] uppercase tracking-wider ${c}`}>{l}</span>;
}
