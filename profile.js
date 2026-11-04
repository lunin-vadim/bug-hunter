'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const ach = require('./achievements');

const AVATARS = [
  '🐛', '🐞', '🪲', '🪳', '🐝', '🐌', '🐊', '🦎', '🕷️', '🦂', '🦋', '🐜',
  '🦗', '🤖', '👾', '💻', '🧑‍💻', '🦖', '🐙', '🦊', '🐱', '🐼', '🚀', '⭐',
];
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const STATUS_MAX = 60;
const BIO_MAX = 200;
const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;

const length = (str) => [...str].length;
/** Убирает управляющие символы (для био оставляет переводы строк) и обрезает пробелы */
const cleanText = (v, { multiline = false } = {}) => (typeof v === 'string'
  ? v.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, '').trim()
  : null);

/**
 * Личный кабинет. Роутер монтируется после requireAuth, поэтому req.user всегда есть.
 * Зависимости передаются из server.js, чтобы не дублировать сессии и валидацию.
 */
module.exports = function createProfileRouter({ pool, asyncH, authLimiter, setSession, validateCredentials, publicUser, USER_COLS, COOKIE }) {
  const router = express.Router();

  async function passwordMatches(userId, password) {
    if (typeof password !== 'string' || !password) { return false; }
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    return rows[0] ? bcrypt.compare(password, rows[0].password_hash) : false;
  }

  const wrongPassword = (res) => res.status(403).json({ error: 'Неверный пароль' });

  router.get('/', asyncH(async (req, res) => {
    const u = req.user;
    const stats = ach.statsFromRow(u);
    const unlockedAt = new Map(
      (await pool.query('SELECT code, unlocked_at FROM user_achievements WHERE user_id = $1', [u.id])).rows.map((r) => [r.code, r.unlocked_at]),
    );
    const doneCodes = new Set(ach.evaluate(stats));
    const games = (await pool.query(
      `SELECT kills, score, duration_ms, best_combo, wave, created_at FROM games
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${HISTORY_LIMIT}`,
      [u.id],
    )).rows.map((g) => ({ kills: g.kills, score: g.score, durationMs: g.duration_ms, bestCombo: g.best_combo, wave: g.wave, createdAt: g.created_at }));

    const rank = ach.rankTitle(u.total_kills);
    const next = ach.RANK_TITLES.find((r) => r.minKills > u.total_kills) || null;
    const changedAt = u.username_changed_at ? new Date(u.username_changed_at).getTime() : 0;
    const nextChange = changedAt + USERNAME_COOLDOWN_MS;

    res.json({
      user: publicUser(u),
      bio: u.bio,
      stats: {
        totalKills: u.total_kills, bestKillsGame: u.best_kills_game, bestScore: u.best_score, gamesPlayed: u.games_played,
        bestCombo: u.best_combo, bestWave: u.best_wave, golden: stats.golden, bombs: stats.bombs, freezes: stats.freezes,
        crocs: stats.crocs, longestGameMs: stats.longestGameMs,
      },
      rank: { name: rank.name, next: next ? { name: next.name, minKills: next.minKills } : null },
      achievements: ach.achievementList(stats, unlockedAt),
      titles: ach.availableTitles(u.total_kills, doneCodes),
      activeTitleCode: ach.activeTitle(u.title, u.total_kills, doneCodes).code,
      titleChosen: !!u.title,
      history: games,
      options: { avatars: AVATARS, statusMax: STATUS_MAX, bioMax: BIO_MAX },
      usernameChangeAvailableAt: nextChange > Date.now() ? new Date(nextChange).toISOString() : null,
    });
  }));

  router.patch('/', asyncH(async (req, res) => {
    const u = req.user;
    const body = req.body || {};
    const set = [];
    const values = [u.id];
    const put = (column, value) => { values.push(value); set.push(`${column} = $${values.length}`); };

    if ('avatar' in body) {
      if (!AVATARS.includes(body.avatar)) { return res.status(400).json({ error: 'Недопустимый аватар' }); }
      put('avatar', body.avatar);
    }
    if ('color' in body) {
      if (typeof body.color !== 'string' || !COLOR_RE.test(body.color)) { return res.status(400).json({ error: 'Цвет: формат #rrggbb' }); }
      put('color', body.color.toLowerCase());
    }
    if ('status' in body) {
      const status = cleanText(body.status);
      if (status === null || length(status) > STATUS_MAX) { return res.status(400).json({ error: `Статус: до ${STATUS_MAX} символов` }); }
      put('status', status);
    }
    if ('bio' in body) {
      const bio = cleanText(body.bio, { multiline: true });
      if (bio === null || length(bio) > BIO_MAX) { return res.status(400).json({ error: `О себе: до ${BIO_MAX} символов` }); }
      put('bio', bio);
    }
    if ('title' in body) {
      if (body.title === null || body.title === '') {
        put('title', null); // вернуться к автоматическому ранговому титулу
      } else {
        const allowed = ach.availableTitles(u.total_kills, new Set(ach.evaluate(ach.statsFromRow(u))));
        if (!allowed.some((t) => t.code === body.title)) { return res.status(400).json({ error: 'Этот титул ещё не открыт' }); }
        put('title', body.title);
      }
    }
    if (!set.length) { return res.status(400).json({ error: 'Нечего менять' }); }

    const { rows } = await pool.query(`UPDATE users SET ${set.join(', ')} WHERE id = $1 RETURNING ${USER_COLS}`, values);
    res.json({ user: publicUser(rows[0]), bio: rows[0].bio });
  }));

  router.post('/username', authLimiter, asyncH(async (req, res) => {
    const u = req.user;
    const v = validateCredentials({ username: req.body?.username, password: 'x'.repeat(6) });
    if (v.error) { return res.status(400).json({ error: v.error }); }
    if (v.username === u.username) { return res.status(400).json({ error: 'Это ваше текущее имя' }); }
    const changedAt = u.username_changed_at ? new Date(u.username_changed_at).getTime() : 0;
    if (changedAt + USERNAME_COOLDOWN_MS > Date.now()) {
      return res.status(429).json({ error: 'Имя можно менять не чаще раза в 7 дней', availableAt: new Date(changedAt + USERNAME_COOLDOWN_MS).toISOString() });
    }
    if (!(await passwordMatches(u.id, req.body?.password))) { return wrongPassword(res); }
    try {
      const { rows } = await pool.query(
        `UPDATE users SET username = $2, username_changed_at = now() WHERE id = $1 RETURNING ${USER_COLS}`,
        [u.id, v.username],
      );
      res.json({ user: publicUser(rows[0]) });
    } catch (e) {
      if (e.code === '23505') { return res.status(409).json({ error: 'Это имя уже занято' }); }
      throw e;
    }
  }));

  router.post('/password', authLimiter, asyncH(async (req, res) => {
    const next = req.body?.newPassword;
    if (typeof next !== 'string' || next.length < 6 || next.length > 72) {
      return res.status(400).json({ error: 'Пароль: от 6 до 72 символов' });
    }
    if (!(await passwordMatches(req.user.id, req.body?.currentPassword))) { return wrongPassword(res); }
    const hash = await bcrypt.hash(next, 10);
    // token_version + 1 гасит сессии на всех остальных устройствах; для текущего выдаём свежую cookie
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING ${USER_COLS}`,
      [req.user.id, hash],
    );
    setSession(res, rows[0]);
    res.json({ ok: true });
  }));

  router.post('/reset', authLimiter, asyncH(async (req, res) => {
    if (!(await passwordMatches(req.user.id, req.body?.password))) { return wrongPassword(res); }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM games WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM user_achievements WHERE user_id = $1', [req.user.id]);
      const { rows } = await client.query(
        `UPDATE users SET total_kills = 0, best_score = 0, games_played = 0, best_kills_game = 0, best_combo = 0,
           best_wave = 1, stats = '{}', title = NULL
         WHERE id = $1 RETURNING ${USER_COLS}`,
        [req.user.id],
      );
      await client.query('COMMIT');
      res.json({ user: publicUser(rows[0]) });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }));

  router.delete('/', authLimiter, asyncH(async (req, res) => {
    if (!(await passwordMatches(req.user.id, req.body?.password))) { return wrongPassword(res); }
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  }));

  return router;
};
