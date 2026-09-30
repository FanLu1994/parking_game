// 数值探针：把玩家车摆到指定位置直接结算，检查各关可达分数
const { run } = require('./harness');
run(String.raw`
const game = new Game(document.getElementById('gameCanvas'));
function parkTest(n, x, y, ang, label){
  game.showIntro(n); game.beginLevel();
  const s = game.scene; const p = s.player;
  p.x=x; p.y=y; p.angle=ang; p.speed=0; s.hasMoved=true;
  const r = s.computeSettle();
  const out = {}; for (const k in r.items) out[k]=r.items[k].points;
  console.log(label.padEnd(22), 'total', String(r.total).padStart(5), JSON.stringify(out), 'occ', r.occ.map(o=>o.f.toFixed(2)).join('/'), 'deg', r.deg.toFixed(1));
  for (let i=0;i<120;i++){ game.update(1/60); Input.tick(); if (game.scene.popup) game.scene.answer(false);}
  console.log('   -> result', game.result && game.result.score, game.result && game.result.mock);
}
parkTest(1, 260, 140, 0, 'L1 perfect spot');
parkTest(1, 285, 140, Math.PI/2, 'L1 sideways 2 spots');
parkTest(1, 285, 150, Math.PI/2+0.5, 'L1 diagonal');
parkTest(2, 285, 150, Math.PI/2+0.6, 'L2 charge diag');
parkTest(3, 135, 205, 0.5, 'L3 vip+entrance');
parkTest(4, 370, 212, Math.PI/2, 'L4 parallel gap');
parkTest(5, 500, 330, 0.7, 'L5 lawn');
parkTest(6, 555, 175, 0.6, 'L6 lobby+dance');
parkTest(6, 500, 330, 0.6, 'L6 nothing');
const hold=(a)=>{for(const k in Input.touch)Input.touch[k]=false;for(const x of a)Input.touch[x]=true;};
for (const n of [7,8,9,10]) {
  game.showIntro(n); game.beginLevel();
  hold(['up','highbeam']); for(let i=0;i<10;i++){game.update(1/60);Input.tick();}
  hold(['up']); for(let i=0;i<60*62 && game.state==='play';i++){game.update(1/60);Input.tick();}
  const it = game.result.items; const o={}; for (const k in it) o[k]=it[k].points+'/'+it[k].count;
  console.log('L'+n+' hold up+beam', game.result.score, JSON.stringify(o));
}
`);
