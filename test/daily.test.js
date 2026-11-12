'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const daily = require('../daily');

test('todayUTC: дата по UTC, а не по местному времени', () => {
  assert.equal(daily.todayUTC(new Date('2026-11-06T23:59:59Z')), '2026-11-06');
  assert.equal(daily.todayUTC(new Date('2026-11-07T00:00:00Z')), '2026-11-07');
});

test('isDateString: принимает только настоящие даты', () => {
  assert.ok(daily.isDateString('2026-11-06'));
  assert.ok(!daily.isDateString('2026-13-40'));
  assert.ok(!daily.isDateString('06.11.2026'));
  assert.ok(!daily.isDateString(20261106));
  assert.ok(!daily.isDateString(null));
});

test('hashString: детерминирован и различает даты', () => {
  assert.equal(daily.hashString('2026-11-06'), daily.hashString('2026-11-06'));
  assert.notEqual(daily.hashString('2026-11-06'), daily.hashString('2026-11-07'));
  assert.ok(Number.isInteger(daily.hashString('x')) && daily.hashString('x') >= 0);
});

test('modifierFor: один мутатор на дату, все мутаторы достижимы', () => {
  assert.equal(daily.modifierFor('2026-11-06').id, daily.modifierFor('2026-11-06').id);
  const seen = new Set();
  for (let d = 1; d <= 28; d++) { seen.add(daily.modifierFor(`2026-02-${String(d).padStart(2, '0')}`).id); }
  assert.equal(seen.size, daily.MODIFIERS.length, 'за месяц встречаются все мутаторы');
  for (const m of daily.MODIFIERS) { assert.ok(m.id && m.icon && m.name && m.desc); }
});

test('isoWeek: неделя по ISO 8601 и UTC', () => {
  assert.equal(daily.isoWeek(new Date('2026-11-12T12:00:00Z')), '2026-W46');
  assert.equal(daily.isoWeek(new Date('2026-11-15T23:59:59Z')), '2026-W46', 'воскресенье — ещё та же неделя');
  assert.equal(daily.isoWeek(new Date('2026-11-16T00:00:00Z')), '2026-W47', 'понедельник — новая');
  assert.equal(daily.isoWeek(new Date('2027-01-01T00:00:00Z')), '2026-W53', 'начало января может относиться к прошлому году');
  assert.equal(daily.isoWeek(new Date('2024-12-30T00:00:00Z')), '2025-W01', 'конец декабря может относиться к следующему');
});

test('weekEndsAt: конец недели — полночь понедельника по UTC', () => {
  assert.equal(new Date(daily.weekEndsAt(new Date('2026-11-12T12:00:00Z'))).toISOString(), '2026-11-16T00:00:00.000Z');
});

test('weeklyModifiersFor: два разных мутатора, стабильно для недели', () => {
  const a = daily.weeklyModifiersFor('2026-W46');
  assert.equal(a.length, 2);
  assert.notEqual(a[0].id, a[1].id);
  assert.deepEqual(a.map((m) => m.id), daily.weeklyModifiersFor('2026-W46').map((m) => m.id));
  const seen = new Set();
  for (let w = 1; w <= 52; w++) { daily.weeklyModifiersFor(`2026-W${String(w).padStart(2, '0')}`).forEach((m) => seen.add(m.id)); }
  assert.equal(seen.size, daily.MODIFIERS.length, 'за год встречаются все мутаторы');
});
