'use strict';

function shortcutProbe(mode) {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const events = [];
    const dispatch = (code, target) => {
      const event = new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase(), ctrlKey: true, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      const held = !!k.api('keys')[code];
      target.dispatchEvent(new KeyboardEvent('keyup', { code, ctrlKey: true, bubbles: true }));
      return { code, prevented: event.defaultPrevented, held };
    };
    if (mode === 'game') {
      check(k.api('isGameplayInputActive')(), 'Shortcut fixture does not have active gameplay');
      k.key('ControlLeft');
      for (const code of ['KeyW', 'KeyT']) {
        const row = dispatch(code, document.body);
        check(row.prevented && row.held, 'In-game Ctrl combination was not consumed as gameplay input', row);
        events.push({ mode: 'game', ...row });
      }
      k.key('ControlLeft', false);
      const input = k.focusField();
      try {
        for (const code of ['KeyW', 'KeyT']) {
          const row = dispatch(code, input);
          check(!row.prevented && !row.held, 'Typing field lost its Ctrl shortcuts to gameplay', row);
          events.push({ mode: 'typing', ...row });
        }
      } finally { input.remove(); }
    } else {
      check(!document.pointerLockElement, 'Outside-game shortcut fixture is still pointer locked');
      for (const code of ['KeyW', 'KeyT']) {
        const row = dispatch(code, document.body);
        check(!row.prevented && !row.held, 'Paused game consumed browser Ctrl shortcuts', row);
        events.push({ mode: 'paused', ...row });
      }
    }
    check(b.player.pos.toArray().every(Number.isFinite), 'Shortcut handling corrupted movement');
    return { events, keyboardLockAvailable: typeof navigator.keyboard?.lock === 'function', fullscreen: !!document.fullscreenElement,
      coverage: 'Cancellable DOM key events; privileged browser Ctrl accelerators are not asserted or dispatched.' };
  });
}

function scoreboardRows() {
  const k = window.__bcTest, { check } = k;
  check(typeof k.api('setScoreboardVisible') === 'function' && typeof k.api('updateScoreboard') === 'function', 'Scoreboard APIs missing');
  const panel = document.getElementById('scoreboard');
  check(panel?.classList.contains('show'), 'Scoreboard is not open');
  const rows = [...document.getElementById('scoreboardRows').children].map((row) => [...row.children].map((cell) => cell.textContent.trim()));
  check(rows.length > 0 && rows.every((row) => row.length === 6), 'Scoreboard does not render six PLAYER/CHAR/WEAPON/K/D/HP columns', rows);
  const local = document.querySelectorAll('#scoreboardRows .is-local');
  check(local.length === 1 && local[0].textContent.includes('YOU'), 'Scoreboard lost the unique local-player marker');
  check(panel.getAttribute('aria-hidden') === 'false' && document.body.classList.contains('scoreboard-open'), 'Scoreboard visible state and accessibility state disagree');
  for (const id of ['scoreboardRoom', 'scoreboardCount']) check(document.getElementById(id)?.textContent.trim(), 'Scoreboard label is empty: ' + id);
  return { rows, room: document.getElementById('scoreboardRoom').textContent, count: document.getElementById('scoreboardCount').textContent };
}

module.exports = { shortcutProbe, scoreboardRows };
