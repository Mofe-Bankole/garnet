import { describe, expect, it } from "vitest";
import { buildJobContract } from "../src/lib/jobs/contract";
import { createSellers } from "../src/lib/providers/sellers";
import { FixtureChainSource, UnreachableChainSource } from "../src/lib/verification/chain";
import { verifyDelivery } from "../src/lib/verification/verifier";
import { TX } from "./helpers";

const contract = buildJobContract({ jobId: "j", txHash: TX, chainId: 84532, budgetMicro: 1_000_000n, idempotencyKey: "k", verifierSource: "fixture" });
const [sellerA] = createSellers(() => new FixtureChainSource());

async function goodDelivery() {
  const r = await sellerA.execute(TX, 84532);
  if (!r.ok) throw new Error(r.error);
  return r.delivery as { analysis: Record<string, unknown> };
}

describe("independent verifier", () => {
  it("passes a correct delivery with per-field evidence", async () => {
    const v = await verifyDelivery(contract, await goodDelivery(), new FixtureChainSource());
    expect(v.verdict).toBe("PASS");
    expect(v.assertions.map((a) => a.field)).toEqual(["txHash", "chainId", "from", "to", "blockNumber", "status", "valueWei"]);
    for (const a of v.assertions) {
      expect(a.expected).toBe(a.actual);
      expect(a.source).toMatch(/fixture/);
    }
  });

  it.each(["from", "to", "status", "valueWei", "txHash"])("fails when %s is wrong", async (field) => {
    const d = await goodDelivery();
    const bad = { ...d, analysis: { ...d.analysis, [field]: field === "status" ? "reverted" : field === "valueWei" ? "1" : "0x" + "1".repeat(field === "txHash" ? 64 : 40) } };
    const v = await verifyDelivery(contract, bad, new FixtureChainSource());
    expect(v.verdict).toBe("FAIL");
    expect(v.assertions.find((a) => a.field === field)!.result).toBe("FAIL");
  });

  it("fails schema-invalid deliveries without trusting any field", async () => {
    const v = await verifyDelivery(contract, { hello: "world" }, new FixtureChainSource());
    expect(v.verdict).toBe("FAIL");
    expect(v.assertions[0].field).toBe("schema");
  });

  it("is INCONCLUSIVE (never PASS) when the independent source is unreachable", async () => {
    const v = await verifyDelivery(contract, await goodDelivery(), new UnreachableChainSource());
    expect(v.verdict).toBe("INCONCLUSIVE");
    expect(v.assertions.every((a) => a.result === "INCONCLUSIVE")).toBe(true);
  });

  it("does not consult seller-provided demo metadata", async () => {
    const r = await sellerA.execute(TX, 84532, { injectFault: true });
    if (!r.ok) throw new Error("x");
    expect(r.demoFault?.label).toBe("DEMO FAULT INJECTION");
    // verifier only receives the delivery, never the fault record
    const v = await verifyDelivery(contract, r.delivery, new FixtureChainSource());
    expect(v.verdict).toBe("FAIL");
  });
});
