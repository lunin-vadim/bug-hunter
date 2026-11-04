'use strict';

/* ---------- Константы баланса ---------- */
const START_LIVES = 5;
const MAX_LIVES = 5;
const HIT_RADIUS_BONUS = 20;
const GOLDEN_BONUS = 5;
const GOLDEN_FREEZE_MS = 2500;
const ALFA_BONUS = 10;
const ALFA_FREEZE_MS = 1500;
const ALFA_IMAGE = 'assets/alfa-bonus.png';
const DECOY_PENALTY = 2;
const WAVE_EVERY_MS = 30000;
const WAVE_BOOST_MS = 4000;
const SLOW_MS = 4000;
const SLOW_FACTOR = 0.4;
const BOMB_RADIUS = 150;
const RESUME_COUNTDOWN_MS = 3000;
const COMBO_MILESTONES = [5, 10, 15, 25, 40];
const BANNER_MS = 2000;
const SPLAT_MS = 400;
const POPUP_MS = 700;
const MAX_BUGS = 40;
const STORAGE_KEY = 'bug-hunter-fullscreen:best';
const FX_KEY = 'bug-hunter-fullscreen:fx';

const BUG_KINDS = [
  { emoji: '🐛', points: 1, hp: 1, size: 28, minSpeed: 32, maxSpeed: 55, weight: 6, behavior: 'normal' },
  { emoji: '🐞', points: 2, hp: 1, size: 24, minSpeed: 65, maxSpeed: 95, weight: 3, behavior: 'normal' },
  { emoji: '🪲', points: 3, hp: 2, size: 36, minSpeed: 22, maxSpeed: 36, weight: 2, behavior: 'normal' },
  { emoji: '🪳', points: 4, hp: 2, size: 32, minSpeed: 45, maxSpeed: 70, weight: 2, behavior: 'splitter' },
  { emoji: '🐝', points: 6, hp: 1, size: 28, minSpeed: 45, maxSpeed: 65, weight: 1, behavior: 'golden' },
  { emoji: '🐌', points: 0, hp: 1, size: 26, minSpeed: 40, maxSpeed: 65, weight: 1.2, behavior: 'decoy' },
  { emoji: '', image: ALFA_IMAGE, points: 0, hp: 1, size: 50, minSpeed: 38, maxSpeed: 55, weight: 0.6, behavior: 'alfa' },
  { emoji: '🧊', points: 0, hp: 1, size: 30, minSpeed: 40, maxSpeed: 60, weight: 0.7, behavior: 'freeze' },
  { emoji: '💣', points: 0, hp: 1, size: 30, minSpeed: 40, maxSpeed: 60, weight: 0.7, behavior: 'bomb' },
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
let phase = 'idle'; // idle | playing | paused | over
let bugs = [], splats = [], popups = [], particles = [];
let score = 0, combo = 0, bestCombo = 0, kills = 0, lives = START_LIVES;
let best = loadBest();
let nextId = 1;
let elapsed = 0, spawnTimer = 0, freezeLeft = 0, boostLeft = 0, wave = 1, nextWaveAt = WAVE_EVERY_MS;
let banner = null; // { text, color, left }
let shake = 0, flash = 0;
let slowLeft = 0, countdownLeft = 0, lastTickSec = 0;
let run = newRunStats(); // расширенная статистика партии для ачивок

function newRunStats() {
  // ключи `croc` и `crocAtOneLife` — часть формата /api/score и сохранённой статистики, относятся к Альфа-Бонусу
  return { livesLost: 0, maxBombKills: 0, crocAtOneLife: false, bonuses: { golden: 0, bomb: 0, freeze: 0, croc: 0 } };
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

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (muted) { return; }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) { osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); }
    gain.gain.setValueAtTime(vol, t0);
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
  alfa: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, null, i * 0.09)); },
  wave: () => tone(330, 0.25, 'sine', 0.1, 660),
  freeze: () => { tone(1200, 0.25, 'sine', 0.09, 500); tone(900, 0.3, 'triangle', 0.07, 400, 0.1); },
  bomb: () => { tone(120, 0.35, 'sawtooth', 0.16, 40); tone(240, 0.2, 'square', 0.08, 60, 0.02); },
  tick: () => tone(700, 0.07, 'sine', 0.06),
  over: () => { tone(330, 0.3, 'sawtooth', 0.12, 110); tone(165, 0.5, 'sawtooth', 0.12, 55, 0.25); },
};

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

/* ---------- Спрайты-картинки (бонус Альфа-Бонус) ---------- */
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
getImage(ALFA_IMAGE); // прогреваем кэш до первого появления бонуса

/* ---------- Спавн ---------- */
function pickKind() {
  const total = BUG_KINDS.reduce((s, k) => s + k.weight, 0);
  let r = Math.random() * total;
  for (const k of BUG_KINDS) {
    r -= k.weight;
    if (r <= 0) { return k; }
  }
  return BUG_KINDS[0];
}

function spawnBug(kind, x, y, canSplit = true, speedMul = 1) {
  const speedBoost = 1 + Math.min(0.6, (wave - 1) * 0.07);
  bugs.push({
    id: nextId++,
    kind,
    emoji: kind.emoji,
    image: kind.image || null,
    behavior: kind.behavior,
    x: x ?? (kind.size * S + Math.random() * (W - kind.size * S * 2)),
    y: y ?? -kind.size * S,
    speed: (kind.minSpeed + Math.random() * (kind.maxSpeed - kind.minSpeed)) * S * speedBoost * speedMul,
    hp: kind.hp,
    points: kind.points,
    size: kind.size * S,
    phase: Math.random() * Math.PI * 2,
    amp: (10 + Math.random() * 25) * S,
    baseX: 0,
    canSplit: kind.behavior === 'splitter' && canSplit,
  });
  const b = bugs[bugs.length - 1];
  b.baseX = b.x;
}

/** Интервал спавна ужимается с 1700 до 600 мс за первые 150 секунд, плюс буст при смене волны */
function spawnInterval() {
  const progress = Math.min(1, elapsed / 150000);
  let iv = 1700 - 1100 * progress;
  if (boostLeft > 0) { iv *= 0.75; }
  return iv;
}

/* ---------- Эффекты ---------- */
function addPopup(x, y, text, color) { popups.push({ x, y, text, color, born: performance.now() }); }
function addSplat(x, y) { splats.push({ x, y, born: performance.now() }); }
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
  score = 0; combo = 0; bestCombo = 0; kills = 0; lives = START_LIVES;
  elapsed = 0; spawnTimer = 0; freezeLeft = 0; boostLeft = 0; wave = 1; nextWaveAt = WAVE_EVERY_MS;
  slowLeft = 0; countdownLeft = 0;
  run = newRunStats();
  banner = null; shake = 0; flash = 0;
}

function startGame() {
  resetGame();
  phase = 'playing';
  overlay.hidden = true;
  el.saveStatus.hidden = true;
  hud.hidden = false;
  lastTs = performance.now();
  updateHud();
}

function endGame() {
  phase = 'over';
  sfx.over();
  const isRecord = score > best;
  if (isRecord) { best = score; saveBest(best); }
  el.title.textContent = isRecord ? 'Новый рекорд' : 'Игра окончена';
  el.text.textContent = 'Релиз сорван: баги добрались до продакшена.';
  el.help.hidden = true;
  el.stats.textContent = `Очки: ${score} · Убито: ${kills} · Лучшее комбо: ${bestCombo} · Волна: ${wave} · Рекорд: ${best}`;
  el.start.textContent = 'Ещё раз';
  overlay.hidden = false;
  updateHud();
  submitResult(score, kills, Math.round(elapsed));
}

function setPaused(p) {
  if (p && phase === 'playing') {
    phase = 'paused';
    el.title.textContent = 'Пауза';
    el.text.textContent = 'Игра приостановлена.';
    el.help.hidden = true;
    el.stats.textContent = '';
    el.start.textContent = 'Продолжить';
    overlay.hidden = false;
  } else if (!p && phase === 'paused') {
    phase = 'playing';
    overlay.hidden = true;
    countdownLeft = RESUME_COUNTDOWN_MS;
    lastTickSec = 0;
    lastTs = performance.now();
  }
}

function loseLife() {
  lives -= 1;
  run.livesLost += 1;
  combo = 0;
  shake = 0.35;
  flash = 0.35;
  sfx.life();
  updateHud();
  if (lives <= 0) { endGame(); }
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
  burst(b.x, b.y, b.behavior === 'golden' ? '#ffd166' : '#8bd450', 8);
  kills += 1;
  const bonus = massKill ? 0 : comboBonus(combo);
  const gain = b.points + bonus;
  score += gain;
  if (gain > 0) { addPopup(b.x, b.y - b.size * 0.5, `+${gain}`, bonus > 0 ? '#ffd166' : '#8bd450'); }

  if (b.canSplit && !massKill) {
    for (const dx of [-1, 1]) {
      const kid = { ...BUG_KINDS[0], emoji: '🐛', points: 1, hp: 1, size: 20, behavior: 'normal' };
      spawnBug(kid, b.x + dx * 24 * S, b.y, false, 1.2);
    }
  }
}

function eatEverything() {
  run.bonuses.croc += 1;
  if (lives === 1) { run.crocAtOneLife = true; }
  const victims = bugs.filter((b) => b.behavior !== 'alfa');
  victims.forEach((b) => killBug(b, true));
  bugs = [];
  freezeLeft = Math.max(freezeLeft, ALFA_FREEZE_MS);
  if (lives < MAX_LIVES) { lives += 1; }
  score += ALFA_BONUS;
  flash = 0.25;
  sfx.alfa();
  showBanner('Альфа-Бонус! +1 жизнь', '#ff5a4d');
}

function activateFreeze(b) {
  run.bonuses.freeze += 1;
  slowLeft = SLOW_MS;
  burst(b.x, b.y, '#7fd8ff', 14);
  sfx.freeze();
  showBanner('Code freeze: баги замедлены', '#7fd8ff');
}

function detonate(b) {
  const r = BOMB_RADIUS * S;
  const victims = bugs.filter((v) => v.behavior !== 'alfa' && (v.x - b.x) ** 2 + (v.y - b.y) ** 2 <= r * r);
  let bombKills = 0;
  run.bonuses.bomb += 1;
  for (const v of victims) {
    if (v.behavior === 'normal' || v.behavior === 'splitter' || v.behavior === 'golden') {
      killBug(v, true);
      bombKills += 1;
    } else {
      bugs = bugs.filter((x) => x.id !== v.id);
      burst(v.x, v.y, '#ffb347', 6);
    }
  }
  run.maxBombKills = Math.max(run.maxBombKills, bombKills);
  burst(b.x, b.y, '#ffb347', 36);
  shake = Math.max(shake, 0.3);
  sfx.bomb();
  showBanner(victims.length ? `Hotfix: устранено ${victims.length}` : 'Hotfix: пусто', '#ffb347');
}

function handleClick(px, py) {
  if (phase !== 'playing' || countdownLeft > 0) { return; }
  // выбираем верхнего (последнего нарисованного) жука под курсором
  let target = null;
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i];
    const r = b.size * 0.6 + HIT_RADIUS_BONUS * S;
    if ((px - b.x) ** 2 + (py - b.y) ** 2 <= r * r) { target = b; break; }
  }
  if (!target) {
    combo = 0;
    sfx.miss();
    updateHud();
    return;
  }
  if (target.behavior === 'decoy') {
    bugs = bugs.filter((x) => x.id !== target.id);
    score = Math.max(0, score - DECOY_PENALTY);
    combo = 0;
    addPopup(target.x, target.y, `-${DECOY_PENALTY}`, '#ff5470');
    burst(target.x, target.y, '#ff5470', 8);
    sfx.decoy();
  } else if (target.behavior === 'alfa') {
    bugs = bugs.filter((x) => x.id !== target.id);
    eatEverything();
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
      if (COMBO_MILESTONES.includes(combo)) { showBanner(`Комбо ×${combo}`, '#ffd166'); }
      if (target.behavior === 'golden') {
        run.bonuses.golden += 1;
        score += GOLDEN_BONUS;
        freezeLeft = Math.max(freezeLeft, GOLDEN_FREEZE_MS);
        addPopup(target.x, target.y - target.size, `+${GOLDEN_BONUS} ★`, '#ffd166');
        showBanner('🐝 Золотой баг! Пауза спавна', '#ffd166');
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
    showBanner(`Волна ${wave}: баги ускоряются`, '#ff9f43');
    sfx.wave();
  }
  boostLeft = Math.max(0, boostLeft - ms);
  slowLeft = Math.max(0, slowLeft - ms);
  const pace = slowLeft > 0 ? SLOW_FACTOR : 1;

  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - ms);
  } else {
    spawnTimer += ms;
    const iv = spawnInterval();
    while (spawnTimer >= iv && bugs.length < MAX_BUGS) {
      spawnTimer -= iv;
      spawnBug(pickKind());
    }
    if (bugs.length >= MAX_BUGS) { spawnTimer = 0; }
  }

  const line = prodY();
  for (const b of bugs.slice()) {
    b.y += b.speed * dt * pace;
    b.phase += dt * 2.2 * pace;
    b.x = b.baseX + Math.sin(b.phase) * b.amp;
    b.x = Math.max(b.size * 0.5, Math.min(W - b.size * 0.5, b.x));
    if (b.y >= line) {
      bugs = bugs.filter((x) => x.id !== b.id);
      if (b.behavior === 'normal' || b.behavior === 'splitter' || b.behavior === 'golden') {
        addSplat(b.x, line);
        loseLife();
        if (phase !== 'playing') { return; }
      }
    }
  }

  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * S * dt; p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  const now = performance.now();
  splats = splats.filter((s) => now - s.born < SPLAT_MS);
  popups = popups.filter((p) => now - p.born < POPUP_MS);
  if (banner) { banner.left -= ms; if (banner.left <= 0) { banner = null; } }
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt);
  updateHud();
}

/* ---------- Отрисовка ---------- */
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0f1a');
  g.addColorStop(1, '#1a1030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(120, 150, 255, 0.06)';
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
  const danger = lives === 1 ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0;
  ctx.fillStyle = `rgba(255, 60, 90, ${0.1 + danger * 0.12})`;
  ctx.fillRect(0, y, W, H - y);
  ctx.strokeStyle = '#ff5470';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 9]);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 120, 140, 0.9)';
  ctx.font = `700 ${Math.round(14 * S)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRODUCTION', W / 2, y + (H - y) / 2);
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
    } else if (b.behavior === 'alfa') {
      ctx.shadowColor = '#ef3124';
      ctx.shadowBlur = 20;
    }
    if (img) {
      const h = b.size * 1.15;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      const w = sp.width / DPR;
      ctx.drawImage(sp, -w / 2, -w / 2, w, w);
    }
    ctx.restore();
    if (b.kind.hp > 1 && b.hp < b.kind.hp) {
      ctx.fillStyle = '#ff5470';
      ctx.fillRect(b.x - b.size * 0.4, b.y - b.size * 0.8, b.size * 0.8 * (b.hp / b.kind.hp), 3);
    }
  }
}

function drawEffects() {
  const now = performance.now();
  for (const s of splats) {
    const t = (now - s.born) / SPLAT_MS;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = '#8bd450';
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
  ctx.font = `800 ${Math.round(20 * S)}px system-ui, sans-serif`;
  for (const p of popups) {
    const t = (now - p.born) / POPUP_MS;
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
  ctx.font = `800 ${Math.round(32 * S)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 12;
  ctx.fillText(banner.text, W / 2, H * 0.22);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
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
  ctx.fillStyle = 'rgba(5, 8, 16, .45)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = `800 ${Math.round(120 * S)}px system-ui, sans-serif`;
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
  drawBugs();
  drawEffects();
  drawSlowTint();
  ctx.restore();
  drawBanner();
  drawCountdown();
  if (fx && flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- HUD ---------- */
function updateHud() {
  el.score.textContent = score;
  el.combo.textContent = combo;
  el.lives.textContent = '●'.repeat(Math.max(0, lives)) + '○'.repeat(Math.max(0, MAX_LIVES - lives));
  el.best.textContent = Math.max(best, score);
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
    if (countdownLeft > 0) { countdownLeft -= dt * 1000; } else { update(dt); }
  }
  render();
  syncPauseButton();
  requestAnimationFrame(frame);
}

/* ---------- Ввод и системные кнопки ---------- */
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleClick(e.clientX, e.clientY);
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
function toggleFx() {
  fx = !fx;
  el.fx.classList.toggle('off', !fx);
  el.fx.setAttribute('aria-pressed', String(fx));
  try { localStorage.setItem(FX_KEY, fx ? '1' : '0'); } catch { /* ignore */ }
}
function primaryAction() {
  if (phase === 'paused') { setPaused(false); } else if (phase !== 'playing') { startGame(); }
}

el.start.addEventListener('click', primaryAction);
el.full.addEventListener('click', toggleFullscreen);
el.sound.addEventListener('click', toggleSound);
el.fx.addEventListener('click', toggleFx);
el.pause.addEventListener('click', onPauseButton);
document.addEventListener('keydown', (e) => {
  if (e.repeat || document.body.dataset.panel || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) { return; }
  const k = e.key.toLowerCase();
  if (k === 'f' || k === 'а') { toggleFullscreen(); }
  else if (k === 'm' || k === 'ь') { toggleSound(); }
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
      bestCombo, wave, livesLost: run.livesLost, bonuses: run.bonuses,
      maxBombKills: run.maxBombKills, crocAtOneLife: run.crocAtOneLife,
    });
    currentUser = data.user;
    renderUser();
    el.saveStatus.textContent = `Сохранено · всего убито: ${currentUser.totalKills}`;
    if (data.newRank) { toast('🎖️', 'Новый ранг', data.newRank); }
    for (const a of data.newAchievements || []) { toast(a.icon, `Ачивка: ${a.name}`, a.desc); }
  } catch (e) {
    el.saveStatus.textContent = `Результат не сохранён: ${e.message}`;
  }
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
  box.append(node);
  setTimeout(() => node.remove(), 5200);
}

el.authForm.addEventListener('submit', (e) => { e.preventDefault(); authSubmit('login'); });
el.btnRegister.addEventListener('click', () => authSubmit('register'));
el.logout.addEventListener('click', async () => {
  try { await api('/api/logout', {}); } catch { /* ignore */ }
  currentUser = null;
  renderUser();
});

/* ---------- Старт ---------- */
loadSession();
el.sound.classList.toggle('off', muted);
el.sound.setAttribute('aria-pressed', String(muted));
el.fx.classList.toggle('off', !fx);
el.fx.setAttribute('aria-pressed', String(fx));
el.stats.textContent = best ? `Рекорд: ${best}` : '';
resize();
updateHud();
requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
