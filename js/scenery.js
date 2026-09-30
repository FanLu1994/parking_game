// ─── 场景装饰（纯视觉：不参与碰撞与判定）──────────────────────────────────────
// 光照约定：光从左上来，高物体的投影落向右下

const DecoCache = {};

// 颗粒噪点纹理（沥青 / 路面）
function grainPattern(ctx, name, dots, alpha) {
  const key = name + ':' + dots + ':' + alpha;
  if (DecoCache[key]) return DecoCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rnd = mulberry32(dots * 31 + 7);
  for (let i = 0; i < dots; i++) {
    const light = rnd() < 0.5;
    g.fillStyle = light ? `rgba(255,255,255,${alpha * rnd()})` : `rgba(0,0,0,${alpha * 1.6 * rnd()})`;
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), rnd() < 0.2 ? 2 : 1, 1);
  }
  return (DecoCache[key] = ctx.createPattern(c, 'repeat'));
}

function shadowRect(g, r, dx = 6, dy = 8, a = 0.3) {
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.fillRect(r.x + dx, r.y + dy, r.w, r.h);
}

// 树冠（俯视）：投影 + 深浅两层 + 高光
function drawTree(g, x, y, r, tone = 0) {
  const greens = [['#1f4a24', '#2d6a32', '#3f8a44'], ['#24502a', '#356f37', '#4c9a4a'], ['#2a4a1e', '#3d6a2a', '#58883a']][tone % 3];
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.arc(x + r * 0.35, y + r * 0.45, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = greens[0];
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = greens[1];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + r;
    g.beginPath(); g.arc(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, r * 0.55, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = greens[2];
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.38, 0, Math.PI * 2); g.fill();
}

function drawBush(g, x, y, r) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.arc(x + 2, y + 3, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a5a2c';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3a7a3a';
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); g.fill();
}

// 路灯（俯视）：灯杆 + 灯臂 + 灯头
function drawLamp(g, x, y, dir = 1) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 2, 20 * dir, 3);
  g.fillStyle = '#5a5f66'; g.fillRect(x, y - 1, 18 * dir, 3);
  g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e4cc'; g.fillRect(x + 14 * dir - (dir < 0 ? 6 : 0), y - 2.5, 6, 5);
}

// 楼顶（俯视）：女儿墙 + 空调外机 + 水箱
function drawRoof(g, r, seed, base = '#4a4540') {
  const rnd = mulberry32(seed);
  shadowRect(g, r, 8, 10, 0.35);
  g.fillStyle = base; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(r.x, r.y, r.w, 3); g.fillRect(r.x, r.y, 3, r.h);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(r.x, r.y + r.h - 4, r.w, 4); g.fillRect(r.x + r.w - 3, r.y, 3, r.h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  g.strokeRect(r.x + 6.5, r.y + 6.5, r.w - 13, r.h - 13);
  const n = Math.max(1, Math.floor(r.w * r.h / 5000));
  for (let i = 0; i < n; i++) {
    const w = 14 + rnd() * 10, h = 10 + rnd() * 6;
    const x = r.x + 10 + rnd() * Math.max(1, r.w - w - 20), y = r.y + 10 + rnd() * Math.max(1, r.h - h - 20);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 3, w, h);
    g.fillStyle = '#8a8d92'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#6a6d72';
    g.beginPath(); for (let k = x + 3; k < x + w - 1; k += 3) { g.moveTo(k + 0.5, y + 2); g.lineTo(k + 0.5, y + h - 2); } g.stroke();
  }
  if (r.w > 80 && r.h > 50 && rnd() < 0.7) {
    const x = r.x + r.w - 26, y = r.y + 22;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 3, y + 4, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c8ccd0'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9a9ea3'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke();
  }
}

// 坡屋顶（民房 / 农房）：屋脊 + 瓦垄
function drawPitchedRoof(g, x, y, w, h, color) {
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(x + 6, y + 8, w, h);
  g.fillStyle = color; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + w / 2, y, w / 2, h);   // 背光坡
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
  g.beginPath();
  for (let yy = y + 5; yy < y + h; yy += 5) { g.moveTo(x, yy + 0.5); g.lineTo(x + w, yy + 0.5); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + w / 2 - 1.5, y, 3, h);  // 屋脊
}

// 路牌（俯视看到牌面）：蓝底 / 绿底白字
function drawSign(g, x, y, text, bg = '#2a5aa8') {
  g.save();
  g.font = `bold 11px ${FONT_BODY}`;
  const w = g.measureText(text).width + 14;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - w / 2 + 4, y - 9 + 5, w, 18);
  g.fillStyle = '#5a5f66'; g.fillRect(x - 1.5, y + 9, 3, 8);
  g.fillStyle = bg; g.fillRect(x - w / 2, y - 9, w, 18);
  g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x - w / 2 + 2.5, y - 6.5, w - 5, 13);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x, y + 0.5);
  g.restore();
}

// 地面箭头标线
function drawFloorArrow(g, x, y, angle) {
  g.save();
  g.translate(x, y); g.rotate(angle);
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.moveTo(-26, -5); g.lineTo(8, -5); g.lineTo(8, -12); g.lineTo(26, 0);
  g.lineTo(8, 12); g.lineTo(8, 5); g.lineTo(-26, 5); g.closePath(); g.fill();
  g.restore();
}

// ─── 停车场景 ─────────────────────────────────────────────────────────────────

// 地面：颗粒 + 油渍 + 裂缝（+ 地库伸缩缝）
function decorParkFloor(g, sc, seed) {
  const rnd = mulberry32(seed);
  g.fillStyle = grainPattern(g, 'floor', 1400, 0.07);
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (sc.theme === 'garage') {
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = 16 + 196; x < 984; x += 196) { g.moveTo(x + 0.5, 56); g.lineTo(x + 0.5, 604); }
    g.moveTo(16, 330.5); g.lineTo(984, 330.5);
    g.stroke();
  }
  // 油渍：多集中在车位里（车头位置）
  const stains = [];
  for (const s of sc.spots) if (rnd() < 0.45) stains.push([s.x + (rnd() - 0.5) * 16, s.y + (rnd() - 0.5) * 30]);
  for (let i = 0; i < 6; i++) stains.push([30 + rnd() * 940, 70 + rnd() * 520]);
  for (const [x, y] of stains) {
    const r = 5 + rnd() * 9;
    g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.12})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + r * 0.7, y + r * 0.4, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); g.fill();
  }
  // 裂缝
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let x = 40 + rnd() * 920, y = 80 + rnd() * 480, a = rnd() * Math.PI * 2;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
    g.stroke();
  }
}

// 地库顶灯光斑（叠加在地面上）
function decorGarageLights(g) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let x = 120; x < 960; x += 190)
    for (const y of [150, 330, 510]) {
      const rg = g.createRadialGradient(x, y, 4, x, y, 150);
      rg.addColorStop(0, 'rgba(200,215,230,0.10)');
      rg.addColorStop(1, 'rgba(200,215,230,0)');
      g.fillStyle = rg; g.fillRect(x - 150, y - 150, 300, 300);
    }
  g.restore();
}

// 车位细节：车轮挡 + 编号（靠通道一侧）
function decorSpot(g, s, i, theme) {
  if (theme === 'street') return;                   // 路边侧方位不设车轮挡
  const deep = s.y < 330 ? -1 : 1;                  // 车位尽头朝向（上排朝上，下排朝下）
  g.save();
  g.translate(s.x, s.y); g.rotate(s.angle);
  const hh = s.h / 2;
  // 车轮挡（水泥灰，和黄黑地锁区分开）
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-13, deep * (hh - 12) - 1, 28, 5);
  g.fillStyle = '#8a8680'; g.fillRect(-14, deep * (hh - 12) - 2.5, 11, 4); g.fillRect(3, deep * (hh - 12) - 2.5, 11, 4);
  // 编号
  if (s.kind === 'normal') {
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.font = `bold 10px ${FONT_BODY}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((theme === 'garage' ? 'B' : 'P') + String(101 + i).slice(-3), 0, -deep * (hh - 12));
  }
  g.restore();
}

// 外墙：按主题画成地库墙 / 小区绿篱 / 街道对面人行道
function decorWall(g, r, theme, seed) {
  const rnd = mulberry32(seed);
  if (theme === 'garage') {
    shadowRect(g, r, 0, 0, 0);
    g.fillStyle = '#3a3d44'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = r.x; x < r.x + r.w; x += 48) g.fillRect(x, r.y, 1, r.h);
    // 墙脚黄黑警示条（朝场内一侧）
    g.fillStyle = getPattern(g, 'hatch');
    if (r.w > r.h) g.fillRect(r.x, r.y < 300 ? r.y + r.h - 4 : r.y, r.w, 4);
    else g.fillRect(r.x < 500 ? r.x + r.w - 4 : r.x, r.y, 4, r.h);
    return;
  }
  if (theme === 'plaza') {
    g.fillStyle = '#233a24'; g.fillRect(r.x, r.y, r.w, r.h);
    const along = r.w > r.h, len = along ? r.w : r.h, th = along ? r.h : r.w;
    for (let t = 0; t < len; t += 11) {
      const cx = along ? r.x + t + 5 : r.x + th / 2, cy = along ? r.y + th / 2 : r.y + t + 5;
      const rr = Math.min(th / 2 + 1, 7 + rnd() * 3);
      g.fillStyle = '#2d5a2d'; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d7a3a'; g.beginPath(); g.arc(cx - 2, cy - 2, rr * 0.5, 0, Math.PI * 2); g.fill();
    }
    return;
  }
  // street：人行道地砖 + 路牙
  g.fillStyle = getPattern(g, 'tiles'); g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = '#9a968e';
  if (r.w > r.h) g.fillRect(r.x, r.y < 300 ? r.y + r.h - 5 : r.y, r.w, 5);
  else g.fillRect(r.x < 500 ? r.x + r.w - 5 : r.x, r.y, 5, r.h);
}

// 场内边缘的墙体投影（墙比地面高）
function decorEdgeShadow(g) {
  const strips = [
    [16, 56, 968, 14, 0, 1], [16, 56, 14, 548, 1, 0],
  ];
  for (const [x, y, w, h, gx, gy] of strips) {
    const lg = g.createLinearGradient(x, y, x + gx * w, y + gy * h);
    lg.addColorStop(0, 'rgba(0,0,0,0.35)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(x, y, w, h);
  }
}

// 街道：沿街店铺雨棚 + 行道树 + 路灯（全部画在人行道墙体内）
function decorStreet(g, sc, seed) {
  const rnd = mulberry32(seed);
  const walk = (sc.sidewalks || [])[0];
  if (!walk) return;
  const shops = ['便利店', '理发', '奶茶', '五金', '修车', '早餐', '药店', '水果'];
  const entrance = (sc.entrances || [])[0];
  const blocked = x => entrance && x > entrance.x - 30 && x < entrance.x + entrance.w + 10;
  // 店铺雨棚（人行道靠里一侧）
  const shopOff = Math.floor(rnd() * shops.length);
  for (let x = walk.x + 8, i = 0; x < walk.x + walk.w - 90; x += 118, i++) {
    if (blocked(x + 50)) continue;
    const w = 104, colors = [['#b8483a', '#e8e4dc'], ['#3a6ab8', '#e8e4dc'], ['#3a8a5a', '#f0ead8'], ['#c8962a', '#fff4d8']][i % 4];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 4, walk.y + 4, w, 26);
    for (let k = 0; k < w; k += 13) { g.fillStyle = (k / 13) % 2 ? colors[1] : colors[0]; g.fillRect(x + k, walk.y, Math.min(13, w - k), 24); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, walk.y + 18, w, 6);
    drawLabel(g, shops[(i + shopOff) % shops.length], x + w / 2, walk.y + 10, '#fff', 10, 'rgba(0,0,0,0.5)');
  }
  // 行道树 + 路灯交替（靠路牙一侧）
  const ty = walk.y + walk.h - 30;
  for (let x = walk.x + 60, i = 0; x < walk.x + walk.w - 30; x += 120, i++) {
    if (blocked(x)) continue;
    g.fillStyle = '#3a2e22'; g.fillRect(x - 11, ty - 11, 22, 22);
    g.strokeStyle = '#7a766e'; g.lineWidth = 2; g.strokeRect(x - 11, ty - 11, 22, 22);
    drawTree(g, x, ty - 4, 22, i);
    if (!blocked(x + 60)) drawLamp(g, x + 60, walk.y + walk.h - 12, 1);
  }
  // 雨水篦子（路牙边）
  g.fillStyle = '#1a1c20';
  for (let x = walk.x + 30; x < walk.x + walk.w; x += 180) {
    if (blocked(x)) continue;
    g.fillRect(x, walk.y + walk.h + 1, 22, 7);
    g.fillStyle = '#34373d';
    for (let k = 2; k < 22; k += 4) g.fillRect(x + k, walk.y + walk.h + 2, 2, 5);
    g.fillStyle = '#1a1c20';
  }
  // 路面：窨井盖 + 修补块
  for (let i = 0; i < 3; i++) {
    const x = 120 + rnd() * 760, y = 420 + rnd() * 140;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2d31'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.moveTo(x - 11, y); g.lineTo(x + 11, y); g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(60 + rnd() * 860, 250 + rnd() * 320, 30 + rnd() * 50, 16 + rnd() * 26);
  }
}

// 小区 / 广场：楼前铺装步道
function decorPlaza(g, sc) {
  const b = sc.building;
  if (!b) return;
  g.fillStyle = 'rgba(160,150,135,0.10)';
  g.fillRect(b.x - 20, b.y + b.h, b.w + 40, 14);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = b.x - 20; x < b.x + b.w + 20; x += 14) { g.moveTo(x + 0.5, b.y + b.h); g.lineTo(x + 0.5, b.y + b.h + 14); }
  g.stroke();
}

// 广场舞专区：音箱线 + 地面磨损
function decorDance(g, r, speaker) {
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.32, r.h * 0.3, 0, 0, Math.PI * 2); g.fill();
  if (speaker) {
    g.strokeStyle = '#111'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(speaker.x + speaker.w / 2, speaker.y + speaker.h);
    g.bezierCurveTo(speaker.x - 20, speaker.y + speaker.h + 30, r.x + r.w - 20, r.y + r.h - 10, r.x + r.w, r.y + r.h - 30);
    g.stroke();
  }
}

// 地库：通道地面喷涂的分区字 + 出口指示牌（上墙会被 HUD 顶栏挡住，所以画在地面）
function decorGarageSigns(g, sc) {
  g.save();
  g.font = `bold 40px ${FONT_TITLE}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillText('B1-A', 260, 330);
  g.fillText('B1-B', 910, 330);
  g.restore();
  for (const e of sc.entrances || []) drawLabel(g, '← 出口', e.x + 36, e.y - 12, '#fff', 10, '#1e7a3e');
}

// ─── 驾驶场景：路边景观（按区块确定性生成，每帧绘制）────────────────────────
const ROADSIDE = {
  highway: { ground: '#223626', patch: '#284030' },
  rural:   { ground: '#2e3a22', patch: '#36442a' },
  city:    { ground: '#26282c', patch: '#2c2e33' },
  village: { ground: '#3a342c', patch: '#423a30' },
};
const IRONIC_SIGNS = ['保持车距', '文明驾驶', '请勿随意变道', '礼让是美德', '禁止鸣笛', '开车别看手机'];
const SCENERY_CH = 260;

function roadsideChunk(scene, k) {
  const cache = scene.sceneryCache || (scene.sceneryCache = new Map());
  if (cache.has(k)) return cache.get(k);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  const kind = scene.cfg.scenery || 'highway';
  const rnd = mulberry32(k * 7919 + scene.level.n * 131 + 17);
  const y0 = k * SCENERY_CH;
  const L = [8, scene.railL - 14];
  const Rside = [scene.railR + (scene.cfg.exitEvery ? RAMP_W + 24 : 14), CANVAS_W - 8];
  const items = [];
  const sides = [L, Rside].filter(s => s[1] - s[0] > 30);
  const at = (s, m = 0) => s[0] + m + rnd() * Math.max(1, s[1] - s[0] - 2 * m);

  for (const s of sides) {
    const near = s === L ? s[1] : s[0];                    // 靠近道路的一侧
    const dirOut = s === L ? -1 : 1;
    if (kind === 'highway') {
      if (rnd() < 0.6) items.push({ t: 'patch', x: at(s), y: y0 + rnd() * SCENERY_CH, r: 30 + rnd() * 60 });
      const n = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++)
        items.push({ t: 'tree', x: at(s, 30), y: y0 + rnd() * SCENERY_CH, r: 14 + rnd() * 12, tone: Math.floor(rnd() * 3) });
      if (rnd() < 0.5) items.push({ t: 'bush', x: near + dirOut * (18 + rnd() * 20), y: y0 + rnd() * SCENERY_CH, r: 7 + rnd() * 4 });
    } else if (kind === 'rural') {
      // 农田：横向条带 + 垄沟
      items.push({ t: 'field', x0: s[0], x1: s[1], y: y0, h: SCENERY_CH, c: ['#3a4a26', '#4a4a24', '#2f4a2a', '#5a5230'][Math.floor(rnd() * 4)], dir: dirOut });
      if (rnd() < 0.35) {
        const w = 60 + rnd() * 30, h = 44 + rnd() * 20;
        const x = Math.max(s[0] + 10, Math.min(s[1] - w - 10, near + dirOut * (70 + rnd() * 120) - (dirOut < 0 ? w : 0)));
        items.push({ t: 'house', x, y: y0 + 40 + rnd() * 120, w, h, c: rnd() < 0.5 ? '#8a4a3a' : '#5a6068' });
      }
      for (let i = 0; i < 2; i++)
        if (rnd() < 0.7) items.push({ t: 'tree', x: near + dirOut * (26 + rnd() * 16), y: y0 + rnd() * SCENERY_CH, r: 12 + rnd() * 8, tone: 2 });
      if (rnd() < 0.3) items.push({ t: 'hay', x: at(s, 40), y: y0 + rnd() * SCENERY_CH });
    } else if (kind === 'city') {
      // 声屏障外是城市楼顶
      let y = y0 + 6;
      while (y < y0 + SCENERY_CH - 30) {
        const h = 50 + rnd() * 90, gap = 12 + rnd() * 14;
        const x0 = s === L ? s[0] + rnd() * 30 : s[0] + 30, x1 = s === L ? s[1] - 30 : s[1] - rnd() * 30;
        if (x1 - x0 > 40) items.push({ t: 'roof', r: R(x0, y, x1 - x0, Math.min(h, y0 + SCENERY_CH - y - 4)), seed: Math.floor(rnd() * 1e6),
                                       c: ['#44474d', '#4d4a46', '#3e4248', '#50535a'][Math.floor(rnd() * 4)] });
        y += h + gap;
      }
    } else if (kind === 'village') {
      let y = y0 + 4;
      while (y < y0 + SCENERY_CH - 30) {
        const h = 60 + rnd() * 50, w = Math.min(s[1] - s[0] - 20, 110 + rnd() * 70);
        const x = s === L ? s[1] - 20 - w : s[0] + 20;
        items.push({ t: 'house', x, y, w, h: Math.min(h, y0 + SCENERY_CH - y - 4), c: ['#8a4a3a', '#6a5a4a', '#5a6068', '#7a3a32'][Math.floor(rnd() * 4)], wall: true });
        if (rnd() < 0.5) items.push({ t: 'tree', x: s === L ? x - 30 : x + w + 30, y: y + h / 2, r: 16 + rnd() * 8, tone: 1 });
        y += h + 16 + rnd() * 20;
      }
    }
  }
  // 路牌（反讽标语 / 服务区预告）：高速和快速路才有
  if ((kind === 'highway' || kind === 'city') && rnd() < 0.3) {
    const text = scene.cfg.exitEvery ? '服务区 2 km' : scene.cfg.turtleHonk ? '快车道 · 请勿龟速' : pick(IRONIC_SIGNS);
    const left = rnd() < 0.5 || scene.cfg.exitEvery;
    items.push({ t: 'sign', x: left ? scene.railL - 70 : scene.railR + 70, y: y0 + rnd() * SCENERY_CH, text,
                 bg: scene.cfg.exitEvery ? '#1e7a3e' : '#2a5aa8' });
  }
  // 电线杆（乡道）/ 路灯（高速、快速路）
  if (kind === 'rural') items.push({ t: 'pole', x: scene.railL - 30, y: y0 + 40 });
  if (kind === 'highway' || kind === 'city') items.push({ t: 'lampR', x: scene.railR + 6, y: y0 + 130 }, { t: 'lampL', x: scene.railL - 6, y: y0 + 130 });
  items.forEach((it, i) => { if (it.t === 'house' || it.t === 'roof') it.key = scene.phase.scene + ':' + k + ':' + i; });
  cache.set(k, items);
  return items;
}

function prerenderBuilding(it) {
  const r = it.t === 'roof' ? it.r : R(it.x - 4, it.y - 4, it.w + 8, it.h + 8);
  it.bx = r.x; it.by = r.y;
  // 全局 LRU：同一关重开时区块内容确定，直接复用，不反复创建画布
  const key = it.key;
  if (key && BuildingCache.has(key)) {
    const img = BuildingCache.get(key);
    BuildingCache.delete(key); BuildingCache.set(key, img);
    return img;
  }
  const c = document.createElement('canvas');
  c.width = Math.ceil(r.w + 22); c.height = Math.ceil(r.h + 24);
  const g = c.getContext('2d');
  g.translate(6 - r.x, 6 - r.y);
  if (it.t === 'roof') drawRoof(g, it.r, it.seed, it.c);
  else {
    if (it.wall) { g.fillStyle = '#b8b0a0'; g.fillRect(it.x - 4, it.y - 4, it.w + 8, it.h + 8); }
    drawPitchedRoof(g, it.x, it.y, it.w, it.h, it.c);
  }
  if (key) {
    BuildingCache.set(key, c);
    if (BuildingCache.size > 160) BuildingCache.delete(BuildingCache.keys().next().value);
  }
  return c;
}
const BuildingCache = new Map();

// 树 / 灌木精灵：按半径与色调缓存，全局共享
function spriteOf(type, r, tone) {
  const key = type + ':' + r + ':' + tone;
  if (DecoCache[key]) return DecoCache[key];
  const size = Math.ceil(r * 2.6 + 8);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const o = r + 3;
  if (type === 'tree') drawTree(g, o, o, r, tone); else drawBush(g, o, o, r);
  return (DecoCache[key] = { c, o });
}
function blitSprite(ctx, type, x, y, r, tone = 0) {
  const s = spriteOf(type, Math.round(r), tone);
  ctx.drawImage(s.c, Math.round(x - s.o), Math.round(y - s.o));
}

// 农田垄沟纹理
function furrowPattern(ctx) {
  if (DecoCache.furrow) return DecoCache.furrow;
  const c = document.createElement('canvas');
  c.width = 9; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(6, 0, 2, 32);
  return (DecoCache.furrow = ctx.createPattern(c, 'repeat'));
}

function drawRoadside(ctx, scene, y0, y1) {
  const kind = scene.cfg.scenery || 'highway';
  const pal = ROADSIDE[kind];
  ctx.fillStyle = pal.ground; ctx.fillRect(0, y0, CANVAS_W, y1 - y0);
  ctx.fillStyle = grainPattern(ctx, 'ground', 900, 0.08); ctx.fillRect(0, y0, CANVAS_W, y1 - y0);
  const k0 = Math.floor(y0 / SCENERY_CH), k1 = Math.floor(y1 / SCENERY_CH);
  const chunks = [];
  for (let k = k0 - 1; k <= k1; k++) chunks.push(roadsideChunk(scene, k));
  // 先地面层，再高物体
  for (const items of chunks) for (const it of items) {
    if (it.t === 'patch') {
      ctx.fillStyle = pal.patch; ctx.beginPath(); ctx.ellipse(it.x, it.y, it.r, it.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (it.t === 'field') {
      ctx.fillStyle = it.c; ctx.fillRect(it.x0, it.y + 3, it.x1 - it.x0, it.h - 6);
      ctx.fillStyle = furrowPattern(ctx); ctx.fillRect(it.x0, it.y + 5, it.x1 - it.x0, it.h - 10);
      ctx.fillStyle = '#4a3e2c'; ctx.fillRect(it.x0, it.y, it.x1 - it.x0, 3);   // 田埂
    }
  }
  for (const items of chunks) for (const it of items) {
    if (it.y !== undefined && (it.y < y0 - 140 || it.y > y1 + 140)) continue;
    if (it.t === 'tree') blitSprite(ctx, 'tree', it.x, it.y, it.r, it.tone);
    else if (it.t === 'bush') blitSprite(ctx, 'bush', it.x, it.y, it.r);
    else if (it.t === 'house' || it.t === 'roof') {
      // 楼顶 / 民房细节多，首次出现时渲染到离屏画布，之后每帧只贴图
      if (!it.img) it.img = prerenderBuilding(it);
      ctx.drawImage(it.img, it.bx - 6, it.by - 6);
    }
    else if (it.t === 'hay') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(it.x + 3, it.y + 4, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a88a48'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y, 6, 0, Math.PI * 2); ctx.stroke();
    }
    else if (it.t === 'sign') drawSign(ctx, it.x, it.y, it.text, it.bg);
    else if (it.t === 'lampR') drawLamp(ctx, it.x, it.y, -1);
    else if (it.t === 'lampL') drawLamp(ctx, it.x, it.y, 1);
    else if (it.t === 'pole') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(it.x - 12, it.y + 3, 28, 3);
      ctx.fillStyle = '#6a5a44'; ctx.fillRect(it.x - 14, it.y - 1, 28, 3);
      ctx.fillStyle = '#4a3e2e'; ctx.beginPath(); ctx.arc(it.x, it.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 电线（乡道：连接电线杆）
  if (kind === 'rural') {
    ctx.strokeStyle = 'rgba(20,20,20,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const dx of [-10, 10]) { ctx.moveTo(scene.railL - 30 + dx, y0); ctx.lineTo(scene.railL - 30 + dx, y1); }
    ctx.stroke();
  }
  // 声屏障（快速路：紧贴护栏外侧）
  if (kind === 'city') {
    for (const x of [scene.railL - 14, scene.railR + 4]) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 4, y0, 10, y1 - y0);
      ctx.fillStyle = '#6a8a9a'; ctx.fillRect(x, y0, 10, y1 - y0);
      ctx.fillStyle = '#4a5a64';
      for (let yy = Math.floor(y0 / 40) * 40; yy < y1; yy += 40) ctx.fillRect(x, yy, 10, 3);
    }
  }
}

// 路面细节：颗粒 + 轮迹磨痕 + 修补块 + 路肩振动标线
function drawRoadSurface(ctx, scene, y0, y1) {
  ctx.fillStyle = grainPattern(ctx, 'road', 1600, 0.08);
  ctx.fillRect(scene.roadL, y0, scene.roadR - scene.roadL, y1 - y0);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i < scene.nL; i++) {
    const cx = scene.laneCenter(i);
    ctx.fillRect(cx - 15, y0, 7, y1 - y0);
    ctx.fillRect(cx + 8, y0, 7, y1 - y0);
  }
  // 修补块
  const k0 = Math.floor(y0 / SCENERY_CH), k1 = Math.floor(y1 / SCENERY_CH);
  for (let k = k0; k <= k1; k++) {
    const rnd = mulberry32(k * 613 + 5);
    if (rnd() < 0.5) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.03)';
      const w = 20 + rnd() * 40;
      ctx.fillRect(scene.roadL + rnd() * (scene.roadR - scene.roadL - w), k * SCENERY_CH + rnd() * 200, w, 18 + rnd() * 40);
    }
  }
  // 路肩：振动标线
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let yy = Math.floor(y0 / 14) * 14; yy < y1; yy += 14) {
    ctx.fillRect(scene.roadL - 14, yy, 9, 3);
    ctx.fillRect(scene.roadR + 5, yy, 9, 3);
  }
}
