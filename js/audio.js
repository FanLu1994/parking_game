// ─── WebAudio 合成音 §5 ───────────────────────────────────────────────────────
const Sfx = (() => {
  let ac = null, master = null, hornNodes = null;

  // 过关音效用 <audio> 元素加载：file:// 直接打开页面时 fetch 不可用
  let clearEl = null, clearOk = false, clearTimers = [];
  if (typeof Audio !== 'undefined') {
    clearEl = new Audio(CLEAR_SFX.src);
    clearEl.preload = 'auto';
    clearEl.addEventListener('canplaythrough', () => { clearOk = true; }, { once: true });
    clearEl.addEventListener('error', () => { clearOk = false; }, { once: true });
  }
  function stopClear() {
    clearTimers.forEach(clearTimeout);
    clearTimers = [];
    if (clearEl) clearEl.pause();
  }

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
    if (!ensure()) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  return {
    unlock: ensure,
    // 碰撞：低频锯齿波
    crash()  { tone('sawtooth', 110, 40, 0.35, 0.7); tone('square', 70, 30, 0.25, 0.4); },
    thud()   { tone('sawtooth', 80, 45, 0.15, 0.4); },
    // 得分：上行方波
    score(big) {
      tone('square', 520, 880, 0.12, 0.25);
      if (big) tone('square', 660, 1320, 0.16, 0.25, 0.09);
    },
    // 喇叭：双音
    horn(pitch = 1) {
      tone('square', 392 * pitch, 392 * pitch, 0.28, 0.25);
      tone('square', 494 * pitch, 494 * pitch, 0.28, 0.2);
    },
    // 会车对峙时按住喇叭
    hornStart() {
      if (!ensure() || hornNodes) return;
      const g = ac.createGain(); g.gain.value = 0.2; g.connect(master);
      const os = [392, 494].map(f => {
        const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
        o.connect(g); o.start(); return o;
      });
      hornNodes = { g, os };
    },
    hornStop() {
      if (!hornNodes) return;
      const t = ac.currentTime;
      hornNodes.g.gain.setTargetAtTime(0, t, 0.02);
      hornNodes.os.forEach(o => o.stop(t + 0.1));
      hornNodes = null;
    },
    // 远光切换：滴
    beep()   { tone('sine', 1400, 1400, 0.07, 0.3); },
    click()  { tone('square', 700, 700, 0.04, 0.15); },
    fail()   { tone('triangle', 400, 120, 0.7, 0.4); },
    win()    { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.14, 0.22, i * 0.1)); },
    // 过关：优先播放本地音频片段
    clear() {
      stopClear();
      if (!clearOk) return this.win();
      const { start, duration, volume } = CLEAR_SFX;
      clearEl.currentTime = start;
      clearEl.volume = volume;
      clearEl.play().catch(() => this.win());
      // 结尾 0.8s 淡出
      const fadeStart = Math.max(0, duration - 0.8) * 1000;
      for (let i = 1; i <= 8; i++)
        clearTimers.push(setTimeout(() => { clearEl.volume = volume * (1 - i / 8); }, fadeStart + i * 100));
      clearTimers.push(setTimeout(stopClear, duration * 1000));
    },
    stopClear,
    phone()  { for (let i = 0; i < 3; i++) tone('square', 880, 880, 0.08, 0.2, i * 0.14); },
  };
})();
