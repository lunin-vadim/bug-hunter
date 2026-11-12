'use strict';

/**
 * Задача дня: у всех игроков в течение суток (по UTC) одна последовательность жуков и событий
 * и один мутатор. Чистые функции без БД: их проверяют юнит-тесты.
 */
const MODIFIERS = [
  { id: 'fast', icon: '⚡', name: 'Спринт', desc: 'Баги быстрее на 20%' },
  { id: 'hearts', icon: '💔', name: 'Хрупкий прод', desc: 'Старт с 3 сердцами вместо 5' },
  { id: 'storm', icon: '🌪️', name: 'Шторм', desc: 'События идут одно за другим' },
  { id: 'gold', icon: '🐝', name: 'Золотой день', desc: 'Золотых жуков втрое больше' },
  { id: 'azart', icon: '🔥', name: 'Горячая серия', desc: 'Множитель «Азарт» включается на 4 попадания раньше' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Дата задачи (YYYY-MM-DD) по UTC: на ней сервер и клиент сходятся независимо от часового пояса */
const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);

const isDateString = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** FNV-1a: одинаковый результат на сервере и в браузере */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Мутатор дня выбирается по дате, поэтому одинаков для всех */
const modifierFor = (date) => MODIFIERS[hashString(date) % MODIFIERS.length];

/* ---------- Недельный челлендж: одна неделя (ISO 8601, по UTC), два мутатора сразу ---------- */

/** Неделя вида 2026-W46: четверг недели определяет её год */
function isoWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // понедельник = 1 … воскресенье = 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Когда кончается текущая неделя: ближайшая полночь понедельника по UTC (мс) */
function weekEndsAt(now = new Date()) {
  const day = now.getUTCDay() || 7;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 8 - day);
}

/** Два разных мутатора на неделю: выбор по хешу недели, одинаковый для всех */
function weeklyModifiersFor(week) {
  const h = hashString(`week:${week}`);
  const n = MODIFIERS.length;
  const i = h % n;
  const j = (i + 1 + (Math.floor(h / n) % (n - 1))) % n;
  return [MODIFIERS[i], MODIFIERS[j]];
}

module.exports = { MODIFIERS, todayUTC, isDateString, hashString, modifierFor, isoWeek, weekEndsAt, weeklyModifiersFor };
