// 无头测试环境：桩化 DOM / Canvas 并按 index.html 顺序加载游戏脚本
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
function fakeCtx() {
  const target = {
    measureText: s => ({ width: String(s).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[a-z]/.test(k) ? noop : undefined)),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => fakeCtx(), addEventListener: noop,
           getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 640 }) };
}
const store = {};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Proxy, performance: { now: () => 0 }, setTimeout, clearTimeout,
  requestAnimationFrame: noop,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  document: {
    addEventListener: noop,
    createElement: () => fakeCanvas(),
    getElementById: () => Object.assign(fakeCanvas(), { style: {} }),
  },
  window: { addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1000, innerHeight: 640, devicePixelRatio: 1 },
};
sandbox.window.AudioContext = undefined;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !s.endsWith('main.js'));
for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', s), 'utf8'), sandbox, { filename: s });

module.exports = { sandbox, run: code => vm.runInContext(code, sandbox, { filename: 'test' }) };
