// ─── HUD §6 ───────────────────────────────────────────────────────────────────
class Hud {
  constructor() { this.reset(); }

  reset() {
    this.floaters = [];   // 世界坐标得分飘字
    this.bubbles = [];    // 世界坐标对话气泡
    this.banner = null;   // "对方全责"横幅
    this.tutorial = null; // { lines, idx, t }
  }

  attach(book) {
    book.onScore((key, pts, x, y, extra) => {
      if (key === '_bubble') {
        this.bubbles.push({ text: extra.text, x, y, t: 0 });
        return;
      }
      const def = ITEM_DEFS[key];
      const label = def ? def.label.replace(/（.*）/, '') : key;
      this.floaters.push({ text: `+${pts} ${label}`, x, y, t: 0, mult: extra.mult || 1 });
      if (key === 'scrape') this.banner = { text: '对方全责', t: 0 };
      if (pts > 0) Sfx.score(pts >= 150);
    });
  }

  startTutorial(lines) { this.tutorial = { lines, idx: 0, t: 0 }; }

  // 由场景推进教程：autoAdvance 秒后自动下一条；force 为 true 时立即推进
  advanceTutorial(force) {
    const tu = this.tutorial;
    if (!tu) return;
    if (force || tu.t > 5) { if (tu.idx < tu.lines.length - 1) { tu.idx++; tu.t = 0; } }
  }

  update(dt) {
    for (const f of this.floaters) f.t += dt;
    for (const b of this.bubbles) b.t += dt;
    this.floaters = this.floaters.filter(f => f.t < 1.4);
    this.bubbles = this.bubbles.filter(b => b.t < 1.8);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.5) this.banner = null; }
    if (this.tutorial) this.tutorial.t += dt;
  }

  // 在场景相机变换下绘制
  drawWorld(ctx, camY = 0) {
    ctx.save();
    ctx.translate(0, -camY);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const a = 1 - Math.max(0, f.t - 0.9) / 0.5;
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.mult > 1 ? 18 : 15}px ${FONT_TITLE}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      const y = f.y - f.t * 40;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.mult > 1 ? '#ffd24a' : C.green;
      ctx.fillText(f.text, f.x, y);
      if (f.mult > 1) {
        ctx.font = `bold 12px ${FONT_TITLE}`;
        ctx.strokeText(`COMBO ×${f.mult.toFixed(2).replace(/0$/, '')}`, f.x, y + 16);
        ctx.fillText(`COMBO ×${f.mult.toFixed(2).replace(/0$/, '')}`, f.x, y + 16);
      }
    }
    ctx.globalAlpha = 1;
    for (const b of this.bubbles) {
      ctx.font = `bold 13px ${FONT_BODY}`;
      const w = ctx.measureText(b.text).width + 16;
      const y = b.y - b.t * 10;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRectPath(ctx, b.x - w / 2, y - 13, w, 24, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(b.x - 5, y + 11); ctx.lineTo(b.x, y + 18); ctx.lineTo(b.x + 5, y + 11); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillText(b.text, b.x, y);
    }
    ctx.restore();
  }

  drawScreen(ctx, game) {
    const run = game.run, scene = game.scene, level = run.level;
    const book = scene.book;
    const levelScore = run.books.reduce((s, b) => s + b.total, 0);

    ctx.save();
    // 顶栏
    const g = ctx.createLinearGradient(0, 0, 0, 52);
    g.addColorStop(0, 'rgba(8,9,11,0.9)'); g.addColorStop(1, 'rgba(8,9,11,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, 50);

    // 左上：第 N 关 · 目标
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = C.lineYellow; ctx.font = `22px ${FONT_TITLE}`;
    ctx.fillText(`第 ${level.n} 关`, 16, 25);
    ctx.fillStyle = '#c8cdd5'; ctx.font = `15px ${FONT_BODY}`;
    ctx.fillText(`目标 ${level.target}`, 100, 26);
    if (level.phases.length > 1) {
      ctx.fillStyle = '#888';
      ctx.fillText(`阶段 ${run.phaseIdx + 1}/${level.phases.length}`, 190, 26);
    }

    // 中间：限时 / 车速
    if (scene.kind === 'drive') {
      ctx.textAlign = 'center';
      const tl = Math.ceil(scene.timeLeft);
      ctx.fillStyle = tl <= 10 ? C.warn : '#fff';
      ctx.font = `24px ${FONT_TITLE}`;
      ctx.fillText(`${tl}s`, CANVAS_W / 2 - 60, 25);
      const kmh = Math.round(Math.abs(scene.player.speed) / 3);
      const lim = Math.round(scene.cfg.limit / 3);
      ctx.font = `14px ${FONT_BODY}`;
      ctx.fillStyle = '#c8cdd5';
      ctx.fillText(`${kmh} km/h`, CANVAS_W / 2 + 30, 18);
      ctx.fillStyle = '#888';
      ctx.fillText(`限速 ${lim}`, CANVAS_W / 2 + 30, 36);
      if (scene.player.highbeam) {
        ctx.fillStyle = '#fffbe0'; ctx.font = `bold 13px ${FONT_BODY}`;
        ctx.fillText('远光 ON', CANVAS_W / 2 + 110, 26);
      }
    }

    // 右上：实时素质分 + 段位 + 距下一段位
    const total = Save.totalWith(level.n, levelScore);
    const rank = getRank(total), next = getNextRank(total);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.green; ctx.font = `26px ${FONT_TITLE}`;
    const right = IS_TOUCH ? CANVAS_W - 64 : CANVAS_W - 16;
    ctx.fillText(`${levelScore}`, right, 22);
    ctx.font = `12px ${FONT_BODY}`;
    ctx.fillStyle = '#c8cdd5';
    ctx.fillText(`素质分 ${total} · ${rank.name}${next ? ` · 距下一段 ${next.score - total}` : ''}`, right, 42);

    // combo（驾驶关）
    if (book.comboEnabled && book.comboN >= 2 && book.comboTimer > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd24a'; ctx.font = `28px ${FONT_TITLE}`;
      ctx.fillText(`COMBO ×${book.comboMult.toFixed(2)}`, 16, 84);
      ctx.fillStyle = 'rgba(255,210,74,0.8)';
      ctx.fillRect(16, 100, 140 * (book.comboTimer / SCORE.COMBO_WINDOW), 4);
    }

    // 持续型行为提示
    const conts = book.activeContinuous();
    if (conts.length) {
      ctx.textAlign = 'left'; ctx.font = `bold 14px ${FONT_BODY}`;
      conts.forEach((k, i) => {
        const c = book.cont[k];
        const decayed = c.seg > SCORE.CONTINUOUS_DECAY_AFTER;
        ctx.fillStyle = decayed ? '#b8a060' : C.green;
        ctx.fillText(`▶ ${ITEM_DEFS[k].label}${decayed ? '（收益减半）' : ''}`, 16, 130 + i * 20);
      });
    }

    // 停稳判定
    if (scene.kind === 'park' && scene.settleProgress > 0 && !scene.popup) {
      const pr = clamp(scene.settleProgress, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRectPath(ctx, CANVAS_W / 2 - 150, 70, 300, 44, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${FONT_BODY}`;
      ctx.fillText('保持不动，正在固化证据……', CANVAS_W / 2, 86);
      ctx.fillStyle = '#444'; ctx.fillRect(CANVAS_W / 2 - 130, 100, 260, 6);
      ctx.fillStyle = C.green; ctx.fillRect(CANVAS_W / 2 - 130, 100, 260 * pr, 6);
    }

    // 驾驶关起步提示
    if (scene.kind === 'drive' && !scene.started) {
      const a = 0.6 + 0.4 * Math.sin(game.time * 5);
      ctx.globalAlpha = a;
      drawLabel(ctx, IS_TOUCH ? '按 油门 出发（计时从出发开始）' : '按 ↑ / W 出发（计时从出发开始）',
        CANVAS_W / 2, 260, C.lineYellow, 20);
      ctx.globalAlpha = 1;
    }

    // 会车对峙
    if (scene.standoff) {
      const s = scene.standoff;
      ctx.textAlign = 'center'; ctx.font = `bold 16px ${FONT_BODY}`;
      if (s.state === 'approach' && s.gap < 260) {
        drawLabel(ctx, '对面不让？按住 喇叭（J）对峙，别松手也别后退', CANVAS_W / 2, 88, '#fff', 15);
      } else if (s.state === 'duel') {
        drawLabel(ctx, `对峙中…… ${s.t.toFixed(1)}s`, CANVAS_W / 2, 88, C.lineYellow, 18);
      }
    }

    // 横幅
    if (this.banner) {
      const b = this.banner;
      const sc = b.t < 0.15 ? 0.6 + b.t / 0.15 * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = b.t > 1.2 ? (1.5 - b.t) / 0.3 : 1;
      ctx.translate(CANVAS_W / 2, 190); ctx.scale(sc, sc); ctx.rotate(-0.05);
      ctx.fillStyle = 'rgba(255,94,94,0.92)';
      ctx.fillRect(-150, -30, 300, 60);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(-144, -24, 288, 48);
      ctx.fillStyle = '#fff'; ctx.font = `34px ${FONT_TITLE}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.text, 0, 2);
      ctx.restore();
    }

    // 新手气泡
    if (this.tutorial) {
      const tu = this.tutorial;
      const text = tu.lines[tu.idx];
      ctx.font = `bold 17px ${FONT_BODY}`;
      const w = ctx.measureText(text).width + 40;
      const x = CANVAS_W / 2 - w / 2, y = CANVAS_H - 120;
      ctx.fillStyle = 'rgba(232,193,74,0.95)';
      roundRectPath(ctx, x, y, w, 40, 20); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, CANVAS_W / 2, y + 20);
    }

    // 底部：操作提示 / 虚拟按键
    if (IS_TOUCH) {
      TouchPad.draw(ctx);
    } else {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `12px ${FONT_BODY}`; ctx.fillStyle = 'rgba(200,205,213,0.7)';
      const hint = scene.kind === 'drive'
        ? '↑↓←→ / WASD 驾驶　空格 手刹　H 远光　J 喇叭　L 转向灯　R 重开　Esc 暂停'
        : '↑↓←→ / WASD 驾驶　↓ 刹车/倒车　空格 手刹　停稳 1.3 秒自动结算　R 重开　Esc 暂停';
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, CANVAS_H - 24, CANVAS_W, 24);
      ctx.fillStyle = 'rgba(200,205,213,0.8)';
      ctx.fillText(hint, CANVAS_W / 2, CANVAS_H - 12);
    }
    ctx.restore();
  }
}
