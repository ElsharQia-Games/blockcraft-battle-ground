/* Blockcraft Battle Ground — connection feedback for internet rooms.
   93-connection.js (after 91-room.js, which reports the state through roomStatus)

   One banner at the top of the screen, over the game and the menus. It says
   what the connection is doing and how long it has been at it, and when a
   connection fails for good it offers Retry and Leave. The match keeps running
   behind it: the banner never blocks input unless there is a button to press. */
'use strict';

(function () {
  const css = `
  .net-banner { position: fixed; z-index: 30; top: max(52px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
    display: none; align-items: center; gap: 12px; max-width: calc(100vw - 32px); padding: 9px 14px; pointer-events: none;
    background: var(--ui-1, #17181b); color: var(--ui-ink, #f2f1ee); border: 2px solid var(--ui-line, #2f3238); border-bottom-color: var(--ui-edge, #08090a);
    border-radius: var(--ui-r, 3px); font: 600 14px/1.25 var(--ui-font, system-ui, sans-serif); }
  .net-banner.is-on { display: flex; }
  .net-banner.is-bad { border-color: var(--ui-red, #e8403f); }
  .net-banner.is-good { border-color: #3fae62; }
  .net-banner.has-actions { pointer-events: auto; }
  .net-banner b { font-weight: 800; white-space: nowrap; }
  .net-banner span { color: var(--ui-ink-2, #b9b8b3); }
  .net-banner i { flex: none; width: 10px; height: 10px; background: currentColor; }
  .net-banner.is-busy i { animation: net-blink 0.8s steps(2) infinite; }
  .net-banner.is-good i { color: #3fae62; }
  .net-banner.is-bad i { color: var(--ui-red, #e8403f); }
  .net-banner button { flex: none; padding: 6px 12px; font: inherit; font-weight: 800; color: var(--ui-ink, #f2f1ee); cursor: pointer;
    background: var(--ui-3, #2b2e34); border: 0; border-bottom: 3px solid var(--ui-edge, #08090a); border-radius: var(--ui-r, 3px); }
  .net-banner button:first-of-type { background: var(--ui-accent, #e8403f); border-bottom-color: var(--ui-accent-edge, #8f1f22); }
  @keyframes net-blink { 50% { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) { .net-banner.is-busy i { animation: none; } }
  @media (max-width: 560px) { .net-banner { flex-wrap: wrap; font-size: 13px; } }`;

  function mount() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const box = document.createElement('div');
    box.className = 'net-banner';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<i></i><b></b><span></span><button type="button">Retry</button><button type="button">Leave</button>';
    document.body.appendChild(box);
    const title = box.querySelector('b'), detail = box.querySelector('span');
    const [retry, leave] = box.querySelectorAll('button');
    retry.addEventListener('click', () => roomRetry());
    leave.addEventListener('click', () => leaveOnline(false));
    let shown = '';
    let unlocked = false;
    const draw = () => {
      const s = net.mode === 'mqtt' ? roomStatus() : null;
      const key = s ? [s.tone, s.title, s.detail, s.actions].join('|') : '';
      if (key === shown) return;
      shown = key;
      box.classList.toggle('is-on', !!s);
      if (!s) { unlocked = false; return; }
      title.textContent = s.title;
      detail.textContent = s.detail || '';
      detail.style.display = s.detail ? '' : 'none';
      box.classList.toggle('is-bad', s.tone === 'bad');
      box.classList.toggle('is-good', s.tone === 'good');
      box.classList.toggle('is-busy', s.tone === 'busy');
      box.classList.toggle('has-actions', !!s.actions);
      retry.style.display = leave.style.display = s.actions ? '' : 'none';
      // Buttons are no use while the mouse is captured.
      if (s.actions && !unlocked && document.pointerLockElement) { unlocked = true; document.exitPointerLock(); }
    };
    setInterval(draw, 250);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
