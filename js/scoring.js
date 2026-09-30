// ─── 计分 §2 ──────────────────────────────────────────────────────────────────

// 得分项定义；note 为驾驶关结算的"现实对照"字幕
const ITEM_DEFS = {
  // 停车（结算时一次性计算）
  spot:       { label: '占用车位（起步价）' },
  extraSpot:  { label: '一车多位' },
  charge:     { label: '霸占充电车位' },
  vip:        { label: '物业经理专属位 ×1.5' },
  angle:      { label: '车身倾角' },
  entrance:   { label: '堵出入口' },
  grass:      { label: '草坪覆盖率' },
  dance:      { label: '广场舞专区' },
  tailgate:   { label: '贴脸停车' },
  lobby:      { label: '堵单元门' },
  // 驾驶：离散
  cutIn:      { label: '强行加塞',   note: '现实中：强行加塞极易引发追尾和路怒冲突' },
  noSignal:   { label: '变道不打灯', note: '现实中：变道不打灯属于违法行为，后车无法预判' },
  highbeam:   { label: '远光晃对向车', note: '现实中：远光会车易致对向司机短暂致盲' },
  brakeCheck: { label: '别车',       note: '现实中：别车可能构成危险驾驶' },
  honk:       { label: '按喇叭',     note: '现实中：很多路段禁鸣，乱按喇叭会被处罚' },
  turtleResist: { label: '顶住催促', note: '现实中：占着快车道不走，后车只会越来越急' },
  // 驾驶：持续
  rideSolid:  { label: '骑实线行驶', note: '现实中：骑轧车道实线属于违法行为' },
  wrongWay:   { label: '逆行',       note: '现实中：逆行极易造成正面相撞' },
  turtleFast: { label: '龟速占快车道', note: '现实中：龟速占用快车道同样违法，还容易引发追尾' },
  rideYellow: { label: '压黄网线 / 导流线', note: '现实中：导流线和网格线禁止压占，易造成拥堵和事故' },
  // 碰撞
  scrape:     { label: '剐蹭（对方全责）', note: '现实中：发生剐蹭请依法处理，不存在"对方全责"的魔法' },
  cone:       { label: '撞飞垃圾桶 / 交通锥' },
  // 其他
  refuseMove: { label: '就不挪' },
  standoff:   { label: '会车对峙胜利', note: '现实中：窄路会车应互相礼让' },
};

class ScoreBook {
  constructor({ combo = false } = {}) {
    this.items = {};          // key → { points, count }
    this.comboEnabled = combo;
    this.comboN = 0;
    this.comboTimer = 0;
    this.cont = {};           // key → { seg, earned, active }
    this.listeners = [];
    this.lastScrapeT = -99;
    this.scraped = new Set(); // 已计分的碰撞对象
    this.time = 0;
    this.honkCount = 0;
    this.lastHonkT = -99;
  }

  onScore(fn) { this.listeners.push(fn); }
  emit(key, pts, x, y, extra) { for (const fn of this.listeners) fn(key, pts, x, y, extra); }

  record(key, pts, count = 1) {
    const it = this.items[key] || (this.items[key] = { points: 0, count: 0 });
    it.points += pts; it.count += count;
  }

  get total() {
    let s = 0;
    for (const k in this.items) s += this.items[k].points;
    return Math.round(s);
  }

  // 是否触发过任何计分项
  get anyScored() { return Object.keys(this.items).some(k => this.items[k].points > 0); }

  update(dt) {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboN = 0;
    }
  }

  get comboMult() {
    return Math.min(SCORE.COMBO_MAX_MULT, 1 + SCORE.COMBO_MULT_STEP * Math.max(0, this.comboN - 1));
  }

  // 离散事件：参与 combo（§6）
  discrete(key, base, x, y) {
    let mult = 1;
    if (this.comboEnabled) {
      this.comboN = this.comboTimer > 0 ? this.comboN + 1 : 1;
      this.comboTimer = SCORE.COMBO_WINDOW;
      mult = this.comboMult;
    }
    const pts = Math.round(base * mult);
    this.record(key, pts);
    this.emit(key, pts, x, y, { mult });
    return pts;
  }

  // 不参与 combo 的一次性得分（碰撞 / 挪车电话 / 对峙 / 停车结算）
  flat(key, pts, x, y, count = 1) {
    this.record(key, pts, count);
    this.emit(key, pts, x, y, {});
    return pts;
  }

  // 持续型：每秒得分 × dt，单段 > 5s 后减半，每关上限
  continuous(key, rate, cap, active, dt) {
    const c = this.cont[key] || (this.cont[key] = { seg: 0, earned: 0, active: false });
    c.active = active && c.earned < cap;
    if (!active) { c.seg = 0; return; }
    c.seg += dt;
    const r = c.seg > SCORE.CONTINUOUS_DECAY_AFTER ? rate * SCORE.CONTINUOUS_DECAY_FACTOR : rate;
    const add = Math.min(r * dt, cap - c.earned);
    if (add <= 0) return;
    c.earned += add;
    this.record(key, add, 0);
  }

  activeContinuous() {
    return Object.keys(this.cont).filter(k => this.cont[k].active);
  }

  // §2.4 碰撞：同一对象每关只计 1 次；全局冷却 1.5s
  scrape(obj, x, y) {
    if (this.scraped.has(obj)) return 0;
    if (this.time - this.lastScrapeT < 1.5) return 0;
    this.scraped.add(obj);
    this.lastScrapeT = this.time;
    return this.flat('scrape', SCORE.SCRAPE, x, y);
  }

  // 按喇叭：冷却 2s，每关最多 10 次（参与 combo）
  honk(x, y) {
    if (this.honkCount >= SCORE.HONK_MAX) return 0;
    if (this.time - this.lastHonkT < SCORE.HONK_CD) return 0;
    this.lastHonkT = this.time;
    this.honkCount++;
    return this.discrete('honk', SCORE.HONK, x, y);
  }
}

// 合并多阶段 ScoreBook 的明细
function mergeItems(books) {
  const out = {};
  for (const b of books)
    for (const k in b.items) {
      const o = out[k] || (out[k] = { points: 0, count: 0 });
      o.points += b.items[k].points; o.count += b.items[k].count;
    }
  for (const k in out) {
    out[k].points = Math.round(out[k].points);
    if (out[k].points <= 0) delete out[k];
  }
  return out;
}

function starsFor(score, target) {
  if (score >= target * STAR.S3) return 3;
  if (score >= target * STAR.S2) return 2;
  if (score >= target * STAR.S1) return 1;
  return 0;
}

// ─── 存档 §6 ──────────────────────────────────────────────────────────────────
const Save = (() => {
  const KEY = 'xianyanbao_save_v2';
  let data = { best: {}, stars: {}, passed: {}, tutorial: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { /* 隐私模式等：只在内存中保存 */ }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  return {
    data,
    best: n => data.best[n] || 0,
    stars: n => data.stars[n] || 0,
    passed: n => !!data.passed[n],
    unlocked: n => n === 1 || !!data.passed[n - 1],
    // 素质分 = 各关历史最高分之和
    totalBest() { let s = 0; for (const k in data.best) s += data.best[k]; return s; },
    // 如果本关当前分数超过历史最高，按当前分数计
    totalWith(n, score) { return this.totalBest() - this.best(n) + Math.max(this.best(n), score); },
    commit(n, score, stars, passed) {
      if (score > (data.best[n] || 0)) data.best[n] = score;
      if (stars > (data.stars[n] || 0)) data.stars[n] = stars;
      if (passed) data.passed[n] = true;
      persist();
    },
    tutorialSeen: n => !!data.tutorial[n],
    markTutorial(n) { data.tutorial[n] = true; persist(); },
    reset() { data.best = {}; data.stars = {}; data.passed = {}; data.tutorial = {}; persist(); },
  };
})();
