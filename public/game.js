'use strict';

/* ---------- Константы баланса ---------- */
// жизни считаем в половинках сердца: 10 = 5 сердец, попадание бага на прод отнимает 1 (полсердца)
const START_LIVES = 10;
const MAX_LIVES = 10;
const REFACTOR_HEAL = 2; // Рефакторинг возвращает целое сердце
const HIT_RADIUS_BONUS = 20;
const GOLDEN_BONUS = 5;
const GOLDEN_FREEZE_MS = 2500;
const REFACTOR_BONUS = 10;
const REFACTOR_FREEZE_MS = 1500;
const DECOY_PENALTY = 2;
const WAVE_EVERY_MS = 30000;
const WAVE_BOOST_MS = 5000;
// прогрессия сложности: чем дальше, тем быстрее и гуще
const SPEED_STEP_PER_WAVE = 0.1;   // прирост скорости за волну
const SPEED_STEP_IN_WAVE = 0.1;    // плюс плавный разгон внутри волны
const SPEED_CAP = 2.2;
const SPAWN_START_MS = 1700;
const SPAWN_DECAY_PER_WAVE = 0.85; // интервал спавна умножается на это каждую волну
const SPAWN_MIN_MS = 420;
const REFACTOR_COOLDOWN_MS = 30000;    // Рефакторинг не чаще, чем раз в это время
const REFACTOR_CLEAR_ZONE = 0.5;       // Рефакторинг чистит нижнюю часть поля (доля высоты до прода), а не весь экран
// «Автотест»: бонус-бот сам устраняет багов, пока не закончится время (комбо и «Азарт» не трогает)
const AUTOTEST_MS = 6000;
const AUTOTEST_MAX_MS = 9000;    // подбор нового продлевает, но не бесконечно
const AUTOTEST_TICK_MS = 700;    // как часто бот делает «выстрел»
// бонус редкий и ценный: не чаще раза в 60 с (перк «Тест-покрытие» сокращает на 20% за уровень), не больше одного на поле
const AUTOTEST_COOLDOWN_MS = 60000;
// перки: каждые PERK_EVERY волн игра встаёт на паузу и даёт выбрать одно из трёх улучшений
const PERK_FIRST_WAVE = 3;
const PERK_EVERY = 2;
const PERK_COUNT = 3;
const PERKS = [
  { id: 'sniper', icon: '🎯', name: 'Снайпер', max: 3, desc: 'Радиус клика +35%' },
  { id: 'backup', icon: '❤️', name: 'Бэкап', consumable: true, desc: 'Сразу +1 сердце', when: () => lives <= MAX_LIVES - 2 },
  { id: 'tests', icon: '🤖', name: 'Тест-покрытие', max: 3, desc: 'Автотест длится на 50% дольше и выпадает чаще' },
  { id: 'gold', icon: '🐝', name: 'Золотая жила', max: 3, desc: 'Золотых жуков вдвое больше, бонус за них +2' },
  { id: 'firewall', icon: '🛡️', name: 'Файрвол', consumable: true, desc: 'Щит на 4 прорыва прямо сейчас' },
  { id: 'slow', icon: '🧊', name: 'Охлаждение', max: 3, desc: 'Все баги медленнее на 10%' },
  { id: 'azart', icon: '🔥', name: 'Азарт+', max: 2, desc: 'Множитель серии включается раньше: на 2 попадания' },
  { id: 'sapper', icon: '💣', name: 'Сапёрка', max: 3, desc: 'Hotfix с радиусом +40% и бомбы выпадают чаще' },
  { id: 'points', icon: '🧮', name: 'Бонусные очки', max: 3, desc: '+1 очко за каждого устранённого бага' },
];
const THREATS = new Set(['normal', 'splitter', 'golden', 'dasher']); // баги, за пролёт которых отнимается жизнь
const DASH_FROM = 0.3;             // с какой доли высоты паук делает рывок
const DASH_MUL = 2.6;
// что нового приносит волна (баннер при её начале)
const WAVE_NEWS = { 2: 'новые жуки и бонусы', 3: 'делятся и приманки', 4: 'комары-зигзаг', 6: 'пауки: рывок', 8: 'скорпионы: броня' };
const SLOW_MS = 4000;
const SLOW_FACTOR = 0.4;
const BOMB_RADIUS = 150;
const RESUME_COUNTDOWN_MS = 3000;
const COMBO_MILESTONES = [5, 10, 15, 20, 25, 40];
// «Азарт»: каждые 10 в серии — множитель очков (×2, ×3). Промах, приманка или пропущенный баг сбрасывают серию
const COMBO_MULT_STEP = 10;
const COMBO_MULT_MAX = 3;
// случайные события: неожиданные всплески между волнами
const EVENT_FIRST_AT_MS = 35000;
const STORM_GAP_MS = [7000, 12000];  // «Шторм»: события идут одно за другим
const EVENT_GAP_MS = [18000, 30000]; // пауза до следующего события (случайно в этих пределах)
const EVENTS = {
  rain: { icon: '🌧️', name: 'Дождь багов', ms: 7000, color: '#7fd8ff' },
  gold: { icon: '🐝', name: 'Золотая лихорадка', ms: 8000, color: '#ffd166' },
  wall: { icon: '🧱', name: 'Стена багов', ms: 0, color: '#ff9f43' },
};
const BANNER_MS = 2000;
const SPLAT_MS = 400;
const POPUP_MS = 700;
const MAX_BUGS = 40;
// «Завали Босса»: большой баг, который надо закликать, пока он ползёт к продакшену
const BOSS_EMOJI = '👾';
const BOSS_FIRST_SCORE = 1000;   // с какого счёта появляется первый босс
const BOSS_EVERY_SCORE = 1500;   // через сколько очков после победы/прорыва — следующий
const BOSS_HP_BASE = 25;
const BOSS_HP_STEP = 10;         // каждый следующий босс крепче
const BOSS_SIZE = 120;
const BOSS_DESCENT_S = 40;       // за сколько секунд босс доползёт до прода (каждый следующий быстрее)
const BOSS_MINION_MS = 2200;     // как часто босс выпускает мелких багов
const BOSS_BONUS = 150;
const BOSS_BONUS_STEP = 50;
const BOSS_DROP_MS = 5500;       // как часто во время босса падают «укрепления» прода
const SHIELD_CHARGES = 4;        // сколько прорывов гасит один щит
const MAX_SHIELD = 8;
const BOSS_REACH_DAMAGE = 4;     // половинок сердца: прорвавшийся босс отнимает 2 сердца
const STORAGE_KEY = 'bug-hunter-fullscreen:best';
const FX_KEY = 'bug-hunter-fullscreen:fx';
const HAPTIC_KEY = 'bug-hunter-fullscreen:haptics';
const MUSIC_KEY = 'bug-hunter-fullscreen:music';
const VOL_SFX_KEY = 'bug-hunter-fullscreen:vol-sfx';
const VOL_MUSIC_KEY = 'bug-hunter-fullscreen:vol-music';

const BUG_KINDS = [
  { emoji: '🐛', points: 1, hp: 1, size: 28, minSpeed: 32, maxSpeed: 55, weight: 6, behavior: 'normal', minWave: 1, fade: 0.15 },
  { emoji: '🐞', points: 2, hp: 1, size: 24, minSpeed: 65, maxSpeed: 95, weight: 3, behavior: 'normal', minWave: 1 },
  { emoji: '🪲', points: 3, hp: 2, size: 36, minSpeed: 22, maxSpeed: 36, weight: 2, behavior: 'normal', minWave: 2 },
  { emoji: '🪳', points: 4, hp: 2, size: 32, minSpeed: 45, maxSpeed: 70, weight: 2, behavior: 'splitter', minWave: 3 },
  { emoji: '🐝', points: 6, hp: 1, size: 28, minSpeed: 45, maxSpeed: 65, weight: 1, behavior: 'golden', minWave: 2 },
  { emoji: '🐌', points: 0, hp: 1, size: 26, minSpeed: 40, maxSpeed: 65, weight: 1.2, behavior: 'decoy', minWave: 3 },
  { emoji: '🧹', points: 0, hp: 1, size: 50, minSpeed: 38, maxSpeed: 55, weight: 0.25, behavior: 'refactor', minWave: 4 },
  { emoji: '🧊', points: 0, hp: 1, size: 30, minSpeed: 40, maxSpeed: 60, weight: 0.7, behavior: 'freeze', minWave: 2 },
  { emoji: '💣', points: 0, hp: 1, size: 30, minSpeed: 40, maxSpeed: 60, weight: 0.7, behavior: 'bomb', minWave: 2 },
  { emoji: '🤖', points: 0, hp: 1, size: 40, minSpeed: 38, maxSpeed: 52, weight: 0.4, behavior: 'autotest', minWave: 3 },
  // новые враги, открываются с волнами
  { emoji: '🦟', points: 3, hp: 1, size: 22, minSpeed: 85, maxSpeed: 120, weight: 2, behavior: 'normal', ampMul: 3, minWave: 4, glow: 'rgba(255, 255, 255, 0.55)' },
  { emoji: '🕷️', points: 5, hp: 1, size: 30, minSpeed: 30, maxSpeed: 45, weight: 1.6, behavior: 'dasher', minWave: 6, glow: 'rgba(255, 255, 255, 0.6)' },
  { emoji: '🦂', points: 8, hp: 4, size: 44, minSpeed: 20, maxSpeed: 30, weight: 1.2, behavior: 'normal', minWave: 8 },
];

// «укрепления»: падают только пока идёт бой с боссом
const BOSS_DROPS = [
  { emoji: '🛡️', points: 0, hp: 1, size: 34, minSpeed: 42, maxSpeed: 58, weight: 3, behavior: 'shield' },
  { emoji: '🔧', points: 0, hp: 1, size: 32, minSpeed: 42, maxSpeed: 58, weight: 2, behavior: 'patch' },
];

/* ---------- DOM ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const el = {
  score: document.getElementById('hud-score'),
  combo: document.getElementById('hud-combo'),
  lives: document.getElementById('hud-lives'),
  best: document.getElementById('hud-best'),
  title: document.getElementById('ov-title'),
  text: document.getElementById('ov-text'),
  help: document.getElementById('ov-help'),
  stats: document.getElementById('ov-stats'),
  start: document.getElementById('btn-start'),
  sound: document.getElementById('btn-sound'),
  full: document.getElementById('btn-full'),
  fx: document.getElementById('btn-fx'),
  haptic: document.getElementById('btn-haptic'),
  music: document.getElementById('btn-music'),
  pause: document.getElementById('btn-pause'),
  meAvatar: document.getElementById('me-avatar'),
  meTitle: document.getElementById('me-title'),
  meGames: document.getElementById('me-games'),
  meBest: document.getElementById('me-best'),
  auth: document.getElementById('auth'),
  authForm: document.getElementById('auth-form'),
  authUser: document.getElementById('auth-user'),
  authPass: document.getElementById('auth-pass'),
  authError: document.getElementById('auth-error'),
  btnRegister: document.getElementById('btn-register'),
  me: document.getElementById('me'),
  meName: document.getElementById('me-name'),
  meKills: document.getElementById('me-kills'),
  logout: document.getElementById('btn-logout'),
  saveStatus: document.getElementById('save-status'),
};

/* ---------- Состояние ---------- */
let W = 0, H = 0, DPR = 1, S = 1; // S — масштаб размеров/скоростей относительно окна
let boss = null, bossesDefeated = 0, nextBossScore = BOSS_FIRST_SCORE, shield = 0;
let ev = null, nextEventAt = EVENT_FIRST_AT_MS, lastEvent = null;
let autotestLeft = 0, autotestTimer = 0, autotestShots = [], autotestTick = 0, autotestSpan = AUTOTEST_MS, lastAutotestAt = -Infinity;
let botFinishing = false; // true, пока выстрел бота наносит урон боссу: так считаем «добил автотестом»
let perks = {}, perkPending = false, perkOpen = false, perkChoices = [];

/* ---------- Задача дня: у всех на сутки один сид ---------- */
let mode = 'normal'; // 'normal' | 'daily'
let dailyInfo = null; // ответ /api/daily: { date, modifier, top, me }
// три независимых потока случайности: набор жуков и события не зависят от того, сколько раз игрок кликнул
let rng = { spawn: Math.random, bug: Math.random, perk: Math.random };
const dayMod = () => (mode === 'daily' && dailyInfo ? dailyInfo.modifier.id : null);

/** FNV-1a: тот же хеш, что в daily.js на сервере */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Быстрый детерминированный генератор (mulberry32) */
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedRng(date) {
  const seed = hashString(date);
  rng = { spawn: mulberry32(seed ^ 0xA5A5A5A5), bug: mulberry32(seed ^ 0x5A5A5A5A), perk: mulberry32(seed ^ 0x1234ABCD) };
}
let phase = 'idle'; // idle | playing | paused | over
let bugs = [], splats = [], popups = [], particles = [];
let score = 0, combo = 0, bestCombo = 0, kills = 0, lives = START_LIVES;
let best = loadBest();
let nextId = 1;
let elapsed = 0, spawnTimer = 0, freezeLeft = 0, boostLeft = 0, wave = 1, nextWaveAt = WAVE_EVERY_MS, lastRefactorAt = -Infinity;
let banner = null; // { text, color, left }
let shake = 0, flash = 0;
let slowLeft = 0, countdownLeft = 0, lastTickSec = 0;
let run = newRunStats(); // расширенная статистика партии для ачивок

function newRunStats() {
  // ключи `croc` и `crocAtOneLife` — часть формата /api/score и сохранённой статистики, относятся к бонусу «Рефакторинг» (раньше назывался иначе)
  return {
    livesLost: 0 /* в половинках сердца */, maxBombKills: 0, crocAtOneLife: false, bonuses: { golden: 0, bomb: 0, freeze: 0, croc: 0 },
    bossKills: 0, bossClean: 0, bossByBot: 0, autotestPicks: 0, autotestKills: 0, // для ачивок про босса и автотест
  };
}
let lastTs = 0;

function loadBest() {
  try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* storage недоступен */ }
}

/* ---------- Звук (WebAudio, без файлов) ---------- */
let audioCtx = null;
let fx = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
try { const saved = localStorage.getItem(FX_KEY); if (saved !== null) { fx = saved === '1'; } } catch { /* ignore */ }
let muted = false;
try { muted = localStorage.getItem('bug-hunter-fullscreen:muted') === '1'; } catch { /* ignore */ }
// музыка включается отдельно от звуковых эффектов (muted — только эффекты)
let musicOn = true;
// громкость 0..1: эффекты и музыка настраиваются отдельно (1 = прежняя громкость)
let sfxVol = 1;
let musicVol = 1;
try {
  const s = Number(localStorage.getItem(VOL_SFX_KEY));
  const m = Number(localStorage.getItem(VOL_MUSIC_KEY));
  if (localStorage.getItem(VOL_SFX_KEY) !== null && s >= 0 && s <= 1) { sfxVol = s; }
  if (localStorage.getItem(VOL_MUSIC_KEY) !== null && m >= 0 && m <= 1) { musicVol = m; }
} catch { /* ignore */ }
try {
  const savedMusic = localStorage.getItem(MUSIC_KEY);
  if (savedMusic !== null) { musicOn = savedMusic === '1'; } else if (muted) { musicOn = false; } // раньше «без звука» глушило всё
} catch { /* ignore */ }

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (muted || sfxVol <= 0) { return; }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) { osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); }
    gain.gain.setValueAtTime(vol * sfxVol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* звук не критичен */ }
}
const sfx = {
  hit: (combo) => tone(520 + Math.min(combo, 15) * 40, 0.09, 'square', 0.07, 220),
  crack: () => tone(300, 0.08, 'triangle', 0.1, 200),
  miss: () => tone(140, 0.1, 'sawtooth', 0.05, 90),
  life: () => tone(220, 0.35, 'sawtooth', 0.14, 70),
  golden: () => { tone(660, 0.1, 'triangle', 0.1); tone(880, 0.1, 'triangle', 0.1, null, 0.08); tone(1320, 0.18, 'triangle', 0.1, null, 0.16); },
  decoy: () => tone(200, 0.2, 'square', 0.09, 100),
  refactor: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, null, i * 0.09)); },
  wave: () => tone(330, 0.25, 'sine', 0.1, 660),
  freeze: () => { tone(1200, 0.25, 'sine', 0.09, 500); tone(900, 0.3, 'triangle', 0.07, 400, 0.1); },
  bomb: () => { tone(120, 0.35, 'sawtooth', 0.16, 40); tone(240, 0.2, 'square', 0.08, 60, 0.02); },
  tick: () => tone(700, 0.07, 'sine', 0.06),
  over: () => { tone(330, 0.3, 'sawtooth', 0.12, 110); tone(165, 0.5, 'sawtooth', 0.12, 55, 0.25); },
  bossIn: () => { tone(110, 0.5, 'sawtooth', 0.14, 220); tone(165, 0.5, 'square', 0.08, 330, 0.25); },
  bossHit: () => tone(160, 0.07, 'square', 0.09, 100),
  event: () => { tone(440, 0.12, 'square', 0.1); tone(660, 0.12, 'square', 0.1, null, 0.1); tone(880, 0.22, 'square', 0.1, null, 0.2); },
  fever: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.08, null, i * 0.06)); },
  rankUp: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, null, i * 0.1)); tone(131, 0.7, 'sawtooth', 0.08, 65, 0.1); },
  autotest: () => { [330, 440, 554, 660].forEach((f, i) => tone(f, 0.08, 'square', 0.07, null, i * 0.05)); },
  zap: () => tone(1100, 0.06, 'square', 0.05, 500),
  rareSpawn: () => { [784, 988, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, null, i * 0.09)); },
  shieldUp: () => { tone(660, 0.1, 'triangle', 0.1); tone(990, 0.16, 'triangle', 0.1, null, 0.07); },
  shieldHit: () => tone(880, 0.12, 'triangle', 0.12, 440),
  patch: () => { tone(523, 0.1, 'sine', 0.1); tone(784, 0.16, 'sine', 0.1, null, 0.08); },
  bossDown: () => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, null, i * 0.08)); tone(65, 0.6, 'sawtooth', 0.12, 30); },
};

/* ---------- Вибрация ---------- */
// Android (Chrome и др.): navigator.vibrate. iOS Safari его не поддерживает вовсе, поэтому там — обходной путь:
// переключение невидимого <input switch> даёт системный тактильный отклик, но только внутри жеста пользователя
// (клик/касание). События вне жеста (потеря сердца, прорыв босса) на iPhone без вибрации.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const touchDevice = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const canHaptic = touchDevice && (typeof navigator.vibrate === 'function' || isIOS);
let haptics = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
try { const saved = localStorage.getItem(HAPTIC_KEY); if (saved !== null) { haptics = saved === '1'; } } catch { /* ignore */ }
let inGesture = false; // true, пока обрабатывается касание: только тогда работает iOS-обход
let lastIosTick = 0;

function iosTick() {
  const now = performance.now();
  if (!inGesture || now - lastIosTick < 40) { return; }
  lastIosTick = now;
  try { document.getElementById('haptic-switch').click(); } catch { /* ignore */ }
}

/** Вибрация: число — миллисекунды, массив — чередование «вибрация, пауза, …» */
function haptic(pattern) {
  if (!haptics || !canHaptic || !pattern) { return; }
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(pattern); } else if (isIOS) { iosTick(); }
  } catch { /* вибрация не критична */ }
}

// рисунок вибрации для каждого звука: пара «звук + отклик» всегда совпадает по моменту
const HAPTICS = {
  hit: (combo) => (combo >= 10 ? 14 : 10),
  crack: 8,
  life: 80,
  golden: [15, 30, 15],
  decoy: 40,
  refactor: [30, 40, 60],
  wave: 20,
  freeze: 25,
  bomb: 90,
  over: [80, 60, 160],
  event: 30,
  fever: [20, 30, 20],
  bossIn: [60, 40, 60],
  bossHit: 12,
  bossDown: [40, 30, 40, 30, 140],
  shieldUp: 25,
  shieldHit: 30,
  patch: 20,
  autotest: 25,
  zap: 6,
  rareSpawn: [15, 40, 25],
  rankUp: [30, 40, 30, 40, 90],
};
for (const [name, pattern] of Object.entries(HAPTICS)) {
  const base = sfx[name];
  sfx[name] = (...args) => {
    haptic(typeof pattern === 'function' ? pattern(...args) : pattern);
    return base(...args);
  };
}

/* ---------- Музыка (WebAudio, 8-бит, без файлов) ---------- */
const music = (() => {
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  // Am – F – C – G, по такту на аккорд; в такте 16 шагов (шестнадцатые)
  const CHORDS = [
    { root: 45, arp: [69, 72, 76, 72] },
    { root: 41, arp: [65, 69, 72, 69] },
    { root: 48, arp: [67, 72, 76, 72] },
    { root: 43, arp: [67, 71, 74, 71] },
  ];
  const MELODY = [ // нота на каждый 4-й шаг, 0 — пауза; по такту на аккорд
    [81, 0, 79, 76], [77, 0, 76, 72], [79, 0, 76, 79], [74, 0, 76, 71],
  ];
  const LEVEL = 0.5;
  let master = null, noise = null, timer = null, step = 0, nextTime = 0;

  function setup() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (master) { return; }
    master = audioCtx.createGain();
    master.gain.value = 0;
    master.connect(audioCtx.destination);
    noise = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) { d[i] = Math.random() * 2 - 1; }
  }

  function note(freq, t, dur, type, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hat(t, vol, dur) {
    const src = audioCtx.createBufferSource();
    const hp = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    src.buffer = noise;
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp).connect(gain).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function playStep(s, t, len) {
    const bar = Math.floor(s / 16) % CHORDS.length;
    const i = s % 16;
    const chord = CHORDS[bar];
    if (i % 2 === 0) { note(hz(chord.root + (i % 8 === 6 ? 12 : 0)), t, len * 1.8, 'triangle', 0.22); } // бас
    note(hz(chord.arp[i % 4]), t, len * 0.9, 'square', 0.035);                                          // арпеджио
    if (i % 4 === 0 && MELODY[bar][i / 4]) { note(hz(MELODY[bar][i / 4]), t, len * 3, 'square', 0.05); } // мелодия
    if (i === 0 || i === 8) { note(hz(36), t, 0.12, 'sine', 0.3); }                                      // «бочка»
    if (i % 2 === 1) { hat(t, i % 4 === 3 ? 0.07 : 0.04, 0.04); }                                       // хэт
    if (i === 4 || i === 12) { hat(t, 0.1, 0.1); }                                                       // «малый»
  }

  function tick() {
    const bpm = 118 + Math.min(wave, 10) * 3 + (boss ? 16 : 0); // чем выше волна, тем быстрее; с боссом ещё быстрее
    const len = 60 / bpm / 4;
    while (nextTime < audioCtx.currentTime + 0.15) {
      playStep(step, nextTime, len);
      nextTime += len;
      step = (step + 1) % (CHORDS.length * 16);
    }
  }

  function play() {
    if (timer) { return; }
    try {
      setup();
      if (audioCtx.state === 'suspended') { audioCtx.resume(); }
      const now = audioCtx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(LEVEL * musicVol, now, 0.15);
      step = 0;
      nextTime = now + 0.05;
      timer = setInterval(tick, 40);
      tick();
    } catch { /* музыка не критична */ }
  }

  function stop() {
    if (!timer) { return; }
    clearInterval(timer);
    timer = null;
    try { master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08); } catch { /* ignore */ }
  }

  /** Музыка играет, пока идёт партия и звук не выключен */
  function sync() { if (phase === 'playing' && musicOn && musicVol > 0 && !perkOpen) { play(); } else { stop(); } }

  /** Громкость меняется на ходу, без перезапуска мелодии */
  function setLevel() {
    if (master) { master.gain.setTargetAtTime(LEVEL * musicVol, audioCtx.currentTime, 0.05); }
  }

  /** Короткий фрагмент мелодии, чтобы на паузе можно было подобрать громкость на слух */
  let previewTimer = null;
  function preview() {
    if (!musicOn || musicVol <= 0 || phase === 'playing') { return; }
    play();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { if (phase !== 'playing') { stop(); } }, 1800);
  }

  return { sync, setLevel, preview };
})();

/* ---------- Размеры и ресайз ---------- */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  S = Math.max(0.6, Math.min(W, H) / 640);
  spriteCache.clear();
}
window.addEventListener('resize', resize);

const prodY = () => H - Math.max(36, 40 * S);

/* ---------- Спрайты эмодзи (кэш, как в оригинале) ---------- */
const spriteCache = new Map();
function getSprite(emoji, size) {
  const px = Math.round(size * DPR);
  const key = emoji + ':' + px;
  let sp = spriteCache.get(key);
  if (!sp) {
    const dim = Math.round(px * 1.8);
    sp = document.createElement('canvas');
    sp.width = dim;
    sp.height = dim;
    const c = sp.getContext('2d');
    c.font = `${px}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(emoji, dim / 2, dim / 2);
    spriteCache.set(key, sp);
  }
  return sp;
}

/* ---------- Спрайты-картинки (общий механизм для бонусов с изображением) ---------- */
const imageCache = new Map();
function getImage(src) {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null; // пока не загрузилась — не рисуем
}

/* ---------- Спавн ---------- */
/** Перки меняют частоту выпадения бонусов */
function perkWeight(k) {
  if (k.behavior === 'autotest') { return 1 + 0.6 * perkLv('tests'); }
  if (k.behavior === 'golden') { return (1 + perkLv('gold')) * (dayMod() === 'gold' ? 3 : 1); }
  if (k.behavior === 'bomb') { return 1 + 0.6 * perkLv('sapper'); }
  return 1;
}

/** Автотест выпадает редко: пауза после прошлого, не пока бот работает и не при втором на поле */
function autotestReady() {
  const cooldown = AUTOTEST_COOLDOWN_MS * (1 - 0.2 * perkLv('tests'));
  return autotestLeft <= 0 && elapsed - lastAutotestAt >= cooldown && !bugs.some((b) => b.behavior === 'autotest');
}

function pickKind() {
  const refactorReady = elapsed - lastRefactorAt >= REFACTOR_COOLDOWN_MS;
  const autotestOk = autotestReady();
  const pool = BUG_KINDS
    .filter((k) => wave >= (k.minWave || 1) && (k.behavior !== 'refactor' || refactorReady) && (k.behavior !== 'autotest' || autotestOk))
    .map((k) => ({ k, w: (k.weight / (1 + (k.fade || 0) * (wave - 1))) * perkWeight(k) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = rng.spawn() * total;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) { return p.k; }
  }
  return BUG_KINDS[0];
}

function spawnBug(kind, x, y, canSplit = true, speedMul = 1) {
  const inWave = Math.max(0, Math.min(1, (elapsed - (nextWaveAt - WAVE_EVERY_MS)) / WAVE_EVERY_MS));
  const speedBoost = Math.min(SPEED_CAP, 1 + (wave - 1) * SPEED_STEP_PER_WAVE + inWave * SPEED_STEP_IN_WAVE) * 0.9 ** perkLv('slow') * (dayMod() === 'fast' ? 1.2 : 1);
  if (kind.behavior === 'refactor') { lastRefactorAt = elapsed; }
  if (kind.behavior === 'autotest') { lastAutotestAt = elapsed; sfx.rareSpawn(); } // редкий гость: даём о себе знать
  bugs.push({
    id: nextId++,
    kind,
    emoji: kind.emoji,
    image: kind.image || null,
    behavior: kind.behavior,
    x: x ?? (kind.size * S + rng.bug() * (W - kind.size * S * 2)),
    y: y ?? -kind.size * S,
    speed: (kind.minSpeed + rng.bug() * (kind.maxSpeed - kind.minSpeed)) * S * speedBoost * speedMul,
    hp: kind.hp,
    points: kind.points,
    size: kind.size * S,
    phase: rng.bug() * Math.PI * 2,
    amp: (10 + rng.bug() * 25) * S * (kind.ampMul || 1),
    baseX: 0,
    canSplit: kind.behavior === 'splitter' && canSplit,
  });
  const b = bugs[bugs.length - 1];
  b.baseX = b.x;
}

/** Интервал спавна сжимается каждую волну и не замирает: 1700 мс → 420 мс, плюс буст при смене волны */
function spawnInterval() {
  let iv = Math.max(SPAWN_MIN_MS, SPAWN_START_MS * SPAWN_DECAY_PER_WAVE ** (elapsed / WAVE_EVERY_MS));
  if (boostLeft > 0) { iv *= 0.55; }
  return iv;
}

/* ---------- Эффекты ---------- */
// часы эффектов идут только пока партия активна: на паузе и при блокировке экрана брызги и подписи замирают,
// а не «дорастают» по реальному времени до размера экрана
let fxClock = 0;
function addPopup(x, y, text, color) { popups.push({ x, y, text, color, born: fxClock }); }
function addSplat(x, y) { splats.push({ x, y, born: fxClock }); }
function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (60 + Math.random() * 180) * S;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.3, max: 0.8, color });
  }
}
function showBanner(text, color) { banner = { text, color, left: BANNER_MS }; }

/* ---------- Игровая логика ---------- */
function resetGame() {
  bugs = []; splats = []; popups = []; particles = [];
  score = 0; combo = 0; bestCombo = 0; kills = 0; lives = dayMod() === 'hearts' ? 6 : START_LIVES;
  elapsed = 0; spawnTimer = 0; freezeLeft = 0; boostLeft = 0; wave = 1; nextWaveAt = WAVE_EVERY_MS; lastRefactorAt = -Infinity;
  slowLeft = 0; countdownLeft = 0;
  boss = null; bossesDefeated = 0; nextBossScore = BOSS_FIRST_SCORE; shield = 0;
  ev = null; nextEventAt = dayMod() === 'storm' ? 12000 : EVENT_FIRST_AT_MS; lastEvent = null;
  autotestLeft = 0; autotestTimer = 0; autotestShots = []; autotestTick = 0; autotestSpan = AUTOTEST_MS; lastAutotestAt = -Infinity;
  perks = {}; perkPending = false; closePerks(); renderPerkStrip();
  run = newRunStats();
  banner = null; shake = 0; flash = 0;
}

/** Задача дня стартует только при загруженной задаче; иначе — обычная игра */
function startGame(m = mode) {
  mode = m === 'daily' && dailyInfo ? 'daily' : 'normal';
  if (mode === 'daily') { seedRng(dailyInfo.date); } else { rng = { spawn: Math.random, bug: Math.random, perk: Math.random }; }
  resetGame();
  phase = 'playing';
  overlay.hidden = true;
  el.saveStatus.hidden = true;
  hud.hidden = false;
  lastTs = performance.now();
  el.best.previousElementSibling.textContent = mode === 'daily' ? 'Лучший день' : 'Рекорд';
  if (mode === 'daily') {
    const m = dailyInfo.modifier;
    showBanner(`${m.icon} ${m.name}: ${m.desc}`, '#b8f04a');
  }
  updateHud();
  renderDaily();
  music.sync();
}

function endGame() {
  phase = 'over';
  music.sync();
  sfx.over();
  const daily = mode === 'daily' && dailyInfo;
  let isRecord;
  if (daily) {
    isRecord = score > dailyBestToday();
    if (isRecord) { saveDailyBest(score); }
  } else {
    isRecord = score > best;
    if (isRecord) { best = score; saveBest(best); }
  }
  el.title.textContent = daily ? (isRecord ? 'Рекорд дня' : 'Задача дня') : (isRecord ? 'Новый рекорд' : 'Игра окончена');
  el.text.textContent = daily
    ? `${dailyInfo.modifier.icon} ${dailyInfo.modifier.name}: релиз сорван, баги добрались до продакшена.`
    : 'Релиз сорван: баги добрались до продакшена.';
  el.help.hidden = true;
  el.stats.textContent = `Очки: ${score} · Убито: ${kills} · Лучшее комбо: ${bestCombo} · Волна: ${wave} · ${daily ? 'Лучший сегодня' : 'Рекорд'}: ${daily ? dailyBestToday() : best}`;
  el.start.textContent = 'Ещё раз';
  overlay.hidden = false;
  updateHud();
  renderDaily();
  submitResult(score, kills, Math.round(elapsed));
}

function setPaused(p) {
  if (p && perkOpen) { return; } // выбор перка и так останавливает игру
  if (p && phase === 'playing') {
    phase = 'paused';
    el.title.textContent = 'Пауза';
    el.text.textContent = 'Игра приостановлена.';
    el.help.hidden = true;
    el.stats.textContent = '';
    el.start.textContent = 'Продолжить';
    overlay.hidden = false;
    renderDaily();
    music.sync();
  } else if (!p && phase === 'paused') {
    phase = 'playing';
    overlay.hidden = true;
    countdownLeft = RESUME_COUNTDOWN_MS;
    lastTickSec = 0;
    lastTs = performance.now();
    music.sync();
  }
}

function loseLife(x = W / 2) {
  if (shield > 0) { // щит гасит прорыв: сердце не тратится, комбо не сбрасывается
    shield -= 1;
    burst(x, prodY(), '#7fd8ff', 12);
    shake = Math.max(shake, 0.12);
    sfx.shieldHit();
    updateHud();
    return;
  }
  lives -= 1;
  run.livesLost += 1;
  breakCombo();
  shake = 0.35;
  flash = 0.35;
  sfx.life();
  updateHud();
  if (lives <= 0) { endGame(); }
}

const perkLv = (id) => perks[id] || 0;
const comboStep = () => Math.max(4, COMBO_MULT_STEP - 2 * perkLv('azart') - (dayMod() === 'azart' ? 4 : 0));
const hitMul = () => 1 + 0.35 * perkLv('sniper');

function comboMult() {
  return Math.min(COMBO_MULT_MAX, 1 + Math.floor(combo / comboStep()));
}

/** Сброс серии; потерю большой серии (с множителем) показываем явно — на этом держится азарт */
function breakCombo() {
  if (combo >= comboStep()) { showBanner(`Серия потеряна: ${combo}`, '#9aa4b5'); }
  combo = 0;
}

function comboBonus(c) {
  if (c >= 15) { return 3; }
  if (c >= 10) { return 2; }
  if (c >= 5) { return 1; }
  return 0;
}

function killBug(b, massKill = false) {
  bugs = bugs.filter((x) => x.id !== b.id);
  addSplat(b.x, b.y);
  burst(b.x, b.y, b.behavior === 'golden' ? '#ffd166' : BRAND, 8);
  kills += 1;
  const bonus = massKill ? 0 : comboBonus(combo);
  const mult = massKill ? 1 : comboMult();
  const gain = (b.points + bonus) * mult + perkLv('points'); // бонус перка прибавляется после множителя
  score += gain;
  if (gain > 0) { addPopup(b.x, b.y - b.size * 0.5, `+${gain}`, mult > 1 ? '#ffd166' : bonus > 0 ? '#ffd166' : BRAND); }

  if (b.canSplit && !massKill) {
    for (const dx of [-1, 1]) {
      const kid = { ...BUG_KINDS[0], emoji: '🐛', points: 1, hp: 1, size: 20, behavior: 'normal' };
      spawnBug(kid, b.x + dx * 24 * S, b.y, false, 1.2);
    }
  }
}

function eatEverything() {
  run.bonuses.croc += 1;
  damageBoss(8);
  if (lives <= 2) { run.crocAtOneLife = true; } // на последнем сердце
  const zoneTop = prodY() * (1 - REFACTOR_CLEAR_ZONE); // чистим нижнюю часть поля, ближе к проду
  const victims = bugs.filter((b) => THREATS.has(b.behavior) && b.y >= zoneTop);
  victims.forEach((b) => killBug(b, true));
  freezeLeft = Math.max(freezeLeft, REFACTOR_FREEZE_MS);
  lives = Math.min(MAX_LIVES, lives + REFACTOR_HEAL);
  score += REFACTOR_BONUS;
  flash = 0.25;
  sfx.refactor();
  showBanner('🧹 Рефакторинг: нижняя зона чиста, +1 жизнь', '#5be3a5');
}

function activateAutotest(b) {
  run.autotestPicks += 1;
  const mul = 1 + 0.5 * perkLv('tests');
  autotestSpan = AUTOTEST_MS * mul;
  autotestLeft = Math.min(AUTOTEST_MAX_MS * mul, autotestLeft + autotestSpan);
  burst(b.x, b.y, '#c792ea', 16);
  sfx.autotest();
  showBanner('🤖 Автотест: баги тают сами', '#c792ea');
}

function botX() {
  return W / 2 + Math.sin(fxClock / 700) * W * 0.28;
}

/** Один «выстрел» бота: добивает самого опасного (ближайшего к проду) бага или бьёт босса */
function autotestShot() {
  const x0 = botX();
  const y0 = prodY() - 56 * S;
  let target = null;
  for (const b of bugs) {
    if (THREATS.has(b.behavior) && b.behavior !== 'golden' && b.y > 0 && (!target || b.y > target.y)) { target = b; }
  }
  if (target) {
    autotestShots.push({ x0, y0, x1: target.x, y1: target.y, born: fxClock });
    sfx.zap();
    target.hp -= 1;
    if (target.hp <= 0) { killBug(target, true); run.autotestKills += 1; } else { burst(target.x, target.y, '#c9d6ff', 5); }
  } else if (boss && boss.y > 0 && autotestTick % 2 === 0) { // босса бьёт вполсилы
    autotestShots.push({ x0, y0, x1: boss.x, y1: boss.y, born: fxClock });
    sfx.zap();
    botFinishing = true;
    damageBoss(1);
    botFinishing = false;
  }
  autotestTick += 1;
}

function updateAutotest(ms) {
  if (autotestLeft <= 0) { return; }
  autotestLeft = Math.max(0, autotestLeft - ms);
  autotestTimer += ms;
  while (autotestTimer >= AUTOTEST_TICK_MS) {
    autotestTimer -= AUTOTEST_TICK_MS;
    autotestShot();
  }
  if (autotestLeft <= 0) { autotestTimer = 0; showBanner('🤖 Автотест завершён', '#9aa4b5'); }
}

function activateFreeze(b) {
  run.bonuses.freeze += 1;
  slowLeft = SLOW_MS;
  burst(b.x, b.y, '#7fd8ff', 14);
  sfx.freeze();
  showBanner('Code freeze: баги замедлены', '#7fd8ff');
}

function detonate(b) {
  const r = BOMB_RADIUS * S * (1 + 0.4 * perkLv('sapper'));
  const victims = bugs.filter((v) => v.behavior !== 'refactor' && (v.x - b.x) ** 2 + (v.y - b.y) ** 2 <= r * r);
  let bombKills = 0;
  run.bonuses.bomb += 1;
  for (const v of victims) {
    if (THREATS.has(v.behavior)) {
      killBug(v, true);
      bombKills += 1;
    } else {
      bugs = bugs.filter((x) => x.id !== v.id);
      burst(v.x, v.y, '#ffb347', 6);
    }
  }
  if (boss && (boss.x - b.x) ** 2 + (boss.y - b.y) ** 2 <= (r + boss.size * 0.5) ** 2) { damageBoss(5); }
  run.maxBombKills = Math.max(run.maxBombKills, bombKills);
  burst(b.x, b.y, '#ffb347', 36);
  shake = Math.max(shake, 0.3);
  sfx.bomb();
  showBanner(victims.length ? `Hotfix: устранено ${victims.length}` : 'Hotfix: пусто', '#ffb347');
}

/* ---------- События ---------- */
function spawnWall() {
  const room = MAX_BUGS - bugs.length;
  const n = Math.min(room, Math.max(6, Math.min(12, Math.floor(W / 64))));
  if (n < 4) { return; }
  const margin = 40 * S;
  let speed = null;
  for (let i = 0; i < n; i++) {
    spawnBug(BUG_KINDS[i % 3 === 2 ? 1 : 0], margin + (W - margin * 2) * (i / (n - 1)), undefined, false);
    const b = bugs[bugs.length - 1];
    speed = speed ?? b.speed * 1.15;
    b.speed = speed; // вся стена идёт ровным строем
    b.amp = 0;
  }
}

function startEvent() {
  const types = Object.keys(EVENTS).filter((t) => t !== lastEvent);
  const type = types[Math.floor(rng.spawn() * types.length)];
  const def = EVENTS[type];
  lastEvent = type;
  showBanner(`${def.icon} ${def.name}!`, def.color);
  sfx.event();
  if (type === 'wall') { spawnWall(); } else { ev = { type, left: def.ms }; }
}

function updateEvents(ms) {
  if (ev) {
    ev.left -= ms;
    if (ev.left <= 0) { ev = null; }
  }
  if (!ev && !boss && (wave >= 2 || dayMod() === 'storm') && elapsed >= nextEventAt) {
    startEvent();
    const gap = dayMod() === 'storm' ? STORM_GAP_MS : EVENT_GAP_MS;
    nextEventAt = elapsed + gap[0] + rng.spawn() * (gap[1] - gap[0]) + (ev ? ev.left : 0);
  }
}

/* ---------- Босс ---------- */
function pickDrop() {
  const total = BOSS_DROPS.reduce((s, k) => s + k.weight, 0);
  let r = rng.spawn() * total;
  for (const k of BOSS_DROPS) {
    r -= k.weight;
    if (r <= 0) { return k; }
  }
  return BOSS_DROPS[0];
}

function addShield(n) {
  shield = Math.min(MAX_SHIELD, shield + n);
}

function spawnBoss() {
  const size = Math.max(BOSS_SIZE * S, 96); // на телефоне масштаб S мал — босс не должен стать крошечным
  const maxHp = BOSS_HP_BASE + BOSS_HP_STEP * bossesDefeated;
  boss = { x: W / 2, y: -size, size, hp: maxHp, maxHp, phase: 0, flash: 0, minionTimer: BOSS_MINION_MS * 0.5, dropTimer: BOSS_DROP_MS * 0.6, lostAtSpawn: run.livesLost };
  showBanner('Завали Босса!', '#ff5470');
  sfx.bossIn();
  shake = Math.max(shake, 0.25);
}

function bossHit(px, py) {
  if (!boss) { return false; }
  const r = boss.size * 0.55 + HIT_RADIUS_BONUS * S * hitMul();
  return (px - boss.x) ** 2 + (py - boss.y) ** 2 <= r * r;
}

function damageBoss(n) {
  if (!boss) { return; }
  boss.hp -= n;
  boss.flash = 0.15;
  burst(boss.x, boss.y, '#ff9f9f', 4 + n);
  if (boss.hp <= 0) { defeatBoss(); }
}

function defeatBoss() {
  const { x, y } = boss;
  const reward = BOSS_BONUS + BOSS_BONUS_STEP * bossesDefeated;
  burst(x, y, '#ffd166', 40);
  burst(x, y, BRAND, 30);
  burst(x, y, '#ff5470', 24);
  for (const b of bugs.slice()) {
    if (THREATS.has(b.behavior) && b.behavior !== 'golden') { killBug(b, true); }
  }
  score += reward;
  kills += 1;
  run.bossKills += 1;
  if (run.livesLost === boss.lostAtSpawn) { run.bossClean += 1; } // за весь бой не потеряно ни полсердца
  if (botFinishing) { run.bossByBot += 1; }
  lives = Math.min(MAX_LIVES, lives + REFACTOR_HEAL);
  bossesDefeated += 1;
  boss = null;
  nextBossScore = score + BOSS_EVERY_SCORE;
  addPopup(x, y, `+${reward}`, '#ffd166');
  showBanner(`Босс повержен! +${reward}`, '#ffd166');
  shake = 0.6;
  flash = 0.5;
  sfx.bossDown();
}

/** Возвращает false, если партия закончилась из-за прорыва босса */
function updateBoss(dt, pace) {
  const line = prodY();
  const topY = (W <= 560 ? 120 : 96) * S + boss.size * 0.5;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.phase += dt * 0.9 * pace;
  boss.x = W / 2 + Math.sin(boss.phase) * (W / 2 - boss.size * 0.6) * 0.85;
  if (boss.y < topY) {
    boss.y = Math.min(topY, boss.y + 170 * S * dt * pace); // выезжает сверху
  } else {
    const descent = Math.max(25, BOSS_DESCENT_S - 3 * bossesDefeated);
    boss.y += ((line - topY) / descent) * dt * pace;
  }
  boss.dropTimer -= dt * 1000;
  if (boss.dropTimer <= 0 && boss.y > 0) {
    boss.dropTimer = BOSS_DROP_MS;
    if (bugs.length < MAX_BUGS) { spawnBug(pickDrop()); }
  }
  boss.minionTimer -= dt * 1000 * pace;
  if (boss.minionTimer <= 0 && boss.y > 0) {
    boss.minionTimer = Math.max(1100, BOSS_MINION_MS - 250 * bossesDefeated);
    if (bugs.length < MAX_BUGS) { spawnBug(BUG_KINDS[Math.floor(rng.spawn() * 3)], boss.x, boss.y + boss.size * 0.4, false, 1.4); }
  }
  if (boss.y + boss.size * 0.35 >= line) {
    const bx = boss.x;
    addSplat(bx, line);
    boss = null;
    nextBossScore = score + BOSS_EVERY_SCORE;
    if (shield >= BOSS_REACH_DAMAGE) { showBanner('Щит выдержал прорыв босса!', '#7fd8ff'); }
    else if (shield > 0) { showBanner('Босс прорвался! Щит поглотил часть', '#ff5470'); }
    else { showBanner('Босс прорвался! −2 сердца', '#ff5470'); }
    for (let i = 0; i < BOSS_REACH_DAMAGE; i++) {
      loseLife(bx);
      if (phase !== 'playing') { return false; }
    }
  }
  return true;
}

function handleClick(px, py) {
  if (phase !== 'playing' || countdownLeft > 0 || perkOpen) { return; }
  // выбираем верхнего (последнего нарисованного) жука под курсором
  let target = null;
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i];
    const r = b.size * 0.6 + HIT_RADIUS_BONUS * S * hitMul();
    if ((px - b.x) ** 2 + (py - b.y) ** 2 <= r * r) { target = b; break; }
  }
  if (!target && bossHit(px, py)) {
    // комбо босс не трогает: серия считается по убитым багам
    score += 1;
    addPopup(px, py - 10 * S, '+1', '#ff9f9f');
    sfx.bossHit();
    damageBoss(1);
    updateHud();
    return;
  }
  if (!target) {
    breakCombo();
    sfx.miss();
    updateHud();
    return;
  }
  if (target.behavior === 'decoy') {
    bugs = bugs.filter((x) => x.id !== target.id);
    score = Math.max(0, score - DECOY_PENALTY);
    breakCombo();
    addPopup(target.x, target.y, `-${DECOY_PENALTY}`, '#ff5470');
    burst(target.x, target.y, '#ff5470', 8);
    sfx.decoy();
  } else if (target.behavior === 'refactor') {
    bugs = bugs.filter((x) => x.id !== target.id);
    eatEverything();
  } else if (target.behavior === 'shield') {
    bugs = bugs.filter((x) => x.id !== target.id);
    addShield(SHIELD_CHARGES);
    burst(target.x, target.y, '#7fd8ff', 14);
    addPopup(target.x, target.y - target.size * 0.5, `Щит ×${shield}`, '#7fd8ff');
    sfx.shieldUp();
  } else if (target.behavior === 'patch') {
    bugs = bugs.filter((x) => x.id !== target.id);
    burst(target.x, target.y, BRAND, 14);
    if (lives < MAX_LIVES) {
      lives += 1;
      addPopup(target.x, target.y - target.size * 0.5, '+½ сердца', BRAND);
    } else { // сердца полные — патч превращается в заряд щита
      addShield(1);
      addPopup(target.x, target.y - target.size * 0.5, 'Щит +1', '#7fd8ff');
    }
    sfx.patch();
  } else if (target.behavior === 'autotest') {
    bugs = bugs.filter((x) => x.id !== target.id);
    activateAutotest(target);
  } else if (target.behavior === 'freeze') {
    bugs = bugs.filter((x) => x.id !== target.id);
    activateFreeze(target);
  } else if (target.behavior === 'bomb') {
    bugs = bugs.filter((x) => x.id !== target.id);
    detonate(target);
  } else {
    target.hp -= 1;
    if (target.hp > 0) {
      sfx.crack();
      burst(target.x, target.y, '#c9d6ff', 5);
      addPopup(target.x, target.y - target.size * 0.5, 'крак!', '#c9d6ff');
    } else {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      if (combo % comboStep() === 0 && combo / comboStep() < COMBO_MULT_MAX) {
        showBanner(`Азарт ×${comboMult()}!`, '#ffd166');
        sfx.fever();
        flash = Math.max(flash, 0.12);
      } else if (COMBO_MILESTONES.includes(combo)) { showBanner(`Комбо ×${combo}`, '#ffd166'); }
      if (target.behavior === 'golden') {
        run.bonuses.golden += 1;
        const goldBonus = GOLDEN_BONUS + 2 * perkLv('gold');
        score += goldBonus;
        addPopup(target.x, target.y - target.size, `+${goldBonus} ★`, '#ffd166');
        if (!(ev && ev.type === 'gold')) { // во время лихорадки пауза спавна не нужна
          freezeLeft = Math.max(freezeLeft, GOLDEN_FREEZE_MS);
          showBanner('🐝 Золотой баг! Пауза спавна', '#ffd166');
        }
        sfx.golden();
      } else {
        sfx.hit(combo);
      }
      killBug(target);
    }
  }
  updateHud();
}

function update(dt) {
  const ms = dt * 1000;
  elapsed += ms;

  if (elapsed >= nextWaveAt) {
    wave += 1;
    nextWaveAt += WAVE_EVERY_MS;
    boostLeft = WAVE_BOOST_MS;
    showBanner(`Волна ${wave}: ${WAVE_NEWS[wave] || 'баги ускоряются'}`, '#ff9f43');
    if (wave >= PERK_FIRST_WAVE && (wave - PERK_FIRST_WAVE) % PERK_EVERY === 0) { perkPending = true; }
    sfx.wave();
  }
  if (perkPending && !boss) { // во время боя с боссом выбор откладывается до его конца
    perkPending = false;
    if (openPerks()) { return; }
  }
  boostLeft = Math.max(0, boostLeft - ms);
  slowLeft = Math.max(0, slowLeft - ms);
  const pace = slowLeft > 0 ? SLOW_FACTOR : 1;

  if (!boss && score >= nextBossScore) { spawnBoss(); }
  updateEvents(ms);
  updateAutotest(ms);

  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - ms);
  } else {
    spawnTimer += ms;
    let iv = spawnInterval() * (boss ? 1.8 : 1); // пока идёт бой с боссом, обычных багов меньше
    if (ev && ev.type === 'rain') { iv *= 0.3; }
    if (ev && ev.type === 'gold') { iv = 650; }
    while (spawnTimer >= iv && bugs.length < MAX_BUGS) {
      spawnTimer -= iv;
      if (ev && ev.type === 'rain') { spawnBug(BUG_KINDS[rng.spawn() < 0.7 ? 0 : 1]); }
      else if (ev && ev.type === 'gold') { spawnBug(BUG_KINDS.find((k) => k.behavior === 'golden')); }
      else { spawnBug(pickKind()); }
    }
    if (bugs.length >= MAX_BUGS) { spawnTimer = 0; }
  }

  const line = prodY();
  for (const b of bugs.slice()) {
    const dash = b.behavior === 'dasher' && b.y > H * DASH_FROM ? DASH_MUL : 1;
    b.y += b.speed * dt * pace * dash;
    b.phase += dt * 2.2 * pace;
    b.x = b.baseX + Math.sin(b.phase) * b.amp;
    b.x = Math.max(b.size * 0.5, Math.min(W - b.size * 0.5, b.x));
    if (b.y >= line) {
      bugs = bugs.filter((x) => x.id !== b.id);
      if (THREATS.has(b.behavior)) {
        addSplat(b.x, line);
        loseLife(b.x);
        if (phase !== 'playing') { return; }
      }
    }
  }

  if (boss && !updateBoss(dt, pace)) { return; }

  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * S * dt; p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  const now = fxClock;
  splats = splats.filter((s) => now - s.born < SPLAT_MS);
  popups = popups.filter((p) => now - p.born < POPUP_MS);
  if (banner) { banner.left -= ms; if (banner.left <= 0) { banner = null; } }
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt);
  updateHud();
}

/* ---------- Отрисовка ---------- */
const FONT_UI = "'Onest', system-ui, sans-serif";
const FONT_DISPLAY = "'Unbounded', 'Onest', system-ui, sans-serif";
const BRAND = '#b8f04a'; // тот же акцент, что --brand в style.css

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0d12');
  g.addColorStop(1, '#14101a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const step = 48 * S;
  const off = (elapsed / 40) % step;
  ctx.beginPath();
  for (let x = 0; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = -step + off; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
}

function drawProdLine() {
  const y = prodY();
  const danger = lives <= 2 ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0;
  ctx.fillStyle = `rgba(255, 60, 90, ${0.1 + danger * 0.12})`;
  ctx.fillRect(0, y, W, H - y);
  ctx.strokeStyle = '#ff5470';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 9]);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.setLineDash([]);
  if (shield > 0) {
    ctx.save();
    ctx.strokeStyle = '#7fd8ff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#7fd8ff';
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(performance.now() / 200);
    ctx.beginPath(); ctx.moveTo(0, y - 3); ctx.lineTo(W, y - 3); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = shield > 0 ? 'rgba(160, 225, 255, 0.95)' : 'rgba(255, 120, 140, 0.9)';
  ctx.font = `700 ${Math.round(13 * S)}px ${FONT_UI}`;
  ctx.letterSpacing = `${Math.round(3 * S)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shield > 0 ? `PRODUCTION · ЩИТ ×${shield}` : 'PRODUCTION', W / 2, y + (H - y) / 2);
  ctx.letterSpacing = '0px';
}

function drawBoss() {
  if (!boss) { return; }
  const sp = getSprite(BOSS_EMOJI, boss.size);
  const w = sp.width / DPR;
  const pulse = 1 + 0.04 * Math.sin(performance.now() / 180);
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(Math.sin(boss.phase * 2) * 0.1);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = boss.flash > 0 ? '#ffffff' : '#ff5470';
  ctx.shadowBlur = boss.flash > 0 ? 40 : 24;
  ctx.drawImage(sp, -w / 2, -w / 2, w, w);
  ctx.restore();
}

function drawBossBar() {
  if (!boss) { return; }
  const narrow = W < 600;
  const bw = narrow ? W - 24 : Math.min(420, W * 0.4);
  const x = (W - bw) / 2;
  const y = narrow ? 72 : 28;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 11px ${FONT_UI}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#ff9f9f';
  ctx.fillText(bossesDefeated ? `БАГ-БОСС · ${bossesDefeated + 1}` : 'БАГ-БОСС', x, y - 7);
  ctx.textAlign = 'right';
  ctx.letterSpacing = '0px';
  ctx.fillText(`${Math.max(0, boss.hp)} / ${boss.maxHp}`, x + bw, y - 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x, y, bw, 10);
  ctx.fillStyle = boss.flash > 0 ? '#ffffff' : '#ff5470';
  ctx.fillRect(x, y, bw * Math.max(0, boss.hp / boss.maxHp), 10);
}

function drawBugs() {
  for (const b of bugs) {
    const img = b.image ? getImage(b.image) : null;
    if (b.image && !img) { continue; }
    const sp = img ? null : getSprite(b.emoji, b.size);
    const wob = Math.sin(b.phase * 1.7) * 0.15;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(wob);
    if (b.behavior === 'golden') {
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 18;
    } else if (b.behavior === 'refactor') {
      ctx.shadowColor = '#5be3a5';
      ctx.shadowBlur = 20;
    } else if (b.behavior === 'dasher' && b.y > H * DASH_FROM) {
      ctx.shadowColor = '#ff5470';
      ctx.shadowBlur = 16;
    } else if (b.behavior === 'autotest') {
      ctx.shadowColor = '#c792ea';
      ctx.shadowBlur = 18;
    } else if (b.kind.glow) { // тёмные жуки: подсветка, чтобы не терялись на фоне
      ctx.shadowColor = b.kind.glow;
      ctx.shadowBlur = 12;
    } else if (b.behavior === 'shield') {
      ctx.shadowColor = '#7fd8ff';
      ctx.shadowBlur = 18;
    } else if (b.behavior === 'patch') {
      ctx.shadowColor = BRAND;
      ctx.shadowBlur = 18;
    }
    if (img) {
      const h = b.size * 1.15;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      const w = sp.width / DPR;
      ctx.drawImage(sp, -w / 2, -w / 2, w, w);
    }
    if (b.behavior === 'autotest') { // кольцо: редкий бонус виден издалека
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(199, 146, 234, 0.75)';
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.arc(0, 0, b.size * 0.78 * (1 + 0.08 * Math.sin(performance.now() / 180)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (b.kind.hp > 1 && b.hp < b.kind.hp) {
      ctx.fillStyle = '#ff5470';
      ctx.fillRect(b.x - b.size * 0.4, b.y - b.size * 0.8, b.size * 0.8 * (b.hp / b.kind.hp), 3);
    }
  }
}

function drawEffects() {
  const now = fxClock;
  for (const s of splats) {
    const t = Math.min(1, (now - s.born) / SPLAT_MS);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = BRAND;
    ctx.beginPath();
    ctx.arc(s.x, s.y, (10 + 22 * t) * S, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(20 * S)}px ${FONT_UI}`;
  for (const p of popups) {
    const t = Math.min(1, (now - p.born) / POPUP_MS);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - 36 * S * t);
  }
  ctx.globalAlpha = 1;
}

function drawBanner() {
  if (!banner) { return; }
  const t = banner.left / BANNER_MS;
  const a = Math.min(1, t * 3, (1 - t) * 6 + 0.2);
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = banner.color;
  let px = Math.round(28 * S);
  ctx.font = `700 ${px}px ${FONT_DISPLAY}`;
  const textW = ctx.measureText(banner.text).width;
  if (textW > W - 24) { // длинный баннер ужимаем под ширину экрана
    px = Math.max(12, Math.floor(px * (W - 24) / textW));
    ctx.font = `700 ${px}px ${FONT_DISPLAY}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 12;
  ctx.fillText(banner.text, W / 2, H * 0.22);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawFever() {
  const m = comboMult();
  if (m < 2) { return; }
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 220);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, m >= 3 ? `rgba(255, 209, 102, ${0.2 * pulse})` : `rgba(184, 240, 74, ${0.15 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawAutotest() {
  const now = fxClock;
  autotestShots = autotestShots.filter((s) => now - s.born < 160);
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of autotestShots) {
    const a = 1 - (now - s.born) / 160;
    ctx.globalAlpha = a;
    ctx.strokeStyle = BRAND;
    ctx.shadowColor = BRAND;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
  }
  ctx.restore();
  if (autotestLeft <= 0) { return; }
  const x = botX();
  const y = prodY() - 56 * S + Math.sin(now / 240) * 3 * S;
  const sp = getSprite('🤖', 36 * S);
  const w = sp.width / DPR;
  ctx.save();
  ctx.shadowColor = '#c792ea';
  ctx.shadowBlur = 16;
  ctx.drawImage(sp, x - w / 2, y - w / 2, w, w);
  ctx.restore();
  const bw = 54 * S;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x - bw / 2, y + 26 * S, bw, 4 * S);
  ctx.fillStyle = '#c792ea';
  ctx.fillRect(x - bw / 2, y + 26 * S, bw * Math.min(1, autotestLeft / autotestSpan), 4 * S);
}

function drawEventBar() {
  if (!ev) { return; }
  const def = EVENTS[ev.type];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(14 * S)}px ${FONT_UI}`;
  ctx.fillStyle = def.color;
  ctx.fillText(`${def.icon} ${def.name} · ${Math.ceil(ev.left / 1000)} с`, W / 2, prodY() - 20 * S);
}

function drawSlowTint() {
  if (slowLeft <= 0) { return; }
  ctx.fillStyle = `rgba(80, 170, 255, ${0.05 + 0.04 * Math.sin(performance.now() / 200)})`;
  ctx.fillRect(0, 0, W, H);
}

function drawCountdown() {
  if (phase !== 'playing' || countdownLeft <= 0) { return; }
  const n = Math.ceil(countdownLeft / 1000);
  if (n !== lastTickSec) { lastTickSec = n; sfx.tick(); }
  ctx.fillStyle = 'rgba(8, 10, 14, .5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = `700 ${Math.round(110 * S)}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), W / 2, H / 2);
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  if (fx && shake > 0) { ctx.translate((Math.random() - 0.5) * 14 * shake * 3, (Math.random() - 0.5) * 14 * shake * 3); }
  drawBackground();
  drawProdLine();
  drawBoss();
  drawBugs();
  drawAutotest();
  drawEffects();
  drawSlowTint();
  drawFever();
  ctx.restore();
  drawBossBar();
  drawEventBar();
  drawBanner();
  drawCountdown();
  if (fx && flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- HUD ---------- */
const heartNodes = Array.from({ length: MAX_LIVES / 2 }, () => {
  const h = document.createElement('i');
  h.className = 'heart';
  el.lives.append(h);
  return h;
});
el.lives.setAttribute('role', 'img');

function updateHud() {
  el.score.textContent = score;
  el.combo.textContent = comboMult() > 1 ? `${combo} ×${comboMult()}` : combo;
  heartNodes.forEach((h, i) => {
    const left = lives - i * 2; // сколько половинок приходится на это сердце
    h.className = left >= 2 ? 'heart' : left === 1 ? 'heart half' : 'heart empty';
  });
  el.lives.setAttribute('aria-label', `Жизни: ${Math.max(0, lives) / 2} из ${MAX_LIVES / 2}`);
  el.best.textContent = Math.max(mode === 'daily' ? dailyBestToday() : best, score);
}

/* ---------- Цикл ---------- */
/** Кнопка паузы: активна только во время партии, на паузе показывает «играть» */
let pauseBtnState = '';
function syncPauseButton() {
  const state = phase === 'playing' ? 'playing' : phase === 'paused' ? 'paused' : 'off';
  if (state === pauseBtnState) { return; }
  pauseBtnState = state;
  el.pause.disabled = state === 'off';
  el.pause.classList.toggle('paused', state === 'paused');
  const label = state === 'paused' ? 'Продолжить' : 'Пауза';
  el.pause.setAttribute('aria-label', label);
  el.pause.title = `${label} (P)`;
}

function onPauseButton() {
  if (document.body.dataset.panel) {
    // закрыть рейтинг или кабинет: слушатели board.js и cabinet.js закрываются при любом detail, кроме своего
    window.dispatchEvent(new CustomEvent('panel:open', { detail: 'none' }));
  }
  setPaused(phase === 'playing');
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  if (phase === 'playing') {
    if (perkOpen) { render(); syncPauseButton(); requestAnimationFrame(frame); return; }
    fxClock += dt * 1000;
    if (countdownLeft > 0) { countdownLeft -= dt * 1000; } else { update(dt); }
  }
  render();
  syncPauseButton();
  requestAnimationFrame(frame);
}

/* ---------- Ввод и системные кнопки ---------- */
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  inGesture = true; // вибрация на iOS разрешена только внутри касания
  try { handleClick(e.clientX, e.clientY); } finally { inGesture = false; }
});

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    (document.documentElement.requestFullscreen?.() || Promise.resolve()).catch(() => {});
  }
}
function toggleSound() {
  muted = !muted;
  el.sound.classList.toggle('off', muted);
  el.sound.setAttribute('aria-pressed', String(muted));
  try { localStorage.setItem('bug-hunter-fullscreen:muted', muted ? '1' : '0'); } catch { /* ignore */ }
}
/** Ползунок громкости: значение 0..100 → 0..1, сохранение и подпись */
function paintSlider(input, out, value) {
  input.value = Math.round(value * 100);
  input.style.setProperty('--p', `${input.value}%`);
  out.textContent = `${input.value}%`;
}

function bindVolume(kind) {
  const input = document.getElementById(`vol-${kind}`);
  const out = document.getElementById(`vol-${kind}-out`);
  if (!input) { return; }
  paintSlider(input, out, kind === 'sfx' ? sfxVol : musicVol);
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    paintSlider(input, out, v);
    if (kind === 'sfx') {
      sfxVol = v;
      if (v > 0 && muted) { toggleSound(); } // крутят ручку громкости — значит, хотят слышать
      try { localStorage.setItem(VOL_SFX_KEY, String(v)); } catch { /* ignore */ }
    } else {
      musicVol = v;
      if (v > 0 && !musicOn) { toggleMusic(); }
      try { localStorage.setItem(VOL_MUSIC_KEY, String(v)); } catch { /* ignore */ }
      music.setLevel();
      music.sync();
    }
  });
  // по отпусканию — «пробный» звук нужной громкости
  input.addEventListener('change', () => {
    if (kind === 'sfx') { tone(520, 0.09, 'square', 0.07, 220); } else { music.preview(); }
  });
}

function toggleMusic() {
  musicOn = !musicOn;
  el.music.classList.toggle('off', !musicOn);
  el.music.setAttribute('aria-pressed', String(!musicOn));
  try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0'); } catch { /* ignore */ }
  music.sync();
}
function toggleHaptic() {
  haptics = !haptics;
  el.haptic.classList.toggle('off', !haptics);
  el.haptic.setAttribute('aria-pressed', String(haptics));
  try { localStorage.setItem(HAPTIC_KEY, haptics ? '1' : '0'); } catch { /* ignore */ }
  if (haptics) { inGesture = true; haptic(30); inGesture = false; } // «пробный» отклик при включении
}
function toggleFx() {
  fx = !fx;
  el.fx.classList.toggle('off', !fx);
  el.fx.setAttribute('aria-pressed', String(fx));
  try { localStorage.setItem(FX_KEY, fx ? '1' : '0'); } catch { /* ignore */ }
}
function primaryAction() {
  if (phase === 'paused') { setPaused(false); } else if (phase !== 'playing') { startGame('normal'); }
}

el.start.addEventListener('click', primaryAction);
el.full.addEventListener('click', toggleFullscreen);
el.sound.addEventListener('click', toggleSound);
el.music.addEventListener('click', toggleMusic);
bindVolume('sfx');
bindVolume('music');
el.fx.addEventListener('click', toggleFx);
el.haptic.addEventListener('click', toggleHaptic);
el.pause.addEventListener('click', onPauseButton);
document.addEventListener('keydown', (e) => {
  if (e.repeat || document.body.dataset.panel || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) { return; }
  const k = e.key.toLowerCase();
  if (k === 'f' || k === 'а') { toggleFullscreen(); }
  else if (k === 'm' || k === 'ь') { toggleSound(); }
  else if (k === 'n' || k === 'т') { toggleMusic(); }
  else if (k === 'v' || k === 'м') { toggleFx(); }
  else if ((k === 'r' || k === 'к') && (phase === 'paused' || phase === 'over')) { startGame(); }
  else if (k === 'p' || k === 'з' || k === 'escape') { setPaused(phase === 'playing'); }
  else if (k === ' ' || k === 'enter') { e.preventDefault(); primaryAction(); }
});
// скрытая вкладка или потеря фокуса — ставим на паузу, чтобы баги не добрались до прода без игрока
document.addEventListener('visibilitychange', () => { if (document.hidden) { setPaused(true); } });
window.addEventListener('blur', () => setPaused(true));

/* ---------- Авторизация, рейтинг, сохранение результата ---------- */
let currentUser = null;

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { throw new Error(data.error || `Ошибка ${res.status}`); }
  return data;
}

function renderUser() {
  el.auth.hidden = !!currentUser;
  el.me.hidden = !currentUser;
  if (currentUser) {
    el.meName.textContent = currentUser.username;
    el.meAvatar.textContent = currentUser.avatar || '🐛';
    el.me.style.setProperty('--accent', currentUser.color || '#35c4ff');
    el.meTitle.textContent = currentUser.title || '';
    if (currentUser.tier) {
      document.getElementById('me-badge').replaceChildren(rankBadge(currentUser.tier, 'sm'));
      applyTier(el.meAvatar, currentUser.tier);
    }
    el.meKills.textContent = currentUser.totalKills;
    el.meGames.textContent = currentUser.gamesPlayed;
    el.meBest.textContent = currentUser.bestScore;
  }
}

function setAuthError(msg) {
  el.authError.textContent = msg || '';
  el.authError.hidden = !msg;
}

async function authSubmit(kind) {
  setAuthError('');
  try {
    const data = await api(`/api/${kind}`, { username: el.authUser.value, password: el.authPass.value });
    currentUser = data.user;
    el.authPass.value = '';
    renderUser();
    loadDaily();
  } catch (e) {
    setAuthError(e.message);
  }
}

async function loadSession() {
  try {
    currentUser = (await api('/api/me')).user;
  } catch {
    currentUser = null; // открыто без сервера — играем как гость
  }
  renderUser();
}

/* ---------- Задача дня: карточка на стартовом экране ---------- */
const dailyBox = document.getElementById('daily');
const dailyKey = () => `bug-hunter-fullscreen:daily:${dailyInfo.date}`;

/** Лучший результат за сегодня: серверный (если вошли) или локальный, смотря что выше */
function dailyBestToday() {
  if (!dailyInfo) { return 0; }
  let local = 0;
  try { local = Number(localStorage.getItem(dailyKey())) || 0; } catch { /* ignore */ }
  return Math.max(dailyInfo.me ? dailyInfo.me.score : 0, local);
}
function saveDailyBest(v) {
  try { localStorage.setItem(dailyKey(), String(v)); } catch { /* ignore */ }
}

async function loadDaily() {
  try {
    dailyInfo = await api('/api/daily');
  } catch {
    dailyInfo = null; // нет сервера — без задачи дня
  }
  renderDaily();
}

function renderDaily() {
  if (!dailyBox) { return; }
  dailyBox.hidden = !dailyInfo || phase === 'paused' || phase === 'playing';
  if (!dailyInfo) { return; }
  const d = new Date(`${dailyInfo.date}T00:00:00Z`);
  document.getElementById('daily-month').textContent = d.toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  document.getElementById('daily-day').textContent = d.getUTCDate();
  const m = dailyInfo.modifier;
  document.getElementById('daily-mod-ic').textContent = m.icon;
  document.getElementById('daily-mod-name').textContent = m.name;
  document.getElementById('daily-mod-desc').textContent = m.desc;
  const best = dailyBestToday();
  const left = Date.parse(`${dailyInfo.date}T00:00:00Z`) + 24 * 3600 * 1000 - Date.now();
  const h = Math.max(0, Math.floor(left / 3600000));
  const min = Math.max(0, Math.floor((left % 3600000) / 60000));
  document.getElementById('daily-best').textContent = best ? `Лучший сегодня: ${best}` : 'Сегодня ещё не пробовали';
  document.getElementById('daily-left').textContent = `Новая через ${h} ч ${min} мин`;
  document.getElementById('btn-daily').textContent = best ? 'Побить свой результат' : 'Играть задачу дня';
}

document.getElementById('btn-daily')?.addEventListener('click', () => { if (phase !== 'playing') { startGame('daily'); } });

async function submitResult(finalScore, finalKills, durationMs) {
  if (!currentUser) {
    el.saveStatus.textContent = 'Войдите, чтобы попасть в рейтинг';
    el.saveStatus.hidden = false;
    return;
  }
  el.saveStatus.textContent = 'Сохраняю результат…';
  el.saveStatus.hidden = false;
  try {
    const data = await api('/api/score', {
      kills: finalKills, score: finalScore, durationMs,
      bestCombo, wave, livesLost: Math.ceil(run.livesLost / 2), bonuses: run.bonuses,
      maxBombKills: run.maxBombKills, crocAtOneLife: run.crocAtOneLife,
      bossKills: run.bossKills, bossClean: run.bossClean, bossByBot: run.bossByBot,
      autotestPicks: run.autotestPicks, autotestKills: run.autotestKills,
      daily: mode === 'daily' && dailyInfo ? dailyInfo.date : undefined,
    });
    currentUser = data.user;
    renderUser();
    el.saveStatus.textContent = data.daily
      ? `Задача дня: место ${data.daily.rank}${data.daily.isBest ? ' · новый лучший результат' : ''} · лучший ${data.daily.best}`
      : `Сохранено · всего убито: ${currentUser.totalKills}`;
    if (data.daily) { loadDaily(); }
    if (data.newRank) { setTimeout(() => showRankUp(data.newRank), 900); } // даём увидеть итоги партии
    toastAchievements(data.newAchievements || []);
  } catch (e) {
    el.saveStatus.textContent = `Результат не сохранён: ${e.message}`;
  }
}

/* ---------- Ранги: значок и окно повышения ---------- */
/** Шестиугольный значок ранга; `tier` — { name, icon, color } из API */
function rankBadge(tier, size = 'sm') {
  const badge = document.createElement('span');
  badge.className = `rank-badge ${size}`;
  badge.style.setProperty('--rank', tier.color);
  badge.title = tier.name;
  const icon = document.createElement('span');
  icon.textContent = tier.icon;
  badge.append(icon);
  return badge;
}

/** Цвет ранга и уровень на элементе — по ним CSS рисует сияние вокруг аватара */
function applyTier(node, tier) {
  node.dataset.tier = tier.level;
  node.style.setProperty('--rank', tier.color);
}

/** Награды ранга в виде плашек: аватары, цвета профиля, свой цвет */
function unlockChips(unlocks) {
  const frag = document.createDocumentFragment();
  for (const a of unlocks.avatars) {
    const chip = document.createElement('span');
    chip.className = 'rd-chip';
    chip.textContent = a;
    frag.append(chip);
  }
  for (const c of unlocks.colors) {
    const chip = document.createElement('span');
    chip.className = 'rd-chip';
    const dot = document.createElement('i');
    dot.className = 'rd-dot';
    dot.style.setProperty('--c', c);
    chip.append(dot);
    frag.append(chip);
  }
  if (unlocks.customColor) {
    const chip = document.createElement('span');
    chip.className = 'rd-chip text';
    chip.textContent = '🎨 Свой цвет';
    frag.append(chip);
  }
  return frag;
}

const rankup = document.getElementById('rankup');
let rankupKey = null;

function hideRankUp() {
  rankup.hidden = true;
  if (document.body.dataset.panel === 'rankup') { delete document.body.dataset.panel; }
  if (rankupKey) { document.removeEventListener('keydown', rankupKey); rankupKey = null; }
}

/** Праздничная карточка при повышении ранга: большой значок, лучи, искры и список открытых наград */
function showRankUp(rank) {
  if (!rankup || !rank) { return; }
  rankup.style.setProperty('--rank', rank.color);
  const stage = rankup.querySelector('.rankup-stage');
  stage.querySelectorAll('.rankup-spark').forEach((n) => n.remove());
  for (let i = 0; i < 18; i++) {
    const spark = document.createElement('i');
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const d = 90 + Math.random() * 70;
    spark.className = 'rankup-spark';
    spark.style.setProperty('--i', i);
    spark.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    spark.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    stage.append(spark);
  }
  document.getElementById('rankup-badge').replaceChildren(rankBadge(rank, 'xl'));
  document.getElementById('rankup-name').textContent = rank.name;
  document.getElementById('rankup-unlocks').replaceChildren(unlockChips(rank.unlocks));
  document.getElementById('rankup-perk').textContent = rank.unlocks.perk;
  rankup.hidden = false;
  document.body.dataset.panel = 'rankup'; // блокирует горячие клавиши игры, пока окно открыто
  sfx.rankUp();
  document.getElementById('rankup-ok').focus({ preventScroll: true });
  rankupKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); hideRankUp(); } };
  document.addEventListener('keydown', rankupKey);
}

document.getElementById('rankup-ok').addEventListener('click', hideRankUp);
document.getElementById('rankup-cabinet').addEventListener('click', () => {
  hideRankUp();
  document.getElementById('btn-cabinet').click();
});
rankup.addEventListener('click', (e) => { if (e.target === rankup) { hideRankUp(); } });

/* ---------- Перки ---------- */
const perkModal = document.getElementById('perk');
const perkStrip = document.getElementById('perk-strip');
let perkKey = null;

function pickPerks() {
  const pool = PERKS.filter((p) => (p.consumable || perkLv(p.id) < p.max) && (!p.when || p.when()));
  for (let i = pool.length - 1; i > 0; i--) { // тасуем и берём первые три
    const j = Math.floor(rng.perk() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PERK_COUNT);
}

function renderPerkStrip() {
  if (!perkStrip) { return; }
  perkStrip.textContent = '';
  for (const p of PERKS) {
    const lv = perkLv(p.id);
    if (!lv) { continue; }
    const chip = document.createElement('span');
    chip.className = 'perk-chip';
    chip.title = `${p.name}: ${p.desc}`;
    chip.textContent = p.icon;
    if (lv > 1) {
      const n = document.createElement('b');
      n.textContent = lv;
      chip.append(n);
    }
    perkStrip.append(chip);
  }
}

function closePerks() {
  perkOpen = false;
  if (perkModal) { perkModal.hidden = true; }
  if (document.body.dataset.panel === 'perk') { delete document.body.dataset.panel; }
  if (perkKey) { document.removeEventListener('keydown', perkKey); perkKey = null; }
}

/** Пауза и три карточки на выбор. Возвращает false, если выбирать нечего */
function openPerks() {
  perkChoices = pickPerks();
  if (!perkChoices.length || !perkModal) { return false; }
  perkOpen = true;
  document.getElementById('perk-wave').textContent = `Волна ${wave}`;
  const box = document.getElementById('perk-cards');
  box.textContent = '';
  perkChoices.forEach((p, i) => {
    const card = document.createElement('button');
    card.className = 'perk-card';
    card.type = 'button';
    card.style.setProperty('--i', i);
    const key = document.createElement('span');
    key.className = 'perk-key';
    key.textContent = i + 1;
    const icon = document.createElement('span');
    icon.className = 'perk-icon';
    icon.textContent = p.icon;
    const name = document.createElement('b');
    name.textContent = p.name;
    const desc = document.createElement('small');
    desc.textContent = p.desc;
    const lvl = document.createElement('em');
    lvl.className = 'perk-lvl';
    lvl.textContent = p.consumable ? 'Разово' : `Ур. ${perkLv(p.id) + 1} из ${p.max}`;
    card.append(key, icon, name, desc, lvl);
    card.addEventListener('click', () => { inGesture = true; try { choosePerk(p); } finally { inGesture = false; } });
    box.append(card);
  });
  perkModal.hidden = false;
  document.body.dataset.panel = 'perk'; // горячие клавиши игры не должны срабатывать
  sfx.event();
  music.sync();
  perkKey = (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= perkChoices.length) { e.preventDefault(); choosePerk(perkChoices[n - 1]); }
  };
  document.addEventListener('keydown', perkKey);
  box.querySelector('.perk-card').focus({ preventScroll: true });
  return true;
}

function choosePerk(p) {
  if (!perkOpen) { return; }
  if (p.id === 'backup') { lives = Math.min(MAX_LIVES, lives + 2); }
  else if (p.id === 'firewall') { addShield(SHIELD_CHARGES); }
  else { perks[p.id] = perkLv(p.id) + 1; }
  closePerks();
  countdownLeft = 1000; // секунда на то, чтобы собраться
  lastTickSec = 0;
  showBanner(`${p.icon} ${p.name}${p.consumable ? '' : ` ×${perkLv(p.id)}`}`, '#b8f04a');
  sfx.fever();
  renderPerkStrip();
  updateHud();
  music.sync();
}

/** Всплывающее уведомление (контейнер #toasts в index.html) */
function toast(icon, title, text) {
  const box = document.getElementById('toasts');
  if (!box) { return; }
  const node = document.createElement('div');
  node.className = 'toast';
  const ic = document.createElement('span');
  ic.className = 'toast-icon';
  ic.textContent = icon;
  const body = document.createElement('div');
  const t = document.createElement('b');
  t.textContent = title;
  const d = document.createElement('small');
  d.textContent = text || '';
  body.append(t, d);
  node.append(ic, body);
  node.addEventListener('click', () => node.remove());
  box.append(node);
  setTimeout(() => node.remove(), 5200);
}

const ACH_TOAST_ROWS = 4; // сколько ачивок показываем строками, остальные — «и ещё N»

/** Одна карточка на все ачивки партии: заголовок, список с каскадом, время показа растёт с числом строк */
function toastAchievements(list) {
  const box = document.getElementById('toasts');
  if (!box || !list.length) { return; }
  const node = document.createElement('div');
  node.className = list.length > 1 ? 'toast toast-ach toast-multi' : 'toast toast-ach';
  const life = Math.min(9000, 4500 + 700 * list.length);
  node.style.setProperty('--life', `${life}ms`);
  const body = document.createElement('div');
  body.className = 'toast-body';
  const kicker = document.createElement('span');
  kicker.className = 'toast-kicker';
  kicker.textContent = list.length > 1 ? `Новые ачивки · ${list.length}` : 'Новая ачивка';
  const ul = document.createElement('ul');
  ul.className = 'toast-list';
  const row = (icon, title, text, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', i);
    const ic = document.createElement('span');
    ic.className = 'toast-icon';
    ic.textContent = icon;
    const info = document.createElement('span');
    info.className = 'toast-info';
    const t = document.createElement('b');
    t.textContent = title;
    info.append(t);
    if (text) {
      const d = document.createElement('small');
      d.textContent = text;
      info.append(d);
    }
    li.append(ic, info);
    ul.append(li);
  };
  list.slice(0, ACH_TOAST_ROWS).forEach((a, i) => row(a.icon, a.name, a.desc, i));
  if (list.length > ACH_TOAST_ROWS) { row('＋', `и ещё ${list.length - ACH_TOAST_ROWS}`, 'Все — в кабинете, во вкладке «Ачивки»', ACH_TOAST_ROWS); }
  body.append(kicker, ul);
  node.append(body);
  node.addEventListener('click', () => node.remove());
  box.append(node);
  setTimeout(() => node.remove(), life);
}

el.authForm.addEventListener('submit', (e) => { e.preventDefault(); authSubmit('login'); });
el.btnRegister.addEventListener('click', () => authSubmit('register'));
el.logout.addEventListener('click', async () => {
  try { await api('/api/logout', {}); } catch { /* ignore */ }
  currentUser = null;
  renderUser();
  loadDaily();
});

/* ---------- Старт ---------- */
loadSession().then(loadDaily);
el.sound.classList.toggle('off', muted);
el.sound.setAttribute('aria-pressed', String(muted));
el.music.classList.toggle('off', !musicOn);
el.music.setAttribute('aria-pressed', String(!musicOn));
el.fx.classList.toggle('off', !fx);
el.fx.setAttribute('aria-pressed', String(fx));
el.haptic.hidden = !canHaptic; // кнопка нужна только на устройствах с вибрацией
el.haptic.classList.toggle('off', !haptics);
el.haptic.setAttribute('aria-pressed', String(haptics));
el.stats.textContent = best ? `Рекорд: ${best}` : '';
resize();
updateHud();
requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
