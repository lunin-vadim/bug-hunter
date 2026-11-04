'use strict';

/**
 * Каталог ачивок и титулов. Только чистые функции, без БД: их проверяют юнит-тесты.
 * `t` — накопленная статистика игрока ПОСЛЕ учёта партии, `g` — статистика этой партии.
 */
const ACHIEVEMENTS = [
  { code: 'first_blood', icon: '🩸', name: 'Первая кровь', desc: 'Устраните первого бага', progress: (t) => [t.totalKills, 1] },
  { code: 'kills_100', icon: '🔨', name: 'Сотня', desc: 'Устраните 100 багов за всё время', progress: (t) => [t.totalKills, 100] },
  { code: 'kills_1000', icon: '⚒️', name: 'Тысячник', desc: 'Устраните 1000 багов за всё время', progress: (t) => [t.totalKills, 1000] },
  { code: 'kills_10000', icon: '🏭', name: 'Баг-конвейер', desc: 'Устраните 10 000 багов за всё время', progress: (t) => [t.totalKills, 10000] },
  { code: 'single_50', icon: '🎯', name: 'Зачистка', desc: '50 багов за одну партию', progress: (t) => [t.bestKillsGame, 50] },
  { code: 'single_100', icon: '💯', name: 'Полная зачистка', desc: '100 багов за одну партию', progress: (t) => [t.bestKillsGame, 100] },
  { code: 'combo_10', icon: '🔥', name: 'В ударе', desc: 'Комбо ×10', progress: (t) => [t.bestCombo, 10] },
  { code: 'combo_25', icon: '⚡', name: 'На волне', desc: 'Комбо ×25', progress: (t) => [t.bestCombo, 25] },
  { code: 'combo_50', icon: '👑', name: 'Король комбо', desc: 'Комбо ×50', progress: (t) => [t.bestCombo, 50] },
  { code: 'wave_5', icon: '🌊', name: 'Пятая волна', desc: 'Доберитесь до 5-й волны', progress: (t) => [t.bestWave, 5] },
  { code: 'wave_10', icon: '🌋', name: 'Десятая волна', desc: 'Доберитесь до 10-й волны', progress: (t) => [t.bestWave, 10] },
  { code: 'golden_10', icon: '🐝', name: 'Золотая лихорадка', desc: 'Поймайте 10 золотых багов', progress: (t) => [t.golden, 10] },
  { code: 'bomb_master', icon: '💣', name: 'Сапёр', desc: 'Одним Hotfix устраните 8 багов', progress: (t) => [t.maxBombKills, 8] },
  { code: 'croc_save', icon: '🅰️', name: 'Альфа-Бонус', desc: 'Поймайте Альфа-Бонус на последней жизни', progress: (t) => [t.crocSaves, 1] },
  { code: 'flawless', icon: '🛡️', name: 'Безупречный', desc: 'Дойдите до 3-й волны, не потеряв ни одной жизни', progress: (t) => [t.flawless, 1] },
  { code: 'marathon', icon: '⏱️', name: 'Марафонец', desc: 'Продержитесь в одной партии 5 минут', progress: (t) => [Math.floor(t.longestGameMs / 1000), 300] },
  { code: 'games_10', icon: '🎮', name: 'Постоянный игрок', desc: 'Сыграйте 10 партий', progress: (t) => [t.gamesPlayed, 10] },
  { code: 'games_50', icon: '🕹️', name: 'Завсегдатай', desc: 'Сыграйте 50 партий', progress: (t) => [t.gamesPlayed, 50] },
];

/** Ранговые титулы по числу убитых багов за всё время */
const RANK_TITLES = [
  { code: 'rank_intern', name: 'Стажёр', minKills: 0 },
  { code: 'rank_junior', name: 'Джуниор', minKills: 100 },
  { code: 'rank_middle', name: 'Мидл', minKills: 500 },
  { code: 'rank_senior', name: 'Сеньор', minKills: 2000 },
  { code: 'rank_lead', name: 'Тимлид', minKills: 5000 },
  { code: 'rank_architect', name: 'Архитектор', minKills: 15000 },
];

/** Титулы за отдельные ачивки */
const ACHIEVEMENT_TITLES = [
  { code: 'title_combo', name: 'Король комбо', achievement: 'combo_50' },
  { code: 'title_sapper', name: 'Сапёр', achievement: 'bomb_master' },
  { code: 'title_immortal', name: 'Неубиваемый', achievement: 'flawless' },
  { code: 'title_marathon', name: 'Марафонец', achievement: 'marathon' },
  { code: 'title_golden', name: 'Золотоискатель', achievement: 'golden_10' },
];

const ACHIEVEMENT_CODES = new Set(ACHIEVEMENTS.map((a) => a.code));

/** Границы правдоподобия расширенной статистики партии. Это не защита от целенаправленной накрутки. */
const WAVE_MS = 30000;
// `croc` и `crocAtOneLife` — историческое имя Альфа-Бонуса в API и сохранённой статистике; не переименовываем без миграции
const BONUS_KEYS = ['golden', 'bomb', 'freeze', 'croc'];

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Возвращает нормализованную статистику партии или { error } */
function parseGameExtra(body, { kills, durationMs }) {
  const bestCombo = toInt(body?.bestCombo ?? 0);
  const wave = toInt(body?.wave ?? 1);
  const livesLost = toInt(body?.livesLost ?? 0);
  const maxBombKills = toInt(body?.maxBombKills ?? 0);
  const crocAtOneLife = body?.crocAtOneLife === true;
  const rawBonuses = body?.bonuses && typeof body.bonuses === 'object' ? body.bonuses : {};
  const bonuses = {};
  for (const key of BONUS_KEYS) {
    const n = toInt(rawBonuses[key] ?? 0);
    if (n === null || n > kills + 5) { return { error: 'Некорректная статистика бонусов' }; }
    bonuses[key] = n;
  }
  if ([bestCombo, wave, livesLost, maxBombKills].includes(null)) { return { error: 'Некорректная статистика партии' }; }
  if (bestCombo > kills) { return { error: 'Комбо не может превышать число убитых' }; }
  if (wave < 1 || wave > 1 + Math.floor(durationMs / WAVE_MS)) { return { error: 'Недостижимая волна' }; }
  if (maxBombKills > kills) { return { error: 'Некорректная статистика бомбы' }; }
  if (livesLost > 1000) { return { error: 'Некорректное число потерянных жизней' }; }
  if (crocAtOneLife && bonuses.croc < 1) { return { error: 'Некорректная статистика Альфа-Бонуса' }; }
  return { bestCombo, wave, livesLost, maxBombKills, crocAtOneLife, bonuses };
}

/** Складывает партию в плоскую накопленную статистику (результат `statsFromRow`). Вход не меняется. */
function applyGame(prev, game) {
  const { extra } = game;
  return {
    totalKills: prev.totalKills + game.kills,
    gamesPlayed: prev.gamesPlayed + 1,
    bestKillsGame: Math.max(prev.bestKillsGame, game.kills),
    bestCombo: Math.max(prev.bestCombo, extra.bestCombo),
    bestWave: Math.max(prev.bestWave, extra.wave),
    golden: prev.golden + extra.bonuses.golden,
    bombs: prev.bombs + extra.bonuses.bomb,
    freezes: prev.freezes + extra.bonuses.freeze,
    crocs: prev.crocs + extra.bonuses.croc,
    crocSaves: prev.crocSaves + (extra.crocAtOneLife ? 1 : 0),
    maxBombKills: Math.max(prev.maxBombKills, extra.maxBombKills),
    flawless: Math.max(prev.flawless, extra.livesLost === 0 && extra.wave >= 3 ? 1 : 0),
    longestGameMs: Math.max(prev.longestGameMs, game.durationMs),
  };
}

/** Часть накопленной статистики, которая лежит в JSONB-колонке `users.stats` */
function statsJson(t) {
  return {
    golden: t.golden, bombs: t.bombs, freezes: t.freezes, crocs: t.crocs, crocSaves: t.crocSaves,
    maxBombKills: t.maxBombKills, flawless: t.flawless, longestGameMs: t.longestGameMs,
  };
}

/** Читает статистику игрока из строки БД в плоский вид, который понимают `progress` и `evaluate` */
function statsFromRow(row) {
  const s = row.stats || {};
  return {
    totalKills: row.total_kills,
    gamesPlayed: row.games_played,
    bestKillsGame: row.best_kills_game,
    bestCombo: row.best_combo,
    bestWave: row.best_wave,
    golden: Number(s.golden) || 0,
    bombs: Number(s.bombs) || 0,
    freezes: Number(s.freezes) || 0,
    crocs: Number(s.crocs) || 0,
    crocSaves: Number(s.crocSaves) || 0,
    maxBombKills: Number(s.maxBombKills) || 0,
    flawless: Number(s.flawless) || 0,
    longestGameMs: Number(s.longestGameMs) || 0,
  };
}

const isDone = (a, t) => { const [cur, goal] = a.progress(t); return cur >= goal; };

/** Коды ачивок, которые выполнены при статистике `t`, но ещё не получены (`unlocked` — Set кодов) */
function evaluate(t, unlocked = new Set()) {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.code) && isDone(a, t)).map((a) => a.code);
}

/** Прогресс по всем ачивкам для кабинета */
function achievementList(t, unlockedAt = new Map()) {
  return ACHIEVEMENTS.map((a) => {
    const [cur, goal] = a.progress(t);
    return {
      code: a.code, icon: a.icon, name: a.name, desc: a.desc,
      current: Math.min(cur, goal), goal,
      unlockedAt: unlockedAt.get(a.code) || null,
    };
  });
}

function rankTitle(totalKills) {
  let best = RANK_TITLES[0];
  for (const r of RANK_TITLES) { if (totalKills >= r.minKills) { best = r; } }
  return best;
}

/** Все титулы, доступные игроку: ранговые до его уровня + за полученные ачивки */
function availableTitles(totalKills, unlocked) {
  const ranks = RANK_TITLES.filter((r) => totalKills >= r.minKills).map((r) => ({ code: r.code, name: r.name, kind: 'rank' }));
  const special = ACHIEVEMENT_TITLES.filter((t) => unlocked.has(t.achievement)).map((t) => ({ code: t.code, name: t.name, kind: 'achievement' }));
  return [...ranks, ...special];
}

/** Название титула, который показывается рядом с именем: выбранный, если он доступен, иначе лучший ранговый */
function activeTitle(chosenCode, totalKills, unlocked) {
  const list = availableTitles(totalKills, unlocked);
  const chosen = chosenCode && list.find((t) => t.code === chosenCode);
  if (chosen) { return chosen; }
  const r = rankTitle(totalKills);
  return { code: r.code, name: r.name, kind: 'rank' };
}

module.exports = {
  ACHIEVEMENTS, ACHIEVEMENT_CODES, RANK_TITLES, ACHIEVEMENT_TITLES,
  parseGameExtra, applyGame, statsJson, statsFromRow, evaluate, achievementList,
  rankTitle, availableTitles, activeTitle,
};
