'use strict';

/* ---------- Константы баланса ---------- */
// жизни считаем в половинках сердца: 10 = 5 сердец, попадание бага на прод отнимает 1 (полсердца)
const START_LIVES = 10;
const MAX_LIVES = 10;
const REFACTOR_HEAL = 2; // Рефакторинг возвращает целое сердце
const HIT_RADIUS_BONUS = 20;
const RING_REF_SIZE = 28;        // размер обычного жука: по нему рисуем кольцо радиуса клика («Снайпер»)
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
const PERK_PICK_MS = 450;        // сколько показываем выбранную карточку, прежде чем вернуться в игру
const PERKS = [
  { id: 'sniper', icon: '🎯', name: 'Снайпер', max: 3, desc: 'Радиус клика +35%. Зона видна кольцом у курсора' },
  { id: 'backup', icon: '❤️', name: 'Бэкап', consumable: true, desc: 'Сразу +1 сердце', when: () => lives <= MAX_LIVES - 2 },
  { id: 'tests', icon: '🤖', name: 'Тест-покрытие', max: 3, desc: 'Сразу выпускает Автотест; он длится на 50% дольше и выпадает чаще' },
  { id: 'gold', icon: '🐝', name: 'Золотая жила', max: 3, desc: 'Золотых жуков вдвое больше, бонус за них +2. Один сразу на поле' },
  { id: 'firewall', icon: '🛡️', name: 'Файрвол', consumable: true, desc: 'Щит на 4 прорыва прямо сейчас' },
  { id: 'slow', icon: '🧊', name: 'Охлаждение', max: 3, desc: 'Все баги медленнее на 10%. Плюс заморозка на 4 с сразу' },
  { id: 'azart', icon: '🔥', name: 'Азарт+', max: 2, desc: 'Множитель серии включается раньше: на 2 попадания' },
  { id: 'sapper', icon: '💣', name: 'Сапёрка', max: 3, desc: 'Hotfix с радиусом +40% и бомбы выпадают чаще. Одна сразу на поле' },
  { id: 'points', icon: '🧮', name: 'Бонусные очки', max: 3, desc: '+15% очков за каждого устранённого бага' },
  // перки с ценой: сильные, но с минусом
  { id: 'debt', icon: '💸', name: 'Технический долг', max: 1, risky: true, desc: '+40% очков навсегда, но баги на 15% быстрее' },
  { id: 'rollback', icon: '⏪', name: 'Откат', consumable: true, risky: true, desc: 'Убирает всех багов на поле, но стоит сердце', when: () => lives > 2 },
];
const THREATS = new Set(['normal', 'splitter', 'golden', 'dasher', 'flaky', 'regression', 'leak', 'race', 'heisen']); // баги, за пролёт которых отнимается жизнь
const DASH_FROM = 0.3;             // с какой доли высоты паук делает рывок
const DASH_MUL = 2.6;
// что нового приносит волна (баннер при её начале)
const WAVE_NEWS = {
  2: 'новые жуки и бонусы', 3: 'делятся и приманки', 4: 'комары-зигзаг', 5: 'flaky-сверчки прыгают', 6: 'пауки: рывок',
  7: 'регрессия возвращается', 8: 'скорпионы: броня', 9: 'утечки памяти растут', 10: 'race condition и элита', 12: 'гейзенбаги',
};
// новые жуки поздних волн
const FLAKY_JUMP_MS = [1100, 1900];  // 🦗 как часто прыгает вбок
const REGRESSION_RISE = 0.35;        // 🐜 после смерти один раз возвращается выше на эту долю высоты
const LEAK_GROW_MS = 1800;           // 🦠 раз в столько растёт: +1 хп, крупнее и медленнее
const LEAK_MAX_HP = 4;
const RACE_WINDOW_MS = 1200;         // 🪰 второго из пары надо убить за это время, иначе первый воскресает
const RACE_BONUS = 6;
const HEISEN_RADIUS = 150;           // 👻 у курсора становится почти невидимым
const ELITE_FROM_WAVE = 10;          // элитные версии обычных жуков: +1 хп, ×2 очков, оранжевое свечение
const HINTS_KEY = 'bug-hunter-fullscreen:seen';
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
  friday: { icon: '🚀', name: 'Пятничный деплой', ms: 10000, color: '#ff5470', minWave: 4 },
  review: { icon: '👀', name: 'Код-ревью', ms: 8000, color: '#5be3a5' },
};
const FRIDAY_LIFT = 0.13;   // «Пятничный деплой»: на какую долю высоты поднимается прод-линия
const FRIDAY_RISE_S = 2.5;  // и за сколько секунд (плавно, чтобы успеть отреагировать)
const BANNER_MS = 2000;
const SPLAT_MS = 400;
const POPUP_MS = 700;
const MAX_BUGS = 40;
// «Завали Босса»: большой баг, который надо закликать, пока он ползёт к продакшену
const BOSS_EMOJI = '👾';
// типы боссов идут по кругу: классический, «Легаси-монолит» (броня из блоков), «Дедлайн» (таймер вместо спуска)
const BOSS_TYPES = [
  { id: 'classic', emoji: '👾', name: 'БАГ-БОСС', hpMul: 1 },
  { id: 'monolith', emoji: '🗿', name: 'ЛЕГАСИ-МОНОЛИТ', hpMul: 0.8, banner: 'Легаси-монолит: сначала разбей блоки!' },
  { id: 'deadline', emoji: '⏰', name: 'ДЕДЛАЙН', hpMul: 0.8, banner: 'Дедлайн: успей до конца таймера!' },
];
const MONOLITH_BLOCKS = 4;       // сколько блоков брони вокруг монолита
const MONOLITH_BLOCK_HP = 3;
const DEADLINE_S = 26;           // сколько секунд даёт «Дедлайн» (каждый следующий на 2 с меньше, не меньше 16)
const BOSS_FIRST_WAVE = 5;       // на какой волне появляется первый босс
const BOSS_EVERY_WAVES = 4;      // и дальше каждые столько волн (5, 9, 13…) — не зависит от набранных очков
// фазы босса по остатку здоровья: «Хаос» — телепорты с предупреждением, «Ярость» — быстрее спускается и чаще зовёт миньонов
const BOSS_PHASES = [
  { at: 1, name: '' },
  { at: 0.6, name: 'ХАОС', banner: 'Босс в хаосе: телепорты!', color: '#c792ff' },
  { at: 0.25, name: 'ЯРОСТЬ', banner: 'Босс в ярости!', color: '#ff3b3b' },
];
const BOSS_WARP_MS = 2600;       // «Хаос»: как часто босс телепортируется
const BOSS_WARP_WARN_MS = 650;   // за сколько до прыжка мигает и показывает точку назначения
const BOSS_RAGE_DESCENT = 1.6;   // «Ярость»: во столько раз быстрее ползёт к проду
const BOSS_RAGE_MINIONS = 0.55;  // и во столько раз короче пауза между миньонами
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
  { emoji: '🦗', points: 3, hp: 1, size: 30, minSpeed: 40, maxSpeed: 60, weight: 1.6, behavior: 'flaky', minWave: 5, ampMul: 0.3 },
  { emoji: '🐜', points: 3, hp: 1, size: 26, minSpeed: 45, maxSpeed: 65, weight: 1.5, behavior: 'regression', minWave: 7, glow: 'rgba(255, 255, 255, 0.5)' },
  { emoji: '🦠', points: 2, hp: 1, size: 24, minSpeed: 34, maxSpeed: 46, weight: 1.2, behavior: 'leak', minWave: 9, ampMul: 0.4 },
  { emoji: '🪰', points: 4, hp: 1, size: 26, minSpeed: 50, maxSpeed: 70, weight: 0.9, behavior: 'race', minWave: 10, glow: 'rgba(255, 255, 255, 0.55)' },
  { emoji: '👻', points: 5, hp: 1, size: 32, minSpeed: 38, maxSpeed: 55, weight: 1.1, behavior: 'heisen', minWave: 12 },
];

// подсказка при первой встрече с объектом (запоминается в браузере)
const HINTS = {
  '🪲': ['Жук-броненосец', 'Два попадания'],
  '🪳': ['Таракан', 'На смерти делится на двух мелких'],
  '🐝': ['Золотой баг', 'Бонус очков и пауза спавна'],
  '🐌': ['Приманка', 'Не трогай: клик снимает очки и рвёт серию'],
  '🧹': ['Рефакторинг', 'Чистит нижнюю половину поля и даёт сердце'],
  '🧊': ['Code freeze', 'Замедляет всех багов на 4 с'],
  '💣': ['Hotfix', 'Взрыв убирает багов вокруг'],
  '🤖': ['Автотест', 'Редкий бот: 6 с сам бьёт ближних багов'],
  '🦟': ['Комар', 'Летит широким зигзагом'],
  '🕷️': ['Паук', 'Ниже трети экрана делает рывок'],
  '🦂': ['Скорпион', 'Броня: четыре попадания'],
  '🦗': ['Flaky-сверчок', 'Время от времени прыгает вбок'],
  '🐜': ['Регрессия', 'После смерти один раз возвращается выше'],
  '🦠': ['Утечка памяти', 'Растёт: чем дольше живёт, тем крепче'],
  '🪰': ['Race condition', 'Пара: убей обоих почти одновременно, иначе первый воскреснет'],
  '👻': ['Гейзенбаг', 'Исчезает, когда на него смотришь: целься чуть издалека'],
  '🛡️': ['Щит', 'Гасит четыре прорыва'],
  '🔧': ['Патч', 'Чинит полсердца'],
  '👾': ['Баг-босс', 'Закликай до прода. С 60% хп телепортируется, с 25% звереет'],
  '🗿': ['Легаси-монолит', 'Сначала разбей вращающиеся блоки 🧱 — пока они целы, монолит неуязвим'],
  '⏰': ['Дедлайн', 'Не спускается, но тикает таймер: не успел — минус два сердца'],
};

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
let boss = null, bossesDefeated = 0, bossesMet = 0, shield = 0;
let ev = null, nextEventAt = EVENT_FIRST_AT_MS, lastEvent = null;
let autotestLeft = 0, autotestTimer = 0, autotestShots = [], autotestTick = 0, autotestSpan = AUTOTEST_MS, lastAutotestAt = -Infinity;
let botFinishing = false; // true, пока выстрел бота наносит урон боссу: так считаем «добил автотестом»
let perks = {}, perkPending = false, perkOpen = false, perkChoosing = false, perkChoices = [];

/* ---------- Задача дня: у всех на сутки один сид ---------- */
let mode = 'normal'; // 'normal' | 'daily' | 'weekly'
let dailyInfo = null; // ответ /api/daily: { date, modifier, top, me }
let weeklyInfo = null; // ответ /api/weekly: { week, endsAt, modifiers, top, me }
// три независимых потока случайности: набор жуков и события не зависят от того, сколько раз игрок кликнул
let rng = { spawn: Math.random, bug: Math.random, perk: Math.random };
/** Описание челленджа: задача дня (один мутатор) или неделя (два); null — обычная игра */
function challengeOf(kind) {
  if (kind === 'daily' && dailyInfo) { return { kind, key: dailyInfo.date, mods: [dailyInfo.modifier], me: dailyInfo.me, label: 'Задача дня', short: 'дня' }; }
  if (kind === 'weekly' && weeklyInfo) { return { kind, key: weeklyInfo.week, mods: weeklyInfo.modifiers, me: weeklyInfo.me, label: 'Челлендж недели', short: 'недели' }; }
  return null;
}
const challenge = () => challengeOf(mode);
const hasMod = (id) => { const c = challenge(); return !!c && c.mods.some((m) => m.id === id); };

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
let ptr = { x: 0, y: 0, at: 0, mouse: false, inside: false }; // последний указатель: для кольца «Снайпера»
let sniperPulseAt = 0;
let run = newRunStats(); // расширенная статистика партии для ачивок

function newRunStats() {
  // ключи `croc` и `crocAtOneLife` — часть формата /api/score и сохранённой статистики, относятся к бонусу «Рефакторинг» (раньше назывался иначе)
  return {
    livesLost: 0 /* в половинках сердца */, maxBombKills: 0, crocAtOneLife: false, bonuses: { golden: 0, bomb: 0, freeze: 0, croc: 0 },
    bossKills: 0, bossClean: 0, bossByBot: 0, autotestPicks: 0, autotestKills: 0, // для ачивок про босса и автотест
    waveScores: [], lastCause: null, // для итогов партии: счёт на конец каждой волны и кто последним прорвался
    timeline: [], // счёт раз в секунду: из лучшей попытки дня получается «призрак»
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
  bossPhase: () => { tone(90, 0.45, 'sawtooth', 0.15, 180); tone(440, 0.3, 'square', 0.07, 220, 0.15); },
  bossWarp: () => tone(1400, 0.14, 'sine', 0.07, 300),
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
  bossPhase: [50, 30, 90],
  bossWarp: 15,
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

let prodLift = 0;
const prodY = () => H - Math.max(36, 40 * S) - prodLift;

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
  if (k.behavior === 'golden') { return (1 + perkLv('gold')) * (hasMod('gold') ? 3 : 1); }
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
  const speedBoost = Math.min(SPEED_CAP, 1 + (wave - 1) * SPEED_STEP_PER_WAVE + inWave * SPEED_STEP_IN_WAVE) * 0.9 ** perkLv('slow') * (perkLv('debt') ? 1.15 : 1) * (hasMod('fast') ? 1.2 : 1);
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
  b.maxHp = b.hp;
  if (kind.behavior === 'flaky') { b.jumpIn = FLAKY_JUMP_MS[0] + Math.random() * (FLAKY_JUMP_MS[1] - FLAKY_JUMP_MS[0]); }
  if (kind.behavior === 'leak') { b.growIn = LEAK_GROW_MS; }
  showHint(kind.emoji);
  return b;
}

/** 🪰 пара в разных половинах поля, связанная общим pairId */
function spawnRacePair(kind) {
  if (bugs.length > MAX_BUGS - 2) { return; }
  const pairId = nextId;
  const half = W / 2;
  const a = spawnBug(kind, kind.size * S + rng.bug() * (half - kind.size * S * 2));
  const b = spawnBug(kind, half + kind.size * S + rng.bug() * (half - kind.size * S * 2));
  a.pairId = pairId; b.pairId = pairId;
  b.speed = a.speed; // летят вровень, чтобы было честно
}

/** Элита поздних волн: крепче, ценнее, светится */
function maybeElite(b) {
  if (!b || wave < ELITE_FROM_WAVE || !['normal', 'splitter', 'dasher'].includes(b.behavior)) { return; }
  if (rng.bug() >= Math.min(0.35, 0.15 + 0.02 * (wave - ELITE_FROM_WAVE))) { return; }
  b.elite = true;
  b.hp += 1; b.maxHp += 1;
  b.points *= 2;
  b.size *= 1.15;
}

/** Подсказка о новом объекте — один раз за всё время в этом браузере */
let seenHints = new Set();
try { seenHints = new Set(JSON.parse(localStorage.getItem(HINTS_KEY) || '[]')); } catch { /* ignore */ }
let hintQueue = [], hintAt = -Infinity;
const HINT_GAP_MS = 2500; // не больше одной подсказки за раз, остальные ждут очереди
function showHint(emoji) {
  if (!HINTS[emoji] || seenHints.has(emoji) || phase !== 'playing') { return; }
  seenHints.add(emoji);
  try { localStorage.setItem(HINTS_KEY, JSON.stringify([...seenHints])); } catch { /* ignore */ }
  hintQueue.push(emoji);
  flushHints();
}
function flushHints() {
  if (!hintQueue.length || fxClock - hintAt < HINT_GAP_MS) { return; }
  const emoji = hintQueue.shift();
  hintAt = fxClock;
  toast(emoji, ...HINTS[emoji]);
}

/** Поведение новых жуков: прыжки, рост, воскрешение пары */
function updateSpecialBug(b, ms) {
  if (b.behavior === 'flaky') {
    b.jumpIn -= ms;
    if (b.jumpIn <= 0) {
      b.jumpIn = FLAKY_JUMP_MS[0] + Math.random() * (FLAKY_JUMP_MS[1] - FLAKY_JUMP_MS[0]);
      const dir = b.baseX < W / 2 ? 1 : -1;
      burst(b.x, b.y, '#9aa4b5', 5);
      b.baseX = Math.max(b.size, Math.min(W - b.size, b.baseX + dir * (80 + Math.random() * 90) * S));
    }
  } else if (b.behavior === 'leak' && b.hp < LEAK_MAX_HP) {
    b.growIn -= ms;
    if (b.growIn <= 0) {
      b.growIn = LEAK_GROW_MS;
      b.hp += 1; b.maxHp += 1; b.points += 2;
      b.size *= 1.22;
      b.speed *= 0.88;
    }
  } else if (b.behavior === 'race' && b.racePending && elapsed > b.racePending.until) {
    const { x, y } = b.racePending; // не успел: пропущенный из пары воскресает
    b.racePending = null;
    if (bugs.length < MAX_BUGS) {
      const twin = spawnBug(b.kind, x, y);
      twin.pairId = b.pairId;
      twin.speed = b.speed;
      burst(x, y, '#ff5470', 8);
      addPopup(x, y - b.size, 'race!', '#ff5470');
    }
  }
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
  score = 0; combo = 0; bestCombo = 0; kills = 0; lives = hasMod('hearts') ? 6 : START_LIVES;
  elapsed = 0; spawnTimer = 0; freezeLeft = 0; boostLeft = 0; wave = 1; nextWaveAt = WAVE_EVERY_MS; lastRefactorAt = -Infinity;
  slowLeft = 0; countdownLeft = 0; sniperPulseAt = 0;
  boss = null; bossesDefeated = 0; bossesMet = 0; shield = 0;
  ev = null; nextEventAt = hasMod('storm') ? 12000 : EVENT_FIRST_AT_MS; lastEvent = null; prodLift = 0;
  autotestLeft = 0; autotestTimer = 0; autotestShots = []; autotestTick = 0; autotestSpan = AUTOTEST_MS; lastAutotestAt = -Infinity;
  perks = {}; perkPending = false; closePerks(); renderPerkStrip();
  hintQueue = []; hintAt = -Infinity;
  run = newRunStats();
  banner = null; shake = 0; flash = 0;
}

/** Челлендж стартует только при загруженной задаче; иначе — обычная игра */
function startGame(m = mode) {
  mode = challengeOf(m) ? m : 'normal';
  const ch = challenge();
  // сид недели отличается от сида дня даже при совпадении строк: у недели свой префикс
  if (ch) { seedRng(ch.kind === 'weekly' ? `week:${ch.key}` : ch.key); } else { rng = { spawn: Math.random, bug: Math.random, perk: Math.random }; }
  resetGame();
  loadGhost();
  phase = 'playing';
  overlay.hidden = true;
  summaryBox.hidden = true;
  el.saveStatus.hidden = true;
  hud.hidden = false;
  lastTs = performance.now();
  el.best.previousElementSibling.textContent = ch ? `Рекорд ${ch.short}` : 'Рекорд';
  if (ch) { showBanner(ch.mods.map((m) => `${m.icon} ${m.name}`).join(' + '), '#b8f04a'); }
  updateHud();
  renderChallenges();
  music.sync();
}

function endGame() {
  phase = 'over';
  music.sync();
  sfx.over();
  const ch = challenge();
  let isRecord;
  if (ch) {
    isRecord = score > challengeBest(ch);
    if (isRecord) { saveChallengeBest(ch, score); }
  } else {
    isRecord = score > best;
    if (isRecord) { best = score; saveBest(best); }
  }
  el.title.textContent = ch ? (isRecord ? `Рекорд ${ch.short}` : ch.label) : (isRecord ? 'Новый рекорд' : 'Игра окончена');
  el.text.textContent = ch
    ? `${ch.mods.map((m) => `${m.icon} ${m.name}`).join(' + ')}: релиз сорван, баги добрались до продакшена.`
    : 'Релиз сорван: баги добрались до продакшена.';
  el.stats.textContent = `Очки: ${score} · Убито: ${kills} · Лучшее комбо: ${bestCombo} · Волна: ${wave} · ${ch ? `Рекорд ${ch.short}` : 'Рекорд'}: ${ch ? challengeBest(ch) : best}`;
  el.start.textContent = 'Ещё раз';
  run.waveScores.push(score);
  renderSummary();
  overlay.hidden = false;
  updateHud();
  renderChallenges();
  submitResult(score, kills, Math.round(elapsed));
}

function setPaused(p) {
  if (p && perkOpen) { return; } // выбор перка и так останавливает игру
  if (p && phase === 'playing') {
    phase = 'paused';
    el.title.textContent = 'Пауза';
    el.text.textContent = 'Игра приостановлена.';
    el.stats.textContent = '';
    summaryBox.hidden = true;
    el.start.textContent = 'Продолжить';
    overlay.hidden = false;
    renderChallenges();
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

function loseLife(x = W / 2, cause = null) {
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
  if (cause) { run.lastCause = { emoji: cause, wave }; }
  breakCombo();
  shake = 0.35;
  flash = 0.35;
  sfx.life();
  updateHud();
  if (lives <= 0) { endGame(); }
}

const perkLv = (id) => perks[id] || 0;
const comboStep = () => Math.max(4, COMBO_MULT_STEP - 2 * perkLv('azart') - (hasMod('azart') ? 4 : 0));
const hitMul = () => 1 + 0.35 * perkLv('sniper');
const scoreMul = () => (1 + 0.15 * perkLv('points')) * (perkLv('debt') ? 1.4 : 1);

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
  const gain = Math.round((b.points + bonus) * mult * scoreMul()); // перки на очки множат после «Азарта»
  score += gain;
  if (gain > 0) { addPopup(b.x, b.y - b.size * 0.5, `+${gain}`, mult > 1 ? '#ffd166' : bonus > 0 ? '#ffd166' : BRAND); }

  if (b.behavior === 'regression' && !b.revived) { // регрессия: однажды возвращается выше
    const r = spawnBug(b.kind, b.x, Math.max(-b.size, b.y - H * REGRESSION_RISE));
    r.revived = true;
    addPopup(b.x, b.y + b.size * 0.6, 'регрессия!', '#ff9f43');
  }
  if (b.behavior === 'race') {
    const partner = bugs.find((x) => x.pairId === b.pairId);
    if (b.racePending) { // второй из пары успел: синхронно
      score += RACE_BONUS;
      addPopup(b.x, b.y - b.size, `синхронно! +${RACE_BONUS}`, '#ffd166');
    } else if (partner) {
      partner.racePending = { x: b.x, y: b.y, until: elapsed + RACE_WINDOW_MS };
    }
  }
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
  const types = Object.keys(EVENTS).filter((t) => t !== lastEvent && wave >= (EVENTS[t].minWave || 1));
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
  // прод-линия плавно поднимается на время «Пятничного деплоя» и так же плавно возвращается
  const lift = ev && ev.type === 'friday' ? H * FRIDAY_LIFT : 0;
  const step = (H * FRIDAY_LIFT * ms) / (FRIDAY_RISE_S * 1000);
  prodLift = prodLift < lift ? Math.min(lift, prodLift + step) : Math.max(lift, prodLift - step * 2);
  if (!ev && !boss && (wave >= 2 || hasMod('storm')) && elapsed >= nextEventAt) {
    startEvent();
    const gap = hasMod('storm') ? STORM_GAP_MS : EVENT_GAP_MS;
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
  const type = BOSS_TYPES[bossesMet % BOSS_TYPES.length];
  bossesMet += 1;
  const size = Math.max(BOSS_SIZE * S, 96); // на телефоне масштаб S мал — босс не должен стать крошечным
  const maxHp = Math.round((BOSS_HP_BASE + BOSS_HP_STEP * bossesDefeated) * type.hpMul);
  boss = {
    type: type.id, emoji: type.emoji, name: type.name,
    x: W / 2, y: -size, size, hp: maxHp, maxHp, phase: 0, flash: 0, stage: 0, warpTimer: BOSS_WARP_MS, warpTo: null,
    minionTimer: BOSS_MINION_MS * 0.5, dropTimer: BOSS_DROP_MS * 0.6, lostAtSpawn: run.livesLost,
    blocks: type.id === 'monolith' ? Array.from({ length: MONOLITH_BLOCKS }, () => ({ hp: MONOLITH_BLOCK_HP, flash: 0 })) : [],
    orbit: 0,
    timeLeft: type.id === 'deadline' ? Math.max(16, DEADLINE_S - 2 * bossesDefeated) : 0,
  };
  showBanner(type.banner ? `Волна ${wave}: ${type.banner}` : `Волна ${wave}: Завали Босса!`, '#ff5470');
  showHint(type.emoji);
  sfx.bossIn();
  shake = Math.max(shake, 0.25);
}

/** Где сейчас i-й блок брони монолита */
function blockPos(i) {
  const a = boss.orbit + (i * Math.PI * 2) / MONOLITH_BLOCKS;
  const r = boss.size * 0.78;
  return { x: boss.x + Math.cos(a) * r, y: boss.y + Math.sin(a) * r * 0.75, size: boss.size * 0.32 };
}

function blockHit(px, py) {
  if (!boss) { return -1; }
  for (let i = 0; i < boss.blocks.length; i++) {
    if (boss.blocks[i].hp <= 0) { continue; }
    const p = blockPos(i);
    const r = p.size * 0.7 + HIT_RADIUS_BONUS * S * hitMul();
    if ((px - p.x) ** 2 + (py - p.y) ** 2 <= r * r) { return i; }
  }
  return -1;
}

const armored = () => !!boss && boss.blocks.some((b) => b.hp > 0);

function damageBlock(i, n) {
  const blk = boss.blocks[i];
  const p = blockPos(i);
  blk.hp -= n;
  blk.flash = 0.15;
  burst(p.x, p.y, '#c9a27a', 6);
  if (blk.hp <= 0) {
    burst(p.x, p.y, '#c9a27a', 18);
    shake = Math.max(shake, 0.15);
    if (!armored()) { showBanner('Броня снята: бей монолит!', '#ffd166'); }
  }
}

function isBossWave(w) {
  return w >= BOSS_FIRST_WAVE && (w - BOSS_FIRST_WAVE) % BOSS_EVERY_WAVES === 0;
}

/** x босса для заданной фазы качания: по ней же считаем, куда он прыгнет в «Хаосе» */
function bossXAt(ph) {
  return W / 2 + Math.sin(ph) * (W / 2 - boss.size * 0.6) * 0.85;
}

function bossHit(px, py) {
  if (!boss) { return false; }
  const r = boss.size * 0.55 + HIT_RADIUS_BONUS * S * hitMul();
  return (px - boss.x) ** 2 + (py - boss.y) ** 2 <= r * r;
}

function damageBoss(n) {
  if (!boss) { return; }
  if (armored()) { // бомбы, рефакторинг и автотест сначала ломают броню монолита; лишний урон уходит в следующий блок
    while (n > 0 && armored()) {
      const i = boss.blocks.findIndex((b) => b.hp > 0);
      const d = Math.min(n, boss.blocks[i].hp);
      damageBlock(i, d);
      n -= d;
    }
    return;
  }
  boss.hp -= n;
  boss.flash = 0.15;
  burst(boss.x, boss.y, '#ff9f9f', 4 + n);
  if (boss.hp <= 0) { defeatBoss(); return; }
  while (boss.stage + 1 < BOSS_PHASES.length && boss.hp <= boss.maxHp * BOSS_PHASES[boss.stage + 1].at) { enterBossStage(boss.stage + 1); }
}

function enterBossStage(n) {
  const def = BOSS_PHASES[n];
  boss.stage = n;
  boss.warpTimer = BOSS_WARP_MS;
  boss.warpTo = null;
  showBanner(def.banner, def.color);
  burst(boss.x, boss.y, def.color, 30);
  shake = Math.max(shake, 0.4);
  flash = Math.max(flash, 0.25);
  sfx.bossPhase();
  const broken = boss.blocks.find((b) => b.hp <= 0);
  if (broken) { broken.hp = MONOLITH_BLOCK_HP; showBanner(`${def.banner} Блок брони вернулся`, def.color); }
  if (n === BOSS_PHASES.length - 1) { // «Ярость» начинается с залпа миньонов
    for (let i = 0; i < 3 && bugs.length < MAX_BUGS; i++) {
      spawnBug(BUG_KINDS[i], boss.x + (i - 1) * boss.size * 0.5, boss.y + boss.size * 0.4, false, 1.4);
    }
  }
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
  addPopup(x, y, `+${reward}`, '#ffd166');
  showBanner(`Босс повержен! +${reward}`, '#ffd166');
  shake = 0.6;
  flash = 0.5;
  sfx.bossDown();
}

/** «Хаос»: за BOSS_WARP_WARN_MS до прыжка выбираем точку (её видно кольцом), затем босс переносится туда */
function updateBossWarp(dt, pace) {
  if (boss.stage < 1 || boss.y <= 0) { return; }
  boss.warpTimer -= dt * 1000 * pace;
  if (boss.warpTo === null && boss.warpTimer <= BOSS_WARP_WARN_MS) {
    // прыжок на заметное расстояние: сдвиг фазы качания на 0.6π…1.4π (косметика, поэтому не из сидового rng)
    boss.warpTo = boss.phase + Math.PI * (0.6 + Math.random() * 0.8);
  }
  if (boss.warpTimer <= 0) {
    burst(boss.x, boss.y, BOSS_PHASES[1].color, 14);
    boss.phase = boss.warpTo;
    boss.x = bossXAt(boss.phase);
    boss.warpTo = null;
    boss.warpTimer = BOSS_WARP_MS;
    burst(boss.x, boss.y, BOSS_PHASES[1].color, 14);
    sfx.bossWarp();
  }
}

/** Возвращает false, если партия закончилась из-за прорыва босса */
function updateBoss(dt, pace) {
  const line = prodY();
  const topY = (W <= 560 ? 120 : 96) * S + boss.size * 0.5;
  const rage = boss.stage === BOSS_PHASES.length - 1;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.phase += dt * 0.9 * pace * (boss.stage >= 1 ? 1.35 : 1);
  if (boss.warpTo !== null) { boss.warpTo += dt * 0.9 * pace * 1.35; } // точка назначения едет вместе с качанием
  boss.x = bossXAt(boss.phase);
  boss.orbit += dt * 1.1 * pace;
  for (const blk of boss.blocks) { blk.flash = Math.max(0, blk.flash - dt); }
  if (boss.y < topY) {
    boss.y = Math.min(topY, boss.y + 170 * S * dt * pace); // выезжает сверху
  } else if (boss.type === 'deadline') { // не спускается: вместо этого тикает таймер (code freeze его тоже тормозит)
    boss.timeLeft -= dt * pace * (rage ? 1.5 : 1);
  } else {
    const descent = Math.max(25, BOSS_DESCENT_S - 3 * bossesDefeated);
    boss.y += ((line - topY) / descent) * dt * pace * (rage ? BOSS_RAGE_DESCENT : 1);
  }
  updateBossWarp(dt, pace);
  boss.dropTimer -= dt * 1000;
  if (boss.dropTimer <= 0 && boss.y > 0) {
    boss.dropTimer = BOSS_DROP_MS;
    if (bugs.length < MAX_BUGS) { spawnBug(pickDrop()); }
  }
  boss.minionTimer -= dt * 1000 * pace;
  if (boss.minionTimer <= 0 && boss.y > 0) {
    boss.minionTimer = Math.max(1100, BOSS_MINION_MS - 250 * bossesDefeated) * (rage ? BOSS_RAGE_MINIONS : 1);
    if (bugs.length < MAX_BUGS) { spawnBug(BUG_KINDS[Math.floor(rng.spawn() * 3)], boss.x, boss.y + boss.size * 0.4, false, 1.4); }
  }
  if (boss.y + boss.size * 0.35 >= line || (boss.type === 'deadline' && boss.timeLeft <= 0)) {
    const bx = boss.x;
    const what = boss.type === 'deadline' ? 'Дедлайн сорван' : 'Босс прорвался';
    const bossEmoji = boss.emoji;
    if (boss.type === 'deadline') { burst(bx, boss.y, '#ff5470', 40); }
    addSplat(bx, line);
    boss = null;
    if (shield >= BOSS_REACH_DAMAGE) { showBanner(`${what}, но щит выдержал!`, '#7fd8ff'); }
    else if (shield > 0) { showBanner(`${what}! Щит поглотил часть`, '#ff5470'); }
    else { showBanner(`${what}! −2 сердца`, '#ff5470'); }
    for (let i = 0; i < BOSS_REACH_DAMAGE; i++) {
      loseLife(bx, bossEmoji);
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
  const blk = target ? -1 : blockHit(px, py);
  if (blk >= 0) {
    score += 1;
    addPopup(px, py - 10 * S, '+1', '#c9a27a');
    sfx.crack();
    damageBlock(blk, 1);
    updateHud();
    return;
  }
  if (!target && bossHit(px, py) && armored()) { // по телу монолита в броне — не промах, но и не урон
    addPopup(px, py - 10 * S, 'броня', '#c9a27a');
    sfx.miss();
    return;
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
  if (!target && ev && ev.type === 'review') { // на ревью промах не считается
    addPopup(px, py, 'не считается', '#5be3a5');
    sfx.miss();
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

  while (run.timeline.length * 1000 <= elapsed) { run.timeline.push(score); }
  if (elapsed >= nextWaveAt) {
    run.waveScores.push(score);
    wave += 1;
    nextWaveAt += WAVE_EVERY_MS;
    boostLeft = WAVE_BOOST_MS;
    showBanner(`Волна ${wave}: ${WAVE_NEWS[wave] || 'баги ускоряются'}`, '#ff9f43');
    if (wave >= PERK_FIRST_WAVE && (wave - PERK_FIRST_WAVE) % PERK_EVERY === 0) { perkPending = true; }
    sfx.wave();
    if (isBossWave(wave) && !boss) { spawnBoss(); } // перк этой волны откроется после боя — как награда
  }
  if (perkPending && !boss) { // во время боя с боссом выбор откладывается до его конца
    perkPending = false;
    if (openPerks()) { return; }
  }
  boostLeft = Math.max(0, boostLeft - ms);
  slowLeft = Math.max(0, slowLeft - ms);
  const pace = slowLeft > 0 ? SLOW_FACTOR : 1;

  updateEvents(ms);
  updateAutotest(ms);
  flushHints();

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
      else {
        const k = pickKind();
        if (k.behavior === 'race') { spawnRacePair(k); } else { maybeElite(spawnBug(k)); }
      }
    }
    if (bugs.length >= MAX_BUGS) { spawnTimer = 0; }
  }

  const line = prodY();
  for (const b of bugs.slice()) {
    const dash = b.behavior === 'dasher' && b.y > H * DASH_FROM ? DASH_MUL : 1;
    b.y += b.speed * dt * pace * dash;
    updateSpecialBug(b, ms * pace);
    b.phase += dt * 2.2 * pace;
    b.x = b.baseX + Math.sin(b.phase) * b.amp;
    b.x = Math.max(b.size * 0.5, Math.min(W - b.size * 0.5, b.x));
    if (b.y >= line) {
      bugs = bugs.filter((x) => x.id !== b.id);
      if (THREATS.has(b.behavior)) {
        addSplat(b.x, line);
        loseLife(b.x, b.emoji);
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
  const sp = getSprite(boss.emoji, boss.size);
  const w = sp.width / DPR;
  const rage = boss.stage === BOSS_PHASES.length - 1;
  const pulse = 1 + (rage ? 0.07 : 0.04) * Math.sin(performance.now() / (rage ? 90 : 180));
  const stageColor = BOSS_PHASES[boss.stage].color || '#ff5470';
  if (boss.warpTo !== null) { // куда прыгнет: пунктирное кольцо, чтобы можно было навести заранее
    const t = Math.max(0, boss.warpTimer) / BOSS_WARP_WARN_MS;
    ctx.save();
    ctx.setLineDash([8 * S, 6 * S]);
    ctx.lineWidth = 3 * S;
    ctx.strokeStyle = stageColor;
    ctx.globalAlpha = 0.35 + 0.5 * (1 - t);
    ctx.beginPath();
    ctx.arc(bossXAt(boss.warpTo), boss.y, boss.size * (0.45 + 0.25 * t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(Math.sin(boss.phase * 2) * 0.1);
  ctx.scale(pulse, pulse);
  if (boss.warpTo !== null) { ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 60)); } // мигает перед прыжком
  ctx.shadowColor = boss.flash > 0 ? '#ffffff' : stageColor;
  ctx.shadowBlur = boss.flash > 0 ? 40 : (rage ? 36 : 24);
  ctx.drawImage(sp, -w / 2, -w / 2, w, w);
  ctx.restore();
  for (let i = 0; i < boss.blocks.length; i++) { // броня монолита
    const blk = boss.blocks[i];
    if (blk.hp <= 0) { continue; }
    const p = blockPos(i);
    const bs = getSprite('🧱', p.size);
    const bw = bs.width / DPR;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = blk.flash > 0 ? '#ffffff' : '#c9a27a';
    ctx.shadowBlur = blk.flash > 0 ? 24 : 10;
    ctx.drawImage(bs, -bw / 2, -bw / 2, bw, bw);
    ctx.restore();
    ctx.fillStyle = '#c9a27a';
    ctx.fillRect(p.x - p.size * 0.4, p.y - p.size * 0.75, p.size * 0.8 * (blk.hp / MONOLITH_BLOCK_HP), 3);
  }
  if (boss.type === 'deadline' && boss.y > 0) { // таймер прямо под циферблатом
    const t = Math.max(0, boss.timeLeft);
    ctx.font = `700 ${Math.round(18 * S + 6)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = t < 6 ? '#ff5470' : '#ffd166';
    ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, boss.x, boss.y + boss.size * 0.55);
  }
}

function drawBossBar() {
  if (!boss) { return; }
  // полоса встаёт в просвет между HUD слева и кнопками справа; если просвет узкий — под HUD на всю ширину
  // сам #hud растянут по ширине, поэтому меряем по карточкам (скрытые дают right = 0)
  const left = Math.max(...[...hud.children].map((c) => c.getBoundingClientRect().right)) + 16;
  const right = document.getElementById('tools').getBoundingClientRect().left - 16;
  const narrow = W < 600 || right - left < 240;
  const bw = narrow ? W - 24 : Math.min(420, right - left);
  const x = narrow ? 12 : left + (right - left - bw) / 2;
  const y = narrow ? Math.max(72, hud.getBoundingClientRect().bottom + 24) : 28;
  const def = BOSS_PHASES[boss.stage];
  const title = bossesMet > 1 ? `${boss.name} · ${bossesMet}` : boss.name;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 11px ${FONT_UI}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = def.color || '#ff9f9f';
  ctx.fillText(def.name ? `${title} · ${def.name}` : title, x, y - 7);
  ctx.textAlign = 'right';
  ctx.letterSpacing = '0px';
  const armor = boss.blocks.filter((b) => b.hp > 0).length;
  ctx.fillText(armor ? `🧱 ×${armor} · ${Math.max(0, boss.hp)} / ${boss.maxHp}` : `${Math.max(0, boss.hp)} / ${boss.maxHp}`, x + bw, y - 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x, y, bw, 10);
  ctx.fillStyle = boss.flash > 0 ? '#ffffff' : (def.color || '#ff5470');
  ctx.fillRect(x, y, bw * Math.max(0, boss.hp / boss.maxHp), 10);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.85)'; // метки порогов фаз
  for (const p of BOSS_PHASES.slice(1)) { ctx.fillRect(x + bw * p.at - 1, y - 2, 2, 14); }
}

function drawRaceLinks() {
  ctx.save();
  ctx.setLineDash([4 * S, 6 * S]);
  ctx.lineWidth = 1.5 * S;
  for (const b of bugs) {
    if (b.behavior !== 'race') { continue; }
    const p = bugs.find((x) => x !== b && x.pairId === b.pairId);
    if (p && b.id < p.id) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    if (b.racePending) { // таймер воскрешения пары
      const t = Math.max(0, (b.racePending.until - elapsed) / RACE_WINDOW_MS);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ff5470';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.size * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t); ctx.stroke();
      ctx.setLineDash([4 * S, 6 * S]);
    }
  }
  ctx.restore();
}

function drawBugs() {
  drawRaceLinks();
  for (const b of bugs) {
    const img = b.image ? getImage(b.image) : null;
    if (b.image && !img) { continue; }
    const sp = img ? null : getSprite(b.emoji, b.size);
    const wob = Math.sin(b.phase * 1.7) * 0.15;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(wob);
    if (b.behavior === 'heisen') { // гейзенбаг: чем ближе курсор, тем прозрачнее
      const d = ptr.inside ? Math.hypot(ptr.x - b.x, ptr.y - b.y) : Infinity;
      ctx.globalAlpha = d < HEISEN_RADIUS * S ? 0.08 + 0.5 * (d / (HEISEN_RADIUS * S)) ** 2 : 0.85;
    }
    if (b.elite) {
      ctx.shadowColor = '#ff9f43';
      ctx.shadowBlur = 20;
    } else if (b.behavior === 'golden') {
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
    if (b.maxHp > 1 && (b.hp < b.maxHp || b.behavior === 'leak')) {
      ctx.fillStyle = b.behavior === 'leak' ? '#c792ff' : '#ff5470';
      ctx.fillRect(b.x - b.size * 0.4, b.y - b.size * 0.8, b.size * 0.8 * (b.hp / b.maxHp), 3);
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
  drawSniperRing();
  drawBossBar();
  drawGhost();
  drawEventBar();
  drawBanner();
  drawCountdown();
  if (fx && flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Зона клика «Снайпера»: радиус, в котором клик попадает по обычному жуку */
function sniperRadius() { return (0.6 * RING_REF_SIZE + HIT_RADIUS_BONUS * hitMul()) * S; }
function ring(x, y, r, alpha, dashed) {
  ctx.save();
  ctx.setLineDash(dashed ? [6 * S, 5 * S] : []);
  ctx.lineWidth = 2 * S;
  ctx.fillStyle = `rgba(184, 240, 74, ${alpha * 0.1})`;
  ctx.strokeStyle = `rgba(184, 240, 74, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function drawSniperRing() {
  if (!perkLv('sniper') || perkOpen) { return; }
  const now = performance.now();
  const r = sniperRadius();
  if (phase === 'playing') {
    // мышь: кольцо следует за курсором; касание: вспыхивает в точке тапа и гаснет
    const a = ptr.mouse ? (ptr.inside ? 0.6 : 0) : Math.max(0, 1 - (now - ptr.at) / 450) * 0.8;
    if (a > 0) { ring(ptr.x, ptr.y, r, a, true); }
  }
  const t = (now - sniperPulseAt) / 1000; // при выборе перка: кольцо расходится от центра до нового радиуса
  if (sniperPulseAt && fx && t < 1) {
    const e = 1 - (1 - t) ** 3;
    ring(W / 2, H / 2, r * e, 1 - t, false);
    ring(W / 2, H / 2, r, 0.5 * (1 - t), true);
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
  const ch = challenge();
  el.best.textContent = Math.max(ch ? challengeBest(ch) : best, score);
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
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { ptr = { x: e.clientX, y: e.clientY, at: performance.now(), mouse: true, inside: true }; }
});
canvas.addEventListener('pointerleave', () => { ptr.inside = false; });
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ptr = { x: e.clientX, y: e.clientY, at: performance.now(), mouse: e.pointerType === 'mouse', inside: true };
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

/* ---------- Челленджи: задача дня и неделя, карточки на стартовом экране ---------- */
const chKey = (ch) => `bug-hunter-fullscreen:${ch.kind}:${ch.key}`;

/** Лучший результат челленджа: серверный (если вошли) или локальный, смотря что выше */
function challengeBest(ch) {
  if (!ch) { return 0; }
  let local = 0;
  try { local = Number(localStorage.getItem(chKey(ch))) || 0; } catch { /* ignore */ }
  return Math.max(ch.me ? ch.me.score : 0, local);
}
function saveChallengeBest(ch, v) {
  try {
    localStorage.setItem(chKey(ch), String(v));
    localStorage.setItem(`${chKey(ch)}:ghost`, JSON.stringify(run.timeline)); // «призрак» — ход лучшей попытки
  } catch { /* ignore */ }
}
const dailyBestToday = () => challengeBest(challengeOf('daily'));

/** Счёт лучшей попытки челленджа по секундам (только в этом браузере) */
let ghost = null;
function loadGhost() {
  ghost = null;
  const ch = challenge();
  if (!ch) { return; }
  try {
    const g = JSON.parse(localStorage.getItem(`${chKey(ch)}:ghost`) || 'null');
    if (Array.isArray(g) && g.length) { ghost = g; }
  } catch { /* ignore */ }
}

/** Опережение или отставание от призрака на этой же секунде */
function drawGhost() {
  if (!ghost || phase !== 'playing') { return; }
  const sec = Math.floor(elapsed / 1000);
  const past = sec >= ghost.length;
  const delta = score - ghost[Math.min(sec, ghost.length - 1)];
  const rect = hud.getBoundingClientRect();
  const who = `Призрак ${challenge().short}`;
  ctx.font = `700 13px ${FONT_UI}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = delta >= 0 ? BRAND : '#ff9f9f';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  const text = past ? `⏱️ ${who} закончил на ${ghost[ghost.length - 1]} · ${sign}${Math.abs(delta)}` : `⏱️ ${who}: ${sign}${Math.abs(delta)}`;
  ctx.fillText(text, 16, Math.max(rect.bottom, 60) + (W < 600 && boss ? 64 : 10));
}

async function loadDaily() {
  const [d, w] = await Promise.allSettled([api('/api/daily'), api('/api/weekly')]);
  dailyInfo = d.status === 'fulfilled' ? d.value : null; // нет сервера — без челленджей
  weeklyInfo = w.status === 'fulfilled' ? w.value : null;
  renderChallenges();
}

function leftText(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.max(0, Math.floor((ms % 86400000) / 3600000));
  const min = Math.max(0, Math.floor((ms % 3600000) / 60000));
  return d > 0 ? `${d} д ${h} ч` : `${h} ч ${min} мин`;
}

function renderChallenges() {
  const hide = phase === 'paused' || phase === 'playing';
  const dailyBox = document.getElementById('daily');
  dailyBox.hidden = !dailyInfo || hide;
  if (dailyInfo) {
    const m = dailyInfo.modifier;
    document.getElementById('daily-mod-ic').textContent = m.icon;
    document.getElementById('daily-mod-name').textContent = m.name;
    document.getElementById('daily-mod-desc').textContent = m.desc;
    const bestD = dailyBestToday();
    document.getElementById('daily-best').textContent = bestD ? `лучший ${bestD}` : 'не играли';
    document.getElementById('daily-left').textContent = `новая через ${leftText(Date.parse(`${dailyInfo.date}T00:00:00Z`) + 86400000 - Date.now())}`;
  }
  const weeklyBox = document.getElementById('weekly');
  weeklyBox.hidden = !weeklyInfo || hide;
  if (weeklyInfo) {
    document.getElementById('weekly-num').textContent = `№${weeklyInfo.week.split('-W')[1].replace(/^0/, '')}`;
    const [a, b] = weeklyInfo.modifiers;
    document.getElementById('weekly-mods').textContent = `${a.icon} ${a.name} + ${b.icon} ${b.name}`;
    document.getElementById('weekly-desc').textContent = `${a.desc}; ${b.desc.charAt(0).toLowerCase()}${b.desc.slice(1)}`;
    weeklyBox.title = `Челлендж недели: ${a.name} + ${b.name}`;
    const bestW = challengeBest(challengeOf('weekly'));
    document.getElementById('weekly-best').textContent = bestW ? `лучший ${bestW}` : 'не играли';
    document.getElementById('weekly-left').textContent = `до конца ${leftText(weeklyInfo.endsAt - Date.now())}`;
  }
}

// плитки режимов целиком — кнопки запуска
document.getElementById('daily').addEventListener('click', () => { if (phase !== 'playing') { startGame('daily'); } });
document.getElementById('weekly').addEventListener('click', () => { if (phase !== 'playing') { startGame('weekly'); } });

async function submitResult(finalScore, finalKills, durationMs) {
  if (!currentUser) { return; } // гостю об этом говорит строка «Играете как гость» со входом
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
      weekly: mode === 'weekly' && weeklyInfo ? weeklyInfo.week : undefined,
    });
    currentUser = data.user;
    renderUser();
    const ch = data.daily || data.weekly;
    el.saveStatus.textContent = ch
      ? `${data.daily ? 'Задача дня' : 'Челлендж недели'}: место ${ch.rank}${ch.isBest ? ' · новый лучший результат' : ''} · лучший ${ch.best}`
      : `Сохранено · всего убито: ${currentUser.totalKills}`;
    if (ch) { loadDaily(); }
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

function renderPerkStrip(popId) {
  if (!perkStrip) { return; }
  perkStrip.textContent = '';
  for (const p of PERKS) {
    const lv = perkLv(p.id);
    if (!lv) { continue; }
    const chip = document.createElement('span');
    chip.className = 'perk-chip';
    chip.title = `${p.name}: ${p.desc}`;
    chip.textContent = p.icon;
    if (p.id === popId) { chip.classList.add('pop'); }
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
  perkChoosing = false;
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
    lvl.textContent = (p.risky ? 'С подвохом · ' : '') + (p.consumable ? 'Разово' : `Ур. ${perkLv(p.id) + 1} из ${p.max}`);
    if (p.risky) { card.classList.add('risky'); }
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
  if (!perkOpen || perkChoosing) { return; }
  perkChoosing = true;
  if (p.id === 'backup') { lives = Math.min(MAX_LIVES, lives + 2); }
  else if (p.id === 'firewall') { addShield(SHIELD_CHARGES); }
  else if (p.id === 'rollback') { /* срабатывает в applyPerkNow, когда поле снова видно */ }
  else { perks[p.id] = perkLv(p.id) + 1; }
  sfx.fever();
  // сначала показываем, что выбрано: карточка подсвечивается, остальные гаснут
  document.querySelectorAll('#perk-cards .perk-card').forEach((card, i) => {
    card.classList.add(perkChoices[i] === p ? 'picked' : 'dim');
  });
  setTimeout(() => { if (perkChoosing) { finishPerk(p); } }, PERK_PICK_MS);
}

/** Перк должен быть заметен сразу, а не через минуту: что-то происходит на поле в момент выбора */
function dropBonus(behavior, x) {
  if (bugs.length >= MAX_BUGS) { return; }
  spawnBug(BUG_KINDS.find((k) => k.behavior === behavior), x);
}
function applyPerkNow(p) {
  if (p.id === 'tests' && !bugs.some((b) => b.behavior === 'autotest')) { dropBonus('autotest', W / 2); }
  else if (p.id === 'gold') { dropBonus('golden', W * 0.35); }
  else if (p.id === 'sapper') { dropBonus('bomb', W * 0.65); }
  else if (p.id === 'slow') { slowLeft = Math.max(slowLeft, SLOW_MS); }
  else if (p.id === 'sniper') { sniperPulseAt = performance.now(); }
  else if (p.id === 'rollback') {
    bugs.filter((b) => THREATS.has(b.behavior)).forEach((b) => killBug(b, true));
    lives -= 2; // ровно сердце; перк предлагается только при запасе больше сердца
    run.livesLost += 2;
    flash = Math.max(flash, 0.3);
    sfx.bomb();
  }
}

function finishPerk(p) {
  closePerks();
  countdownLeft = 1000; // секунда на то, чтобы собраться
  lastTickSec = 0;
  const lv = perkLv(p.id);
  showBanner(`${p.icon} ${p.name}${p.consumable ? '' : ` ×${lv}`}`, '#b8f04a');
  toast(p.icon, p.consumable ? p.name : `${p.name} · ур. ${lv} из ${p.max}`, p.desc);
  renderPerkStrip(p.id);
  applyPerkNow(p);
  updateHud();
  music.sync();
}

/* ---------- Итоги партии ---------- */
const summaryBox = document.getElementById('summary');
const CAUSE_NAMES = {
  '🐛': 'гусеница', '🐞': 'божья коровка', '🪲': 'жук', '🪳': 'таракан', '🐝': 'золотой баг', '🦟': 'комар', '🕷️': 'паук',
  '🦂': 'скорпион', '🦗': 'flaky-сверчок', '🐜': 'регрессия', '🦠': 'утечка памяти', '🪰': 'race condition', '👻': 'гейзенбаг',
  '👾': 'баг-босс', '🗿': 'легаси-монолит', '⏰': 'дедлайн',
};

/** Лучшие моменты партии — короткие плашки */
function runMoments() {
  const list = [];
  if (bestCombo >= 5) { list.push(`🔥 Серия ${bestCombo}`); }
  if (run.bossKills) { list.push(`👾 Боссов: ${run.bossKills}`); }
  if (run.maxBombKills >= 3) { list.push(`💣 ${run.maxBombKills} за один взрыв`); }
  if (run.autotestKills) { list.push(`🤖 Бот устранил ${run.autotestKills}`); }
  const gains = run.waveScores.map((v, i) => v - (run.waveScores[i - 1] || 0));
  const top = gains.indexOf(Math.max(...gains));
  if (gains.length > 1 && gains[top] > 0) { list.push(`📈 Лучшая волна: ${top + 1} (+${gains[top]})`); }
  return list;
}

/** График: счёт на конец каждой волны */
function drawScoreChart(c, pts, w, h, color = BRAND) {
  const g = c.getContext('2d');
  const max = Math.max(1, ...pts);
  const pad = 6;
  const xs = (i) => pad + (pts.length > 1 ? (i / (pts.length - 1)) * (w - pad * 2) : (w - pad * 2) / 2);
  const ys = (v) => h - pad - (v / max) * (h - pad * 2);
  g.lineWidth = Math.max(2, h / 40);
  g.lineJoin = 'round';
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(184, 240, 74, 0.35)');
  grad.addColorStop(1, 'rgba(184, 240, 74, 0)');
  g.beginPath();
  g.moveTo(xs(0), h - pad);
  pts.forEach((v, i) => g.lineTo(xs(i), ys(v)));
  g.lineTo(xs(pts.length - 1), h - pad);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.beginPath();
  pts.forEach((v, i) => (i ? g.lineTo(xs(i), ys(v)) : g.moveTo(xs(i), ys(v))));
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = color;
  pts.forEach((v, i) => { g.beginPath(); g.arc(xs(i), ys(v), g.lineWidth * 1.2, 0, Math.PI * 2); g.fill(); });
}

function renderSummary() {
  const cv = document.getElementById('summary-chart');
  const h = 84;
  summaryBox.hidden = false; // сначала показываем, чтобы у холста был размер
  const cw = cv.clientWidth || 360;
  cv.width = Math.round(cw * DPR);
  cv.height = Math.round(h * DPR);
  const g = cv.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, cw, h);
  drawScoreChart(cv, [0, ...run.waveScores], cw, h);
  const c = run.lastCause;
  document.getElementById('summary-cause').textContent = c
    ? `Последним прорвался ${c.emoji} ${CAUSE_NAMES[c.emoji] || 'баг'} на ${c.wave}-й волне`
    : '';
  const ul = document.getElementById('summary-moments');
  ul.textContent = '';
  for (const m of runMoments()) {
    const li = document.createElement('li');
    li.textContent = m;
    ul.append(li);
  }
}

/** Картинка 1200×630 для соцсетей и мессенджеров */
function makeShareCard() {
  const cw = 1200, ch = 630;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, '#0b0d12');
  bg.addColorStop(1, '#1a1222');
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  g.fillStyle = BRAND;
  g.font = `700 34px ${FONT_DISPLAY}`;
  g.textBaseline = 'top';
  g.fillText('🐛 Bug Hunter', 64, 56);
  g.fillStyle = '#9aa4b5';
  g.font = `600 26px ${FONT_UI}`;
  const chal = challenge();
  g.fillText(chal ? `${chal.label} · ${chal.key} · ${chal.mods.map((m) => `${m.icon} ${m.name}`).join(' + ')}` : 'Охота на багов перед релизом', 64, 108);
  g.fillStyle = '#ffffff';
  g.font = `700 120px ${FONT_DISPLAY}`;
  g.fillText(String(score), 64, 160);
  g.fillStyle = '#ffd166';
  g.font = `600 30px ${FONT_UI}`;
  g.fillText(`очков · волна ${wave} · убито ${kills} · серия ${bestCombo}`, 64, 300);
  const moments = runMoments().filter((m) => !m.startsWith('🔥')).slice(0, 3); // серия уже есть в строке выше
  g.fillStyle = '#e8ecf5';
  g.font = `500 26px ${FONT_UI}`;
  moments.forEach((m, i) => g.fillText(m, 64, 360 + i * 40));
  g.save();
  g.translate(64, 500);
  drawScoreChart(cv, [0, ...run.waveScores], cw - 128, 90);
  g.restore();
  return cv;
}

async function shareResult() {
  const text = `Bug Hunter: ${score} очков, волна ${wave}, серия ${bestCombo}`;
  const blob = await new Promise((r) => makeShareCard().toBlob(r, 'image/png'));
  const file = blob && new File([blob], 'bug-hunter.png', { type: 'image/png' });
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { return; }
  }
  if (blob) { // на десктопе — просто скачиваем картинку
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bug-hunter.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  try { await navigator.clipboard.writeText(text); toast('📋', 'Картинка сохранена', 'Текст результата скопирован в буфер'); } catch { toast('🖼️', 'Картинка сохранена', text); }
}
document.getElementById('btn-share').addEventListener('click', shareResult);

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

// офлайн-режим и установка как приложение (manifest.webmanifest + sw.js); без сервера (file://) не нужен
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* не критично */ }); });
}
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
