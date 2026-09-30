// 场景截图：用 Playwright 加载游戏脚本，逐关逐阶段渲染一帧并保存 PNG
// 用法：NODE_PATH=$(npm root -g) node tools/screenshot.js [输出目录] [关卡号...]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'shots'));
const ONLY = process.argv.slice(3).map(Number);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace('<script src="js/main.js"></script>', '');
  const tmp = path.join(ROOT, '.shot.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto('file://' + tmp.replace(/\\/g, '/'));

  const shots = await page.evaluate(() => LEVELS.flatMap(l => l.phases.map((p, i) => [l.n, i])));
  for (const [n, pi] of shots) {
    if (ONLY.length && !ONLY.includes(n)) continue;
    await page.evaluate(([n, pi]) => {
      const canvas = document.getElementById('gameCanvas');
      canvas.width = CANVAS_W; canvas.height = CANVAS_H;
      canvas.style.width = CANVAS_W + 'px'; canvas.style.height = CANVAS_H + 'px';
      const game = new Game(canvas);
      game.showIntro(n);
      game.startPhase(pi);
      game.hud.tutorial = null;
      // 驾驶关：踩油门跑一段，让道路卷动起来
      if (game.scene.kind === 'drive') {
        Input.touch.up = true;
        for (let i = 0; i < 150; i++) { game.update(1 / 60); Input.tick(); }
        Input.touch.up = false;
      } else {
        for (let i = 0; i < 5; i++) { game.update(1 / 60); Input.tick(); }
      }
      game.ctx.setTransform(1, 0, 0, 1, 0, 0);
      game.draw();
    }, [n, pi]);
    const file = path.join(OUT, `L${String(n).padStart(2, '0')}-${pi + 1}.png`);
    await page.locator('#gameCanvas').screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
  fs.unlinkSync(tmp);
})();
