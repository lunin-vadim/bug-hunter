'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ach = require('../achievements');

const emptyRow = () => ({
  total_kills: 0, games_played: 0, best_kills_game: 0, best_combo: 0, best_wave: 1, stats: {},
});
const game = (over = {}) => ({
  kills: 10, durationMs: 20000,
  extra: { bestCombo: 3, wave: 1, livesLost: 2, maxBombKills: 0, crocAtOneLife: false, bonuses: { golden: 0, bomb: 0, freeze: 0, croc: 0 }, ...over },
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
