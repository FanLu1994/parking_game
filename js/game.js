// ─── 游戏状态机 ───────────────────────────────────────────────────────────────
// title → intro → play ⇄ (transition / mini) → result
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.stateT = 0;
    this.time = 0;
    this.paused = false;
    this.menuSel = 0;
    this.hud = new Hud();
    this.run = null;
    this.scene = null;
    this.result = null;
    this.titleCar = new Car(CANVAS_W / 2, 580, Math.PI / 2, { w: CAR.W, h: CAR.H, isPlayer: true });
    // 默认选中最新解锁的关卡
    for (const lv of LEVELS) if (Save.unlocked(lv.n)) this.menuSel = lv.n - 1;
  }

  setState(s) {
    // 离开结算页时掐掉过关音乐
    if (this.state === 'result' && s !== 'result') Sfx.stopClear();
    this.state = s; this.stateT = 0; Input.clear();
  }

  toTitle() {
    Sfx.hornStop();
    this.paused = false;
    this.run = null; this.scene = null;
    this.setState('title');
  }

  showIntro(n) {
    this.run = { level: LEVELS[n - 1], phaseIdx: 0, books: [], flags: {}, mock: null };
    this.menuSel = n - 1;
    this.paused = false;
    this.setState('intro');
  }

  beginLevel() { this.startPhase(0); }

  restart() {
    Sfx.hornStop();
    const n = this.run ? this.run.level.n : this.menuSel + 1;
    this.showIntro(n);
    this.beginLevel();
  }

  startPhase(i) {
    const run = this.run, level = run.level;
    run.phaseIdx = i;
    run.books.length = i;
    const phase = level.phases[i];
    const book = new ScoreBook({ combo: phase.type === 'drive' });
    this.hud.reset();
    this.hud.attach(book);
    this.scene = phase.type === 'park' ? new ParkScene(level, phase, book) : new DriveScene(level, phase, book);
    run.books.push(book);
    TouchPad.layout(phase.type === 'drive');
    if (i === 0 && level.tutorial && !Save.tutorialSeen(level.n)) this.hud.startTutorial(TUTORIAL[level.n]);
    this.paused = false;
    this.setState('play');
  }

  // 当前阶段结束
  endPhase() {
    const run = this.run, scene = this.scene;
    Object.assign(run.flags, scene.flags);
    if (scene.mock) { run.mock = scene.mock; return this.finishLevel(); }
    const next = run.phaseIdx + 1;
    const phase = run.level.phases[run.phaseIdx];
    if (next >= run.level.phases.length) return this.finishLevel();
    if (phase.miniResult) { this.setState('mini'); return; }
    this.goTransition(next);
  }

  goTransition(next) {
    this.pendingPhase = next;
    this.transitionText = run_intro(this.run.level.phases[next]);
    this.setState('transition');
  }

  finishLevel() {
    const run = this.run, level = run.level;
    Sfx.hornStop();
    if (level.tutorial) Save.markTutorial(level.n);
    const items = mergeItems(run.books);
    let score = Object.values(items).reduce((s, it) => s + it.points, 0);
    let mock = run.mock;
    if (!mock && score === 0) mock = level.phases.length > 1 ? '所有阶段合计 0 分' : '全程没有触发任何计分事件';
    if (mock) score = 0;

    const stars = mock ? 0 : starsFor(score, level.target);
    const passed = !mock && score >= level.target;
    const beforeTotal = Save.totalBest();
    const prevBest = Save.best(level.n);
    Save.commit(level.n, score, stars, passed);
    const afterTotal = Save.totalBest();
    const r0 = getRank(beforeTotal), r1 = getRank(afterTotal);

    const all = levelItems(level);
    const hidden = all.filter(k => !items[k]).length;
    const hasDrive = level.phases.some(p => p.type === 'drive');
    const notes = hasDrive ? Object.keys(items).map(k => ITEM_DEFS[k].note).filter(Boolean) : [];

    let pool;
    if (mock) pool = DANMAKU.mock.slice();
    else {
      pool = DANMAKU.normal.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      if (run.flags.dance) pool[0] = pick(DANMAKU.dance);
    }
    const danmaku = pool.slice(0, 3).map((text, i) => ({ text, speed: 110 + Math.random() * 60, offset: i * 260 + Math.random() * 120 }));

    this.result = {
      level: level.n, target: level.target, score, stars, passed, mock,
      items: mock ? {} : items, hidden: mock ? all.length : hidden, notes: mock ? [] : notes, danmaku,
      newBest: !mock && score > prevBest,
      rankUp: r1.score > r0.score ? r1.name : null,
      warning: level.n >= 4 && stars >= 2 && Math.random() < 0.4 ? pick(WARNINGS) : null,
      ending: level.n === LEVELS.length && passed,
    };
    if (mock) Sfx.fail(); else if (passed) Sfx.clear(); else Sfx.fail();
    this.setState('result');
  }

  // ── 主更新 ──
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    updateShake(dt);

    if (this.state === 'title') this.updateTitle(dt);
    else if (this.state === 'intro') { if (Input.justDown('confirm')) this.beginLevel(); if (Input.justDown('pause')) this.toTitle(); }
    else if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'transition') { if (this.stateT >= 1) this.startPhase(this.pendingPhase); }
    else if (this.state === 'mini') { if (this.stateT >= 2) this.goTransition(this.run.phaseIdx + 1); }
    else if (this.state === 'result') this.updateResult();
  }

  updateTitle(dt) {
    const car = this.titleCar;
    car.x += 120 * dt;
    if (car.x > CANVAS_W + 60) car.x = -60;
    const n = LEVELS.length;
    let s = this.menuSel;
    if (Input.justDown('right')) s++;
    if (Input.justDown('left')) s--;
    if (Input.justDown('down')) s += 6;
    if (Input.justDown('up')) s -= 6;
    s = clamp(s, 0, n - 1);
    if (Save.unlocked(s + 1)) this.menuSel = s;
    if (Input.justDown('confirm')) this.showIntro(this.menuSel + 1);
  }

  updatePlay(dt) {
    if (Input.justDown('pause')) this.paused = !this.paused;
    if (this.paused) return;
    if (Input.justDown('restart')) return this.restart();

    const scene = this.scene;
    scene.update(dt);
    this.hud.update(dt);
    this.updateTutorial();
    if (scene.done) this.endPhase();
  }

  updateTutorial() {
    const hud = this.hud, tu = hud.tutorial, scene = this.scene;
    if (!tu) return;
    if (scene.kind === 'park') {
      // 最后一条"停稳别动"在玩家第一次停下时出现
      if (tu.idx < tu.lines.length - 2 && tu.t > 5) hud.advanceTutorial(true);
      else if (tu.idx === tu.lines.length - 2 && (tu.t > 6 || (scene.settleTimer > 0.1 && tu.t > 2))) hud.advanceTutorial(true);
    } else {
      if (tu.idx === 0 && (scene.laneChanges > 0 || tu.t > 6)) hud.advanceTutorial(true);
      else if (tu.idx === tu.lines.length - 1 && tu.t > 8) hud.tutorial = null;
    }
  }

  updateResult() {
    const r = this.result;
    if (r.warning && !r.warningClosed) {
      if (Input.justDown('confirm') || Input.justDown('pause')) r.warningClosed = true;
      return;
    }
    if (Input.justDown('restart')) this.restart();
    else if (Input.justDown('confirm') && r.passed && r.level < LEVELS.length) this.showIntro(r.level + 1);
    else if (Input.justDown('pause')) this.toTitle();
  }

  // ── 绘制 ──
  draw() {
    const ctx = this.ctx;
    UI.beginFrame();
    ctx.save();
    ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.state === 'title') drawTitleScreen(ctx, this);
    else if (this.state === 'intro') drawIntro(ctx, this);
    else if (this.state === 'transition') drawTransition(ctx, this);
    else if (this.scene) {
      ctx.save();
      ctx.translate(screenShake.x, screenShake.y);
      this.scene.draw(ctx);
      this.hud.drawWorld(ctx, this.scene.camY || 0);
      ctx.restore();
      if (this.state === 'play' || this.state === 'mini') {
        this.hud.drawScreen(ctx, this);
        if (this.state === 'play') {
          drawPauseButton(ctx, this);
          if (this.scene.popup) drawPhone(ctx, this);
          if (this.paused) drawPause(ctx, this);
        } else drawMini(ctx, this);
      } else if (this.state === 'result') drawResult(ctx, this);
    }
    ctx.restore();
  }
}

function run_intro(phase) { return phase.intro || '继续前进'; }
