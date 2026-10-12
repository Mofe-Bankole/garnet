import { RESULT_SCHEMA_ID } from "../jobs/contract";
import { formatUsd, parseUsd } from "../money";
import type { ChainSource, TxFacts } from "../verification/chain";
import type { ExecuteOptions, ExecuteResult, FaultRecord, ProviderInfo, Quote, SellerProvider, TxAnalysis } from "./types";

function classify(f: TxFacts): TxAnalysis["analysis"]["classification"] {
  const isCall = f.methodSelector !== "0x" && f.methodSelector.length >= 10;
  if (!isCall) return "native_transfer";
  return BigInt(f.valueWei) > 0n ? "contract_call_with_value" : "contract_call";
}

function weiToEth(wei: string): string {
  const w = BigInt(wei);
  const whole = w / 10n ** 18n;
  const frac = (w % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function summarize(f: TxFacts, cls: string): string {
  const short = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "contract creation");
  const what =
    cls === "native_transfer"
      ? `transferred ${weiToEth(f.valueWei)} ETH`
      : `called ${f.methodSelector} on`;
  return `${short(f.from)} ${what} ${short(f.to)} in block ${f.blockNumber}; status ${f.status}, ${f.logCount} log(s), gas used ${f.gasUsed}.`;
}

function toAnalysis(providerId: string, f: TxFacts): TxAnalysis {
  const classification = classify(f);
  return {
    schema: RESULT_SCHEMA_ID,
    provider: providerId,
    analysis: {
      txHash: f.txHash,
      chainId: f.chainId,
      from: f.from,
      to: f.to,
      blockNumber: f.blockNumber,
      status: f.status,
      valueWei: f.valueWei,
      gasUsed: f.gasUsed,
      logCount: f.logCount,
      classification,
      methodSelector: f.methodSelector,
      summary: summarize(f, classification),
    },
    producedAt: new Date().toISOString(),
  };
}

/** Deliberate, labeled corruption: off-by-one block number (a realistic indexer bug). */
function injectFault(a: TxAnalysis): { analysis: TxAnalysis; fault: FaultRecord } {
  const original = a.analysis.blockNumber;
  const injected = (BigInt(original) + 1n).toString();
  return {
    analysis: { ...a, analysis: { ...a.analysis, blockNumber: injected } },
    fault: { field: "blockNumber", original, injected, label: "DEMO FAULT INJECTION" },
  };
}

class ChainBackedSeller implements SellerProvider {
  constructor(
    public info: ProviderInfo,
    private source: ChainSource,
    private etaMs: number,
    private supportsFaultInjection: boolean,
  ) {}

  quote(): Quote {
    return {
      providerId: this.info.id,
      priceMicro: this.info.priceMicro,
      etaMs: this.etaMs,
      claims: `${this.info.name}: decoded tx + receipt analysis for ${formatUsd(this.info.priceMicro)}`,
    };
  }

  async execute(txHash: string, chainId: number, opts: ExecuteOptions = {}): Promise<ExecuteResult> {
    const t0 = Date.now();
    const res = await this.source.lookup(txHash, chainId);
    if (!res.ok) return { ok: false, error: `seller data source ${res.reason}: ${res.detail}`, latencyMs: Date.now() - t0 };
    let delivery = toAnalysis(this.info.id, res.facts);
    let demoFault: FaultRecord | undefined;
    if (opts.injectFault && this.supportsFaultInjection) {
      const r = injectFault(delivery);
      delivery = r.analysis;
      demoFault = r.fault;
    }
    return { ok: true, delivery, latencyMs: Date.now() - t0, demoFault };
  }
}

export const SELLER_A_ID = "seller-a";
export const SELLER_B_ID = "seller-b";

export function createSellers(sourceFor: (id: string) => ChainSource): SellerProvider[] {
  return [
    new ChainBackedSeller(
      {
        id: SELLER_A_ID,
        name: "Seller A · Quickscan",
        description: "Low-cost single-pass indexer. Fast, cheapest quote.",
        priceMicro: parseUsd("0.40"),
        dataSource: "Base Sepolia RPC (seller-operated)",
      },
      sourceFor(SELLER_A_ID),
      900,
      true,
    ),
    new ChainBackedSeller(
      {
        id: SELLER_B_ID,
        name: "Seller B · Deepledger",
        description: "Receipt-level analysis with log counts. Higher price.",
        priceMicro: parseUsd("0.65"),
        dataSource: "Base Sepolia RPC (seller-operated)",
      },
      sourceFor(SELLER_B_ID),
      1600,
      false,
    ),
  ];
}
