// ─── 即时模式 UI：每帧绘制按钮并登记点击区域 ─────────────────────────────────
const UI = {
  regions: [],
  pending: [],
  hover: null,
  beginFrame() { this.regions = this.pending; this.pending = []; },
  button(ctx, x, y, w, h, label, onClick, opts = {}) {
    const hot = this.hover && this.hover[0] >= x && this.hover[0] <= x + w && this.hover[1] >= y && this.hover[1] <= y + h;
    const primary = opts.primary;
    ctx.save();
    ctx.fillStyle = opts.disabled ? '#2a2d33' : primary ? (hot ? '#f5d470' : C.lineYellow) : (hot ? '#3a3f48' : '#2a2e35');
    roundRectPath(ctx, x, y, w, h, opts.r || 8); ctx.fill();
    ctx.strokeStyle = primary ? '#fff3' : (opts.border || '#ffffff22'); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = opts.disabled ? '#555' : primary ? '#16181c' : '#e8ecf0';
    ctx.font = `${opts.bold === false ? '' : 'bold '}${opts.size || 16}px ${opts.title ? FONT_TITLE : FONT_BODY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    if (!opts.disabled) this.pending.push({ x, y, w, h, onClick });
  },
  click(x, y) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { Sfx.click(); r.onClick(); return true; }
    }
    return false;
  },
};

function panel(ctx, x, y, w, h, border = '#ffffff22') {
  ctx.fillStyle = 'rgba(18,20,24,0.94)';
  roundRectPath(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke();
}

function starText(n, max = 3) { return '★'.repeat(n) + '☆'.repeat(max - n); }

// ─── 标题 / 选关 ─────────────────────────────────────────────────────────────
function drawTitleScreen(ctx, game) {
  drawAsphalt(ctx, 0, 0, CANVAS_W, CANVAS_H);
  // 装饰：斜纹条
  ctx.fillStyle = getPattern(ctx, 'hatch');
  ctx.fillRect(0, 0, CANVAS_W, 10); ctx.fillRect(0, CANVAS_H - 10, CANVAS_W, 10);

  // 标题车
  const car = game.titleCar;
  car.draw(ctx, game.time);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.lineYellow; ctx.font = `54px ${FONT_TITLE}`;
  ctx.fillText('马路显眼包', CANVAS_W / 2, 74);
  ctx.fillStyle = C.green; ctx.font = `22px ${FONT_TITLE}`;
  ctx.fillText('· 素质模拟器 ·', CANVAS_W / 2, 118);
  ctx.fillStyle = '#9aa0a8'; ctx.font = `14px ${FONT_BODY}`;
  ctx.fillText('别的游戏罚你压线，这游戏给压线发奖', CANVAS_W / 2, 148);

  // 右上角：GitHub 仓库链接
  UI.button(ctx, CANVAS_W - 126, 22, 110, 30, '★ GitHub',
    () => window.open(REPO_URL, '_blank', 'noopener'), { size: 13 });

  const total = Save.totalBest();
  const rank = getRank(total), next = getNextRank(total);
  ctx.fillStyle = '#e8ecf0'; ctx.font = `16px ${FONT_BODY}`;
  ctx.fillText(`素质分 ${total} · ${rank.name}${next ? `（距 ${next.name} 还差 ${next.score - total}）` : ''}`, CANVAS_W / 2, 182);

  // 12 关网格
  const cols = 6, bw = 128, bh = 96, gap = 14;
  const x0 = CANVAS_W / 2 - (cols * bw + (cols - 1) * gap) / 2, y0 = 214;
  const chapters = ['城市地库', '路边与小区', '马路现场', '终局'];
  LEVELS.forEach((lv, i) => {
    const x = x0 + (i % cols) * (bw + gap), y = y0 + Math.floor(i / cols) * (bh + gap);
    const unlocked = Save.unlocked(lv.n);
    const sel = game.menuSel === i;
    ctx.save();
    ctx.fillStyle = unlocked ? (sel ? '#3a3f48' : '#2a2e35') : '#1c1e22';
    roundRectPath(ctx, x, y, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = sel ? C.lineYellow : '#ffffff18'; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (unlocked) {
      ctx.fillStyle = '#fff'; ctx.font = `26px ${FONT_TITLE}`;
      ctx.fillText(`${lv.n}`, x + bw / 2, y + 28);
      ctx.fillStyle = '#9aa0a8'; ctx.font = `12px ${FONT_BODY}`;
      ctx.fillText(`目标 ${lv.target}`, x + bw / 2, y + 52);
      ctx.fillStyle = C.lineYellow; ctx.font = `16px ${FONT_BODY}`;
      ctx.fillText(starText(Save.stars(lv.n)), x + bw / 2, y + 72);
      const best = Save.best(lv.n);
      if (best) { ctx.fillStyle = C.green; ctx.font = `11px ${FONT_BODY}`; ctx.fillText(`最高 ${best}`, x + bw / 2, y + 88); }
    } else {
      ctx.fillStyle = '#555'; ctx.font = `28px ${FONT_BODY}`;
      ctx.fillText('🔒', x + bw / 2, y + bh / 2);
    }
    ctx.restore();
    if (unlocked) UI.pending.push({ x, y, w: bw, h: bh, onClick: () => game.showIntro(lv.n) });
  });
  // 篇章标签（只给篇章名，不透露关卡场景）
  ctx.fillStyle = '#6a7078'; ctx.font = `12px ${FONT_BODY}`; ctx.textAlign = 'left';
  ctx.fillText(`第一篇章 ${chapters[0]}  1–3　第二篇章 ${chapters[1]}  4–6　第三篇章 ${chapters[2]}  7–10　第四篇章 ${chapters[3]}  11–12`, x0, y0 + 2 * (bh + gap) + 8);

  UI.button(ctx, CANVAS_W / 2 - 110, 470, 220, 50, '开 始', () => game.showIntro(LEVELS[game.menuSel].n), { primary: true, size: 22, title: true });
  ctx.fillStyle = '#6a7078'; ctx.font = `12px ${FONT_BODY}`; ctx.textAlign = 'center';
  ctx.fillText(IS_TOUCH ? '点选关卡开始' : '←→↑↓ 选关，Enter 开始', CANVAS_W / 2, 540);
  ctx.fillStyle = '#4a5058';
  ctx.fillText('纯属虚构的玩梗游戏：游戏得分 ≠ 现实正确。现实中请遵守交规、规范停车。', CANVAS_W / 2, 600);
  UI.button(ctx, CANVAS_W - 110, CANVAS_H - 46, 94, 28, game.confirmReset ? '确定清空？' : '清空存档',
    () => { if (game.confirmReset) { Save.reset(); game.confirmReset = false; game.menuSel = 0; } else game.confirmReset = true; },
    { size: 12, border: game.confirmReset ? C.warn : undefined });
}

// ─── 关卡入口（不显示关卡名、不预告场景）──────────────────────────────────────
function drawIntro(ctx, game) {
  ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const lv = game.run.level;
  const a = Math.min(1, game.stateT / 0.4);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.lineYellow; ctx.font = `60px ${FONT_TITLE}`;
  ctx.fillText(`第 ${lv.n} 关`, CANVAS_W / 2, 230);
  ctx.fillStyle = '#e8ecf0'; ctx.font = `24px ${FONT_TITLE}`;
  ctx.fillText(`目标 ${lv.target}`, CANVAS_W / 2, 300);
  ctx.fillStyle = '#8a9099'; ctx.font = `18px ${FONT_BODY}`;
  ctx.fillText(`「${lv.hint}」`, CANVAS_W / 2, 350);
  ctx.globalAlpha = 1;
  UI.button(ctx, CANVAS_W / 2 - 100, 420, 200, 50, '出 发', () => game.beginLevel(), { primary: true, size: 22, title: true });
  UI.button(ctx, CANVAS_W / 2 - 60, 486, 120, 34, '返回', () => game.toTitle(), { size: 14 });
}

// ─── 阶段过渡（黑屏）─────────────────────────────────────────────────────────
function drawTransition(ctx, game) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8ecf0'; ctx.font = `30px ${FONT_TITLE}`;
  ctx.globalAlpha = Math.min(1, game.stateT / 0.25);
  ctx.fillText(game.transitionText, CANVAS_W / 2, CANVAS_H / 2);
  ctx.globalAlpha = 1;
}

// ─── 小结算（第 12 关 ②）───────────────────────────────────────────────────
function drawMini(ctx, game) {
  panel(ctx, CANVAS_W / 2 - 180, 220, 360, 150, C.lineYellow);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c8cdd5'; ctx.font = `16px ${FONT_BODY}`;
  ctx.fillText('本段得分', CANVAS_W / 2, 262);
  ctx.fillStyle = C.green; ctx.font = `46px ${FONT_TITLE}`;
  ctx.fillText(`${game.scene.book.total}`, CANVAS_W / 2, 318);
}

// ─── 暂停 ─────────────────────────────────────────────────────────────────────
function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  panel(ctx, CANVAS_W / 2 - 150, 170, 300, 290);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `30px ${FONT_TITLE}`;
  ctx.fillText('暂停', CANVAS_W / 2, 215);
  UI.button(ctx, CANVAS_W / 2 - 100, 250, 200, 46, '继续', () => { game.paused = false; }, { primary: true });
  UI.button(ctx, CANVAS_W / 2 - 100, 310, 200, 46, '重开本关', () => game.restart());
  UI.button(ctx, CANVAS_W / 2 - 100, 370, 200, 46, '返回选关', () => game.toTitle());
}

// ─── 挪车电话弹窗 §3.5 ────────────────────────────────────────────────────────
function drawPhone(ctx, game) {
  const scene = game.scene, pop = scene.popup;
  const shake = scene.popupCount * 1.2;
  const ox = (Math.random() - 0.5) * shake, oy = (Math.random() - 0.5) * shake;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const x = CANVAS_W / 2 - 220 + ox, y = 190 + oy;
  panel(ctx, x, y, 440, 230, scene.popupCount >= 2 ? C.warn : '#ffffff44');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = scene.popupCount >= 2 ? C.warn : C.lineYellow; ctx.font = `24px ${FONT_TITLE}`;
  ctx.fillText('📞 挪车电话', CANVAS_W / 2 + ox, y + 36);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${16 + scene.popupCount}px ${FONT_BODY}`;
  ctx.fillText(pop.line, CANVAS_W / 2 + ox, y + 92);
  const kb = IS_TOUCH ? '' : '（1）';
  const kb2 = IS_TOUCH ? '' : '（2）';
  UI.button(ctx, x + 40, y + 150, 170, 50, `就不挪${kb}`, () => scene.answer(false), { primary: true });
  UI.button(ctx, x + 230, y + 150, 170, 50, `马上挪${kb2}`, () => scene.answer(true));
}

// ─── 结算面板 §6 ─────────────────────────────────────────────────────────────
function drawResult(ctx, game) {
  const r = game.result;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 弹幕（背景滚动）
  ctx.save();
  ctx.font = `bold 20px ${FONT_BODY}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  r.danmaku.forEach((d, i) => {
    const w = ctx.measureText(d.text).width;
    const span = CANVAS_W + w + 40;
    const x = CANVAS_W - ((game.stateT * d.speed + d.offset) % span);
    ctx.fillStyle = r.mock ? 'rgba(255,94,94,0.9)' : 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.strokeText(d.text, x, 40 + i * 34);
    ctx.fillText(d.text, x, 40 + i * 34);
  });
  ctx.restore();

  const px = CANVAS_W / 2 - 300, py = 140, pw = 600, ph = 470;
  panel(ctx, px, py, pw, ph, r.mock ? C.warn : r.passed ? C.green : '#ffffff33');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (r.mock) {
    ctx.fillStyle = C.warn; ctx.font = `34px ${FONT_TITLE}`;
    ctx.fillText('⛔ 您的驾驶过于规范', CANVAS_W / 2, py + 44);
    ctx.fillStyle = '#c8cdd5'; ctx.font = `15px ${FONT_BODY}`;
    ctx.fillText(`（${r.mock}）本关记 0 分，不解锁下一关，可无限重试`, CANVAS_W / 2, py + 84);
  } else {
    ctx.fillStyle = C.lineYellow; ctx.font = `36px ${FONT_BODY}`;
    ctx.fillText(starText(r.stars), CANVAS_W / 2, py + 40);
    ctx.fillStyle = r.passed ? C.green : '#c8cdd5'; ctx.font = `24px ${FONT_TITLE}`;
    ctx.fillText(r.passed ? '素质达标 · 过关' : '素质不达标', CANVAS_W / 2, py + 80);
  }
  ctx.fillStyle = '#fff'; ctx.font = `44px ${FONT_TITLE}`;
  ctx.fillText(`${r.score}`, CANVAS_W / 2, py + 128);
  ctx.fillStyle = '#8a9099'; ctx.font = `13px ${FONT_BODY}`;
  const t2 = Math.round(r.target * STAR.S2), t3 = Math.round(r.target * STAR.S3);
  ctx.fillText(`目标 ${r.target}　★★ ${t2}　★★★ ${t3}${r.newBest ? '　· 新纪录！' : ''}`, CANVAS_W / 2, py + 160);

  // 明细
  let y = py + 192;
  ctx.font = `14px ${FONT_BODY}`;
  const keys = Object.keys(r.items);
  const colW = 260;
  keys.forEach((k, i) => {
    const it = r.items[k];
    const cx = i % 2 === 0 ? px + 30 : px + 30 + colW + 20;
    const cy = y + Math.floor(i / 2) * 22;
    ctx.textAlign = 'left'; ctx.fillStyle = '#c8cdd5';
    ctx.fillText(`${ITEM_DEFS[k].label}${it.count > 1 ? ` ×${it.count}` : ''}`, cx, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = C.green;
    ctx.fillText(`+${it.points}`, cx + colW, cy);
  });
  y += Math.ceil(keys.length / 2) * 22;
  if (r.hidden > 0) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#6a7078';
    ctx.fillText(`??? × ${r.hidden} 个得分点未发现`, CANVAS_W / 2, y + 4);
    y += 24;
  }
  // 现实对照
  if (r.notes.length) {
    y += 4;
    ctx.textAlign = 'center'; ctx.font = `12px ${FONT_BODY}`; ctx.fillStyle = '#e8a060';
    for (const n of r.notes.slice(0, 4)) { ctx.fillText(n, CANVAS_W / 2, y); y += 17; }
  }
  if (r.rankUp) {
    ctx.fillStyle = C.lineYellow; ctx.font = `18px ${FONT_TITLE}`; ctx.textAlign = 'center';
    ctx.fillText(`段位提升：${r.rankUp}`, CANVAS_W / 2, py + ph - 100);
  }
  if (r.ending) {
    ctx.fillStyle = C.green; ctx.font = `bold 15px ${FONT_BODY}`; ctx.textAlign = 'center';
    ctx.fillText(ENDING_TEXT, CANVAS_W / 2, py + ph - 78);
  }

  // 按钮
  const by = py + ph - 62;
  const canNext = r.passed && r.level < LEVELS.length;
  UI.button(ctx, px + 30, by, 170, 44, IS_TOUCH ? '重试' : '重试（R）', () => game.restart());
  UI.button(ctx, px + 215, by, 170, 44, '选关', () => game.toTitle());
  UI.button(ctx, px + 400, by, 170, 44, IS_TOUCH ? '下一关' : '下一关（Enter）', () => game.showIntro(r.level + 1),
    { primary: canNext, disabled: !canNext });
  ctx.fillStyle = '#5a6068'; ctx.font = `11px ${FONT_BODY}`; ctx.textAlign = 'center';
  ctx.fillText('以上均为反面示范：游戏得分 ≠ 现实正确。现实中请遵守交规、规范停车。', CANVAS_W / 2, py + ph - 8);

  // 物业法务部 / 交管 AI 警告彩蛋
  if (r.warning && !r.warningClosed) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    panel(ctx, CANVAS_W / 2 - 260, 230, 520, 170, C.warn);
    ctx.strokeStyle = C.warn; ctx.lineWidth = 4;
    roundRectPath(ctx, CANVAS_W / 2 - 252, 238, 504, 154, 10); ctx.stroke();
    ctx.fillStyle = C.warn; ctx.font = `22px ${FONT_TITLE}`; ctx.textAlign = 'center';
    ctx.fillText('⚠ 警告', CANVAS_W / 2, 270);
    ctx.fillStyle = '#fff'; ctx.font = `15px ${FONT_BODY}`;
    wrapText(ctx, r.warning, CANVAS_W / 2, 308, 460, 22);
    UI.button(ctx, CANVAS_W / 2 - 60, 350, 120, 34, '知道了', () => { r.warningClosed = true; }, { size: 14 });
  }
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  let line = '';
  const lines = [];
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch;
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh - (lines.length - 1) * lh / 2));
}

// 移动端暂停按钮
function drawPauseButton(ctx, game) {
  if (!IS_TOUCH) return;
  UI.button(ctx, CANVAS_W - 52, 8, 40, 34, 'Ⅱ', () => { game.paused = true; }, { size: 16 });
}
