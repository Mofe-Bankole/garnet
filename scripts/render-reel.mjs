// Renders media/reel/reel.html deterministically to media/garnet-showreel.mp4 (15s, 1080p30).
//   NODE_PATH=<dir with playwright> node scripts/render-reel.mjs [--draft]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30, DUR = 15, draft = process.argv.includes("--draft");
const outFile = resolve(root, draft ? "media/garnet-showreel-draft.mp4" : "media/garnet-showreel.mp4");

const browser = await chromium.launch({ args: ["--disable-gpu-vsync"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => { console.error("PAGE ERROR", e); process.exit(1); });
await page.goto("file://" + resolve(root, "media/reel/reel.html") + (draft ? "?blur=0" : ""));
const fontsOk = await page.evaluate(() => window.ready);
if (!fontsOk) throw new Error("fonts failed to load");

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", draft ? "veryfast" : "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile], { stdio: ["pipe", "inherit", "inherit"] });

const total = FPS * DUR;
for (let i = 0; i < total; i++) {
  const png = await page.evaluate(async (t) => { window.render(t); return document.getElementById("c").toDataURL("image/png"); }, i / FPS);
  const ok = ff.stdin.write(Buffer.from(png.split(",")[1], "base64"));
  if (!ok) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 75 === 0) console.log(`frame ${i}/${total}`);
}
ff.stdin.end();
await new Promise((ok, fail) => ff.on("exit", (c) => (c === 0 ? ok() : fail(new Error("ffmpeg " + c)))));
await browser.close();
console.log("wrote", outFile);
