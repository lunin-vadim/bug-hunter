'use strict';

/**
 * Рейтинг: выезжающая справа панель.
 * Использует глобальные `api`, `currentUser`, `phase`, `setPaused` из game.js.
 * Пока панель открыта, на <body> стоит data-panel="board": game.js в это время игнорирует горячие клавиши.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const handle = $('board-handle');
  const closeBtn = $('btn-board-close');
  const openBtn = $('btn-board');
  const body = $('board-body');
  const meLine = $('board-me');
  const tabs = [...board.querySelectorAll('.tab')];
  const heads = [...board.querySelectorAll('th[data-col]')];
  // порядок столбцов в таблице → ключ сортировки
  const COLS = ['single', 'kills', 'score'];
  const dailyInfoEl = $('board-daily');
  const headTexts = heads.map((h) => h.textContent);
  const DAILY_HEADS = ['Волна', 'Убито', 'Очки'];

  let sort = 'kills';
  let isOpen = false;
  let loadId = 0;

  function setOpen(next) {
    if (next === isOpen) { return; }
    isOpen = next;
    board.inert = !next;
    board.classList.toggle('open', next);
    handle.classList.toggle('open', next);
    handle.setAttribute('aria-expanded', String(next));
    if (next) {
      window.dispatchEvent(new CustomEvent('panel:open', { detail: 'board' })); // закрыть кабинет, если он открыт
      document.body.dataset.panel = 'board';
      if (phase === 'playing') { setPaused(true); }
      load();
      closeBtn.focus({ preventScroll: true });
    } else {
      if (document.body.dataset.panel === 'board') { delete document.body.dataset.panel; }
      if (board.contains(document.activeElement)) { handle.focus({ preventScroll: true }); }
    }
  }

  function setSort(next) {
    sort = next;
    for (const t of tabs) {
      const on = t.dataset.sort === next;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    // во вкладке «Сегодня» те же три столбца показывают волну, убитых и очки, отсортировано по очкам
    heads.forEach((h, i) => {
      h.textContent = next === 'daily' ? DAILY_HEADS[i] : headTexts[i];
      h.classList.toggle('sorted', h.dataset.col === (next === 'daily' ? 'score' : next));
    });
    load();
  }

  function messageRow(text) {
    const tr = body.insertRow();
    const td = tr.insertCell();
    td.colSpan = 5;
    td.className = 'empty';
    td.textContent = text;
  }

  function playerCell(td, r) {
    const wrap = document.createElement('div');
    wrap.className = 'who-flex';
    const av = document.createElement('span');
    av.className = 'avatar';
    av.textContent = r.avatar || '🐛';
    av.style.setProperty('--accent', r.color || '#35c4ff');
    if (r.tier) { applyTier(av, r.tier); }
    const info = document.createElement('div');
    info.className = 'who-info';
    const nameRow = document.createElement('div');
    nameRow.className = 'who-name';
    const name = document.createElement('b');
    name.textContent = r.username;
    nameRow.append(name);
    if (r.tier) { nameRow.append(rankBadge(r.tier, 'sm')); }
    const sub = document.createElement('small');
    sub.textContent = r.status ? `${r.title} · ${r.status}` : r.title;
    info.append(nameRow, sub);
    wrap.append(av, info);
    td.append(wrap);
  }

  /** Вкладка «Сегодня»: рейтинг задачи дня; дата и мутатор над таблицей */
  async function loadDailyTab(id) {
    const data = await api('/api/daily');
    if (id !== loadId) { return; }
    const d = new Date(`${data.date}T00:00:00Z`);
    dailyInfoEl.textContent = `📅 ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })} · ${data.modifier.icon} ${data.modifier.name}: ${data.modifier.desc}`;
    dailyInfoEl.hidden = false;
    if (!data.top.length) { messageRow('Сегодня ещё никто не играл — станьте первым!'); }
    for (const r of data.top) {
      const tr = body.insertRow();
      if (currentUser && r.username === currentUser.username) { tr.className = 'mine'; }
      tr.insertCell().textContent = r.rank;
      playerCell(tr.insertCell(), r);
      [r.wave, r.kills, r.score].forEach((v, i) => {
        const td = tr.insertCell();
        td.className = i === 2 ? 'num sorted' : 'num';
        td.textContent = v;
      });
    }
    if (data.me && data.me.rank > data.top.length) {
      meLine.textContent = `Ваше место: ${data.me.rank} · очки: ${data.me.score} · убито: ${data.me.kills} · волна: ${data.me.wave}`;
      meLine.hidden = false;
    }
  }

  async function load() {
    const id = ++loadId;
    body.textContent = '';
    meLine.hidden = true;
    dailyInfoEl.hidden = true;
    try {
      if (sort === 'daily') { await loadDailyTab(id); return; }
      const data = await api(`/api/leaderboard?sort=${sort}`);
      if (id !== loadId) { return; } // пришёл устаревший ответ после смены вкладки
      if (!data.top.length) { messageRow('Пока никого — станьте первым!'); }
      for (const r of data.top) {
        const tr = body.insertRow();
        if (currentUser && r.username === currentUser.username) { tr.className = 'mine'; }
        tr.insertCell().textContent = r.rank;
        playerCell(tr.insertCell(), r);
        [r.bestKillsGame, r.totalKills, r.bestScore].forEach((v, i) => {
          const td = tr.insertCell();
          td.className = COLS[i] === sort ? 'num sorted' : 'num';
          td.textContent = v;
        });
      }
      if (data.me && data.me.rank > data.top.length) {
        meLine.textContent = `Ваше место: ${data.me.rank} · за раз: ${data.me.bestKillsGame} · всего: ${data.me.totalKills} · очки: ${data.me.bestScore}`;
        meLine.hidden = false;
      }
    } catch (e) {
      if (id === loadId) { messageRow(`Не удалось загрузить рейтинг: ${e.message}`); }
    }
  }

  handle.addEventListener('click', () => setOpen(!isOpen));
  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  tabs.forEach((t) => t.addEventListener('click', () => setSort(t.dataset.sort)));
  window.addEventListener('panel:open', (e) => { if (e.detail !== 'board') { setOpen(false); } });

  // клик вне панели закрывает её
  document.addEventListener('pointerdown', (e) => {
    if (isOpen && !board.contains(e.target) && !handle.contains(e.target) && !openBtn.contains(e.target)) { setOpen(false); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) { return; }
    if (e.key === 'Escape' && isOpen) { setOpen(false); return; }
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const other = document.body.dataset.panel && document.body.dataset.panel !== 'board';
    if (typing || other || e.ctrlKey || e.metaKey || e.altKey) { return; }
    const k = e.key.toLowerCase();
    if (k === 'l' || k === 'д') { setOpen(!isOpen); }
  });

  heads.forEach((h) => h.classList.toggle('sorted', h.dataset.col === sort));
})();
