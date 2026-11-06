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

module.exports = { MODIFIERS, todayUTC, isDateString, hashString, modifierFor };
