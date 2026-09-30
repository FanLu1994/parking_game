// 事件探针：会车对峙、第 10 关后车催促、加塞 / 不打灯、广场舞专区
const { run } = require('./harness');
run(String.raw`
const game = new Game(document.getElementById('gameCanvas'));
const hold=(a)=>{for(const k in Input.touch)Input.touch[k]=false;for(const x of a)Input.touch[x]=true;};
const step=(sec,cond)=>{for(let i=0;i<sec*60;i++){ if(cond&&cond())return; game.update(1/60);Input.tick();}};
const items=()=>{const it=(game.result?game.result.items:mergeItems(game.run.books));const o={};for(const k in it)o[k]=Math.round(it[k].points)+'/'+it[k].count;return JSON.stringify(o);};

// 12①：开到对向车前，按住喇叭 6s
game.showIntro(12); game.beginLevel();
hold(['up']); step(10, ()=>game.scene.standoff.gap<140);
hold(['brake']); step(1);
hold(['honk']); step(6);
console.log('L12 standoff state', game.scene.standoff && game.scene.standoff.state, 'phase', game.run.phaseIdx, items());
hold([]); step(3);
console.log('  after: state', game.state, 'phase', game.run.phaseIdx);

// 12①：先松手 → 0
game.showIntro(12); game.beginLevel();
hold(['up']); step(10, ()=>game.scene.standoff.gap<140);
hold(['honk']); step(0.5); hold([]); step(0.2);
console.log('L12 release early', game.scene.standoff.state, items());

// 10：并到最左车道后龟速
game.showIntro(10); game.beginLevel();
hold(['up','left']); step(0.25); hold(['up','right']); step(0.25); hold(['up']); step(0.5);
hold(['up','left']); step(0.25); hold(['up','right']); step(0.25);
console.log('L10 lane now', game.scene.laneOf(game.scene.player.x), 'fast', game.scene.fastLane, 'angle', game.scene.player.angle.toFixed(2));
for (let i=0;i<50 && game.state==='play';i++){ hold(game.scene.player.speed>110?['down']:['up']); step(0.2); const p=game.scene.player; if (Math.abs(p.angle)>0.05) { hold([p.angle>0?'left':'right','up']); step(0.05);} }
console.log('L10 after turtling', items());

// 7：连续变道
game.showIntro(7); game.beginLevel();
for (let i=0;i<14 && game.state==='play';i++){ hold(['up', i%2?'left':'right']); step(0.22); hold(['up', i%2?'right':'left']); step(0.22); hold(['up']); step(0.8); }
console.log('L7 weaving', items(), 'laneChanges', game.scene.laneChanges);
`);
