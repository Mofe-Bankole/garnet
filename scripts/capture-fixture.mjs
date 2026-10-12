// Captures real Base Sepolia transactions + receipts into an offline fixture file.
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { writeFileSync } from 'node:fs';
const url = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const c = createPublicClient({ chain: baseSepolia, transport: http(url) });
const latest = await c.getBlockNumber();
const picked = [];
for (let n = latest - 5n; n > latest - 40n && picked.length < 3; n--) {
  const b = await c.getBlock({ blockNumber: n, includeTransactions: true });
  for (const t of b.transactions) {
    if (t.type === 'deposit' || !t.to) continue;
    const wantValue = picked.length === 0;
    if (wantValue && t.value === 0n) continue;
    if (!wantValue && t.value !== 0n) continue;
    const r = await c.getTransactionReceipt({ hash: t.hash });
    picked.push({
      chainId: 84532,
      tx: { hash: t.hash, from: t.from, to: t.to, value: t.value.toString(), blockNumber: t.blockNumber.toString(), input: t.input.slice(0, 10) },
      receipt: { status: r.status, blockNumber: r.blockNumber.toString(), gasUsed: r.gasUsed.toString(), logCount: r.logs.length },
      capturedAt: new Date().toISOString(),
      source: url,
    });
    break;
  }
}
writeFileSync('src/lib/verification/fixtures.json', JSON.stringify(picked, null, 2) + '\n');
console.log(picked.map(p => `${p.tx.hash} value=${p.tx.value} logs=${p.receipt.logCount} status=${p.receipt.status}`).join('\n'));
