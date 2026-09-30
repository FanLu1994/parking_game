// ─── Math helpers ─────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const deg2rad = d => d * Math.PI / 180;
const rad2deg = r => r * 180 / Math.PI;
const dist2 = (ax, ay, bx, by) => (ax-bx)**2 + (ay-by)**2;
const dist  = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

// ─── OBB (Oriented Bounding Box) ──────────────────────────────────────────────
// Returns the four corner world-coordinates of a rect (cx,cy,w,h,angle_rad)
function obbCorners(cx, cy, w, h, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const hw = w / 2, hh = h / 2;
  return [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ].map(([lx, ly]) => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]);
}

// Separating-axis test for two OBBs. Returns overlap area approximation (px²)
// or 0 if no intersection.
function obbOverlap(ax, ay, aw, ah, aa, bx, by, bw, bh, ba) {
  const ca = obbCorners(ax, ay, aw, ah, aa);
  const cb = obbCorners(bx, by, bw, bh, ba);
  if (!satTest(ca, cb)) return 0;
  // Approximate overlap via AABB of intersection — good enough for scoring
  const axs = ca.map(p => p[0]), ays = ca.map(p => p[1]);
  const bxs = cb.map(p => p[0]), bys = cb.map(p => p[1]);
  const ix0 = Math.max(Math.min(...axs), Math.min(...bxs));
  const ix1 = Math.min(Math.max(...axs), Math.max(...bxs));
  const iy0 = Math.max(Math.min(...ays), Math.min(...bys));
  const iy1 = Math.min(Math.max(...ays), Math.max(...bys));
  if (ix1 <= ix0 || iy1 <= iy0) return 0;
  return (ix1 - ix0) * (iy1 - iy0);
}

function satTest(poly1, poly2) {
  for (const poly of [poly1, poly2]) {
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const nx = -(poly[j][1] - poly[i][1]);
      const ny =   poly[j][0] - poly[i][0];
      const p1 = poly1.map(p => p[0]*nx + p[1]*ny);
      const p2 = poly2.map(p => p[0]*nx + p[1]*ny);
      if (Math.min(...p1) > Math.max(...p2) || Math.min(...p2) > Math.max(...p1)) return false;
    }
  }
  return true;
}

// Point-in-polygon (ray casting)
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// Fraction of OBB area that is inside a polygon
function obbFractionInPoly(cx, cy, w, h, angle, poly) {
  const corners = obbCorners(cx, cy, w, h, angle);
  const inside = corners.filter(([px, py]) => pointInPoly(px, py, poly)).length;
  return inside / 4;
}

// Closest distance between two OBBs (edge-to-edge approximation)
function obbMinDist(ax, ay, aw, ah, aa, bx, by, bw, bh, ba) {
  const ca = obbCorners(ax, ay, aw, ah, aa);
  const cb = obbCorners(bx, by, bw, bh, ba);
  let minD = Infinity;
  for (const pa of ca) for (const pb of cb)
    minD = Math.min(minD, dist(pa[0], pa[1], pb[0], pb[1]));
  return minD;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 以随机数为种子的确定性生成（草簇纹理等）
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// 角度归一化到 (-π, π]
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

// 轴对齐矩形（x,y,w,h）→ 多边形
const rectPoly = r => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];

// OBB 与多边形重叠面积占 OBB 面积的比例（网格采样，精度足够计分用）
function obbCoverage(cx, cy, w, h, angle, poly, n = 8) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let hit = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const lx = ((i + 0.5) / n - 0.5) * w;
    const ly = ((j + 0.5) / n - 0.5) * h;
    if (pointInPoly(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos, poly)) hit++;
  }
  return hit / (n * n);
}

// OBB 与多边形是否相交
function obbIntersectsPoly(cx, cy, w, h, angle, poly) {
  return satTest(obbCorners(cx, cy, w, h, angle), poly);
}

// 凸多边形最小分离向量：把 A 推出 B 的方向和深度；不相交返回 null
function satMTV(A, B) {
  let best = Infinity, bx = 0, by = 0;
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      let nx = -(poly[j][1] - poly[i][1]), ny = poly[j][0] - poly[i][0];
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const p of A) { const d = p[0] * nx + p[1] * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
      for (const p of B) { const d = p[0] * nx + p[1] * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
      const o = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (o <= 0) return null;
      if (o < best) { best = o; bx = nx; by = ny; }
    }
  }
  const ca = centroid(A), cb = centroid(B);
  if ((ca[0] - cb[0]) * bx + (ca[1] - cb[1]) * by < 0) { bx = -bx; by = -by; }
  return { x: bx, y: by, depth: best };
}

function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

// 点到线段距离
function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 两个不相交凸多边形的最近边距（相交返回 0）
function polyDist(A, B) {
  if (satTest(A, B)) return 0;
  let m = Infinity;
  for (const [P, Q] of [[A, B], [B, A]])
    for (const p of P)
      for (let i = 0; i < Q.length; i++) {
        const q1 = Q[i], q2 = Q[(i + 1) % Q.length];
        m = Math.min(m, pointSegDist(p[0], p[1], q1[0], q1[1], q2[0], q2[1]));
      }
  return m;
}

// Screen-shake state
const screenShake = { x: 0, y: 0, power: 0 };
function addShake(power) { screenShake.power = Math.max(screenShake.power, power); }
function updateShake(dt) {
  if (screenShake.power < 0.5) { screenShake.x = screenShake.y = 0; return; }
  screenShake.x = (Math.random() - 0.5) * screenShake.power * 2;
  screenShake.y = (Math.random() - 0.5) * screenShake.power * 2;
  screenShake.power *= Math.pow(0.15, dt);
}
