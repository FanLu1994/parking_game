// ─── Input Manager ────────────────────────────────────────────────────────────
// 键盘与虚拟按键统一映射为 action；justDown 基于上一帧快照判断
const Input = (() => {
  const keys = {};
  const touch = {};
  let prev = {};

  const KEY_MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'brake',
    KeyH: 'highbeam',
    KeyJ: 'honk',
    KeyL: 'signal',
    KeyR: 'restart',
    Escape: 'pause', KeyP: 'pause',
    Enter: 'confirm',
    Digit1: 'opt1', Numpad1: 'opt1',
    Digit2: 'opt2', Numpad2: 'opt2',
  };

  let anyKeyListener = null;

  document.addEventListener('keydown', e => {
    const action = KEY_MAP[e.code];
    if (action) { e.preventDefault(); keys[action] = true; }
    if (anyKeyListener) anyKeyListener(e);
  });
  document.addEventListener('keyup', e => {
    const action = KEY_MAP[e.code];
    if (action) keys[action] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  function pressed(a)  { return !!(keys[a] || touch[a]); }
  function justDown(a) { return pressed(a) && !prev[a]; }
  function anyDriveInput() {
    return pressed('up') || pressed('down') || pressed('left') || pressed('right') || pressed('brake');
  }
  // 每帧末尾调用
  function tick() {
    const snap = {};
    for (const k in keys) snap[k] = keys[k];
    for (const k in touch) snap[k] = snap[k] || touch[k];
    prev = snap;
  }
  function clear() {
    for (const k in keys) keys[k] = false;
    for (const k in touch) touch[k] = false;
  }

  return { pressed, justDown, anyDriveInput, tick, clear, touch,
           onAnyKey(fn) { anyKeyListener = fn; } };
})();

// ─── Pointer → 画布坐标 ──────────────────────────────────────────────────────
function toCanvasXY(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return [ (clientX - r.left) * CANVAS_W / r.width,
           (clientY - r.top)  * CANVAS_H / r.height ];
}

const IS_TOUCH = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

// ─── 虚拟按键（画布坐标）§4.3 ─────────────────────────────────────────────────
const TouchPad = {
  buttons: [],
  layout(isDrive) {
    const S = 68, G = 10, B = CANVAS_H - S - 14;
    const R = CANVAS_W - 14 - S;
    const btns = [
      { a: 'left',  x: 14,         y: B, w: S, h: S, label: '◀' },
      { a: 'right', x: 14 + S + G, y: B, w: S, h: S, label: '▶' },
      { a: 'up',    x: R,          y: B - S - G, w: S, h: S, label: '油门' },
      { a: 'down',  x: R,          y: B, w: S, h: S, label: '刹/倒' },
      { a: 'brake', x: R - S - G,  y: B, w: S, h: S, label: '手刹' },
    ];
    if (isDrive) {
      btns.push({ a: 'highbeam', x: CANVAS_W - 14 - 52 * 2 - G, y: 70, w: 52, h: 40, label: '远光' });
      btns.push({ a: 'honk',     x: CANVAS_W - 14 - 52,         y: 70, w: 52, h: 40, label: '喇叭' });
    }
    this.buttons = btns;
  },
  handle(canvas, e) {
    for (const b of this.buttons) Input.touch[b.a] = false;
    for (const t of e.touches) {
      const [x, y] = toCanvasXY(canvas, t.clientX, t.clientY);
      for (const b of this.buttons)
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) Input.touch[b.a] = true;
    }
  },
  draw(ctx) {
    if (!IS_TOUCH) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of this.buttons) {
      const on = Input.touch[b.a];
      ctx.fillStyle = on ? 'rgba(232,193,74,0.45)' : 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = on ? C.lineYellow : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? C.lineYellow : 'rgba(255,255,255,0.75)';
      ctx.font = `bold 16px ${FONT_BODY}`;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
    ctx.restore();
  },
};
