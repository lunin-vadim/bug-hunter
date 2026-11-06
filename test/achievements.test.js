'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ach = require('../achievements');

const emptyRow = () => ({
  total_kills: 0, games_played: 0, best_kills_game: 0, best_combo: 0, best_wave: 1, stats: {},
});
const game = (over = {}) => ({
  kills: 10, durationMs: 20000,
  extra: {
    bestCombo: 3, wave: 1, livesLost: 2, maxBombKills: 0, crocAtOneLife: false, bonuses: { golden: 0, bomb: 0, freeze: 0, croc: 0 },
    bossKills: 0, bossClean: 0, bossByBot: 0, autotestPicks: 0, autotestKills: 0, ...over,
  },
});

test('каталог: коды уникальны, у каждой ачивки есть прогресс', () => {
  const codes = ach.ACHIEVEMENTS.map((a) => a.code);
  assert.equal(new Set(codes).size, codes.length);
  const stats = ach.statsFromRow(emptyRow());
  for (const a of ach.ACHIEVEMENTS) {
    const [cur, goal] = a.progress(stats);
    assert.ok(Number.isFinite(cur) && goal > 0, a.code);
  }
});

test('новый игрок не имеет ачивок', () => {
  assert.deepEqual(ach.evaluate(ach.statsFromRow(emptyRow())), []);
});

test('первая партия открывает «Первую кровь»', () => {
  const next = ach.applyGame(ach.statsFromRow(emptyRow()), game());
  assert.deepEqual(ach.evaluate(next), ['first_blood']);
});

test('уже полученные ачивки не выдаются повторно', () => {
  const next = ach.applyGame(ach.statsFromRow(emptyRow()), game());
  assert.deepEqual(ach.evaluate(next, new Set(['first_blood'])), []);
});

test('пороги: сотня убийств и зачистка за партию', () => {
  const row = { ...emptyRow(), total_kills: 95, games_played: 3 };
  const next = ach.applyGame(ach.statsFromRow(row), { ...game({ bestCombo: 10 }), kills: 60, durationMs: 30000 });
  const done = ach.evaluate(next);
  assert.ok(done.includes('kills_100'));
  assert.ok(done.includes('single_50'));
  assert.ok(done.includes('combo_10'));
  assert.ok(!done.includes('single_100'));
});

test('«Безупречный»: волна ≥3 без потери жизни', () => {
  const clean = ach.applyGame(ach.statsFromRow(emptyRow()), { ...game({ wave: 3, livesLost: 0 }), durationMs: 70000 });
  assert.ok(ach.evaluate(clean).includes('flawless'));
  const dirty = ach.applyGame(ach.statsFromRow(emptyRow()), { ...game({ wave: 3, livesLost: 1 }), durationMs: 70000 });
  assert.ok(!ach.evaluate(dirty).includes('flawless'));
});

test('максимумы не уменьшаются, суммы накапливаются', () => {
  const first = ach.applyGame(ach.statsFromRow(emptyRow()), game({ bestCombo: 9, bonuses: { golden: 2, bomb: 0, freeze: 0, croc: 0 } }));
  const row = { total_kills: first.totalKills, games_played: first.gamesPlayed, best_kills_game: first.bestKillsGame, best_combo: first.bestCombo, best_wave: first.bestWave, stats: ach.statsJson(first) };
  const second = ach.applyGame(ach.statsFromRow(row), { ...game({ bestCombo: 2, bonuses: { golden: 3, bomb: 0, freeze: 0, croc: 0 } }), kills: 4 });
  assert.equal(second.bestCombo, 9);
  assert.equal(second.bestKillsGame, 10);
  assert.equal(second.golden, 5);
  assert.equal(second.totalKills, 14);
  assert.equal(second.gamesPlayed, 2);
});

test('applyGame не изменяет входную статистику', () => {
  const prev = ach.statsFromRow(emptyRow());
  const snapshot = JSON.stringify(prev);
  ach.applyGame(prev, game());
  assert.equal(JSON.stringify(prev), snapshot);
});

test('ранговые титулы по числу убитых', () => {
  assert.equal(ach.rankTitle(0).name, 'Стажёр');
  assert.equal(ach.rankTitle(99).name, 'Стажёр');
  assert.equal(ach.rankTitle(100).name, 'Джуниор');
  assert.equal(ach.rankTitle(2000).name, 'Сеньор');
  assert.equal(ach.rankTitle(1e6).name, 'Архитектор');
});

test('титулы за ачивки доступны только после получения', () => {
  assert.ok(!ach.availableTitles(0, new Set()).some((t) => t.code === 'title_sapper'));
  assert.ok(ach.availableTitles(0, new Set(['bomb_master'])).some((t) => t.code === 'title_sapper'));
});

test('activeTitle: недоступный выбранный титул заменяется ранговым', () => {
  assert.equal(ach.activeTitle('title_sapper', 150, new Set()).code, 'rank_junior');
  assert.equal(ach.activeTitle('title_sapper', 150, new Set(['bomb_master'])).code, 'title_sapper');
  assert.equal(ach.activeTitle(null, 0, new Set()).code, 'rank_intern');
});

test('parseGameExtra: допустимая статистика проходит', () => {
  const r = ach.parseGameExtra({ bestCombo: 5, wave: 2, livesLost: 1, maxBombKills: 3, bonuses: { golden: 1 } }, { kills: 30, durationMs: 45000 });
  assert.equal(r.error, undefined);
  assert.equal(r.bestCombo, 5);
  assert.equal(r.bonuses.golden, 1);
  assert.equal(r.bonuses.bomb, 0);
});

test('parseGameExtra: отсутствующая статистика — значения по умолчанию', () => {
  const r = ach.parseGameExtra({}, { kills: 10, durationMs: 10000 });
  assert.equal(r.error, undefined);
  assert.equal(r.wave, 1);
});

test('parseGameExtra: отклоняет недостижимые значения', () => {
  const ctx = { kills: 20, durationMs: 40000 };
  assert.ok(ach.parseGameExtra({ bestCombo: 21 }, ctx).error, 'комбо больше убитых');
  assert.ok(ach.parseGameExtra({ wave: 3 }, ctx).error, 'волна 3 за 40 секунд невозможна');
  assert.ok(ach.parseGameExtra({ wave: 0 }, ctx).error, 'волна 0');
  assert.ok(ach.parseGameExtra({ maxBombKills: 21 }, ctx).error, 'бомба убила больше, чем всего убито');
  assert.ok(ach.parseGameExtra({ bonuses: { golden: 999 } }, ctx).error, 'слишком много бонусов');
  assert.ok(ach.parseGameExtra({ bestCombo: -1 }, ctx).error, 'отрицательное');
  assert.ok(ach.parseGameExtra({ bestCombo: 1.5 }, ctx).error, 'дробное');
  assert.ok(ach.parseGameExtra({ crocAtOneLife: true }, ctx).error, 'Альфа-Бонус на последней жизни без самого бонуса');
});

/* ---------- Ранги: значки, прогресс, награды ---------- */
// те же 24 аватара, что и в profile.js; тест ловит рассинхрон каталога наград и списка профиля
const PROFILE_AVATARS = [
  '🐛', '🐞', '🪲', '🪳', '🐝', '🐌', '🐊', '🦎', '🕷️', '🦂', '🦋', '🐜',
  '🦗', '🤖', '👾', '💻', '🧑‍💻', '🦖', '🐙', '🦊', '🐱', '🐼', '🚀', '⭐',
];

test('награды: у каждого ранга есть значок, цвет и набор наград', () => {
  assert.equal(ach.RANK_UNLOCKS.length, ach.RANK_TITLES.length);
  for (const r of ach.RANK_TITLES) {
    assert.ok(r.icon && /^#[0-9a-f]{6}$/i.test(r.color), `значок и цвет у ${r.name}`);
  }
});

test('награды: каждый аватар профиля открывается ровно на одном ранге', () => {
  const all = ach.RANK_UNLOCKS.flatMap((u) => u.avatars);
  assert.equal(new Set(all).size, all.length, 'аватар не должен повторяться');
  assert.deepEqual([...all].sort(), [...PROFILE_AVATARS].sort());
});

test('награды: новичку открыт базовый набор, свой цвет — только с Сеньора', () => {
  assert.ok(ach.isAvatarAllowed('🐛', 0));
  assert.ok(!ach.isAvatarAllowed('🚀', 0));
  assert.ok(ach.isAvatarAllowed('🚀', 15000));
  assert.ok(ach.isColorAllowed('#35c4ff', 0));
  assert.ok(!ach.isColorAllowed('#c792ea', 99), 'цвет Джуниора закрыт до 100 убитых');
  assert.ok(ach.isColorAllowed('#C792EA', 100), 'регистр не важен');
  assert.ok(!ach.isColorAllowed('#123456', 1999), 'произвольный цвет закрыт');
  assert.ok(ach.isColorAllowed('#123456', 2000), 'произвольный цвет с Сеньора');
});

test('награды: открытое сохраняется при повышении ранга (набор только растёт)', () => {
  let prev = 0;
  for (const r of ach.RANK_TITLES) {
    const n = ach.unlockedFor(r.minKills).avatars.length;
    assert.ok(n > prev, `на ранге ${r.name} открываются новые аватары`);
    prev = n;
  }
  assert.equal(prev, PROFILE_AVATARS.length);
});

test('rankProgress: прогресс считается внутри текущего ранга', () => {
  assert.equal(ach.rankProgress(0).ratio, 0);
  assert.equal(ach.rankProgress(50).ratio, 0.5);
  const mid = ach.rankProgress(600);
  assert.equal(mid.floor, 500);
  assert.equal(mid.remaining, 1400);
  assert.ok(Math.abs(mid.ratio - 100 / 1500) < 1e-9, 'не 600/2000');
  assert.equal(mid.next.name, 'Сеньор');
  const top = ach.rankProgress(20000);
  assert.deepEqual([top.ratio, top.remaining, top.next], [1, 0, null]);
});

test('tierInfo и rankLadder: уровень, текущий ранг и достигнутые', () => {
  assert.equal(ach.tierInfo(0).level, 0);
  assert.equal(ach.tierInfo(500).name, 'Мидл');
  const ladder = ach.rankLadder(600);
  assert.deepEqual(ladder.map((r) => r.reached), [true, true, true, false, false, false]);
  assert.equal(ladder.filter((r) => r.current).length, 1);
  assert.equal(ladder.find((r) => r.current).name, 'Мидл');
});

/* ---------- Босс и автотест ---------- */
test('parseGameExtra: боссы и автотест — значения по умолчанию нулевые', () => {
  const r = ach.parseGameExtra({}, { kills: 10, durationMs: 10000 });
  assert.deepEqual([r.bossKills, r.bossClean, r.bossByBot, r.autotestPicks, r.autotestKills], [0, 0, 0, 0, 0]);
});

test('parseGameExtra: правдоподобные боссы и автотесты принимаются', () => {
  const ctx = { kills: 200, durationMs: 120000 };
  const r = ach.parseGameExtra({ bossKills: 2, bossClean: 1, bossByBot: 1, autotestPicks: 3, autotestKills: 40 }, ctx);
  assert.ok(!r.error, r.error);
  assert.deepEqual([r.bossKills, r.bossClean, r.bossByBot, r.autotestPicks, r.autotestKills], [2, 1, 1, 3, 40]);
});

test('parseGameExtra: отклоняет невозможные боссы и автотесты', () => {
  const ctx = { kills: 100, durationMs: 60000 };
  assert.ok(ach.parseGameExtra({ bossKills: 3 }, ctx).error, 'три босса за минуту');
  assert.ok(ach.parseGameExtra({ bossKills: 1, bossClean: 2 }, ctx).error, 'чистых побед больше побед');
  assert.ok(ach.parseGameExtra({ bossKills: 1, bossByBot: 2 }, ctx).error, 'побед от бота больше побед');
  assert.ok(ach.parseGameExtra({ bossKills: 2 }, { kills: 1, durationMs: 120000 }).error, 'боссов больше, чем убитых');
  assert.ok(ach.parseGameExtra({ autotestPicks: 6 }, ctx).error, 'автотестов слишком много для минуты');
  assert.ok(ach.parseGameExtra({ autotestKills: 5 }, ctx).error, 'убитые автотестом без подобранного автотеста');
  assert.ok(ach.parseGameExtra({ autotestPicks: 1, autotestKills: 101 }, ctx).error, 'автотест убил больше, чем убито всего');
  assert.ok(ach.parseGameExtra({ bossKills: -1 }, ctx).error, 'отрицательное');
  assert.ok(ach.parseGameExtra({ autotestPicks: 1.5 }, ctx).error, 'дробное');
});

test('applyGame: статистика боссов и автотеста копится, рекорд по боссам за партию — максимум', () => {
  const a = ach.applyGame(ach.statsFromRow(emptyRow()), { ...game({ bossKills: 2, bossClean: 1, bossByBot: 1, autotestPicks: 2, autotestKills: 15 }), durationMs: 120000 });
  const b = ach.applyGame(a, { ...game({ bossKills: 1, bossClean: 0, bossByBot: 0, autotestPicks: 1, autotestKills: 10 }), durationMs: 60000 });
  assert.deepEqual([b.bossKills, b.bossClean, b.bossByBot, b.maxBossesGame, b.autotestPicks, b.autotestKills], [3, 1, 1, 2, 3, 25]);
});

test('ачивки за босса и автотест открываются по порогам', () => {
  const base = ach.statsFromRow(emptyRow());
  const has = (t, code) => ach.evaluate(t).includes(code);
  assert.ok(!has(base, 'boss_first') && !has(base, 'autotest_first'));
  assert.ok(has({ ...base, bossKills: 1 }, 'boss_first'));
  assert.ok(!has({ ...base, bossKills: 4 }, 'boss_5') && has({ ...base, bossKills: 5 }, 'boss_5'));
  assert.ok(!has({ ...base, maxBossesGame: 1 }, 'boss_double') && has({ ...base, maxBossesGame: 2 }, 'boss_double'));
  assert.ok(has({ ...base, bossClean: 1 }, 'boss_clean'));
  assert.ok(has({ ...base, bossByBot: 1 }, 'boss_bot'));
  assert.ok(has({ ...base, autotestPicks: 1 }, 'autotest_first'));
  assert.ok(!has({ ...base, autotestPicks: 4 }, 'autotest_5') && has({ ...base, autotestPicks: 5 }, 'autotest_5'));
  assert.ok(!has({ ...base, autotestKills: 49 }, 'autotest_50') && has({ ...base, autotestKills: 50 }, 'autotest_50'));
});

test('статистика без новых полей (старые игроки) читается нулями и сохраняется через statsJson', () => {
  const t = ach.statsFromRow({ ...emptyRow(), stats: { golden: 3 } });
  assert.deepEqual([t.bossKills, t.autotestPicks, t.maxBossesGame], [0, 0, 0]);
  const back = ach.statsFromRow({ ...emptyRow(), stats: ach.statsJson({ ...t, bossKills: 4, autotestKills: 12 }) });
  assert.deepEqual([back.bossKills, back.autotestKills], [4, 12]);
});

test('титулы за боссов и QA открываются вместе с ачивками', () => {
  assert.ok(!ach.availableTitles(0, new Set()).some((x) => x.code === 'title_boss'));
  assert.ok(ach.availableTitles(0, new Set(['boss_5'])).some((x) => x.code === 'title_boss'));
  assert.ok(ach.availableTitles(0, new Set(['autotest_5'])).some((x) => x.code === 'title_qa'));
});

test('каталог ачивок: коды и значки не повторяются', () => {
  const codes = ach.ACHIEVEMENTS.map((x) => x.code);
  const icons = ach.ACHIEVEMENTS.map((x) => x.icon);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(icons).size, icons.length);
});
