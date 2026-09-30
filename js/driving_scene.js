// ─── 驾驶场景（纵向卷动道路）─────────────────────────────────────────────────
// 世界坐标：玩家向上行驶（y 减小）；对向车道在左侧

const SHOULDER = 46;
const CAR_LEN = CAR.H;          // 判定中的"车长"
const RAMP_LEN = 420, RAMP_W = 110;
const LANE_HYST = 10;           // 变道判定迟滞 px

class DriveScene {
  constructor(level, phase, book) {
    this.kind = 'drive';
    this.level = level;
    this.phase = phase;
    this.cfg = DRIVE_SCENES[phase.scene];
    this.book = book;
    this.t = 0;
    this.timeLeft = this.cfg.time;
    this.done = false;
    this.mock = null;
    this.flags = {};
    this.endReason = null;

    const cfg = this.cfg;
    this.laneW = cfg.laneW || 64;
    this.lanes = cfg.lanes;
    this.nL = this.lanes.length;
    this.roadL = CANVAS_W / 2 - this.nL * this.laneW / 2;
    this.roadR = this.roadL + this.nL * this.laneW;
    this.railL = this.roadL - SHOULDER;
    this.railR = this.roadR + SHOULDER;
    // 最左侧的同向车道；同向只有一条车道时不存在"快车道"
    this.fastLane = this.lanes.filter(d => d === 1).length >= 2 ? this.lanes.indexOf(1) : -1;

    // 起步车道：最右的同向车道
    const startLane = this.lanes.lastIndexOf(1);
    this.player = new Car(this.laneCenter(startLane), 0, 0,
      { w: CAR.W, h: CAR.H, phys: PHYS.drive, isPlayer: true });
    // 静止起步：玩家第一次操作前不计时、不计分
    this.started = false;
    this.camY = this.player.y - 440;

    this.npcs = [];
    this.props = [];
    this.skids = new SkidMarks(600);
    this.propChunk = 1;             // 已生成道具的区块
    this.prevLane = startLane;
    this.lastSignalT = -99;
    this.pendingBrake = null;
    this.brakeChecked = new Set();
    this.cutInCars = new Set();
    this.beamed = new Set();
    this.laneChanges = 0;
    this.noSignalN = 0;
    this.conesHit = 0;
    this.turtleResistN = 0;

    if (!cfg.noTraffic) this.populate();
    if (cfg.standoff) this.initStandoff();
  }

  laneCenter(i) { return this.roadL + (i + 0.5) * this.laneW; }
  laneOf(x) { return Math.floor((x - this.roadL) / this.laneW); }
  onRoadLane(x) { return clamp(this.laneOf(x), 0, this.nL - 1); }

  // ── 车流 ──────────────────────────────────────────────────────────────────
  newNpc(lane, y) {
    const dir = this.lanes[lane];
    const cfg = this.cfg;
    const sp = dir === 1 ? cfg.speed : (cfg.oncomingSpeed || cfg.speed);
    const n = new Car(this.laneCenter(lane), y, dir === 1 ? 0 : Math.PI);
    n.lane = lane; n.dir = dir;
    n.v0 = lerp(sp[0], sp[1], Math.random());
    n.speed = n.v0;
    n.stopTimer = 0; n.glare = 0; n.hazard = false;
    n.honkCD = 0; n.honks = 0; n.stuck = 0;
    n.targetX = n.x;
    this.npcs.push(n);
    return n;
  }

  gapFor(dir) {
    const g = dir === 1 ? this.cfg.gap : (this.cfg.oncomingGap || this.cfg.gap);
    return lerp(g[0], g[1], Math.random());
  }

  populate() {
    const top = this.camY - 700, bottom = this.camY + CANVAS_H + 500;
    for (let i = 0; i < this.nL; i++) {
      let y = bottom;
      while (y > top) {
        if (Math.abs(y - this.player.y) > 160 || this.laneOf(this.player.x) !== i) this.newNpc(i, y);
        y -= this.gapFor(this.lanes[i]);
      }
    }
  }

  // 在视野外补车 / 回收
  manageTraffic() {
    const top = this.camY - 700, bottom = this.camY + CANVAS_H + 500;
    const viewTop = this.camY - 80, viewBottom = this.camY + CANVAS_H + 80;
    this.npcs = this.npcs.filter(n => n.y > top - 300 && n.y < bottom + 300);
    for (let i = 0; i < this.nL; i++) {
      const inLane = this.npcs.filter(n => n.lane === i);
      let minY = Infinity, maxY = -Infinity;
      for (const n of inLane) { minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
      if (!inLane.length) { minY = viewTop; maxY = viewTop; }
      const dir = this.lanes[i];
      const g1 = this.gapFor(dir);
      if (minY - g1 > top && minY - g1 < viewTop) this.newNpc(i, minY - g1);
      else if (!inLane.length) this.newNpc(i, viewTop - 60);
      // 后方补车：同向车比玩家快（第 10 关）或对向车需要从下方离开时不补
      if (dir === 1 && this.cfg.spawnBehind) {
        const g2 = this.gapFor(dir);
        if (maxY + g2 < bottom && maxY + g2 > viewBottom) this.newNpc(i, maxY + g2);
      }
    }
  }

  // 前车（沿自身行驶方向）
  leaderOf(n) {
    let best = null, bestGap = Infinity;
    const consider = (o) => {
      if (o === n) return;
      if (Math.abs(o.x - n.x) > this.laneW * 0.7) return;
      const ahead = n.dir === 1 ? n.y - o.y : o.y - n.y;
      if (ahead <= 0) return;
      const gap = ahead - (n.h + o.h) / 2;
      if (gap < bestGap) { bestGap = gap; best = o; }
    };
    for (const o of this.npcs) consider(o);
    consider(this.player);
    return { car: best, gap: bestGap };
  }

  laneClear(lane, y, range = 130) {
    const x = this.laneCenter(lane);
    if (Math.abs(this.player.x - x) < this.laneW * 0.8 && Math.abs(this.player.y - y) < range) return false;
    return !this.npcs.some(o => Math.abs(o.x - x) < this.laneW * 0.8 && Math.abs(o.y - y) < range);
  }

  updateNpc(n, dt) {
    const p = this.player;
    n.honkCD -= dt;
    n.glare = Math.max(0, n.glare - dt);
    n.braking = false;

    if (n.stopTimer > 0) {
      // 停车理论：被撞后原地停 3s
      n.stopTimer -= dt;
      n.speed = Math.max(0, n.speed - 600 * dt);
      n.hazard = true;
      n.braking = true;
      if (n.stopTimer <= 0) n.hazard = false;
    } else {
      const { car: lead, gap } = this.leaderOf(n);
      const desired = n.v0 * (n.glare > 0 ? 0.45 : 1);
      const safe = 26 + n.speed * 0.42;
      if (lead && gap < safe) {
        n.speed = Math.max(0, n.speed - (gap < safe * 0.5 ? 700 : 380) * dt);
        n.braking = true;
      } else if (n.speed < desired) n.speed = Math.min(desired, n.speed + 150 * dt);
      else n.speed = Math.max(desired, n.speed - 200 * dt);

      // 被堵住：尝试从旁边车道超车
      const blocked = lead && gap < safe && n.speed < 60;
      n.stuck = blocked ? n.stuck + dt : 0;

      // 第 10 关 / 混合关：在最左车道龟速时，后车鸣笛催促
      if (this.cfg.turtleHonk && this.started && lead === p && gap < 170 && n.dir === 1 &&
          this.laneOf(p.x) === this.fastLane && p.speed < this.cfg.limit * 0.5 && n.honkCD <= 0) {
        n.honkCD = 2.2;
        n.honks++;
        Sfx.horn(0.75);
        if (this.turtleResistN++ < SCORE.TURTLE_RESIST_MAX)
          this.book.discrete('turtleResist', SCORE.TURTLE_RESIST, n.x, n.y - 40);
        this.book.emit('_bubble', 0, n.x, n.y - 30, { text: pick(['滴滴！', '走不走啊！', '快车道啊大哥！', '滴——']) });
        if (n.honks >= 2) n.stuck = 99;
      }
      if (n.stuck > 1.2 && n.x === n.targetX) {
        for (const tgt of [n.lane + 1, n.lane - 1]) {
          if (tgt < 0 || tgt >= this.nL || this.lanes[tgt] !== n.dir) continue;
          if (this.laneClear(tgt, n.y)) { n.lane = tgt; n.targetX = this.laneCenter(tgt); n.stuck = 0; n.honks = 0; break; }
        }
      }
    }

    // 横向并线
    let tilt = 0;
    if (n.x !== n.targetX) {
      const d = n.targetX - n.x, step = 90 * dt;
      n.x = Math.abs(d) <= step ? n.targetX : n.x + Math.sign(d) * step;
      tilt = Math.sign(d) * 0.18 * n.dir;
    }
    n.angle = (n.dir === 1 ? 0 : Math.PI) + tilt;
    n.y += (n.dir === 1 ? -1 : 1) * n.speed * dt;
  }

  // ── 道具（路肩上的交通锥 / 垃圾桶）────────────────────────────────────────
  manageProps() {
    if (!this.cfg.props) return;
    const CH = 520;
    while (-this.propChunk * CH > this.camY - 900) {
      const y = -this.propChunk * CH;
      const rnd = mulberry32(this.propChunk * 97 + this.level.n);
      if (rnd() < 0.65) {
        const right = rnd() < 0.6;
        const x = right ? this.roadR + 22 : this.roadL - 22;
        const type = rnd() < 0.7 ? 'cone' : 'bin';
        const k = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) this.props.push(new Prop(type, x + (rnd() - 0.5) * 10, y + i * 34));
      }
      this.propChunk++;
    }
    const bottom = this.camY + CANVAS_H + 400;
    this.props = this.props.filter(p => p.y < bottom);
  }

  // ── 标线 ──────────────────────────────────────────────────────────────────
  isSolidAt(i, y) {
    const E = this.cfg.solidEvery;
    if (!E) return false;
    const off = i * 230;
    const m = (((-y + off) % E) + E) % E;
    return m < E * 0.38;
  }

  yellowZone(k) {
    const E = this.cfg.yellowEvery;
    if (!E || k < 1) return null;
    const y = -k * E - 200;
    const twoWay = this.lanes.includes(-1);
    if (twoWay && k % 2 === 0) {
      const cx = this.roadL + this.laneW;   // 双向车道中线处的导流区
      return R(cx - 22, y, 44, 220);
    }
    return k % 2 ? R(this.roadR - 26, y, 56, 230) : R(this.roadL - 30, y, 56, 230);
  }

  yellowZonesNear(y) {
    const E = this.cfg.yellowEvery;
    if (!E) return [];
    const k = Math.floor(-y / E);
    const out = [];
    for (let i = k - 1; i <= k + 1; i++) { const z = this.yellowZone(i); if (z) out.push(z); }
    return out;
  }

  // 服务区匝道（第 11 关）
  rampAt(y) {
    const E = this.cfg.exitEvery;
    if (!E) return null;
    const k = Math.floor((-y + RAMP_LEN) / E);
    if (k < 1) return null;
    const ry = -k * E;
    return (y >= ry && y <= ry + RAMP_LEN) ? { x: this.roadR, y: ry, w: SHOULDER + RAMP_W, h: RAMP_LEN } : null;
  }

  // ── 更新 ──────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    if (this.done) return;
    if (!this.started) {
      if (!Input.anyDriveInput()) {
        // 等待出发：车流照常，玩家车、计时、计分都不动
        for (const n of this.npcs) this.updateNpc(n, dt);
        if (!this.cfg.noTraffic) this.manageTraffic();
        return;
      }
      this.started = true;
    }
    if (this.cfg.standoff) { this.updateStandoff(dt); }

    const p = this.player;
    const ctl = {
      up: Input.pressed('up'), down: Input.pressed('down'),
      left: Input.pressed('left'), right: Input.pressed('right'),
      handbrake: Input.pressed('brake'),
    };
    if (this.standoff && this.standoff.state !== 'approach' && this.standoff.state !== 'duel') {
      ctl.up = ctl.down = false; ctl.handbrake = true;
    }
    const prevSpeed = p.speed;
    p.drive(dt, ctl);
    updateSkid(p, this.skids, ctl);

    if (Input.justDown('signal')) { this.lastSignalT = this.t; Sfx.click(); this.book.emit('_bubble', 0, p.x, p.y - 50, { text: '已打灯（然而并没有分）' }); }
    if (Input.justDown('highbeam')) { p.highbeam = !p.highbeam; Sfx.beep(); }
    if (Input.justDown('honk') && !this.cfg.standoff) this.honk();

    for (const n of this.npcs) this.updateNpc(n, dt);
    if (this.standoffCar) this.updateStandoffCar(dt);
    for (const pr of this.props) pr.update(dt);

    this.collide();
    this.detectLaneChange();
    this.detectBrakeCheck();
    this.detectHighbeam();
    this.continuous(dt);

    this.camY = p.y - 440;
    if (!this.cfg.noTraffic) this.manageTraffic();
    this.manageProps();

    // 匝道 → 进入服务区
    if (this.cfg.exitEvery) {
      const ramp = this.rampAt(p.y);
      if (ramp && p.x > this.roadR + 16) this.finish('ramp');
    }

    if (!this.cfg.standoff) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish('timeout'); }
    }
  }

  finish(reason) {
    if (this.done) return;
    this.done = true;
    this.endReason = reason;
    this.player.highbeam = false;
    Sfx.hornStop();
  }

  honk() {
    const p = this.player;
    Sfx.horn();
    this.book.honk(p.x, p.y - 50);
    // 停车理论：按喇叭催它，70% 开走，30% 再停 3s
    for (const n of this.npcs) {
      if (n.stopTimer > 0 && dist(n.x, n.y, p.x, p.y) < 220) {
        if (Math.random() < 0.7) { n.stopTimer = 0; n.hazard = false; }
        else {
          n.stopTimer = 3;
          this.book.emit('_bubble', 0, n.x, n.y - 30, { text: '我就不走' });
        }
      }
    }
  }

  collide() {
    const p = this.player;
    // 护栏：只反弹 + 震动
    const pp = p.poly();
    let minX = Infinity, maxX = -Infinity;
    for (const c of pp) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); }
    const rampHere = this.cfg.exitEvery && this.rampAt(p.y);
    const railR = rampHere ? this.railR + RAMP_W : this.railR;
    if (minX < this.railL || maxX > railR) {
      p.x += minX < this.railL ? this.railL - minX : railR - maxX;
      const v = Math.abs(p.speed);
      p.speed *= 0.6;
      p.angle *= 0.6;
      if (v > 60) { addShake(Math.min(10, v / 30)); Sfx.thud(); }
    }

    // AI 车
    for (const n of this.npcs) {
      if (Math.abs(n.y - p.y) > 90) continue;
      const m = satMTV(p.poly(), n.poly());
      if (!m) continue;
      p.x += m.x * (m.depth + 0.5);
      p.y += m.y * (m.depth + 0.5);
      const rel = Math.hypot(p.vx - n.vx, p.vy - n.vy);
      p.speed *= 0.4;
      if (n.stopTimer <= 0) { n.stopTimer = 3; n.hazard = true; }
      if (rel > 20) {
        addShake(Math.min(12, rel / 25));
        if (this.book.scrape(n, p.x, p.y)) Sfx.crash(); else Sfx.thud();
      }
    }

    // 道具
    const pp2 = p.poly();
    for (const pr of this.props) {
      if (pr.down || Math.abs(pr.y - p.y) > 60) continue;
      if (satTest(pp2, pr.poly())) {
        pr.knock(p.vx, p.vy);
        Sfx.thud();
        if (this.conesHit++ < SCORE.CONE_MAX_DRIVE) this.book.flat('cone', SCORE.CONE, pr.x, pr.y);
      }
    }
  }

  // "变道"：车身中心越过车道线；需越过 LANE_HYST px 才算完成，防止骑线抖动反复触发
  detectLaneChange() {
    const p = this.player;
    const raw = this.laneOf(p.x);
    if (raw < 0 || raw >= this.nL) return;
    const lane = raw;
    if (lane === this.prevLane) return;
    const from = this.prevLane;
    if (from >= 0 && from < this.nL) {
      const line = this.roadL + Math.max(lane, from) * this.laneW;
      if (Math.abs(lane - from) === 1 && Math.abs(p.x - line) < LANE_HYST) return;
    }
    this.prevLane = lane;
    if (from < 0 || from >= this.nL) return;
    this.laneChanges++;

    // 不打灯：目标车道附近得有车"看见"才算，空路上摆方向不计分；每关有上限
    const witness = this.npcs.some(n => n.lane === lane && Math.abs(n.y - p.y) < CAR_LEN * SCORE.NO_SIGNAL_NEAR);
    if (this.t - this.lastSignalT > 2 && witness && this.noSignalN < (this.cfg.noSignalMax ?? SCORE.NO_SIGNAL_MAX)) {
      this.noSignalN++;
      this.book.discrete('noSignal', SCORE.NO_SIGNAL, p.x, p.y - 40);
    }

    // 加塞：目标车道后车距离 < 1.5 车长；同一辆车每关只计一次
    if (this.lanes[lane] !== 1) return;
    let back = null, gap = Infinity;
    for (const n of this.npcs) {
      if (n.lane !== lane || n.dir !== 1 || n.y <= p.y) continue;
      const g = n.y - p.y - (n.h + p.h) / 2;
      if (g < gap) { gap = g; back = n; }
    }
    if (back && gap < CAR_LEN * 1.5 && !this.cutInCars.has(back) && this.cutInCars.size < (this.cfg.cutInMax ?? SCORE.CUT_IN_MAX)) {
      this.cutInCars.add(back);
      this.book.discrete('cutIn', SCORE.CUT_IN, p.x, p.y - 60);
      if (gap < CAR_LEN * (this.cfg.brakeGap || 0.5) && !this.brakeChecked.has(back) && this.brakeChecked.size < (this.cfg.brakeMax ?? SCORE.BRAKE_CUT_MAX))
        this.pendingBrake = { npc: back, t: this.t, v: Math.max(p.speed, 1) };
    }
  }

  // 别车：切入后与后车 < 0.5 车长，且 1s 内刹车使车速下降 ≥ 30%
  detectBrakeCheck() {
    const pb = this.pendingBrake;
    if (!pb) return;
    const p = this.player;
    if (this.t - pb.t > 1) { this.pendingBrake = null; return; }
    if (p.speed <= pb.v * 0.7) {
      this.brakeChecked.add(pb.npc);
      this.pendingBrake = null;
      this.book.discrete('brakeCheck', SCORE.BRAKE_CUT, p.x, p.y - 70);
    }
  }

  // 远光晃对向车：扇形半角 30°，长 260px；每辆车计一次
  detectHighbeam() {
    const p = this.player;
    if (!p.highbeam) return;
    const fx = p.fx, fy = p.fy;
    const ox = p.x + fx * p.h / 2, oy = p.y + fy * p.h / 2;
    const cosHalf = Math.cos(deg2rad(30));
    for (const n of this.npcs) {
      if (n.dir !== -1) continue;
      const dx = n.x - ox, dy = n.y - oy;
      const d = Math.hypot(dx, dy);
      if (d > 260 || d < 1) continue;
      if ((dx * fx + dy * fy) / d < cosHalf) continue;
      n.glare = 1.6;
      if (this.beamed.has(n) || this.beamed.size >= SCORE.HIGHBEAM_MAX) continue;
      this.beamed.add(n);
      // 逆行进对向车道正面晃：翻倍
      const headOn = this.laneOf(p.x) === n.lane;
      this.book.discrete('highbeam', SCORE.HIGHBEAM_CAR * (headOn ? SCORE.HIGHBEAM_HEADON : 1), n.x, n.y + 30);
    }
  }

  continuous(dt) {
    const p = this.player, cfg = this.cfg, b = this.book;
    const v = Math.abs(p.speed);
    const pp = p.poly();
    let minX = Infinity, maxX = -Infinity;
    for (const c of pp) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); }
    const lane = this.laneOf(p.x);

    // 骑实线：车道实线段 + 道路边线
    let onSolid = false;
    for (let i = 1; i < this.nL; i++) {
      const lx = this.roadL + i * this.laneW;
      if (minX < lx && maxX > lx && this.isSolidAt(i, p.y)) onSolid = true;
    }
    for (const lx of [this.roadL + 2, this.roadR - 2])
      if (minX < lx && maxX > lx && !(this.cfg.exitEvery && this.rampAt(p.y) && lx > this.roadL + 2)) onSolid = true;
    b.continuous('rideSolid', SCORE.RIDE_SOLID, SCORE.CAP_RIDE_SOLID, onSolid && v > 30, dt);

    // 逆行：位于对向车道，且沿车道反方向速度分量 > 30
    const wrong = lane >= 0 && lane < this.nL && this.lanes[lane] === -1 && -p.vy > 30;
    b.continuous('wrongWay', SCORE.WRONG_WAY, SCORE.CAP_WRONG_WAY, wrong, dt);

    // 龟速占快车道
    const turtle = this.fastLane >= 0 && lane === this.fastLane && p.speed > 10 && p.speed < cfg.limit * 0.5;
    b.continuous('turtleFast', SCORE.TURTLE_FAST, SCORE.CAP_TURTLE_FAST, turtle, dt);

    // 压黄网线 / 导流线
    const yz = this.yellowZonesNear(p.y).some(z => satTest(pp, rectPoly(z)));
    b.continuous('rideYellow', SCORE.RIDE_YELLOW, SCORE.CAP_RIDE_YELLOW, yz && v > 30, dt);
  }

  // ── 会车对峙（第 12 关 ①）§3.3 ────────────────────────────────────────────
  initStandoff() {
    const n = new Car(this.laneCenter(0), -760, Math.PI);
    n.color = '#8a7a6a';
    this.standoffCar = n;
    this.standoff = { state: 'approach', t: 0, patience: 2 + Math.random() * 3, endT: 0 };
    this.timeLeft = this.cfg.time;
  }

  updateStandoff(dt) {
    const s = this.standoff, p = this.player, n = this.standoffCar;
    const gap = (p.y - n.y) - (p.h + n.h) / 2;
    s.gap = gap;
    const holding = Input.pressed('honk');

    if (s.state === 'approach') {
      this.timeLeft -= dt;
      if (Input.justDown('honk')) { Sfx.horn(); this.book.honk(p.x, p.y - 50); }
      if (holding && gap < 170) {
        s.state = 'duel'; s.t = 0; s.startY = p.y;
        Sfx.hornStart();
      } else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        s.state = 'lose'; s.endT = this.t;
        this.book.emit('_bubble', 0, n.x, n.y + 40, { text: '（对方等不及，挤过去了）' });
      }
    } else if (s.state === 'duel') {
      s.t += dt;
      if (!holding || p.y > s.startY + 6 || p.speed < -5) {
        Sfx.hornStop();
        s.state = 'lose'; s.endT = this.t;
        this.book.emit('_bubble', 0, p.x, p.y - 60, { text: '你怂了' });
      } else if (s.t >= s.patience) {
        Sfx.hornStop();
        s.state = 'win'; s.endT = this.t;
        this.book.flat('standoff', SCORE.HONK_STANDOFF, n.x, n.y + 40);
        this.book.emit('_bubble', 0, n.x, n.y + 40, { text: '行行行，我倒……' });
      }
    } else if (this.t - s.endT > 2) {
      this.finish('standoff');
    }
  }

  updateStandoffCar(dt) {
    const s = this.standoff, n = this.standoffCar, p = this.player;
    if (s.state === 'win') { n.speed = 0; n.y -= 160 * dt; }               // 倒车让路
    else if (s.state === 'lose') {                                        // AI 贴边挤过去
      n.x = lerp(n.x, this.roadR - n.w / 2 + 14, Math.min(1, dt * 3));
      n.y += 150 * dt;
      p.x = lerp(p.x, this.roadL + p.w / 2 - 8, Math.min(1, dt * 3));
    } else if (s.state === 'duel' && Math.floor(this.t * 2) % 3 === 0 && !s.aiHonked) {
      s.aiHonked = true; Sfx.horn(0.8);
      this.book.emit('_bubble', 0, n.x, n.y + 40, { text: pick(['滴——！', '你退！', '凭什么我退？']) });
    } else if (Math.floor(this.t * 2) % 3 !== 0) s.aiHonked = false;
    if (s.state === 'approach' || s.state === 'duel') {
      // 实体阻挡
      const m = satMTV(p.poly(), n.poly());
      if (m) { p.x += m.x * m.depth; p.y += m.y * m.depth; p.speed *= 0.3; }
    }
  }

  // ── 绘制 ──────────────────────────────────────────────────────────────────
  draw(ctx) {
    const y0 = this.camY - 20, y1 = this.camY + CANVAS_H + 20;
    ctx.save();
    ctx.translate(0, -this.camY);

    // 路外
    ctx.fillStyle = '#1f2b22'; ctx.fillRect(0, y0, CANVAS_W, y1 - y0);
    const rnd = mulberry32(3);
    ctx.fillStyle = '#26352a';
    for (let i = 0; i < 60; i++) {
      const x = rnd() * CANVAS_W, yy = rnd() * 2000;
      const wy = y0 + ((yy - y0) % 2000 + 2000) % 2000;
      ctx.fillRect(x, wy - 1000, 16, 16);
    }
    // 路肩 + 路面
    ctx.fillStyle = '#2b2e33'; ctx.fillRect(this.railL, y0, this.railR - this.railL, y1 - y0);
    drawAsphalt(ctx, this.roadL, y0, this.roadR - this.roadL, y1 - y0);

    // 匝道
    if (this.cfg.exitEvery) {
      for (let k = Math.max(1, Math.floor(-y1 / this.cfg.exitEvery)); k <= Math.floor(-y0 / this.cfg.exitEvery) + 1; k++) {
        const ry = -k * this.cfg.exitEvery;
        if (ry > y1 || ry + RAMP_LEN < y0) continue;
        ctx.fillStyle = '#2b2e33'; ctx.fillRect(this.railR, ry, RAMP_W, RAMP_LEN);
        ctx.fillStyle = '#1e7a3e'; ctx.fillRect(this.railR + 12, ry + 30, 90, 46);
        ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FONT_BODY}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('服务区', this.railR + 57, ry + 46); ctx.fillText('→ 出口', this.railR + 57, ry + 64);
      }
    }

    // 导流线 / 黄网线
    const E = this.cfg.yellowEvery;
    if (E) {
      for (let k = Math.max(1, Math.floor(-y1 / E) - 1); k <= Math.floor(-y0 / E) + 1; k++) {
        const z = this.yellowZone(k);
        if (!z || z.y > y1 || z.y + z.h < y0) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
        ctx.strokeStyle = 'rgba(232,193,74,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let yy = z.y - z.w; yy < z.y + z.h; yy += 18) { ctx.moveTo(z.x, yy); ctx.lineTo(z.x + z.w, yy + z.w); }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = C.lineYellow; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h);
      }
    }

    // 车道线
    for (let i = 1; i < this.nL; i++) {
      const lx = this.roadL + i * this.laneW;
      const center = this.lanes[i - 1] !== this.lanes[i];
      ctx.strokeStyle = center ? C.lineYellow : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const start = Math.floor(y0 / 20) * 20;
      for (let yy = start; yy < y1; yy += 20) {
        const solid = this.isSolidAt(i, yy);
        const dashOn = (((Math.floor(yy / 20) % 3) + 3) % 3) !== 2;
        if (solid || dashOn) { ctx.moveTo(lx, yy); ctx.lineTo(lx, yy + 20); }
      }
      ctx.stroke();
    }
    // 边线
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.roadL + 2, y0); ctx.lineTo(this.roadL + 2, y1);
    ctx.moveTo(this.roadR - 2, y0); ctx.lineTo(this.roadR - 2, y1);
    ctx.stroke();

    // 护栏（匝道处断开）
    this.drawRail(ctx, this.railL, y0, y1, false);
    this.drawRail(ctx, this.railR, y0, y1, !!this.cfg.exitEvery);

    this.skids.draw(ctx, y0, y1);
    for (const pr of this.props) if (pr.down) pr.draw(ctx);
    drawHighbeam(ctx, this.player);
    for (const n of this.npcs) if (n.y > y0 - 60 && n.y < y1 + 60) n.draw(ctx, this.t);
    if (this.standoffCar) this.standoffCar.draw(ctx, this.t);
    for (const pr of this.props) if (!pr.down) pr.draw(ctx);
    this.player.draw(ctx, this.t);
    ctx.restore();
  }

  drawRail(ctx, x, y0, y1, gaps) {
    ctx.fillStyle = '#8a9099';
    const segs = [[y0, y1]];
    if (gaps) {
      segs.length = 0;
      let cur = y0;
      const E = this.cfg.exitEvery;
      for (let k = Math.max(1, Math.floor(-y1 / E)); k <= Math.floor(-y0 / E) + 1; k++) {
        const ry = -k * E;
        if (ry + RAMP_LEN < y0 || ry > y1) continue;
        segs.push([cur, ry]); cur = ry + RAMP_LEN;
      }
      segs.push([cur, y1]);
      segs.sort((a, b) => a[0] - b[0]);
    }
    for (const [a, b] of segs) {
      if (b <= a) continue;
      ctx.fillRect(x - 3, a, 6, b - a);
      ctx.fillStyle = '#5a6069';
      for (let yy = Math.ceil(a / 60) * 60; yy < b; yy += 60) ctx.fillRect(x - 5, yy, 10, 6);
      ctx.fillStyle = '#8a9099';
    }
  }
}
