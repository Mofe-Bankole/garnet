// Shared helpers for the showreel. Everything is a pure function of time t → deterministic frames.
const W = 1920, H = 1080, FPS = 30, DUR = 15;
const C = { bg: "#19171B", bg2: "#211E24", garnet: "#982E48", vivid: "#B7455D", deep: "#6F2034", ivory: "#F7EFEA", rose: "#E68B9B", gold: "#E8C37A", teal: "#8FC9A3" };
const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return [c, c.getContext("2d", { willReadFrequently: true })]; };
const [buf, ctx] = mk();
const [wc, wx] = mk();
const [wc2, wx2] = mk();
const [wc3, wx3] = mk();

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const TAU = Math.PI * 2;
const E = {
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
};
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function resetCtx(c) { c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.setLineDash([]); c.letterSpacing = "0px"; c.filter = "none"; c.textAlign = "left"; c.textBaseline = "alphabetic"; }

/** Per-letter layout centred on cx. */
function letters(c, str, font, cx, ls = 0) {
  c.font = font; c.letterSpacing = "0px";
  const ws = [...str].map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + ls * (str.length - 1);
  let x = cx - total / 2;
  return ws.map((w, i) => { const o = { ch: str[i], x: x + w / 2, w }; x += w + ls; return o; });
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=/<>";
/** Decoder-style text reveal. */
function scramble(c, str, x, y, p, t, font, color, ls = 0, align = "center") {
  c.font = font; c.letterSpacing = ls + "px"; c.textAlign = align; c.textBaseline = "middle"; c.fillStyle = color;
  const fr = Math.floor(t * 24); let out = "";
  for (let i = 0; i < str.length; i++) {
    const ri = i / str.length;
    if (str[i] === " ") out += " ";
    else if (p > ri * 0.6 + 0.4) out += str[i];
    else if (p > ri * 0.6) out += GLYPHS[Math.floor(hash(i * 31 + fr) * GLYPHS.length)];
    else out += " ";
  }
  c.fillText(out, x, y); c.letterSpacing = "0px";
}

function grid(alpha, step = 80, ox = 0, oy = 0) {
  if (alpha <= 0) return;
  ctx.strokeStyle = C.ivory; ctx.globalAlpha = alpha; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = ((ox % step) + step) % step; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = ((oy % step) + step) % step; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke(); ctx.globalAlpha = 1;
}

function glow(x, y, r, color, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(25,23,27,0)");
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1;
}

/** Garnet emblem (rhombic facets), assembling with progress p∈[0,1]. */
function emblem(c, x, y, s, p) {
  const F = [
    ["M16 2 28.1 9 16 16 3.9 9Z", C.vivid, 0, -7, 0],
    ["M16 16 3.9 9v14L16 30Z", C.garnet, -6.5, 3.5, 0.12],
    ["M16 16 28.1 9v14L16 30Z", C.deep, 6.5, 3.5, 0.24],
  ];
  c.save(); c.translate(x, y); c.scale(s, s); c.translate(-16, -16);
  for (const [d, col, dx, dy, delay] of F) {
    const q = seg(p, delay, delay + 0.6), e = E.outBack(q);
    c.save(); c.globalAlpha = E.outCubic(q); c.translate(dx * (1 - e), dy * (1 - e)); c.fillStyle = col; c.fill(new Path2D(d)); c.restore();
  }
  c.globalAlpha = seg(p, 0.6, 1); c.strokeStyle = C.ivory; c.lineWidth = 0.25;
  c.stroke(new Path2D("M16 16v14M16 16 3.9 9M16 16l12.1-7"));
  c.restore(); c.globalAlpha = 1;
}

/** Sample filled pixels of text into target points (deterministic). */
function textPoints(str, font, n, seed) {
  const [cv, c] = mk();
  c.fillStyle = "#fff"; c.font = font; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(str, W / 2, H / 2);
  const d = c.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(r() * pts.length)]);
  cv.width = 1;
  return out;
}
