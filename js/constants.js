// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  asphalt:    '#22252a',
  asphaltLt:  '#2a2e35',
  line:       '#ffffff',
  lineYellow: '#e8c14a',
  grass:      '#2d5a2d',
  grassLt:    '#3a7a3a',
  vipGold:    '#e8c14a',
  warn:       '#ff5e5e',
  green:      '#5df2a6',
  chargeBlue: '#4ab8e8',
  hatching:   '#e8c14a',
  npcCar:     ['#7a8a9a', '#8a7a6a', '#6a8a7a', '#9a8a7a', '#7a6a8a'],
};

// ─── Physics ──────────────────────────────────────────────────────────────────
const PHYS = {
  park: {
    accel:   180,  // px/s²
    maxSpeed: 160, // px/s
    drag:    4.4,  // e^(-drag*dt) decel
    steerMax: 2.6, // rad/s at full speed
    steerMin: 0.4, // rad/s floor
    reverseRatio: 0.7,
  },
  drive: {
    accel:   240,
    maxSpeed: 360,
    drag:    4.4,
    steerMax: 2.6,
    steerMin: 0.4,
    reverseRatio: 0.7,
  },
};

// ─── Car sizes ─────────────────────────────────────────────────────────────────
const CAR = {
  W:    34,  // player
  H:    70,
  NPC_W: 30,
  NPC_H: 58,
  SETTLE_SPEED: 2,    // px/s — "stopped"
  SETTLE_TIME:  1.3,  // s before auto-settle
};

// ─── Scoring values ────────────────────────────────────────────────────────────
const SCORE = {
  // parking
  FIRST_SPOT:       200,
  EXTRA_SPOT:       280,
  CHARGE_SPOT:      150,
  VIP_MULT:         1.5, // 占到专属位时整次结算 ×1.5
  ANGLE_MAX:        220, // at 45°
  ANGLE_DEG_MAX:    45,
  ANGLE_DEG_MIN:    0,
  BLOCK_ENTRANCE:   320,
  GRASS_MAX:        600,
  DANCE_ZONE:       400,
  TAILGATE:         170, // per car
  TAILGATE_PX:      8,
  BLOCK_LOBBY:      320,
  TRIPLE_MULT:      1.5, // 一停三吃：同时压中三类禁停区域

  // driving – discrete
  CUT_IN:           150,
  CUT_IN_MAX:       10,  // 每关上限：第 10 关后方车流无穷，不设上限时加塞 / 别车可刷到 5000+
  NO_SIGNAL:        80,
  NO_SIGNAL_NEAR:   2,   // 目标车道 2 车长内有车才计分（原型实测空路摆方向可占驾驶关总分 70%）
  NO_SIGNAL_MAX:    12,
  HIGHBEAM_CAR:     40,
  HIGHBEAM_HEADON:  3,   // 位于该对向车的车道内（逆行正面晃）时倍率；只开远光不逆行拿不到大头
  HIGHBEAM_MAX:     8,   // 每关最多计 8 辆（设计案未给上限，原型实测对向车流下会无限刷分）
  BRAKE_CUT:        300,
  BRAKE_CUT_MAX:    6,
  HONK:             30,
  HONK_CD:          2,
  HONK_MAX:         10,
  TURTLE_RESIST:    50,  TURTLE_RESIST_MAX: 16,

  // driving – continuous (per second)
  RIDE_SOLID:       30,  CAP_RIDE_SOLID:  240,
  WRONG_WAY:        60,  CAP_WRONG_WAY:   480,
  TURTLE_FAST:      25,  CAP_TURTLE_FAST: 600,
  RIDE_YELLOW:      20,  CAP_RIDE_YELLOW: 200,

  // collision
  SCRAPE:           100,
  CONE:             60,
  CONE_MAX_DRIVE:   6,   // 驾驶关每段最多计 6 个（路肩锥桶连绵不断，否则沿边蹭就能刷分）

  // misc
  REFUSE_MOVE:      80,  REFUSE_MOVE_MAX: 5,
  HONK_STANDOFF:    260,

  // combo
  COMBO_WINDOW:     3,   // s
  COMBO_MULT_STEP:  0.25,
  COMBO_MAX_MULT:   2.0,

  // decay
  CONTINUOUS_DECAY_AFTER: 5, // s
  CONTINUOUS_DECAY_FACTOR: 0.5,
};

// ─── Level targets summary (full in level_data.js) ────────────────────────────
const STAR = {
  S1: 1.0,
  S2: 1.25,
  S3: 1.45,
};

// ─── 过关音效：本地音频片段，缺失时回退为合成音 ────────────────────────────────
// start / duration 单位秒：从音频的哪一秒开始、播多久（结尾 0.8s 淡出）
const CLEAR_SFX = { src: 'assets/audio/clear.mp3', start: 0, duration: 8, volume: 0.8 };

const REPO_URL = 'https://github.com/FanLu1994/parking_game';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const CANVAS_W = 1000;
const CANVAS_H = 640;

// ─── Typography ────────────────────────────────────────────────────────────────
const FONT_TITLE = '"ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif';
const FONT_BODY  = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

// ─── Ranks ────────────────────────────────────────────────────────────────────
// 阈值：P2/P3/P4/P5 ≈ 第 2/5/8/11 关累计目标分（1320/3560/8500/19600），P6 ≈ 全部目标分合计 22100 × 1.13
const RANKS = [
  { score: 0,     name: 'P1 · 科目二学员' },
  { score: 1300,  name: 'P2 · 新手上路'   },
  { score: 3500,  name: 'P3 · 马路显眼包' },
  { score: 8500,  name: 'P4 · 加塞艺术家' },
  { score: 19500, name: 'P5 · 别车宗师'   },
  { score: 25000, name: 'P6 · 车库之神'   },
];

function getRank(totalScore) {
  let r = RANKS[0];
  for (const rank of RANKS) { if (totalScore >= rank.score) r = rank; }
  return r;
}
function getNextRank(totalScore) {
  for (const rank of RANKS) { if (rank.score > totalScore) return rank; }
  return null;
}
