// SCENE 4 · DATA (6–8.5s): animated bar chart, line draw, rolling counter, donut
function s4(lt) {
  ctx.fillStyle = C.ivory; ctx.fillRect(0, 0, W, H);
  // iris wipe in from previous dark scene
  const iris = E.inOutExpo(seg(lt, 0, 0.5));
  ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, iris * 1300, 0, TAU); ctx.clip();
  ctx.fillStyle = C.ivory; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.bg; ctx.globalAlpha = 0.07; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 300; y <= 860; y += 70) { ctx.moveTo(140, y + 0.5); ctx.lineTo(1180, y + 0.5); } ctx.stroke(); ctx.globalAlpha = 1;
  const vals = [0.38, 0.55, 0.47, 0.72, 0.64, 0.88, 0.79, 1.0];
  const bw = 90, gap = 40, x0 = 160, base = 860, maxH = 520;
  vals.forEach((v, i) => {
    const p = E.outExpo(seg(lt, 0.35 + i * 0.07, 1.1 + i * 0.07)), h = v * maxH * p;
    ctx.fillStyle = i === vals.length - 1 ? C.garnet : C.bg; ctx.globalAlpha = i === vals.length - 1 ? 1 : 0.88;
    ctx.fillRect(x0 + i * (bw + gap), base - h, bw, h);
  });
  ctx.globalAlpha = 1;
  // line chart over bars
  const lp = E.inOutCubic(seg(lt, 0.9, 1.9));
  ctx.strokeStyle = C.vivid; ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.beginPath();
  const pts = vals.map((v, i) => [x0 + i * (bw + gap) + bw / 2, base - v * maxH - 40]);
  const nseg = (pts.length - 1) * lp;
  for (let i = 0; i <= Math.floor(nseg) && i < pts.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i][0], pts[i][1]);
  const fi = Math.floor(nseg);
  if (fi < pts.length - 1) { const f = nseg - fi; ctx.lineTo(lerp(pts[fi][0], pts[fi + 1][0], f), lerp(pts[fi][1], pts[fi + 1][1], f)); }
  ctx.stroke();
  pts.forEach((p, i) => { if (i <= nseg) { ctx.fillStyle = C.ivory; ctx.strokeStyle = C.vivid; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, TAU); ctx.fill(); ctx.stroke(); } });
  // counter
  const cp = E.outExpo(seg(lt, 0.5, 2.0)), n = Math.round(cp * 1000);
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.bg;
  ctx.font = "800 250px Geist"; ctx.letterSpacing = "-10px";
  ctx.fillText(n.toLocaleString("en-US"), W - 150, 560); ctx.letterSpacing = "0px";
  ctx.font = 'italic 70px "Instrument Serif"'; ctx.fillStyle = C.garnet; ctx.fillText("frames of intent", W - 160, 650);
  // donut
  const dp = E.outExpo(seg(lt, 0.8, 2.1));
  ctx.lineWidth = 34; ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(25,23,27,0.1)"; ctx.beginPath(); ctx.arc(W - 330, 820, 100, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.vivid; ctx.beginPath(); ctx.arc(W - 330, 820, 100, -Math.PI / 2, -Math.PI / 2 + TAU * 0.86 * dp); ctx.stroke();
  ctx.font = '500 34px "Geist Mono"'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = C.bg;
  ctx.fillText(Math.round(86 * dp) + "%", W - 330, 820);
  ctx.font = '500 22px "Geist Mono"'; ctx.letterSpacing = "8px"; ctx.textAlign = "left"; ctx.fillStyle = C.bg; ctx.globalAlpha = 0.75;
  ctx.fillText("03 — DATA IN MOTION", 160, 150); ctx.globalAlpha = 1; ctx.letterSpacing = "0px";
  ctx.restore();
}

// SCENE 5 · PARTICLES (8.5–11s): 2,600 particles swirl in a flow field then converge into "CRAFT"
let P5 = null;
function initP5() {
  const r = rng(77), tgt = textPoints("CRAFT", "900 300px Geist", 2600, 9);
  P5 = tgt.map((t) => ({ sx: r() * W, sy: r() * H, tx: t[0], ty: t[1], ph: r() * TAU, sp: 0.6 + r() * 0.9, hue: r() }));
}
function s5(lt) {
  if (!P5) initP5();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // iris wipe from the light scene
  glow(W / 2, H / 2, 900, C.garnet, 0.35);
  const conv = E.inOutExpo(seg(lt, 0.7, 1.9));
  for (let i = 0; i < P5.length; i++) {
    const p = P5[i];
    const fx = p.sx + Math.cos(p.ph + lt * p.sp * 2.2 + p.sy * 0.004) * 160 * lt + Math.sin(lt * 1.3 + i) * 20;
    const fy = p.sy + Math.sin(p.ph + lt * p.sp * 2.0 + p.sx * 0.003) * 160 * lt;
    const x = lerp(fx, p.tx, conv), y = lerp(fy, p.ty, conv);
    const sz = lerp(2.4, 3.2, conv) * (1 + 0.6 * Math.sin(lt * 6 + i) * (1 - conv));
    ctx.fillStyle = p.hue > 0.82 ? C.rose : p.hue > 0.6 ? C.vivid : C.ivory;
    ctx.globalAlpha = lerp(0.65, 1, conv);
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  // shimmer sweep after convergence
  const sh = seg(lt, 1.95, 2.45);
  if (sh > 0 && sh < 1) {
    const sx = lerp(300, 1650, E.inOutCubic(sh));
    const g = ctx.createLinearGradient(sx - 140, 0, sx + 140, 0);
    g.addColorStop(0, "rgba(247,239,234,0)"); g.addColorStop(0.5, "rgba(247,239,234,0.35)"); g.addColorStop(1, "rgba(247,239,234,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(sx - 140, 340, 280, 400); ctx.globalCompositeOperation = "source-over";
  }
  ctx.font = '500 22px "Geist Mono"'; ctx.letterSpacing = "8px"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.ivory; ctx.globalAlpha = 0.8;
  ctx.fillText("04 — SYSTEMS", 120, 150);
  ctx.textAlign = "right"; ctx.fillStyle = C.rose; ctx.fillText(`${P5.length.toLocaleString("en-US")} PARTICLES · FLOW FIELD`, W - 120, 150);
  ctx.globalAlpha = 1; ctx.letterSpacing = "0px";
}

// SCENE 6 · 3D (11–13s): wireframe rhombic dodecahedron (garnet crystal) in perspective, rotating
const RD_V = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1], [2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]];
const RD_E = [];
for (let i = 0; i < 8; i++) for (let j = 8; j < 14; j++) {
  const a = RD_V[i], b = RD_V[j], d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  if (Math.abs(d - 3) < 0.01) RD_E.push([i, j]);
}
function project(v, ax, ay, s, cx, cy) {
  let [x, y, z] = v;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  const f = 7 / (7 + z);
  return [cx + x * s * f, cy + y * s * f, z];
}
function s6(lt) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // perspective floor grid
  const hz = H * 0.62;
  ctx.strokeStyle = C.ivory; ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const z = ((i + (lt * 3) % 1) / 18), y = hz + Math.pow(z, 2.2) * (H - hz);
    ctx.globalAlpha = 0.18 * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -14; i <= 14; i++) { ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hz); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
  ctx.globalAlpha = 1;
  glow(W / 2, H / 2 - 40, 560, C.garnet, 0.55);
  const build = E.outExpo(seg(lt, 0, 0.9));
  const ax = 0.5 + lt * 0.55, ay = lt * 1.1, s = 170 * lerp(0.4, 1, build), cx = W / 2, cy = H / 2 - 40;
  const P = RD_V.map((v) => project(v, ax, ay, s, cx, cy));
  const edges = RD_E.map(([a, b]) => [a, b, (P[a][2] + P[b][2]) / 2]).sort((u, v) => v[2] - u[2]);
  edges.forEach(([a, b, z], i) => {
    const ep = seg(build * RD_E.length, i, i + 1);
    const back = z > 0;
    ctx.strokeStyle = back ? C.vivid : C.ivory; ctx.globalAlpha = back ? 0.35 : 0.95; ctx.lineWidth = back ? 1.5 : 3;
    ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(lerp(P[a][0], P[b][0], ep), lerp(P[a][1], P[b][1], ep)); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  P.forEach((p, i) => { ctx.fillStyle = i >= 8 ? C.rose : C.ivory; ctx.beginPath(); ctx.arc(p[0], p[1], (i >= 8 ? 7 : 5) * build, 0, TAU); ctx.fill(); });
  // spinning dashed ring
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-lt * 0.8); ctx.setLineDash([4, 14]); ctx.strokeStyle = C.ivory; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 440, 0, TAU); ctx.stroke(); ctx.restore(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.font = '500 22px "Geist Mono"'; ctx.letterSpacing = "8px"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.ivory; ctx.globalAlpha = 0.8;
  ctx.fillText("05 — DIMENSION", 120, 150);
  ctx.textAlign = "right"; ctx.fillStyle = C.rose; ctx.fillText("RHOMBIC DODECAHEDRON · 14V / 24E", W - 120, 150);
  ctx.textAlign = "left"; ctx.fillStyle = C.ivory; ctx.globalAlpha = 0.45;
  ctx.fillText(`X ${ax.toFixed(2)}  Y ${ay.toFixed(2)}  FOV 7.0`, 120, H - 150);
  ctx.globalAlpha = 1; ctx.letterSpacing = "0px";
}

// SCENE 7 · FINALE (13–15s): crystal collapses into the Garnet emblem, wordmark, signature line
function s7(lt) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 - 70;
  grid(0.035);
  const flash = 1 - E.outCubic(seg(lt, 0, 0.35));
  glow(cx, cy, 700, C.vivid, 0.5 + flash * 0.4);
  // converging lines
  const cl = seg(lt, 0, 0.6);
  if (cl < 1) {
    ctx.strokeStyle = C.ivory; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - cl; ctx.beginPath();
    for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU + 0.2, r0 = lerp(900, 160, E.inOutExpo(cl)), r1 = lerp(1300, 220, E.inOutExpo(cl)); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  const ep = seg(lt, 0.2, 1.0);
  emblem(ctx, cx, cy, 9 * E.outBack(clamp(ep * 1.3)), ep);
  // glint
  const gl = seg(lt, 0.9, 1.3);
  if (gl > 0 && gl < 1) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(9, 9); ctx.translate(-16, -16); ctx.clip(new Path2D("M16 2 28.1 9v14L16 30 3.9 23V9Z"));
    const gx = lerp(-10, 42, E.inOutCubic(gl)), g = ctx.createLinearGradient(gx - 5, 0, gx + 5, 0);
    g.addColorStop(0, "rgba(247,239,234,0)"); g.addColorStop(0.5, "rgba(247,239,234,0.8)"); g.addColorStop(1, "rgba(247,239,234,0)");
    ctx.fillStyle = g; ctx.fillRect(-10, -10, 60, 60); ctx.restore();
  }
  const L = letters(ctx, "Garnet", '150px "Instrument Serif"', cx, 0);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.ivory;
  ctx.save(); ctx.beginPath(); ctx.rect(0, cy + 200, W, 190); ctx.clip();
  L.forEach((o, i) => { const p = E.outExpo(seg(lt, 0.55 + i * 0.05, 1.2 + i * 0.05)); ctx.fillText(o.ch, o.x, cy + 340 + (1 - p) * 180); });
  ctx.restore();
  const tg = seg(lt, 1.15, 1.7);
  if (tg > 0) scramble(ctx, "AGENTS CAN TRANSACT · EVERY OUTCOME SHOULD BE PROVABLE", cx, cy + 420, tg, lt, '500 24px "Geist Mono"', C.rose, 6);
}
