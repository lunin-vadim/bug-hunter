'use strict';

/**
 * «Как играть»: выезжающая слева панель с вкладками правил.
 * Использует глобальные `phase` и `setPaused` из game.js. Пока панель открыта, на <body> стоит data-panel="rules":
 * game.js в это время игнорирует свои горячие клавиши.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const root = $('rules');
  const openBtn = $('btn-rules');
  const closeBtn = $('btn-rules-close');
  const tabs = [...root.querySelectorAll('[data-rules]')];
  let isOpen = false;

  function setOpen(next) {
    if (next === isOpen) { return; }
    isOpen = next;
    root.inert = !next;
    root.classList.toggle('open', next);
    if (next) {
      window.dispatchEvent(new CustomEvent('panel:open', { detail: 'rules' })); // закрыть рейтинг и кабинет
      document.body.dataset.panel = 'rules';
      if (phase === 'playing') { setPaused(true); }
      closeBtn.focus({ preventScroll: true });
    } else {
      if (document.body.dataset.panel === 'rules') { delete document.body.dataset.panel; }
      if (root.contains(document.activeElement)) { openBtn.focus({ preventScroll: true }); }
    }
  }

  function showTab(name) {
    for (const t of tabs) {
      const on = t.dataset.rules === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      if (on) { t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } // на телефоне вкладки прокручиваются
    }
    for (const pane of root.querySelectorAll('.rules-pane')) { pane.hidden = pane.id !== `rules-${name}`; }
    root.querySelector('.rules-body').scrollTop = 0;
  }

  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.rules)));
  window.addEventListener('panel:open', (e) => { if (e.detail !== 'rules') { setOpen(false); } });

  // клик вне панели закрывает её
  document.addEventListener('pointerdown', (e) => {
    if (isOpen && !root.contains(e.target) && !openBtn.contains(e.target)) { setOpen(false); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) { return; }
    if (e.key === 'Escape' && isOpen) { setOpen(false); return; }
    if (isOpen && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { // стрелки листают вкладки
      const i = tabs.findIndex((t) => t.classList.contains('active'));
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      showTab(next.dataset.rules);
      next.focus({ preventScroll: true });
      return;
    }
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const other = document.body.dataset.panel && document.body.dataset.panel !== 'rules';
    if (typing || other || e.ctrlKey || e.metaKey || e.altKey) { return; }
    const k = e.key.toLowerCase();
    if (k === 'h' || k === 'р') { setOpen(!isOpen); }
  });
})();
