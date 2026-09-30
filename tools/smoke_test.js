// 无头冒烟测试：用脚本输入跑完 12 关，捕获运行时异常
// 用法：node tools/smoke_test.js
const { run } = require('./harness');

run(`
  const game = new Game(document.getElementById('gameCanvas'));
  const hold = (acts) => { for (const k in Input.touch) Input.touch[k] = false; for (const a of acts) Input.touch[a] = true; };
  const step = (sec) => { for (let i = 0; i < sec * 60; i++) { game.update(1/60); Input.tick(); if (i % 6 === 0) game.draw(); } };
  const results = [];
  let rngSeed = 1;
  for (const lv of LEVELS) {
    game.showIntro(lv.n); game.beginLevel();
    let guard = 0;
    while (game.state !== 'result' && guard++ < 200) {
      const sc = game.scene;
      if (game.state !== 'play') { hold([]); step(0.5); continue; }
      if (sc.popup) { hold(['opt1']); step(0.05); hold([]); step(0.05); continue; }
      if (sc.kind === 'park') {
        // 开一段、拐一下、停住
        hold(['up']); step(0.6);
        hold(['up', guard % 2 ? 'left' : 'right']); step(0.35);
        hold(['brake']); step(0.5);
        hold([]); step(2.5);
      } else if (sc.standoff) {
        hold(['up']); step(1.5);
        hold(['down']); step(1);
        hold(['honk']); step(6);
        hold([]); step(3);
      } else {
        const r = (guard * 7) % 5;
        hold(r === 0 ? ['up', 'left'] : r === 1 ? ['up', 'right'] : r === 2 ? ['up', 'honk'] : r === 3 ? ['down'] : ['up', 'highbeam']);
        step(0.4);
        hold(['up']); step(1.2);
      }
    }
    const r = game.result;
    results.push({ n: lv.n, state: game.state, score: r && r.score, target: lv.target, mock: r && r.mock, items: r && Object.keys(r.items).join(',') });
    // 结算面板也绘制一次
    step(0.2);
  }
  console.table(results);
`);
