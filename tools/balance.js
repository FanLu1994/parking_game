// 数值平衡测试：驾驶关用随机 bot 与激进 bot 各跑多局，统计分数分布与各得分项占比
// 用法：node tools/balance.js [局数]
const { run, sandbox } = require('./harness');
sandbox.RUNS = Number(process.argv[2] || 12);
run(String.raw`
const game = new Game(document.getElementById('gameCanvas'));
const hold = a => { for (const k in Input.touch) Input.touch[k] = false; for (const x of a) Input.touch[x] = true; };
const tick = () => { game.update(1 / 60); Input.tick(); };

// 随机 bot：乱开
function randomBot(g) {
  const r = Math.floor(Math.random() * 6);
  return [['up', 'left'], ['up', 'right'], ['up', 'honk'], ['down'], ['up', 'highbeam'], ['up']][r];
}

// 激进 bot：贴着车流来回变道、切入后急刹、按喇叭、开远光、第 8 关逆行、第 10 关龟速
function aggroBot(s, t) {
  const p = s.player, acts = [];
  const lane = s.onRoadLane(p.x);
  if (!s.aggro) s.aggro = { target: lane, next: 0, beamT: 0 };
  const A = s.aggro;
  if (t > A.next) {
    // 优先切到后方有近车的车道（加塞）
    let best = null, bestGap = Infinity;
    for (const L of [lane - 1, lane + 1]) {
      if (L < 0 || L >= s.nL) continue;
      for (const n of s.npcs) if (n.lane === L && n.dir === 1 && n.y > p.y) {
        const g = n.y - p.y; if (g < bestGap) { bestGap = g; best = L; }
      }
    }
    A.target = best ?? (lane === 0 ? 1 : lane - 1);
    if (s.lanes.includes(-1) && Math.random() < 0.5) A.target = s.lanes.indexOf(-1);
    if (s.cfg.turtleHonk && Math.random() < 0.4) A.target = s.fastLane;
    A.target = clamp(A.target, 0, s.nL - 1);
    A.next = t + 1.2 + Math.random();
  }
  const tx = s.laneCenter(A.target);
  const wantAngle = clamp((tx - p.x) / 200, -0.35, 0.35);
  if (p.angle < wantAngle - 0.03) acts.push('right');
  else if (p.angle > wantAngle + 0.03) acts.push('left');
  const turtle = s.cfg.turtleHonk && lane === s.fastLane;
  const cap = turtle ? s.cfg.limit * 0.4 : 330;
  if (s.pendingBrake) acts.push('brake');
  else if (p.speed < cap) acts.push('up');
  else if (p.speed > cap + 30) acts.push('down');
  if (Math.floor(t * 10) % 21 === 0) acts.push('honk');
  if (t - A.beamT > 3 && !p.highbeam) { acts.push('highbeam'); A.beamT = t; }
  return acts;
}

function play(n, bot) {
  game.showIntro(n); game.beginLevel();
  let t = 0, acts = [];
  while (game.state === 'play') {
    const s = game.scene;
    if (bot === 'random') { if (Math.floor(t * 60) % 30 === 0) acts = randomBot(); }
    else acts = aggroBot(s, t);
    if (s.kind === 'park') break;   // 混合关只测驾驶段
    hold(acts); tick(); t += 1 / 60;
    if (t > 120) break;
  }
  hold([]);
  const items = mergeItems(game.run.books);
  let total = 0; for (const k in items) total += items[k].points;
  return { total, items };
}

const drive = LEVELS.filter(l => l.phases[0].type === 'drive' && !DRIVE_SCENES[l.phases[0].scene].standoff);
const rows = [];
for (const lv of drive) {
  for (const bot of ['random', 'aggro']) {
    const scores = [], sum = {};
    for (let i = 0; i < RUNS; i++) {
      const r = play(lv.n, bot);
      scores.push(r.total);
      for (const k in r.items) sum[k] = (sum[k] || 0) + r.items[k].points;
    }
    scores.sort((a, b) => a - b);
    const tot = Object.values(sum).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => k + ' ' + Math.round(v / tot * 100) + '%').join(', ');
    rows.push({ lv: lv.n, bot, target: lv.target, min: scores[0], median: scores[scores.length >> 1],
                max: scores[scores.length - 1], 'max×0.65': Math.round(scores[scores.length - 1] * 0.65), top });
  }
}
console.table(rows);
`);
