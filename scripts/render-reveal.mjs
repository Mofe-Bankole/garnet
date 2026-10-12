// Renders media/reveal/reveal.html frame-by-frame (deterministic) into media/garnet-reveal.mp4.
// Requires: playwright (+ chromium) resolvable via NODE_PATH, and ffmpeg on PATH.
//   NODE_PATH=/path/to/node_modules node scripts/render-reveal.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const FPS = 30;
const DURATION = 10;
const W = 1920;
const H = 1080;
const frames = resolve("media/.frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto("file://" + resolve("media/reveal/reveal.html"));
await page.evaluate(() => window.ready);

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: `${frames}/f${String(i).padStart(4, "0")}.png` });
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}\n`);
}
await browser.close();

await new Promise((ok, fail) => {
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS), "-i", `${frames}/f%04d.png`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "media/garnet-reveal.mp4",
  ], { stdio: "inherit" });
  ff.on("exit", (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exit ${c}`))));
});
rmSync(frames, { recursive: true, force: true });
console.log("wrote media/garnet-reveal.mp4");
