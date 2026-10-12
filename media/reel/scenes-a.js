// SCENE 1 · IMPACT (0–2s): shockwave rings, orbiting arcs, ray burst, decoder subtitle
function s1(lt) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  grid(0.045 * E.outCubic(seg(lt, 0, 1.2)));
  glow(cx, cy, 760, C.garnet, 0.4 * E.outCubic(seg(lt, 0, 1.5)));
  for (let k = 0; k < 4; k++) {
    const p = seg(lt, k * 0.42, k * 0.42 + 1.1);
    if (p <= 0 || p >= 1) continue;
    ctx.strokeStyle = k % 2 ? C.rose : C.vivid; ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = lerp(16, 1, p);
    ctx.beginPath(); ctx.arc(cx, cy, E.outExpo(p) * (280 + k * 240), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const ar = E.outExpo(seg(lt, 0.3, 1.3));
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = k === 1 ? C.rose : C.ivory; ctx.globalAlpha = 0.55 * ar; ctx.lineWidth = k === 1 ? 4 : 2;
    const r = 150 + k * 52, a0 = lt * (1.8 + k * 0.6) * (k % 2 ? -1 : 1) + k * 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + ar * (1.1 + k * 0.45)); ctx.stroke();
    // tick on arc head
    const ah = a0 + ar * (1.1 + k * 0.45);
    ctx.fillStyle = C.ivory; ctx.beginPath(); ctx.arc(cx + Math.cos(ah) * r, cy + Math.sin(ah) * r, 4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const pulse = Math.max(0, ...[0, 0.42, 0.84, 1.26].map((b) => { const p = seg(lt, b, b + 0.3); return p > 0 && p < 1 ? 1 - E.outCubic(p) : 0; }));
  const dr = lerp(8, 30, pulse) * E.outBack(seg(lt, 0, 0.3));
  ctx.fillStyle = C.ivory; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, dr), 0, TAU); ctx.fill();
  const rb = seg(lt, 0.95, 1.7);
  if (rb > 0 && rb < 1) {
    ctx.strokeStyle = C.ivory; ctx.lineWidth = 2; ctx.globalAlpha = 1 - rb; ctx.beginPath();
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * TAU, r0 = lerp(40, 560, E.outExpo(rb)), r1 = lerp(70, 820, E.outExpo(Math.min(1, rb * 1.4)));
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (lt > 1.1) scramble(ctx, "SHOWREEL  ·  MMXXVI", cx, cy + 200, seg(lt, 1.1, 1.75), lt, '500 30px "Geist Mono"', C.ivory, 14);
}

// SCENE 2 · KINETIC TYPE (2–4s): panel wipe, masked letter rise, RGB-split slice glitch, serif reveal
function drawMotion(c, color, lt) {
  c.clearRect(0, 0, W, H);
  const font = "900 340px Geist", L = letters(c, "MOTION", font, W / 2, -8);
  c.font = font; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = color;
  const base = H / 2 + 120;
  c.save(); c.beginPath(); c.rect(0, base - 310, W, 360); c.clip();
  L.forEach((o, i) => { const p = E.outExpo(seg(lt, 0.25 + i * 0.05, 0.9 + i * 0.05)); c.fillText(o.ch, o.x, base + (1 - p) * 360); });
  c.restore();
}
function s2(lt) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const pin = E.inOutExpo(seg(lt, 0, 0.45)), pout = E.inOutExpo(seg(lt, 1.42, 1.85));
  const px = lerp(-W, 0, pin) + lerp(0, W * 1.1, pout);
  if (lt > 1.35) {
    grid(0.04);
    const L = letters(ctx, "design", 'italic 380px "Instrument Serif"', W / 2, 2);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.ivory;
    L.forEach((o, i) => {
      const p = E.outExpo(seg(lt, 1.5 + i * 0.04, 1.98 + i * 0.04));
      ctx.save(); ctx.globalAlpha = p; ctx.translate(o.x, H / 2 + 115 + (1 - p) * 110); ctx.rotate((1 - p) * 0.35); ctx.fillText(o.ch, 0, 0); ctx.restore();
    });
    const u = E.outExpo(seg(lt, 1.62, 2)); ctx.fillStyle = C.vivid; ctx.fillRect(W / 2 - 400 * u, H / 2 + 175, 800 * u, 5);
  }
  // panel (skewed leading edge)
  ctx.save(); ctx.beginPath(); ctx.moveTo(px - 120, 0); ctx.lineTo(px + W + 200, 0); ctx.lineTo(px + W + 200, H); ctx.lineTo(px, H); ctx.closePath();
  ctx.fillStyle = C.garnet; ctx.fill(); ctx.clip();
  ctx.strokeStyle = C.vivid; ctx.globalAlpha = 0.28; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = -20; i < 44; i++) { const x = px + i * 70 + ((lt * 160) % 70); ctx.moveTo(x, 0); ctx.lineTo(x - 520, H); }
  ctx.stroke(); ctx.globalAlpha = 1;
  drawMotion(wx, C.ivory, lt);
  const sl = seg(lt, 0.98, 1.42);
  if (sl > 0) {
    drawMotion(wx2, C.rose, lt); drawMotion(wx3, C.teal, lt);
    const ch = Math.sin(sl * Math.PI) * 30;
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.9;
    ctx.drawImage(wc2, px + ch, 0); ctx.drawImage(wc3, px - ch, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  const bands = 9, bh = H / bands;
  for (let k = 0; k < bands; k++) {
    const dx = (k % 2 ? 1 : -1) * (40 + hash(k + Math.floor(lt * 12)) * 180) * Math.sin(sl * Math.PI);
    ctx.drawImage(wc, 0, k * bh, W, bh, px + dx, k * bh, W, bh);
  }
  ctx.font = '500 20px "Geist Mono"'; ctx.letterSpacing = "6px"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.ivory; ctx.globalAlpha = 0.75;
  ctx.fillText("01 — KINETIC TYPE", px + 120, 150);
  ctx.textAlign = "right"; ctx.fillText("GEIST 900 / 340PX", px + W - 120, 150);
  ctx.restore(); ctx.globalAlpha = 1; ctx.letterSpacing = "0px";
}

// SCENE 3 · GEOMETRY MORPH (4–6s): rotating polygon morph tri→quad→hex→star→circle, echoes, orbit dots
const SHAPES = [[3, 0], [4, 0], [6, 0], [5, 1], [0, 0]];
const SHAPE_NAMES = ["TRIANGLE", "SQUARE", "HEXAGON", "STAR", "CIRCLE"];
const NPTS = 240;
function shapePts(def, r) {
  const [n, star] = def, out = [];
  for (let i = 0; i < NPTS; i++) {
    const u = i / NPTS, a = u * TAU - Math.PI / 2;
    if (n === 0) { out.push([Math.cos(a) * r, Math.sin(a) * r]); continue; }
    const sides = star ? n * 2 : n, k = Math.floor(u * sides), f = u * sides - k;
    const rad = (j) => (star && j % 2 ? r * 0.45 : r);
    const a0 = (k / sides) * TAU - Math.PI / 2, a1 = ((k + 1) / sides) * TAU - Math.PI / 2;
    const p0 = [Math.cos(a0) * rad(k), Math.sin(a0) * rad(k)], p1 = [Math.cos(a1) * rad(k + 1), Math.sin(a1) * rad(k + 1)];
    out.push([lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)]);
  }
  return out;
}
function morphAt(lt, r) {
  const span = 2 / (SHAPES.length - 1);
  const k = Math.min(SHAPES.length - 2, Math.floor(lt / span)), f = E.inOutExpo(seg(lt, k * span + span * 0.25, (k + 1) * span));
  const A = shapePts(SHAPES[k], r), B = shapePts(SHAPES[k + 1], r);
  return { pts: A.map((p, i) => [lerp(p[0], B[i][0], f), lerp(p[1], B[i][1], f)]), k: f > 0.5 ? k + 1 : k };
}
function s3(lt) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  grid(0.035, 120, lt * 40, lt * 20);
  glow(cx, cy, 520, C.garnet, 0.45);
  // echoes
  for (let e = 5; e >= 0; e--) {
    const t = Math.max(0, lt - e * 0.05), { pts } = morphAt(t, 300 - e * 6), rot = t * 0.9;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    if (e === 0) {
      const g = ctx.createLinearGradient(-300, -300, 300, 300); g.addColorStop(0, C.vivid); g.addColorStop(1, C.deep);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.rose; ctx.lineWidth = 3; ctx.stroke();
    } else { ctx.strokeStyle = C.ivory; ctx.globalAlpha = 0.28 - e * 0.04; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // orbiting satellites with trails
  for (let s = 0; s < 3; s++) {
    for (let tr = 0; tr < 14; tr++) {
      const tt = lt - tr * 0.012, a = tt * (2.4 + s * 0.8) + s * 2.1, r = 400 + s * 40;
      ctx.fillStyle = s === 1 ? C.rose : C.ivory; ctx.globalAlpha = (1 - tr / 14) * 0.9;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.42, (1 - tr / 14) * 7, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // crosshair + labels
  ctx.strokeStyle = C.ivory; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40); ctx.stroke(); ctx.globalAlpha = 1;
  const { k } = morphAt(lt, 300);
  ctx.font = '500 22px "Geist Mono"'; ctx.letterSpacing = "8px"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.ivory;
  ctx.globalAlpha = 0.8; ctx.fillText("02 — GEOMETRY", 120, 150);
  ctx.textAlign = "right"; ctx.fillStyle = C.rose; ctx.fillText(`MORPH → ${SHAPE_NAMES[k]}`, W - 120, 150);
  ctx.textAlign = "left"; ctx.fillStyle = C.ivory; ctx.globalAlpha = 0.5;
  ctx.fillText(`ROT ${((lt * 0.9 * 180) / Math.PI).toFixed(1).padStart(6, "0")}°   EASE inOutExpo`, 120, H - 150);
  ctx.globalAlpha = 1; ctx.letterSpacing = "0px";
}
