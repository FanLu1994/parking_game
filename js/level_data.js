// ─── 关卡数据 §3（场景要点对玩家不可见）──────────────────────────────────────
// 停车场景坐标系即画布坐标 1000×640；可活动区域 y ∈ [56, 604]

const SPOT_W = 50, SPOT_H = 84;

// 车位：中心 + 朝向（0 = 竖向车位）
const spot = (x, y, angle = 0, kind = 'normal', w = SPOT_W, h = SPOT_H) => ({ x, y, angle, kind, w, h });
const row = (x0, y, n, angle = 0, kinds = {}) =>
  Array.from({ length: n }, (_, i) => spot(x0 + i * SPOT_W, y, angle, kinds[i] || 'normal'));
const hrow = (x0, y, n, len = 90, kinds = {}) =>
  Array.from({ length: n }, (_, i) => spot(x0 + i * len, y, Math.PI / 2, kinds[i] || 'normal', SPOT_W, len));
const R = (x, y, w, h) => ({ x, y, w, h });
const parked = (x, y, angle = 0) => ({ x, y, angle });

// 场地外墙
const BOUNDS = [R(0, 40, 1000, 16), R(0, 604, 1000, 36), R(0, 40, 16, 600), R(984, 40, 16, 600)];

// ── 停车场景 ────────────────────────────────────────────────────────────────
const PARK_SCENES = {
  // 1：一排空位 + 少量障碍车，教学占位
  garage1: {
    theme: 'garage',
    spawn: { x: 80, y: 330, angle: Math.PI / 2 },
    spots: [...row(260, 140, 10), ...row(260, 520, 10)],
    npcs: [parked(310, 520), parked(360, 520, Math.PI), parked(510, 520), parked(660, 520, Math.PI),
           parked(560, 140)],
    walls: [...BOUNDS],
  },
  // 2：充电位带桩体，普通位更空更顺
  garage2: {
    theme: 'garage',
    spawn: { x: 80, y: 330, angle: Math.PI / 2 },
    spots: [...row(260, 140, 10, 0, { 0: 'charge', 1: 'charge', 2: 'charge', 3: 'charge' }),
            ...row(260, 520, 10, 0, { 7: 'charge', 8: 'charge' })],
    chargers: [[260, 108], [310, 108], [360, 108], [410, 108], [610, 552], [660, 552]],
    npcs: [parked(310, 140), parked(260, 520), parked(310, 520, Math.PI), parked(460, 520), parked(760, 520, Math.PI)],
    walls: [...BOUNDS],
  },
  // 3：物业经理专属位紧邻入口；地锁、立柱增加走位难度
  garage3: {
    theme: 'garage',
    spawn: { x: 200, y: 330, angle: Math.PI / 2 },
    spots: [spot(130, 170, 0, 'vip'), ...row(300, 140, 12), ...row(300, 520, 12)],
    entrances: [R(16, 250, 90, 160)],
    entranceLabel: '出入口',
    locks: [[400, 150], [500, 150], [650, 150], [750, 150], [400, 510], [600, 510], [850, 510]],
    pillars: [R(385, 315, 30, 30), R(605, 315, 30, 30), R(825, 315, 30, 30)],
    npcs: [parked(300, 140), parked(550, 140, Math.PI), parked(450, 520), parked(700, 520, Math.PI), parked(900, 520)],
    walls: [...BOUNDS],
  },
  // 4：路边侧方位，他车间距刚好一辆车
  street4: {
    theme: 'street',
    spawn: { x: 80, y: 330, angle: Math.PI / 2 },
    sidewalks: [R(16, 56, 968, 120)],
    spots: hrow(160, 212, 9),
    npcs: [parked(175, 212, Math.PI / 2), parked(301, 212, Math.PI / 2), parked(439, 212, -Math.PI / 2),
           parked(612, 212, Math.PI / 2), parked(790, 212, -Math.PI / 2), parked(250, 548, Math.PI / 2),
           parked(520, 548, -Math.PI / 2)],
    entrances: [R(880, 120, 90, 120)],
    entranceLabel: '小区出入口',
    props: [['bin', 700, 188], ['bin', 724, 188], ['cone', 860, 250], ['cone', 860, 290]],
    walls: [...BOUNDS, R(16, 56, 862, 120), R(972, 56, 12, 120)],
    laneLines: [390],
  },
  // 5：中央大草坪 + 四角正常车位
  lawn5: {
    theme: 'plaza',
    spawn: { x: 500, y: 570, angle: -Math.PI / 2 },
    spots: [...row(80, 130, 3), ...row(820, 130, 3), ...row(80, 520, 3), ...row(820, 520, 3)],
    grass: [R(330, 190, 340, 280)],
    signs: [[500, 330]],
    npcs: [parked(130, 130), parked(870, 520, Math.PI), parked(80, 520)],
    walls: [...BOUNDS],
  },
  // 6：广场舞专区 + 单元门口 + 垃圾桶阵，一停三吃；挪车电话
  community6: {
    theme: 'plaza',
    spawn: { x: 80, y: 430, angle: Math.PI / 2 },
    building: R(260, 40, 480, 90),
    doors: [R(470, 110, 60, 20)],
    lobby: [R(430, 130, 140, 70)],
    dance: [R(570, 140, 200, 170)],
    speaker: R(740, 150, 22, 30),
    grass: [R(16, 56, 180, 150), R(820, 380, 164, 100)],
    signs: [[100, 120]],
    spots: [...row(260, 540, 10)],
    npcs: [parked(310, 540), parked(460, 540, Math.PI), parked(610, 540), parked(710, 540, Math.PI)],
    props: [['bin', 390, 215], ['bin', 390, 245], ['bin', 390, 275], ['bin', 418, 230], ['bin', 418, 260]],
    walls: [...BOUNDS, R(260, 40, 480, 90)],
  },
  // 11②：服务区
  service11: {
    theme: 'plaza',
    spawn: { x: 80, y: 330, angle: Math.PI / 2 },
    building: R(560, 40, 400, 80),
    buildingLabel: '服务区便利店',
    doors: [R(730, 100, 60, 20)],
    lobby: [R(700, 120, 120, 64)],
    lobbyLabel: '门口禁停',
    entrances: [R(16, 250, 90, 160)],
    entranceLabel: '匝道入口',
    grass: [R(230, 250, 300, 120)],
    signs: [[380, 310]],
    spots: [spot(160, 140, 0, 'vip'), ...row(260, 140, 5, 0, { 3: 'charge', 4: 'charge' }), ...row(260, 530, 12)],
    chargers: [[410, 108], [460, 108]],
    npcs: [parked(310, 140), parked(260, 530), parked(410, 530, Math.PI), parked(560, 530), parked(760, 530, Math.PI),
           parked(860, 530)],
    props: [['bin', 850, 150], ['bin', 880, 150], ['cone', 620, 300], ['cone', 660, 300]],
    walls: [...BOUNDS, R(560, 40, 400, 80)],
  },
  // 12②：极限侧方，仅剩"半个车位"
  street12: {
    theme: 'street',
    spawn: { x: 80, y: 330, angle: Math.PI / 2 },
    sidewalks: [R(16, 56, 968, 120)],
    spots: hrow(160, 212, 9),
    // 290 与 400 之间只剩 52px 的空当（玩家车长 70）
    npcs: [160, 225, 290, 400, 465, 530, 595, 660, 725, 790, 855, 920]
      .map((x, i) => parked(x, 212, i % 3 === 1 ? -Math.PI / 2 : Math.PI / 2)),
    props: [['cone', 345, 262], ['bin', 560, 300]],
    walls: [...BOUNDS, R(16, 56, 968, 120)],
    laneLines: [390],
  },
  // 12③：草坪 + 广场舞专区 + 单元门三区重叠处
  finale12: {
    theme: 'plaza',
    spawn: { x: 80, y: 480, angle: Math.PI / 2 },
    building: R(300, 40, 400, 90),
    doors: [R(470, 110, 60, 20)],
    lobby: [R(430, 130, 140, 80)],
    dance: [R(520, 170, 220, 160)],
    speaker: R(710, 290, 22, 30),
    grass: [R(290, 190, 250, 170)],
    signs: [[340, 330]],
    spots: [...row(200, 550, 14)],
    npcs: [parked(250, 550), parked(400, 550, Math.PI), parked(650, 550), parked(800, 550, Math.PI)],
    props: [['bin', 600, 150], ['bin', 630, 150], ['bin', 660, 150], ['cone', 450, 260], ['cone', 470, 290]],
    walls: [...BOUNDS, R(300, 40, 400, 90)],
  },
};

// ── 驾驶场景 ────────────────────────────────────────────────────────────────
// lanes：每条车道方向，+1 = 与玩家同向（向上），-1 = 对向；对向车道在左
const DRIVE_SCENES = {
  highway7:  { lanes: [1, 1, 1], limit: 300, gap: [260, 520], speed: [170, 250], time: 60,
               solidEvery: 1100, yellowEvery: 1500, props: true },
  rural8:    { lanes: [-1, 1], limit: 260, gap: [300, 520], speed: [150, 210], oncomingGap: [320, 620],
               oncomingSpeed: [170, 240], time: 60, solidEvery: 1300, yellowEvery: 1900, props: true },
  express9:  { lanes: [1, 1, 1], limit: 320, gap: [180, 360], speed: [190, 260], time: 60,
               solidEvery: 1400, yellowEvery: 1700, props: true },
  turtle10:  { lanes: [1, 1, 1], limit: 300, gap: [320, 560], speed: [230, 300], time: 60,
               solidEvery: 1500, yellowEvery: 2000, turtleHonk: true, spawnBehind: true },
  service11: { lanes: [1, 1, 1], limit: 300, gap: [220, 460], speed: [180, 250], time: 45,
               solidEvery: 1200, yellowEvery: 1500, props: true, turtleHonk: true, exitEvery: 2600 },
  narrow12:  { lanes: [1], laneW: 96, limit: 200, time: 40, standoff: true, noTraffic: true },
};

// ── 12 关 ───────────────────────────────────────────────────────────────────
// 驾驶关目标分按 tools/balance.js 实测最高分 × 65% 设定（设计案 §2.6）
const LEVELS = [
  { n: 1,  target: 450,  hint: '找个地方停一下',   phases: [{ type: 'park',  scene: 'garage1' }], tutorial: true },
  { n: 2,  target: 520,  hint: '前面好像有位置',   phases: [{ type: 'park',  scene: 'garage2' }] },
  { n: 3,  target: 480,  hint: '拐进去看看',       phases: [{ type: 'park',  scene: 'garage3' }] },
  { n: 4,  target: 560,  hint: '靠边停一下',       phases: [{ type: 'park',  scene: 'street4' }] },
  { n: 5,  target: 500,  hint: '找个宽敞的地方',   phases: [{ type: 'park',  scene: 'lawn5' }] },
  { n: 6,  target: 640,  hint: '到家了',           phases: [{ type: 'park',  scene: 'community6', phone: true }] },
  { n: 7,  target: 3800, hint: '驶入下一个路口',   phases: [{ type: 'drive', scene: 'highway7' }], tutorial: true },
  { n: 8,  target: 2350, hint: '抄个近道',         phases: [{ type: 'drive', scene: 'rural8' }] },
  { n: 9,  target: 4600, hint: '赶时间',           phases: [{ type: 'drive', scene: 'express9' }] },
  { n: 10, target: 6100, hint: '不急，慢慢开',     phases: [{ type: 'drive', scene: 'turtle10' }] },
  { n: 11, target: 5100, hint: '出趟远门',
    phases: [{ type: 'drive', scene: 'service11' },
             { type: 'park',  scene: 'service11', phone: true, intro: '驶入服务区' }] },
  { n: 12, target: 1500, hint: '最后一程',
    phases: [{ type: 'drive', scene: 'narrow12' },
             { type: 'park',  scene: 'street12', phone: true, intro: '前方仅剩半个车位', miniResult: true },
             { type: 'park',  scene: 'finale12', phone: true, intro: '终点就在眼前' }] },
];

// 各场景可能触发的得分项（结算的"??? × k"）
function parkItemsOf(sc, phone) {
  const s = ['spot', 'extraSpot', 'angle', 'tailgate', 'scrape'];
  if (sc.spots.some(p => p.kind === 'charge')) s.push('charge');
  if (sc.spots.some(p => p.kind === 'vip')) s.push('vip');
  if (sc.entrances) s.push('entrance');
  if (sc.grass) s.push('grass');
  if (sc.dance) s.push('dance');
  if (sc.lobby) s.push('lobby');
  if (sc.props) s.push('cone');
  if (phone) s.push('refuseMove');
  return s;
}
function driveItemsOf(sc) {
  if (sc.standoff) return ['standoff', 'honk'];
  const s = ['cutIn', 'noSignal', 'brakeCheck', 'honk', 'rideSolid', 'rideYellow', 'scrape'];
  if (sc.lanes.filter(d => d === 1).length >= 2) s.push('turtleFast');
  if (sc.lanes.includes(-1)) s.push('highbeam', 'wrongWay');
  if (sc.turtleHonk) s.push('turtleResist');
  if (sc.props) s.push('cone');
  return s;
}
function levelItems(level) {
  const set = new Set();
  for (const ph of level.phases) {
    const list = ph.type === 'park' ? parkItemsOf(PARK_SCENES[ph.scene], ph.phone) : driveItemsOf(DRIVE_SCENES[ph.scene]);
    list.forEach(k => set.add(k));
  }
  return [...set];
}

// ─── 文案 ─────────────────────────────────────────────────────────────────────
const DANMAKU = {
  normal: [
    '物业看了沉默，保安看了流泪', '你压的不是草坪，是大家的血压', '这灯晃得对面司机看见了人生走马灯',
    '广场舞阿姨：今晚就在你车顶跳', '一车占俩位，停车场的钉子户', '后车司机已在业主群发起投票',
    '这停车角度，量角器都不敢认', '邻居：我车呢？哦，被你挡着了', '保安大爷已经在写情况说明了',
    '路过的驾校教练摇了摇头', '此车已被写进物业年度报告', '建议车库按平方米收你的费',
  ],
  dance: ['广场舞阿姨：今晚就在你车顶跳', '阿姨：音箱往哪儿放？放你车顶上！', '领舞阿姨已把你的车设为 C 位'],
  mock: ['群主：你已被移出「老司机交流群」', '开这么守规矩？驾校教练卧底吧', '不压线？那你开这么大的车干嘛？'],
};

const WARNINGS = [
  '物业法务部：您的停车照片已在业主群转发 99+ 次，相关证据已固定。',
  '交管 AI 温馨提示：您的驾驶行为已形成完整证据链，建议保留律师电话。',
  '网友：这么停车，建议直接把车库买下来。',
];

const PHONE_LINES = [
  '您好，麻烦挪一下车，挡着我了。',
  '师傅，您这车能挪挪吗？我急着出门。',
  '我在楼下等十分钟了！能不能挪车？！',
  '你到底挪不挪？！我要报物业了！',
  '最后说一次！！！马！上！挪！车！',
];

const TUTORIAL = {
  1: ['一个车位装得下你这么大的车吗？', '停歪一点试试？', '停稳别动，自动结算'],
  7: ['变道？打什么灯。', '空隙越小，越叫加塞'],
};

const ENDING_TEXT = '恭喜您已成为全城修理厂的 VIP 客户。游戏结束，现实中请好好开车。';
