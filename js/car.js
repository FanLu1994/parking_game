// ─── 车辆：物理 + 绘制 ────────────────────────────────────────────────────────
// 约定：angle = 0 时车头朝上（-y），车长沿局部 y 轴，前进方向 (sin a, -cos a)

class Car {
  constructor(x, y, angle, opts = {}) {
    this.x = x; this.y = y; this.angle = angle;
    this.speed = 0;               // 沿车头方向的有符号速度 px/s
    this.w = opts.w || CAR.NPC_W;
    this.h = opts.h || CAR.NPC_H;
    this.phys = opts.phys || PHYS.park;
    this.color = opts.color || pick(C.npcCar);
    this.isPlayer = !!opts.isPlayer;
    this.highbeam = false;
    this.braking = false;
    this.steerInput = 0;
  }

  get fx() { return Math.sin(this.angle); }
  get fy() { return -Math.cos(this.angle); }
  get vx() { return this.fx * this.speed; }
  get vy() { return this.fy * this.speed; }

  poly() { return obbCorners(this.x, this.y, this.w, this.h, this.angle); }

  // ctl: { up, down, left, right, handbrake }
  drive(dt, ctl) {
    const P = this.phys;
    const maxRev = -P.maxSpeed * P.reverseRatio;
    this.braking = false;

    if (ctl.up) {
      this.speed += (this.speed < 0 ? P.accel * 2.2 : P.accel) * dt;
    } else if (ctl.down) {
      if (this.speed > 0) { this.speed -= P.accel * 2.2 * dt; this.braking = true; }
      else this.speed -= P.accel * 0.8 * dt;
    } else {
      // 松油门滑行：速度 × e^(−4.4·dt)
      this.speed *= Math.exp(-P.drag * dt);
      if (Math.abs(this.speed) < 1) this.speed = 0;
    }
    if (ctl.handbrake) {
      this.speed *= Math.exp(-6 * dt);
      this.braking = true;
      if (Math.abs(this.speed) < 3) this.speed = 0;
    }
    this.speed = clamp(this.speed, maxRev, P.maxSpeed);

    // 转向率与车速相关，下限 0.4；倒车时反向
    const steer = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    this.steerInput = steer;
    if (steer && Math.abs(this.speed) > 1) {
      const rate = Math.max(P.steerMin, P.steerMax * Math.abs(this.speed) / P.maxSpeed);
      this.angle = wrapAngle(this.angle + steer * rate * Math.sign(this.speed) * dt);
    }

    this.x += this.fx * this.speed * dt;
    this.y += this.fy * this.speed * dt;
  }

  // 后轮坐标（轮胎痕迹用）
  rearWheels() {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const lx = this.w / 2 - 5, ly = this.h / 2 - 12;
    return [-lx, lx].map(ox => [this.x + ox * c - ly * s, this.y + ox * s + ly * c]);
  }

  draw(ctx, t = 0) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.isPlayer) drawPlayerBody(ctx, this, t);
    else drawNpcBody(ctx, this, t);
    ctx.restore();
  }
}

// 远光扇形（在车辆之前绘制）
function drawHighbeam(ctx, car) {
  if (!car.highbeam) return;
  const len = 260, half = deg2rad(30);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle - Math.PI / 2);
  const g = ctx.createRadialGradient(car.h / 2, 0, 4, car.h / 2, 0, len);
  g.addColorStop(0, 'rgba(255,250,210,0.55)');
  g.addColorStop(1, 'rgba(255,250,210,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(car.h / 2 - 4, 0);
  ctx.arc(car.h / 2 - 4, 0, len, -half, half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 玩家车：卡通虚构"显眼包"——方盒子、超大前杠、车顶四射灯、"车大勿近"车贴、圆标
function drawPlayerBody(ctx, car, t) {
  const w = car.w, h = car.h, hw = w / 2, hh = h / 2;
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRectPath(ctx, -hw + 3, -hh + 4, w, h, 5); ctx.fill();
  // 车身
  ctx.fillStyle = '#e8c14a';
  roundRectPath(ctx, -hw, -hh, w, h, 4); ctx.fill();
  ctx.strokeStyle = '#6b5310'; ctx.lineWidth = 1.2; ctx.stroke();
  // 超大号前杠
  ctx.fillStyle = '#3a3d44';
  roundRectPath(ctx, -hw - 3, -hh - 5, w + 6, 10, 3); ctx.fill();
  ctx.fillStyle = '#555a63';
  ctx.fillRect(-hw + 2, -hh - 3, w - 4, 2);
  // 分体式大灯（左右独立，不做贯穿灯带）
  ctx.fillStyle = car.highbeam ? '#fffbe0' : '#f4f1dc';
  ctx.fillRect(-hw + 2, -hh + 5, 6, 4);
  ctx.fillRect(hw - 8, -hh + 5, 6, 4);
  // 前挡风
  ctx.fillStyle = '#2b3a4f';
  ctx.fillRect(-hw + 4, -hh + 14, w - 8, 9);
  // 车顶（方盒子）
  ctx.fillStyle = '#f2d36b';
  ctx.fillRect(-hw + 4, -hh + 23, w - 8, 30);
  ctx.strokeStyle = '#b8932a'; ctx.lineWidth = 1;
  ctx.strokeRect(-hw + 4, -hh + 23, w - 8, 30);
  // 车顶四盏射灯
  for (let i = 0; i < 4; i++) {
    const lx = -hw + 7 + i * ((w - 14) / 3);
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(lx, -hh + 26, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = car.highbeam ? '#ffffff' : '#d8d2b0';
    ctx.beginPath(); ctx.arc(lx, -hh + 26, 2.1, 0, Math.PI * 2); ctx.fill();
    if (car.highbeam) {
      ctx.fillStyle = 'rgba(255,255,220,0.35)';
      ctx.beginPath(); ctx.arc(lx, -hh + 26, 5.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 圆标
  ctx.fillStyle = '#ff5e5e';
  ctx.beginPath(); ctx.arc(0, -hh + 9, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold 5px ${FONT_BODY}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('显', 0, -hh + 9.3);
  // 后挡风
  ctx.fillStyle = '#2b3a4f';
  ctx.fillRect(-hw + 5, hh - 16, w - 10, 6);
  // 车贴"车大勿近"
  ctx.fillStyle = '#222';
  ctx.fillRect(-hw + 3, hh - 9, w - 6, 6);
  ctx.fillStyle = '#e8c14a';
  ctx.font = `bold 5px ${FONT_BODY}`;
  ctx.fillText('车大勿近', 0, hh - 5.8);
  // 分体尾灯
  ctx.fillStyle = car.braking ? '#ff3030' : '#a02020';
  ctx.fillRect(-hw + 1, hh - 3, 6, 3);
  ctx.fillRect(hw - 7, hh - 3, 6, 3);
}

// AI / 障碍车：低饱和杂色小车
function drawNpcBody(ctx, car, t) {
  const w = car.w, h = car.h, hw = w / 2, hh = h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRectPath(ctx, -hw + 2, -hh + 3, w, h, 6); ctx.fill();
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -hw, -hh, w, h, 6); ctx.fill();
  // 车窗（被远光照到时泛白）
  const glare = car.glare > 0;
  ctx.fillStyle = glare ? '#f4f6ff' : '#2c3542';
  ctx.fillRect(-hw + 4, -hh + 12, w - 8, 9);
  ctx.fillRect(-hw + 5, hh - 16, w - 10, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-hw + 4, -hh + 21, w - 8, 20);
  // 灯
  ctx.fillStyle = '#e8e4cc';
  ctx.fillRect(-hw + 2, -hh + 1, 5, 3); ctx.fillRect(hw - 7, -hh + 1, 5, 3);
  const blink = car.hazard && Math.floor(t * 3) % 2 === 0;
  ctx.fillStyle = blink ? '#ffb020' : (car.braking ? '#ff3030' : '#8a2020');
  ctx.fillRect(-hw + 2, hh - 4, 5, 3); ctx.fillRect(hw - 7, hh - 4, 5, 3);
  if (blink) {
    ctx.fillRect(-hw + 2, -hh + 1, 5, 3); ctx.fillRect(hw - 7, -hh + 1, 5, 3);
  }
}

// ─── 轮胎痕迹 ─────────────────────────────────────────────────────────────────
class SkidMarks {
  constructor(max = 900) { this.segs = []; this.max = max; this.last = null; }
  add(wheels) {
    if (this.last) {
      for (let i = 0; i < 2; i++)
        this.segs.push([this.last[i][0], this.last[i][1], wheels[i][0], wheels[i][1]]);
      if (this.segs.length > this.max) this.segs.splice(0, this.segs.length - this.max);
    }
    this.last = wheels;
  }
  lift() { this.last = null; }
  draw(ctx, yMin = -Infinity, yMax = Infinity) {
    ctx.save();
    ctx.strokeStyle = 'rgba(10,10,12,0.55)';
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const s of this.segs) {
      if (s[1] < yMin || s[1] > yMax) continue;
      ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// 玩家车留痕判定：高速急转 / 手刹 / 急刹
function updateSkid(car, skids, ctl) {
  const v = Math.abs(car.speed);
  const hard = (ctl.handbrake && v > 40) ||
               (car.steerInput && v > car.phys.maxSpeed * 0.7) ||
               (ctl.down && car.speed > car.phys.maxSpeed * 0.6);
  if (hard) skids.add(car.rearWheels()); else skids.lift();
}

// ─── 可撞倒道具：垃圾桶 / 交通锥 ─────────────────────────────────────────────
class Prop {
  constructor(type, x, y) {
    this.type = type; this.x = x; this.y = y;
    this.r = type === 'bin' ? 11 : 8;
    this.down = false; this.vx = 0; this.vy = 0; this.rot = 0; this.spin = 0;
  }
  poly() {
    const r = this.r;
    return [[this.x - r, this.y - r], [this.x + r, this.y - r], [this.x + r, this.y + r], [this.x - r, this.y + r]];
  }
  knock(vx, vy) {
    this.down = true;
    this.vx = vx * 0.9 + (Math.random() - 0.5) * 60;
    this.vy = vy * 0.9 + (Math.random() - 0.5) * 60;
    this.spin = (Math.random() - 0.5) * 12;
  }
  update(dt) {
    if (!this.down) return;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.spin * dt;
    const k = Math.exp(-3 * dt);
    this.vx *= k; this.vy *= k; this.spin *= k;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    if (this.type === 'cone') {
      if (this.down) {
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, 0); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-3, -2.5, 3, 5);
      } else {
        ctx.fillStyle = '#333'; ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      if (this.down) {
        ctx.fillStyle = '#2f7a4a'; ctx.fillRect(-12, -7, 24, 14);
        ctx.fillStyle = '#6b5a3a';
        for (let i = 0; i < 4; i++) ctx.fillRect(12 + i * 5, -6 + i * 3, 4, 3);
      } else {
        ctx.fillStyle = '#2f7a4a'; roundRectPath(ctx, -11, -11, 22, 22, 3); ctx.fill();
        ctx.fillStyle = '#3d9a5e'; ctx.fillRect(-9, -9, 18, 5);
        ctx.fillStyle = '#fff'; ctx.font = `bold 8px ${FONT_BODY}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('垃圾', 0, 3);
      }
    }
    ctx.restore();
  }
}
