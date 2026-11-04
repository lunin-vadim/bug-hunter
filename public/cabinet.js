'use strict';

/**
 * Личный кабинет: профиль, ачивки, история партий, безопасность.
 * Использует глобальные `currentUser`, `renderUser`, `toast`, `phase`, `setPaused` из game.js.
 * Весь пользовательский текст попадает в DOM только через textContent.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const root = $('cabinet');
  const profileBtn = $('btn-profile');
  const openBtn = $('btn-cabinet');
  const DELETE_WORD = 'УДАЛИТЬ';

  let profile = null;
  let isOpen = false;
  // несохранённый выбор во вкладке «Профиль»
  let draft = { avatar: '🐛', color: '#35c4ff', title: null };
  let rankSel = null; // какой ранг выбран на лестнице (показываем его награды)

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  };

  async function request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { throw new Error(data.error || `Ошибка ${res.status}`); }
    return data;
  }

  function setMsg(node, text, ok = false) {
    node.textContent = text || '';
    node.hidden = !text;
    node.classList.toggle('ok', ok);
  }

  const fmtDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

  /* ---------- Отрисовка ---------- */
  function renderHeader() {
    const { user, stats, rank } = profile;
    const av = $('cab-avatar');
    av.textContent = draft.avatar;
    av.style.setProperty('--accent', draft.color);
    $('cab-name').textContent = user.username;
    $('cab-chip').textContent = user.title;
    $('cab-status').textContent = user.status || '';
    applyTier(av, rank);
    renderRank();

    const tiles = [
      ['За раз', stats.bestKillsGame, 'Максимум багов за одну партию'],
      ['Всего багов', stats.totalKills],
      ['Рекорд очков', stats.bestScore],
      ['Партий', stats.gamesPlayed],
      ['Лучшее комбо', stats.bestCombo],
      ['Лучшая волна', stats.bestWave],
      ['Золотых', stats.golden],
      ['Самая долгая', stats.longestGameMs ? fmtTime(stats.longestGameMs) : '—'],
    ];
    const grid = $('cab-stats');
    grid.textContent = '';
    for (const [label, value, hint] of tiles) {
      const t = make('div', 'stat-tile');
      if (hint) { t.title = hint; }
      t.append(make('b', null, String(value)), make('small', null, label));
      grid.append(t);
    }
  }

  const fmt = (n) => Number(n).toLocaleString('ru-RU');

  /** Карточка ранга: значок, прогресс внутри ранга, лестница и награды выбранной ступени */
  function renderRank() {
    const { rank, ladder, stats } = profile;
    $('cab-rank').style.setProperty('--rank', rank.color);
    $('cab-rank-badge').replaceChildren(rankBadge(rank, 'md'));
    $('cab-rank-name').textContent = rank.name;
    $('cab-rank-kills').textContent = fmt(stats.totalKills);
    $('cab-rank-fill').style.width = `${Math.round(rank.ratio * 100)}%`;
    $('cab-rank-text').textContent = rank.next
      ? `До «${rank.next.name}» ещё ${fmt(rank.remaining)} багов`
      : 'Высший ранг. Выше только слава';
    if (rankSel === null) {
      rankSel = rank.next ? ladder.findIndex((r) => r.name === rank.next.name) : ladder.length - 1;
    }
    const steps = $('cab-rank-steps');
    steps.textContent = '';
    ladder.forEach((r, i) => {
      const li = make('li');
      const btn = make('button', `rank-step${r.current ? ' current' : ''}${i === rankSel ? ' selected' : ''}`);
      btn.type = 'button';
      btn.style.setProperty('--rank', r.color);
      btn.setAttribute('aria-label', `${r.name}: ${r.reached ? 'получен' : `с ${fmt(r.minKills)} убитых`}`);
      btn.setAttribute('aria-pressed', String(i === rankSel));
      const badge = rankBadge(r, 'sm');
      if (!r.reached) { badge.classList.add('off'); }
      btn.append(badge, make('small', null, r.name));
      btn.addEventListener('click', () => { rankSel = i; renderRank(); });
      li.append(btn);
      steps.append(li);
    });
    renderRankDetail();
  }

  function renderRankDetail() {
    const r = profile.ladder[rankSel];
    const box = $('cab-rank-detail');
    box.style.setProperty('--rank', r.color);
    box.textContent = '';
    const status = r.current ? 'Текущий ранг'
      : r.reached ? 'Пройден'
        : `Ещё ${fmt(r.minKills - profile.stats.totalKills)} багов · с ${fmt(r.minKills)} убитых`;
    const head = make('div', 'rd-head');
    head.append(make('b', null, r.name), make('span', null, status));
    const chips = make('div', 'rd-unlocks');
    chips.append(unlockChips(r.unlocks));
    if (!r.reached) { chips.querySelectorAll('.rd-chip').forEach((n) => n.classList.add('locked')); }
    box.append(head, make('p', 'rd-perk', r.unlocks.perk), chips);
  }

  function renderAvatars() {
    const box = $('cab-avatars');
    box.textContent = '';
    for (const o of profile.options.avatars) {
      const b = make('button', `avatar-opt${o.locked ? ' locked' : ''}`, o.value);
      b.type = 'button';
      b.disabled = o.locked;
      b.setAttribute('aria-pressed', String(o.value === draft.avatar));
      b.setAttribute('aria-label', o.locked ? `Аватар ${o.value}: откроется на ранге «${o.rank}»` : `Аватар ${o.value}`);
      if (o.locked) { b.title = `Откроется на ранге «${o.rank}»`; }
      b.addEventListener('click', () => { draft.avatar = o.value; renderAvatars(); renderHeader(); });
      box.append(b);
    }
  }

  function renderColors() {
    const box = $('cab-swatches');
    box.textContent = '';
    for (const o of profile.options.colors) {
      const b = make('button', `swatch${o.locked ? ' locked' : ''}`);
      b.type = 'button';
      b.disabled = o.locked;
      b.style.setProperty('--sw', o.value);
      b.setAttribute('aria-pressed', String(o.value === draft.color));
      b.setAttribute('aria-label', o.locked ? `Цвет ${o.value}: откроется на ранге «${o.rank}»` : `Цвет ${o.value}`);
      if (o.locked) { b.title = `Откроется на ранге «${o.rank}»`; }
      b.addEventListener('click', () => { draft.color = o.value; renderColors(); renderHeader(); });
      box.append(b);
    }
    const custom = profile.options.customColor;
    $('cab-color').value = draft.color;
    $('cab-color').disabled = custom.locked;
    $('cab-color-hint').textContent = custom.locked ? `Свой цвет и остальные оттенки откроются с новыми рангами; своя палитра — на ранге «${custom.rank}»` : '';
  }

  function renderTitles() {
    const box = $('cab-titles');
    box.textContent = '';
    const options = [{ code: null, name: 'Авто (по рангу)' }, ...profile.titles];
    for (const t of options) {
      const b = make('button', 'title-opt', t.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(t.code === draft.title));
      b.addEventListener('click', () => { draft.title = t.code; renderTitles(); });
      box.append(b);
    }
  }

  function renderAchievements() {
    const list = profile.achievements;
    const done = list.filter((a) => a.unlockedAt).length;
    $('cab-ach-summary').textContent = `Получено ${done} из ${list.length}`;
    const grid = $('cab-ach-grid');
    grid.textContent = '';
    for (const a of list) {
      const card = make('div', a.unlockedAt ? 'ach done' : 'ach');
      card.append(make('span', 'ach-icon', a.icon));
      const info = make('div', 'ach-info');
      info.append(make('b', null, a.name), make('small', null, a.desc));
      if (a.unlockedAt) {
        info.append(make('small', 'ach-date', `Получено ${fmtDate(a.unlockedAt)}`));
      } else {
        const bar = make('div', 'ach-bar');
        const fill = make('div', 'ach-fill');
        fill.style.width = `${Math.round((a.current / a.goal) * 100)}%`;
        bar.append(fill);
        info.append(bar, make('small', 'ach-date', `${a.current} / ${a.goal}`));
      }
      card.append(info);
      grid.append(card);
    }
  }

  function renderHistory() {
    const body = $('cab-history-body');
    body.textContent = '';
    if (!profile.history.length) {
      const td = body.insertRow().insertCell();
      td.colSpan = 6;
      td.className = 'empty';
      td.textContent = 'Партий пока нет';
      return;
    }
    for (const g of profile.history) {
      const tr = body.insertRow();
      tr.insertCell().textContent = fmtDate(g.createdAt);
      [g.score, g.kills, g.bestCombo, g.wave, fmtTime(g.durationMs)].forEach((v) => {
        const td = tr.insertCell();
        td.className = 'num';
        td.textContent = v;
      });
    }
  }

  function renderProfile() {
    draft = {
      avatar: profile.user.avatar,
      color: profile.user.color,
      title: profile.titleChosen ? profile.activeTitleCode : null,
    };
    $('cab-status-input').value = profile.user.status || '';
    $('cab-status-input').maxLength = profile.options.statusMax;
    $('cab-bio').value = profile.bio || '';
    $('cab-bio').maxLength = profile.options.bioMax;
    $('cab-bio-count').textContent = [...$('cab-bio').value].length;
    renderHeader();
    renderAvatars();
    renderColors();
    renderTitles();
    renderAchievements();
    renderHistory();
    $('sec-name-hint').textContent = profile.usernameChangeAvailableAt
      ? `Следующая смена имени — ${fmtDate(profile.usernameChangeAvailableAt)}`
      : 'Имя можно менять раз в 7 дней.';
  }

  async function loadProfile() {
    try {
      profile = await request('GET', '/api/profile');
      renderProfile();
    } catch (e) {
      toast('⚠️', 'Не удалось загрузить кабинет', e.message);
      setOpen(false);
    }
  }

  /* ---------- Открытие и вкладки ---------- */
  function setOpen(next) {
    if (next === isOpen) { return; }
    if (next && !currentUser) {
      toast('🔒', 'Нужен вход', 'Войдите в аккаунт, чтобы открыть кабинет');
      return;
    }
    isOpen = next;
    root.inert = !next;
    root.classList.toggle('open', next);
    if (next) {
      window.dispatchEvent(new CustomEvent('panel:open', { detail: 'cabinet' })); // закрыть рейтинг
      document.body.dataset.panel = 'cabinet';
      if (phase === 'playing') { setPaused(true); }
      showTab('profile');
      loadProfile();
      $('btn-cabinet-close').focus({ preventScroll: true });
    } else {
      if (document.body.dataset.panel === 'cabinet') { delete document.body.dataset.panel; }
      if (root.contains(document.activeElement)) { profileBtn.focus({ preventScroll: true }); }
    }
  }

  function showTab(name) {
    for (const t of root.querySelectorAll('[data-cab]')) {
      const on = t.dataset.cab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    for (const pane of root.querySelectorAll('.cab-pane')) { pane.hidden = pane.id !== `cab-${name}`; }
  }

  /* ---------- Действия ---------- */
  async function saveProfile() {
    const msg = $('cab-profile-msg');
    setMsg(msg, '');
    try {
      const data = await request('PATCH', '/api/profile', {
        avatar: draft.avatar,
        color: draft.color,
        status: $('cab-status-input').value,
        bio: $('cab-bio').value,
        title: draft.title,
      });
      currentUser = data.user;
      renderUser();
      await loadProfile();
      setMsg(msg, 'Профиль сохранён', true);
    } catch (e) {
      setMsg(msg, e.message);
    }
  }

  /** Общий обработчик форм безопасности: запрос → сообщение → обновление данных */
  function bindForm(formId, msgId, run, successText) {
    $(formId).addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $(msgId);
      setMsg(msg, '');
      try {
        await run();
        setMsg(msg, successText, true);
        e.target.querySelectorAll('input').forEach((i) => { i.value = ''; });
      } catch (err) {
        setMsg(msg, err.message);
      }
    });
  }

  bindForm('form-username', 'sec-name-msg', async () => {
    const data = await request('POST', '/api/profile/username', { username: $('sec-newname').value, password: $('sec-name-pass').value });
    currentUser = data.user;
    renderUser();
    await loadProfile();
  }, 'Имя изменено');

  bindForm('form-password', 'sec-pass-msg', async () => {
    await request('POST', '/api/profile/password', { currentPassword: $('sec-oldpass').value, newPassword: $('sec-newpass').value });
  }, 'Пароль изменён, остальные устройства разлогинены');

  bindForm('form-reset', 'sec-reset-msg', async () => {
    const data = await request('POST', '/api/profile/reset', { password: $('sec-reset-pass').value });
    currentUser = data.user;
    renderUser();
    await loadProfile();
  }, 'Статистика сброшена');

  $('form-delete').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('sec-del-msg');
    setMsg(msg, '');
    if ($('sec-del-word').value.trim().toUpperCase() !== DELETE_WORD) {
      setMsg(msg, `Введите слово ${DELETE_WORD} для подтверждения`);
      return;
    }
    try {
      await request('DELETE', '/api/profile', { password: $('sec-del-pass').value });
      e.target.querySelectorAll('input').forEach((i) => { i.value = ''; });
      currentUser = null;
      renderUser();
      setOpen(false);
      toast('👋', 'Аккаунт удалён', 'Будем рады видеть вас снова');
    } catch (err) {
      setMsg(msg, err.message);
    }
  });

  /* ---------- Привязка событий ---------- */
  $('cab-save').addEventListener('click', saveProfile);
  $('cab-color').addEventListener('input', (e) => { draft.color = e.target.value; renderColors(); renderHeader(); });
  $('cab-bio').addEventListener('input', (e) => { $('cab-bio-count').textContent = [...e.target.value].length; });
  openBtn.addEventListener('click', () => setOpen(true));
  profileBtn.addEventListener('click', () => setOpen(!isOpen));
  $('btn-cabinet-close').addEventListener('click', () => setOpen(false));
  // клик вне панели закрывает её (кнопки, открывающие кабинет, обрабатывают клик сами)
  document.addEventListener('pointerdown', (e) => {
    if (isOpen && !root.contains(e.target) && !profileBtn.contains(e.target) && !openBtn.contains(e.target)) { setOpen(false); }
  });
  root.querySelectorAll('[data-cab]').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.cab)));
  window.addEventListener('panel:open', (e) => { if (e.detail !== 'cabinet') { setOpen(false); } });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) { return; }
    if (e.key === 'Escape' && isOpen) { setOpen(false); return; }
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const other = document.body.dataset.panel && document.body.dataset.panel !== 'cabinet';
    if (typing || other || e.ctrlKey || e.metaKey || e.altKey) { return; }
    const k = e.key.toLowerCase();
    if (k === 'c' || k === 'с') { setOpen(!isOpen); }
  });
})();
