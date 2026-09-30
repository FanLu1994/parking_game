// ─── 停车场景 ─────────────────────────────────────────────────────────────────

// 通用纹理
const Patterns = {};
function getPattern(ctx, name) {
  if (Patterns[name]) return Patterns[name];
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (name === 'hatch') {             // 黄黑斜纹
    c.width = c.height = 20;
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 20, 20);
    g.strokeStyle = C.hatching; g.lineWidth = 6;
    g.beginPath();
    for (let i = -20; i <= 40; i += 20) { g.moveTo(i, 20); g.lineTo(i + 20, 0); }
    g.stroke();
  } else if (name === 'redhatch') {   // 单元门禁停区
    c.width = c.height = 16;
    g.strokeStyle = 'rgba(255,94,94,0.75)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = -16; i <= 32; i += 8) { g.moveTo(i, 16); g.lineTo(i + 16, 0); }
    g.stroke();
  } else if (name === 'yellowgrid') { // 黄网线
    c.width = c.height = 22;
    g.strokeStyle = 'rgba(232,193,74,0.8)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(22, 22); g.moveTo(22, 0); g.lineTo(0, 22);
    g.stroke();
  } else if (name === 'tiles') {      // 人行道
    c.width = c.height = 24;
    g.fillStyle = '#6d6a64'; g.fillRect(0, 0, 24, 24);
    g.strokeStyle = '#5b5852'; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 23, 23);
  }
  return (Patterns[name] = ctx.createPattern(c, 'repeat'));
}

function drawAsphalt(g, x, y, w, h, base = C.asphalt) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 1;
  g.beginPath();
  for (let gx = x - (x % 40); gx < x + w; gx += 40) { g.moveTo(gx + 0.5, y); g.lineTo(gx + 0.5, y + h); }
  for (let gy = y - (y % 40); gy < y + h; gy += 40) { g.moveTo(x, gy + 0.5); g.lineTo(x + w, gy + 0.5); }
  g.stroke();
}

function drawGrass(g, r, seed = 7) {
  g.fillStyle = C.grass; g.fillRect(r.x, r.y, r.w, r.h);
  const rnd = mulberry32(seed + r.x * 13 + r.y);
  g.strokeStyle = C.grassLt; g.lineWidth = 1.4;
  g.beginPath();
  const n = Math.floor(r.w * r.h / 260);
  for (let i = 0; i < n; i++) {
    const x = r.x + rnd() * r.w, y = r.y + 4 + rnd() * (r.h - 4);
    g.moveTo(x, y); g.lineTo(x - 2, y - 5);
    g.moveTo(x, y); g.lineTo(x + 1, y - 6);
    g.moveTo(x, y); g.lineTo(x + 3, y - 4);
  }
  g.stroke();
  g.strokeStyle = '#1f3f1f'; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h);
}

function drawLabel(g, text, x, y, color, size = 12, bg = 'rgba(0,0,0,0.55)') {
  g.save();
  g.font = `bold ${size}px ${FONT_BODY}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(text).width + 10;
  g.fillStyle = bg; g.fillRect(x - w / 2, y - size / 2 - 3, w, size + 6);
  g.fillStyle = color; g.fillText(text, x, y);
  g.restore();
}

function drawSpot(g, s) {
  g.save();
  g.translate(s.x, s.y); g.rotate(s.angle);
  const hw = s.w / 2, hh = s.h / 2;
  if (s.kind === 'charge') {
    g.fillStyle = 'rgba(74,184,232,0.16)'; g.fillRect(-hw, -hh, s.w, s.h);
  } else if (s.kind === 'vip') {
    g.fillStyle = 'rgba(232,193,74,0.12)'; g.fillRect(-hw, -hh, s.w, s.h);
  }
  g.strokeStyle = s.kind === 'vip' ? C.vipGold : 'rgba(255,255,255,0.85)';
  g.lineWidth = s.kind === 'vip' ? 3 : 2;
  g.strokeRect(-hw + 1, -hh + 1, s.w - 2, s.h - 2);
  g.rotate(-s.angle);
  if (s.kind === 'charge') {
    g.fillStyle = C.chargeBlue; g.font = `bold 20px ${FONT_BODY}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('⚡', 0, 0);
  } else if (s.kind === 'vip') {
    g.fillStyle = C.vipGold; g.font = `bold 10px ${FONT_BODY}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('物业经理', 0, -8); g.fillText('专属', 0, 6);
  }
  g.restore();
}

function spotPoly(s) { return obbCorners(s.x, s.y, s.w, s.h, s.angle); }

// ─── ParkScene ────────────────────────────────────────────────────────────────
class ParkScene {
  constructor(level, phase, book) {
    this.kind = 'park';
    this.level = level;
    this.phase = phase;
    this.sc = PARK_SCENES[phase.scene];
    this.book = book;
    this.t = 0;
    const sp = this.sc.spawn;
    this.player = new Car(sp.x, sp.y, sp.angle, { w: CAR.W, h: CAR.H, phys: PHYS.park, isPlayer: true });
    this.npcs = (this.sc.npcs || []).map(p => new Car(p.x, p.y, p.angle));
    this.props = (this.sc.props || []).map(([t, x, y]) => new Prop(t, x, y));
    this.skids = new SkidMarks(700);

    // 静态碰撞体
    const polys = [];
    for (const r of this.sc.walls || []) polys.push(rectPoly(r));
    for (const r of this.sc.pillars || []) polys.push(rectPoly(r));
    for (const [x, y] of this.sc.locks || []) polys.push(rectPoly(R(x - 11, y - 5, 22, 10)));
    for (const [x, y] of this.sc.chargers || []) polys.push(rectPoly(R(x - 9, y - 7, 18, 14)));
    if (this.sc.speaker) polys.push(rectPoly(this.sc.speaker));
    this.statics = polys;

    this.hasMoved = false;
    this.settleTimer = 0;
    this.done = false;
    this.mock = null;
    this.flags = {};

    // 挪车电话 §3.5
    this.phoneOn = !!phase.phone;
    this.popup = null;
    this.popupCount = 0;
    this.lastPopupT = -99;
    this.poppedThisStop = false;

    this.bg = this.buildBackground();
  }

  // ── 背景离屏绘制 ──
  buildBackground() {
    const c = document.createElement('canvas');
    c.width = CANVAS_W; c.height = CANVAS_H;
    const g = c.getContext('2d');
    const sc = this.sc;
    drawAsphalt(g, 0, 0, CANVAS_W, CANVAS_H, sc.theme === 'plaza' ? '#272a30' : C.asphalt);

    if (sc.theme === 'street') {
      for (const r of sc.sidewalks || []) {
        g.fillStyle = getPattern(g, 'tiles'); g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = '#9a968e'; g.fillRect(r.x, r.y + r.h - 5, r.w, 5);
      }
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.setLineDash([30, 24]);
      for (const y of sc.laneLines || []) { g.beginPath(); g.moveTo(16, y); g.lineTo(984, y); g.stroke(); }
      g.setLineDash([]);
    }
    for (const r of sc.grass || []) drawGrass(g, r);
    for (const r of sc.dance || []) {
      g.fillStyle = 'rgba(232,193,74,0.08)'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = getPattern(g, 'yellowgrid'); g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = C.lineYellow; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
      drawLabel(g, '广场舞专区', r.x + r.w / 2, r.y + r.h - 14, C.lineYellow, 13);
    }
    for (const r of sc.lobby || []) {
      g.fillStyle = getPattern(g, 'redhatch'); g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = C.warn; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h);
      drawLabel(g, sc.lobbyLabel || '单元门 · 禁停', r.x + r.w / 2, r.y + r.h / 2, C.warn, 11);
    }
    for (const r of sc.entrances || []) {
      g.fillStyle = getPattern(g, 'hatch'); g.fillRect(r.x, r.y, r.w, r.h);
      drawLabel(g, `${sc.entranceLabel || '出入口'} · 禁停`, r.x + r.w / 2, r.y + r.h / 2, C.lineYellow, 11);
    }
    for (const s of sc.spots) drawSpot(g, s);

    // 建筑
    if (sc.building) {
      const b = sc.building;
      g.fillStyle = '#4a4540'; g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = '#5c564f';
      for (let x = b.x + 14; x < b.x + b.w - 30; x += 44) g.fillRect(x, b.y + 22, 28, 18);
      g.fillStyle = '#3a3530'; g.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      drawLabel(g, sc.buildingLabel || '3 号楼', b.x + 60, b.y + 14, '#ddd', 11);
      for (const d of sc.doors || []) {
        g.fillStyle = '#2b3a4f'; g.fillRect(d.x, d.y, d.w, d.h);
        g.fillStyle = '#e8e4cc'; g.font = `bold 10px ${FONT_BODY}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('单元门', d.x + d.w / 2, d.y + d.h / 2);
      }
    }
    // 外墙
    for (const r of sc.walls) {
      if (r === sc.building) continue;
      if (sc.theme === 'street' && (sc.sidewalks || []).some(s => s.y === r.y && r.h === s.h)) continue;
      g.fillStyle = '#3a3d44'; g.fillRect(r.x, r.y, r.w, r.h);
    }
    // 立柱
    for (const r of sc.pillars || []) {
      g.fillStyle = '#6a6d74'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = getPattern(g, 'hatch'); g.fillRect(r.x, r.y + r.h - 8, r.w, 8);
    }
    // 地锁
    for (const [x, y] of sc.locks || []) {
      g.fillStyle = '#1a1a1a'; g.fillRect(x - 11, y - 5, 22, 10);
      g.fillStyle = C.lineYellow; g.fillRect(x - 9, y - 3, 18, 6);
      g.fillStyle = '#1a1a1a'; g.fillRect(x - 3, y - 3, 6, 6);
    }
    // 充电桩
    for (const [x, y] of sc.chargers || []) {
      g.fillStyle = '#dfe6ea'; g.fillRect(x - 9, y - 7, 18, 14);
      g.fillStyle = C.chargeBlue; g.fillRect(x - 5, y - 3, 10, 6);
    }
    // 音箱道具
    if (sc.speaker) {
      const r = sc.speaker;
      g.fillStyle = '#111'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#444';
      g.beginPath(); g.arc(r.x + r.w / 2, r.y + 10, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(r.x + r.w / 2, r.y + 22, 4, 0, Math.PI * 2); g.fill();
    }
    // "草坪 · 请勿踩踏" 立牌
    for (const [x, y] of sc.signs || []) {
      g.fillStyle = '#8a6a3a'; g.fillRect(x - 1.5, y, 3, 14);
      drawLabel(g, '草坪 · 请勿踩踏', x, y - 4, '#fff', 10, '#3a6a3a');
    }
    return c;
  }

  // ── 更新 ──
  update(dt) {
    this.t += dt;
    if (this.done) return;
    if (this.popup) { this.updatePopup(); return; }

    const ctl = {
      up: Input.pressed('up'), down: Input.pressed('down'),
      left: Input.pressed('left'), right: Input.pressed('right'),
      handbrake: Input.pressed('brake'),
    };
    const anyInput = Input.anyDriveInput();
    if (anyInput) this.hasMoved = true;

    const p = this.player;
    p.drive(dt, ctl);
    this.collide();
    updateSkid(p, this.skids, ctl);
    for (const pr of this.props) pr.update(dt);

    // 停稳判定：车速 < 2px/s 且无输入，持续 1.3s
    if (this.hasMoved && Math.abs(p.speed) < CAR.SETTLE_SPEED && !anyInput) {
      this.settleTimer += dt;
      this.maybePhone();
    } else {
      this.settleTimer = 0;
      this.poppedThisStop = false;
    }
    if (this.settleTimer >= CAR.SETTLE_TIME && !this.popup) this.settle();
  }

  collide() {
    const p = this.player;
    for (let iter = 0; iter < 2; iter++) {
      for (const poly of this.statics) this.pushOut(poly, null);
      for (const n of this.npcs) this.pushOut(n.poly(), n);
    }
    const pp = p.poly();
    for (const pr of this.props) {
      if (pr.down) continue;
      if (satTest(pp, pr.poly())) {
        pr.knock(p.vx, p.vy);
        Sfx.thud();
        this.book.flat('cone', SCORE.CONE, pr.x, pr.y);
      }
    }
  }

  pushOut(poly, npc) {
    const p = this.player;
    const m = satMTV(p.poly(), poly);
    if (!m) return;
    p.x += m.x * (m.depth + 0.3); p.y += m.y * (m.depth + 0.3);
    const v = Math.abs(p.speed);
    // 只有朝向障碍物运动时才反弹
    if ((p.vx * m.x + p.vy * m.y) < 0) {
      p.speed = -p.speed * 0.25;
      if (v > 25) { addShake(Math.min(8, v / 18)); Sfx.thud(); }
      if (npc && v > 12 && this.book.scrape(npc, p.x, p.y)) Sfx.crash();
    }
  }

  // ── 挪车电话 ──
  maybePhone() {
    if (!this.phoneOn || this.poppedThisStop || this.popupCount >= SCORE.REFUSE_MOVE_MAX) return;
    if (this.settleTimer < 0.5) return;
    const prov = this.book.total + this.computeSettle().total;
    const interval = Math.max(2, 8 - prov / 120);
    if (this.t - this.lastPopupT < interval) return;
    this.popup = { line: PHONE_LINES[Math.min(this.popupCount, PHONE_LINES.length - 1)], t: 0 };
    this.poppedThisStop = true;
    Sfx.phone();
  }

  updatePopup() {
    if (Input.justDown('opt1')) this.answer(false);
    else if (Input.justDown('opt2')) this.answer(true);
  }

  answer(move) {
    Sfx.click();
    if (move) {
      this.mock = '主动认怂';
      this.popup = null;
      this.done = true;
      return;
    }
    this.popupCount++;
    this.book.flat('refuseMove', SCORE.REFUSE_MOVE, this.player.x, this.player.y - 40);
    this.popup = null;
    this.lastPopupT = this.t;
  }

  // ── 结算 §2.2 ──
  computeSettle() {
    const p = this.player, sc = this.sc;
    const items = {};
    const add = (k, v, n = 1) => {
      if (v <= 0) return;
      const it = items[k] || (items[k] = { points: 0, count: 0 });
      it.points += v; it.count += n;
    };

    const occ = [];
    for (const s of sc.spots) {
      const f =obbCoverage(p.x, p.y, p.w, p.h, p.angle, spotPoly(s), 10);
      if (f > 0.15) occ.push({ s, f });
    }
    occ.sort((a, b) => b.f - a.f);
    occ.forEach(({ s }, i) => {
      add(i === 0 ? 'spot' : 'extraSpot', i === 0 ? SCORE.FIRST_SPOT : SCORE.EXTRA_SPOT);
      if (s.kind === 'charge') add('charge', SCORE.CHARGE_SPOT);
    });

    // 倾角：相对占用最多的车位，否则相对最近车位
    let ref = occ[0] && occ[0].s;
    if (!ref) {
      let best = Infinity;
      for (const s of sc.spots) {
        const d = dist2(s.x, s.y, p.x, p.y);
        if (d < best) { best = d; ref = s; }
      }
    }
    let deg = 0;
    if (ref) {
      let d = Math.abs(wrapAngle(p.angle - ref.angle)) % Math.PI;
      d = Math.min(d, Math.PI - d);
      deg = Math.min(SCORE.ANGLE_DEG_MAX, rad2deg(d));
      if (occ.length) add('angle', Math.round(deg / SCORE.ANGLE_DEG_MAX * SCORE.ANGLE_MAX));
    }

    const pp = p.poly();
    if ((sc.entrances || []).some(r => satTest(pp, rectPoly(r)))) add('entrance', SCORE.BLOCK_ENTRANCE);
    let g = 0;
    for (const r of sc.grass || []) g += obbCoverage(p.x, p.y, p.w, p.h, p.angle, rectPoly(r), 10);
    add('grass', Math.round(Math.min(1, g) * SCORE.GRASS_MAX));
    const dance = (sc.dance || []).some(r => obbCoverage(p.x, p.y, p.w, p.h, p.angle, rectPoly(r), 10) > 0.3);
    if (dance) add('dance', SCORE.DANCE_ZONE);
    for (const n of this.npcs) if (polyDist(pp, n.poly()) < SCORE.TAILGATE_PX) add('tailgate', SCORE.TAILGATE);
    if ((sc.lobby || []).some(r => satTest(pp, rectPoly(r)))) add('lobby', SCORE.BLOCK_LOBBY);

    let total = 0;
    for (const k in items) total += items[k].points;
    // 一停三吃（只在三区重叠的终局场景开放）：同时压中出入口 / 草坪（≥30%）/ 广场舞专区 / 单元门中的至少三样，整次结算 ×1.5
    const zones = ['entrance', 'dance', 'lobby'].filter(k => items[k]).length + (g >= 0.3 ? 1 : 0);
    if (sc.triple && zones >= 3) {
      const bonus = Math.round(total * (SCORE.TRIPLE_MULT - 1));
      add('triple', bonus);
      total += bonus;
    }
    // 物业经理专属位：本次结算全部得分 ×1.5
    if (occ.some(o => o.s.kind === 'vip')) {
      const bonus = Math.round(total * (SCORE.VIP_MULT - 1));
      add('vip', bonus);
      total += bonus;
    }
    return { items, total, occ, deg, dance };
  }

  settle() {
    const r = this.computeSettle();
    // 嘲讽结局：恰好 1 位、重叠 > 85%、倾角 < 8°，且没有其他计分项
    const others = Object.keys(r.items).filter(k => k !== 'spot' && k !== 'angle');
    if (r.occ.length === 1 && r.occ[0].f > 0.85 && r.deg < 8 && !others.length && !this.book.anyScored) {
      this.mock = '停得过于规范';
    }
    for (const k in r.items) this.book.flat(k, r.items[k].points, this.player.x, this.player.y, r.items[k].count);
    if (r.dance) this.flags.dance = true;
    this.done = true;
  }

  // ── 绘制 ──
  draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    this.skids.draw(ctx);
    for (const pr of this.props) if (pr.down) pr.draw(ctx);
    for (const n of this.npcs) n.draw(ctx, this.t);
    for (const pr of this.props) if (!pr.down) pr.draw(ctx);
    this.player.draw(ctx, this.t);
  }

  // 停稳进度（HUD 用）
  get settleProgress() { return this.hasMoved ? this.settleTimer / CAR.SETTLE_TIME : 0; }
}
