import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import fixtures from "./fixtures.json";

/** Normalized on-chain facts for one transaction. */
export interface TxFacts {
  txHash: string;
  chainId: number;
  from: string;
  to: string | null;
  blockNumber: string;
  status: "success" | "reverted";
  valueWei: string;
  gasUsed: string;
  logCount: number;
  methodSelector: string;
}

export type ChainLookup =
  | { ok: true; facts: TxFacts; source: SourceDescriptor }
  | { ok: false; reason: "not_found" | "unreachable" | "wrong_chain"; detail: string; source: SourceDescriptor };

export interface SourceDescriptor {
  kind: "rpc" | "fixture";
  /** Host only — never the full URL (it may embed an API key). */
  endpoint: string;
  chainId: number;
  fetchedAt: string;
}

export interface ChainSource {
  readonly kind: "rpc" | "fixture";
  lookup(txHash: string, expectedChainId: number): Promise<ChainLookup>;
}

export const DEFAULT_RPC = "https://sepolia.base.org";

export function redactEndpoint(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

export class RpcChainSource implements ChainSource {
  readonly kind = "rpc" as const;
  private client;
  private host: string;
  constructor(url: string = process.env.BASE_SEPOLIA_RPC_URL || DEFAULT_RPC, timeoutMs = 8000) {
    this.client = createPublicClient({ chain: baseSepolia, transport: http(url, { timeout: timeoutMs, retryCount: 1 }) });
    this.host = redactEndpoint(url);
  }

  async lookup(txHash: string, expectedChainId: number): Promise<ChainLookup> {
    const source = (chainId: number): SourceDescriptor => ({
      kind: "rpc",
      endpoint: this.host,
      chainId,
      fetchedAt: new Date().toISOString(),
    });
    let chainId: number;
    try {
      chainId = await this.client.getChainId();
    } catch (e) {
      return { ok: false, reason: "unreachable", detail: errMsg(e), source: source(expectedChainId) };
    }
    if (chainId !== expectedChainId) {
      return { ok: false, reason: "wrong_chain", detail: `RPC reports chainId ${chainId}, contract requires ${expectedChainId}`, source: source(chainId) };
    }
    try {
      const hash = txHash as `0x${string}`;
      const [tx, receipt] = await Promise.all([
        this.client.getTransaction({ hash }),
        this.client.getTransactionReceipt({ hash }),
      ]);
      return {
        ok: true,
        source: source(chainId),
        facts: {
          txHash: tx.hash.toLowerCase(),
          chainId,
          from: tx.from.toLowerCase(),
          to: tx.to ? tx.to.toLowerCase() : null,
          blockNumber: receipt.blockNumber.toString(),
          status: receipt.status,
          valueWei: tx.value.toString(),
          gasUsed: receipt.gasUsed.toString(),
          logCount: receipt.logs.length,
          methodSelector: tx.input.slice(0, 10),
        },
      };
    } catch (e) {
      const msg = errMsg(e);
      const notFound = /could not be found|not found/i.test(msg);
      return { ok: false, reason: notFound ? "not_found" : "unreachable", detail: msg.slice(0, 300), source: source(chainId) };
    }
  }
}

interface FixtureRecord {
  chainId: number;
  tx: { hash: string; from: string; to: string | null; value: string; blockNumber: string; input: string };
  receipt: { status: "success" | "reverted"; blockNumber: string; gasUsed: string; logCount: number };
}

/** Offline mode: real Base Sepolia records captured by scripts/capture-fixture.mjs. Always labeled "fixture". */
export class FixtureChainSource implements ChainSource {
  readonly kind = "fixture" as const;
  constructor(private records: FixtureRecord[] = fixtures as FixtureRecord[]) {}
  async lookup(txHash: string, expectedChainId: number): Promise<ChainLookup> {
    const source: SourceDescriptor = { kind: "fixture", endpoint: "fixtures.json", chainId: expectedChainId, fetchedAt: new Date().toISOString() };
    const r = this.records.find((x) => x.tx.hash.toLowerCase() === txHash.toLowerCase());
    if (!r) return { ok: false, reason: "not_found", detail: "hash not present in offline fixture set", source };
    if (r.chainId !== expectedChainId) return { ok: false, reason: "wrong_chain", detail: `fixture chainId ${r.chainId}`, source };
    return {
      ok: true,
      source,
      facts: {
        txHash: r.tx.hash.toLowerCase(),
        chainId: r.chainId,
        from: r.tx.from.toLowerCase(),
        to: r.tx.to ? r.tx.to.toLowerCase() : null,
        blockNumber: r.receipt.blockNumber,
        status: r.receipt.status,
        valueWei: r.tx.value,
        gasUsed: r.receipt.gasUsed,
        logCount: r.receipt.logCount,
        methodSelector: r.tx.input,
      },
    };
  }
}

/** Always fails as unreachable — used by tests and the "RPC down" scenario. */
export class UnreachableChainSource implements ChainSource {
  readonly kind = "rpc" as const;
  async lookup(txHash: string, expectedChainId: number): Promise<ChainLookup> {
    return {
      ok: false,
      reason: "unreachable",
      detail: "simulated RPC outage (test double)",
      source: { kind: "rpc", endpoint: "unreachable.invalid", chainId: expectedChainId, fetchedAt: new Date().toISOString() },
    };
  }
}

export const FIXTURE_TX_HASHES = (fixtures as FixtureRecord[]).map((f) => f.tx.hash);

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "shortMessage" in e) return String((e as { shortMessage: unknown }).shortMessage);
  return e instanceof Error ? e.message : String(e);
}
