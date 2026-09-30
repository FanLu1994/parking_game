// ─── 入口：画布适配 + 主循环 ─────────────────────────────────────────────────
(() => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);

  function resize() {
    const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(CANVAS_W * s)}px`;
    canvas.style.height = `${Math.floor(CANVAS_H * s)}px`;
    canvas.width = Math.floor(CANVAS_W * s * dpr);
    canvas.height = Math.floor(CANVAS_H * s * dpr);
    game.pixelScale = s * dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  // 鼠标 / 触摸点击 UI
  canvas.addEventListener('pointerdown', e => {
    Sfx.unlock();
    const [x, y] = toCanvasXY(canvas, e.clientX, e.clientY);
    UI.click(x, y);
  });
  canvas.addEventListener('pointermove', e => { UI.hover = toCanvasXY(canvas, e.clientX, e.clientY); });
  canvas.addEventListener('pointerleave', () => { UI.hover = null; });

  // 虚拟按键
  const onTouch = e => { if (game.state === 'play') { e.preventDefault(); TouchPad.handle(canvas, e); } };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    canvas.addEventListener(ev, onTouch, { passive: false });

  // 浏览器要求用户手势后才能播放音频
  const unlockAudio = () => Sfx.unlock();
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('pointerdown', unlockAudio, { once: true });

  let last = performance.now();
  const STEP = 1 / 60;
  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // 固定子步长，保证判定与帧率无关
    while (dt > 1e-6) {
      const h = Math.min(STEP, dt);
      game.update(h);
      Input.tick();
      dt -= h;
    }
    const ctx = game.ctx;
    ctx.setTransform(game.pixelScale, 0, 0, game.pixelScale, 0, 0);
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
