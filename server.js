'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const ach = require('./achievements');
const createProfileRouter = require('./profile');
const dailyMod = require('./daily');

const PORT = Number(process.env.PORT) || 3131;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://bughunter:bughunter@localhost:5433/bughunter';
// Без JWT_SECRET в .env секрет случайный на запуск: сессии не переживут рестарт, но дыры нет
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me'
  ? process.env.JWT_SECRET
  : crypto.randomBytes(32).toString('hex');
const COOKIE = 'bh_token';
const TOKEN_TTL_S = 60 * 60 * 24 * 30;

/** Ограничения на отправку партии: серверу нельзя верить клиенту, поэтому режем явную накрутку */
const MIN_GAME_MS = 8000;
const MAX_KILLS_PER_SEC = 12;
// на одно убийство: до 8 очков за скорпиона + бонус серии 3, всё это ×3 за «Азарт»; запас на золото и боссов
const MAX_SCORE_PER_KILL = 40;
const MAX_KILLS_BASE = 60; // запас на массовые убийства (Рефакторинг, Hotfix)

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 5, // у Prisma Postgres Free всего 10 пул-соединений
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // при перегрузке БД запрос падает с ошибкой, а не висит бесконечно
});
// ошибка простаивающего соединения (рестарт или обслуживание БД) не должна ронять процесс
pool.on('error', (e) => console.error('PostgreSQL: ошибка простаивающего соединения:', e.message));

/** Кэш общих рейтингов: топ-20 не пересчитывается на каждый запрос (у Prisma Postgres Free 200 тыс. запросов в месяц).
 * Своё место игрок видит сразу (оно считается отдельно), а сам топ обновляется раз в BOARD_CACHE_MS */
const BOARD_CACHE_MS = 30000;
const boardCache = new Map();
async function cached(key, load) {
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_CACHE_MS) { return hit.value; }
  const value = await load();
  boardCache.set(key, { at: Date.now(), value });
  return value;
}
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  });
  next();
});
app.use(express.json({ limit: '4kb' }));
app.use(cookieParser());

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Слишком много попыток, попробуйте позже' } });

/** Поля пользователя, которые нужны почти везде (без password_hash) */
const USER_COLS = `id, username, total_kills, best_score, games_played, avatar, color, status, bio, title,
  best_kills_game, best_combo, best_wave, stats, token_version, username_changed_at`;

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, JWT_SECRET, { expiresIn: TOKEN_TTL_S });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: TOKEN_TTL_S * 1000 });
}

/** Кэш строк пользователей: сессия проверяется на каждом /api-запросе, а в БД ходим не чаще раза в USER_CACHE_MS.
 * Свои изменения (партия, кабинет) обновляют или сбрасывают запись сразу */
const USER_CACHE_MS = 60000;
const userCache = new Map();
async function userRow(id) {
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_CACHE_MS) { return hit.row; }
  const { rows } = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  if (userCache.size > 5000) { userCache.clear(); } // память ограничена: на бесплатном инстансе 512 МБ
  userCache.set(id, { at: Date.now(), row: rows[0] || null });
  return rows[0] || null;
}

async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies[COOKIE];
  if (token) {
    try {
      const { sub, v } = jwt.verify(token, JWT_SECRET);
      const row = await userRow(sub);
      // токены без `v` считаем версией 0; смена пароля увеличивает token_version и гасит старые сессии
      req.user = row && (v ?? 0) === row.token_version ? row : null;
    } catch { /* протухший или чужой токен — считаем гостем */ }
  }
  next();
}
// для проверки здоровья Render (каждые несколько секунд): без запроса к БД, чтобы не тратить её квоту
app.get('/livez', (_req, res) => res.json({ status: 'ok' }));
// ручная проверка с базой
app.get('/healthz', asyncH(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.use('/api', loadUser);

const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Нужно войти в аккаунт' }));

/** Достижения выводятся из накопленной статистики, поэтому титул считается без запроса в БД */
const unlockedOf = (u) => new Set(ach.evaluate(ach.statsFromRow(u)));
const titleOf = (u) => ach.activeTitle(u.title, u.total_kills, unlockedOf(u));

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  totalKills: u.total_kills,
  bestScore: u.best_score,
  gamesPlayed: u.games_played,
  bestKillsGame: u.best_kills_game,
  avatar: u.avatar,
  color: u.color,
  status: u.status,
  title: titleOf(u).name,
  tier: ach.tierInfo(u.total_kills),
});

function validateCredentials(body) {
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(username)) { return { error: 'Имя: 3–20 символов, буквы, цифры, _ и -' }; }
  if (password.length < 6 || password.length > 72) { return { error: 'Пароль: от 6 до 72 символов' }; }
  return { username, password };
}

app.post('/api/register', authLimiter, asyncH(async (req, res) => {
  const v = validateCredentials(req.body);
  if (v.error) { return res.status(400).json({ error: v.error }); }
  const hash = await bcrypt.hash(v.password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING ${USER_COLS}`,
      [v.username, hash],
    );
    setSession(res, rows[0]);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') { return res.status(409).json({ error: 'Это имя уже занято' }); }
    throw e;
  }
}));

// Фиктивный хэш: время ответа не выдаёт, существует ли пользователь
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

app.post('/api/login', authLimiter, asyncH(async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const { rows } = await pool.query(
    `SELECT ${USER_COLS}, password_hash FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) { return res.status(401).json({ error: 'Неверное имя или пароль' }); }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

app.post('/api/score', requireAuth, asyncH(async (req, res) => {
  const kills = Number(req.body?.kills);
  const score = Number(req.body?.score);
  const durationMs = Number(req.body?.durationMs);
  const valid = [kills, score, durationMs].every((n) => Number.isInteger(n) && n >= 0);
  if (!valid || durationMs < MIN_GAME_MS || durationMs > 6 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Некорректный результат' });
  }
  if (kills > MAX_KILLS_BASE + (durationMs / 1000) * MAX_KILLS_PER_SEC || score > kills * MAX_SCORE_PER_KILL + 100) {
    return res.status(422).json({ error: 'Результат отклонён как нереалистичный' });
  }
  // расширенная статистика приходит от клиента: проверяем только границы правдоподобия
  const extra = ach.parseGameExtra(req.body, { kills, durationMs });
  if (extra.error) { return res.status(422).json({ error: extra.error }); }

  // результат засчитывается в задачу дня, только если клиент прислал сегодняшнюю дату (по UTC сервера)
  const dailyDate = req.body?.daily === dailyMod.todayUTC() ? req.body.daily : null;
  // и в недельный челлендж — только с текущей неделей
  const weeklyKey = !dailyDate && req.body?.weekly === dailyMod.isoWeek() ? req.body.weekly : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Один запрос вместо пяти (каждый запрос к Prisma Postgres — платная «операция»):
    // FOR UPDATE — параллельные отправки одного игрока идут по очереди; recent — не чаще раза в MIN_GAME_MS;
    // лучшие результаты дня и недели до этой партии; уже открытые ачивки
    const { rows: [cur] } = await client.query(
      `SELECT ${USER_COLS},
         EXISTS (SELECT 1 FROM games g WHERE g.user_id = u.id AND g.created_at > now() - ($2 || ' milliseconds')::interval) AS recent,
         (SELECT MAX(g.score) FROM games g WHERE g.user_id = u.id AND g.daily = $3::date) AS daily_prev,
         (SELECT MAX(g.score) FROM games g WHERE g.user_id = u.id AND g.weekly = $4::text) AS weekly_prev,
         (SELECT COALESCE(array_agg(a.code), '{}') FROM user_achievements a WHERE a.user_id = u.id) AS owned
       FROM users u WHERE u.id = $1 FOR UPDATE OF u`,
      [req.user.id, String(MIN_GAME_MS), dailyDate, weeklyKey],
    );
    if (cur.recent) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Слишком частая отправка результатов' });
    }
    const dailyPrevBest = cur.daily_prev;
    const weeklyPrevBest = cur.weekly_prev;
    const prev = ach.statsFromRow(cur);
    const next = ach.applyGame(prev, { kills, durationMs, extra });
    await client.query(
      'INSERT INTO games (user_id, kills, score, duration_ms, best_combo, wave, extra, daily, weekly) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [req.user.id, kills, score, durationMs, extra.bestCombo, extra.wave, JSON.stringify({ livesLost: extra.livesLost, bonuses: extra.bonuses, maxBombKills: extra.maxBombKills }), dailyDate, weeklyKey],
    );
    const { rows } = await client.query(
      `UPDATE users SET total_kills = $2, best_score = GREATEST(best_score, $3), games_played = $4,
         best_kills_game = $5, best_combo = $6, best_wave = $7, stats = $8
       WHERE id = $1 RETURNING ${USER_COLS}`,
      [req.user.id, next.totalKills, score, next.gamesPlayed, next.bestKillsGame, next.bestCombo, next.bestWave, JSON.stringify(ach.statsJson(next))],
    );
    const fresh = ach.evaluate(next, new Set(cur.owned));
    if (fresh.length) {
      await client.query(
        'INSERT INTO user_achievements (user_id, code) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING',
        [req.user.id, fresh],
      );
    }
    await client.query('COMMIT');
    userCache.set(req.user.id, { at: Date.now(), row: rows[0] });

    let dailyResult = null;
    if (dailyDate) {
      const best = Math.max(score, dailyPrevBest ?? 0);
      const rank = await challengeRank(client, 'daily', dailyDate, best);
      dailyResult = { date: dailyDate, rank, best, isBest: dailyPrevBest === null || score > dailyPrevBest };
    }
    let weeklyResult = null;
    if (weeklyKey) {
      const best = Math.max(score, weeklyPrevBest ?? 0);
      const rank = await challengeRank(client, 'weekly', weeklyKey, best);
      weeklyResult = { week: weeklyKey, rank, best, isBest: weeklyPrevBest === null || score > weeklyPrevBest };
    }

    const levelBefore = ach.rankIndex(prev.totalKills);
    const levelAfter = ach.rankIndex(next.totalKills);
    res.json({
      user: publicUser(rows[0]),
      newAchievements: ach.ACHIEVEMENTS.filter((a) => fresh.includes(a.code)).map(({ code, icon, name, desc }) => ({ code, icon, name, desc })),
      // повышение ранга: значок и награды, чтобы клиент показал праздничную карточку
      daily: dailyResult,
      weekly: weeklyResult,
      newRank: levelAfter > levelBefore ? { ...ach.tierInfo(next.totalKills), unlocks: ach.RANK_UNLOCKS[levelAfter] } : null,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

// любое изменение в кабинете (имя, пароль, сброс, удаление) сбрасывает кэш пользователя
app.use('/api/profile', (req, res, next) => {
  if (req.method !== 'GET' && req.user) { const id = req.user.id; res.on('finish', () => userCache.delete(id)); }
  next();
});
app.use('/api/profile', requireAuth, createProfileRouter({
  pool, asyncH, authLimiter, setSession, validateCredentials, publicUser, USER_COLS, COOKIE,
}));

// Сортировка рейтинга — только из белого списка, в SQL подставляются готовые фрагменты.
// `args` — значения $1..$3 для запроса «сколько игроков выше меня»; в каждом запросе используются все три.
const LEADERBOARD_SORTS = {
  kills: {
    order: 'total_kills DESC, best_score DESC, id ASC',
    ahead: 'total_kills > $1 OR (total_kills = $1 AND (best_score > $2 OR (best_score = $2 AND id < $3)))',
    args: (u) => [u.total_kills, u.best_score, u.id],
  },
  single: {
    order: 'best_kills_game DESC, total_kills DESC, id ASC',
    ahead: 'best_kills_game > $1 OR (best_kills_game = $1 AND (total_kills > $2 OR (total_kills = $2 AND id < $3)))',
    args: (u) => [u.best_kills_game, u.total_kills, u.id],
  },
  score: {
    order: 'best_score DESC, total_kills DESC, id ASC',
    ahead: 'best_score > $2 OR (best_score = $2 AND (total_kills > $1 OR (total_kills = $1 AND id < $3)))',
    args: (u) => [u.total_kills, u.best_score, u.id],
  },
};

app.get('/api/leaderboard', asyncH(async (req, res) => {
  const key = Object.hasOwn(LEADERBOARD_SORTS, req.query.sort) ? req.query.sort : 'kills';
  const sort = LEADERBOARD_SORTS[key];
  const rows = await cached(`board:${key}`, async () => (await pool.query(
    `SELECT ${USER_COLS} FROM users WHERE games_played > 0 ORDER BY ${sort.order} LIMIT 20`,
  )).rows);
  let me = null;
  if (req.user && req.user.games_played > 0) {
    const r = await pool.query(
      `SELECT COUNT(*) + 1 AS rank FROM users WHERE games_played > 0 AND (${sort.ahead})`,
      sort.args(req.user),
    );
    me = {
      rank: Number(r.rows[0].rank), username: req.user.username, totalKills: req.user.total_kills,
      bestScore: req.user.best_score, bestKillsGame: req.user.best_kills_game,
    };
  }
  res.json({
    sort: key,
    top: rows.map((r, i) => ({
      rank: i + 1, username: r.username, avatar: r.avatar, color: r.color, status: r.status, title: titleOf(r).name, tier: ach.tierInfo(r.total_kills),
      totalKills: r.total_kills, bestScore: r.best_score, bestKillsGame: r.best_kills_game, gamesPlayed: r.games_played,
    })),
    me,
  });
}));

/* ---------- Задача дня и недельный челлендж: общий рейтинг по колонке games.daily / games.weekly ---------- */
const CHALLENGE_COLS = new Set(['daily', 'weekly']); // имя колонки подставляется в SQL — только из этого списка

async function challengeRank(db, col, key, score) {
  if (!CHALLENGE_COLS.has(col)) { throw new Error('bad challenge column'); }
  const { rows } = await db.query(
    `SELECT COUNT(*) + 1 AS rank FROM (SELECT user_id, MAX(score) AS s FROM games WHERE ${col} = $1 GROUP BY user_id) b WHERE b.s > $2`,
    [key, score],
  );
  return Number(rows[0].rank);
}

/** Топ-20 (лучшая попытка каждого игрока) и место текущего игрока */
async function challengeBoard(col, key, user) {
  if (!CHALLENGE_COLS.has(col)) { throw new Error('bad challenge column'); }
  const { best, users } = await cached(`${col}:${key}`, async () => {
    const { rows: top } = await pool.query(
      `SELECT user_id, score, kills, wave FROM (
         SELECT DISTINCT ON (user_id) user_id, score, kills, wave, created_at
         FROM games WHERE ${col} = $1 ORDER BY user_id, score DESC, created_at ASC
       ) t ORDER BY score DESC, created_at ASC LIMIT 20`,
      [key],
    );
    const byId = new Map();
    if (top.length) {
      const { rows } = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id = ANY($1::int[])`, [top.map((b) => b.user_id)]);
      rows.forEach((u) => byId.set(u.id, u));
    }
    return { best: top, users: byId };
  });
  let me = null;
  if (user) {
    const mine = (await pool.query(
      `SELECT score, kills, wave FROM games WHERE user_id = $1 AND ${col} = $2 ORDER BY score DESC, created_at ASC LIMIT 1`,
      [user.id, key],
    )).rows[0];
    if (mine) { me = { rank: await challengeRank(pool, col, key, mine.score), score: mine.score, kills: mine.kills, wave: mine.wave }; }
  }
  const top = best.map((b, i) => {
    const u = users.get(b.user_id);
    return {
      rank: i + 1, username: u.username, avatar: u.avatar, color: u.color, status: u.status, title: titleOf(u).name,
      tier: ach.tierInfo(u.total_kills), score: b.score, kills: b.kills, wave: b.wave,
    };
  });
  return { top, me };
}

app.get('/api/daily', asyncH(async (req, res) => {
  const date = dailyMod.todayUTC();
  res.json({ date, modifier: dailyMod.modifierFor(date), ...(await challengeBoard('daily', date, req.user)) });
}));

app.get('/api/weekly', asyncH(async (req, res) => {
  const week = dailyMod.isoWeek();
  res.json({ week, endsAt: dailyMod.weekEndsAt(), modifiers: dailyMod.weeklyModifiersFor(week), ...(await challengeBoard('weekly', week, req.user)) });
}));

app.use(express.static(path.join(__dirname, 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

(async () => {
  try {
    // бесплатный инстанс часто засыпает и стартует заново: схему применяем, только если schema.sql изменился (1 запрос вместо ~30)
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const hash = crypto.createHash('sha256').update(schema).digest('hex');
    const applied = await pool.query('SELECT hash FROM schema_meta LIMIT 1').then((r) => r.rows[0]?.hash, () => null);
    if (applied !== hash) {
      await pool.query(`${schema}
        CREATE TABLE IF NOT EXISTS schema_meta (hash TEXT NOT NULL);
        DELETE FROM schema_meta;
        INSERT INTO schema_meta (hash) VALUES ('${hash}');`);
      console.log('Схема БД обновлена');
    }
  } catch (e) {
    console.error(`Не удалось подключиться к PostgreSQL (${DATABASE_URL.replace(/:[^:@/]*@/, ':***@')}): ${e.message}`);
    console.error('Запустите БД: npm run db:start (или docker compose up -d)');
    process.exit(1);
  }
  const server = app.listen(PORT, () => console.log(`Bug Hunter: http://localhost:${PORT}`));
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
