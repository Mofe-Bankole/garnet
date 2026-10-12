import { GarnetEngine } from "./agent/engine";
import { type Planner, createPlanner } from "./agent/planner";
import { type Db, openDb } from "./db";
import { JobRepo } from "./jobs/repo";
import { SimulatedEscrowLedger } from "./payments/ledger";
import { createSellers } from "./providers/sellers";
import { type ChainSource, FixtureChainSource, RpcChainSource } from "./verification/chain";

export interface RuntimeOptions {
  dbPath?: string;
  verifierMode?: "rpc" | "fixture";
  planner?: Planner;
  verifierSource?: ChainSource;
  sellerSource?: (id: string) => ChainSource;
}

export interface Runtime {
  db: Db;
  engine: GarnetEngine;
  ledger: SimulatedEscrowLedger;
}

export function createRuntime(o: RuntimeOptions = {}): Runtime {
  const db = openDb(o.dbPath ?? process.env.GARNET_DB_PATH ?? "./data/garnet.db");
  const mode = o.verifierMode ?? (process.env.GARNET_VERIFIER_MODE === "fixture" ? "fixture" : "rpc");
  // Verifier and each seller get SEPARATE source instances: the verifier never reuses seller data.
  const verifierSource = o.verifierSource ?? (mode === "fixture" ? new FixtureChainSource() : new RpcChainSource());
  const sellerSource = o.sellerSource ?? (() => (mode === "fixture" ? new FixtureChainSource() : new RpcChainSource()));
  const ledger = new SimulatedEscrowLedger(db);
  const engine = new GarnetEngine({
    db,
    repo: new JobRepo(db),
    ledger,
    sellers: createSellers(sellerSource),
    verifierSource,
    planner: o.planner ?? createPlanner(),
  });
  return { db, engine, ledger };
}

const g = globalThis as unknown as { __garnetRuntime?: Runtime };
/** Process-wide singleton for the Next.js server. */
export function serverRuntime(): Runtime {
  return (g.__garnetRuntime ??= createRuntime());
}
