// Exact money arithmetic. All amounts are bigint micro-units of USD (6 decimals, USDC-like).
// Never use floating point for money.

export const MICRO = 1_000_000n;

const DECIMAL_RE = /^(\d{1,9})(?:\.(\d{1,6}))?$/;

/** Parse a decimal USD string like "1.25" into micro-units. Throws on invalid input. */
export function parseUsd(input: string): bigint {
  const s = input.trim().replace(/^\$/, "");
  const m = DECIMAL_RE.exec(s);
  if (!m) throw new Error(`Invalid USD amount: "${input}" (use up to 6 decimals, e.g. 1.00)`);
  const whole = BigInt(m[1]);
  const frac = BigInt((m[2] ?? "").padEnd(6, "0"));
  return whole * MICRO + frac;
}

/** Format micro-units as "$1.25" (2–6 decimals, trailing zeros trimmed past cents). */
export function formatUsd(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / MICRO;
  let frac = (abs % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${neg ? "-" : ""}$${whole.toString()}.${frac}`;
}

export const toStr = (v: bigint) => v.toString();
export const fromStr = (v: string) => BigInt(v);
