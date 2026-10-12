import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: "Demo",
  description: "Run Garnet's buyer agent: hire a seller, verify the delivered transaction analysis against Base Sepolia, then settle or recover a simulated payment.",
};

export default function DemoPage() {
  return (
    <>
      <Nav current="demo" />
      <main className="mx-auto max-w-[1240px] px-5 pb-20 pt-10">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose">Interactive demo</p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.01em] sm:text-5xl">Hire an agent. Verify the work. Then pay.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ivory/60">
            Garnet buys a transaction analysis from Seller A or B, checks every field against Base Sepolia itself, and releases the simulated payment only on a pass.
          </p>
        </div>
        <DemoClient />
      </main>
    </>
  );
}
