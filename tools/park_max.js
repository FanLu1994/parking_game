// 停车关满分搜索：网格枚举玩家车位姿（排除与墙 / 立柱 / 他车重叠的位置），输出各停车阶段的最高结算分
// 用法：node tools/park_max.js [步长px]
// 注：只检查位姿是否合法，不保证能开进去；挪车电话"就不挪"另计：每次停车只弹一次，正常玩每阶段 +80
//（反复停一下再挪才能多弹，最多 5 次 = 400，目标分不按这个算）
const { run, sandbox } = require('./harness');
sandbox.STEP = Number(process.argv[2] || 8);
run(String.raw`
const game = new Game(document.getElementById('gameCanvas'));
const rows = [];
for (const lv of LEVELS) {
  lv.phases.forEach((ph, pi) => {
    if (ph.type !== 'park') return;
    const s = new ParkScene(lv, ph, new ScoreBook());
    const p = s.player;
    const blockers = [...s.statics, ...s.npcs.map(n => n.poly())];
    let best = { total: -1 };
    for (let x = 30; x < 970; x += STEP)
      for (let y = 70; y < 600; y += STEP)
        for (let a = 0; a < 180; a += 15) {
          p.x = x; p.y = y; p.angle = deg2rad(a);
          const pp = p.poly();
          if (blockers.some(b => satTest(pp, b))) continue;
          const r = s.computeSettle();
          if (r.total > best.total) best = { total: r.total, x, y, a, items: r.items };
        }
    const items = Object.entries(best.items).map(([k, v]) => k + ' ' + v.points).join(', ');
    const phoneMax = ph.phone ? SCORE.REFUSE_MOVE : 0;
    rows.push({ lv: lv.n, phase: pi + 1, scene: ph.scene, target: lv.target, max: best.total, phone: phoneMax,
                at: best.x + ',' + best.y + '@' + best.a, items });
  });
}
console.table(rows);
`);
