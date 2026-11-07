/* Blockcraft Battle Ground — End of a match.
   96-match-end.js (after 90-net.js, 95-bots.js)
   Reaching the score used to only set a flag, so matches ran on forever and
   bots stopped moving. This shows the result, pauses the fight for a few
   seconds and starts the next match. In a room the host decides and restarts;
   LAN clients each see the same scores and the host restarts. */
'use strict';

const MATCH_END_MS = 8000;
const MATCH_END_GRACE_MS = 6000;   // a peer gives up waiting for a host that vanished

let matchEndState = null, matchEndDoneRound = -1, matchEndEl = null;

BC.style('bc-match-end', `
  #matchEnd { position: fixed; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 40; display: none;
    pointer-events: none; padding: 22px 16px; text-align: center; background: rgba(6,10,14,.82); color: #eef4f8; }
  #matchEnd.show { display: block; }
  #matchEnd .me-title { font-size: clamp(30px, 7vw, 56px); font-weight: 800; letter-spacing: .06em; line-height: 1.05; }
  #matchEnd.win .me-title { color: #6fd08c; }
  #matchEnd.lose .me-title { color: #ff5a68; }
  #matchEnd .me-sub { margin-top: 6px; font-size: 16px; font-weight: 600; }
  #matchEnd .me-top { margin-top: 10px; font-size: 14px; opacity: .85; }
  #matchEnd .me-next { margin-top: 10px; font-size: 13px; letter-spacing: .08em; opacity: .7; }
`);

function matchEndLeaders() {
  const rows = [{ name: typeof playerName === 'string' ? playerName : 'You', kills }];
  for (const r of net.players.values()) rows.push({ name: r.name || 'Player', kills: r.kills || 0 });
  return rows.sort((a, b) => b.kills - a.kills).slice(0, 3);
}

function matchEndResult() {
  const def = MODES_activeDef || MODES[0], id = MODES_winnerId;
  if (def.teams) return { team: id, name: BC.teamName(id) };
  const name = MODES_ffaNames.get(id);
  return { team: null, name: name || (MODES_isLocal(id, name) ? playerName : 'Someone') };
}

function matchEndShow(result) {
  if (!matchEndEl) {
    matchEndEl = document.createElement('div');
    matchEndEl.id = 'matchEnd';
    for (const name of ['me-title', 'me-sub', 'me-top', 'me-next']) {
      const row = document.createElement('div');
      row.className = name;
      matchEndEl.appendChild(row);
    }
    document.body.appendChild(matchEndEl);
  }
  const local = MODES_localTeam, won = result.team ? result.team === local : result.name === playerName;
  const [title, sub, top] = matchEndEl.children;
  title.textContent = won ? 'VICTORY' : 'DEFEAT';
  const scores = result.scores || MODES_scores;
  sub.textContent = result.team
    ? result.name + ' wins ' + scores[result.team] + ' to ' + scores[result.team === 'red' ? 'blue' : 'red']
    : (won ? 'You won the match' : result.name + ' won the match');
  top.textContent = matchEndLeaders().map((row) => row.name + ' ' + row.kills).join('   ·   ');
  matchEndEl.classList.toggle('win', won);
  matchEndEl.classList.toggle('lose', !won);
  matchEndEl.classList.add('show');
  BC.emit('sfx', { kind: 'confirm', volume: 0.7 });
}

function matchEndBegin(result) {
  matchEndState = { round: MODES_round, endAt: performance.now() + MATCH_END_MS };
  BC.flags.matchOver = true;
  gun.trigger = false;
  matchEndShow(result);
  if (typeof net !== 'undefined' && net.online && net.mode === 'mqtt' && net.hostId === net.id) {
    netMqttAuthority({ t: 'matchEnd', team: result.team, name: result.name, scores: { red: MODES_scores.red, blue: MODES_scores.blue } });
  }
}

function matchEndClear() {
  if (matchEndState) matchEndDoneRound = matchEndState.round;
  matchEndState = null;
  BC.flags.matchOver = false;
  if (matchEndEl) matchEndEl.classList.remove('show');
}

// A room peer can miss kills from before it joined, so the host's word decides.
function matchEndReceive(msg) {
  if (matchEndState || MODES_round === matchEndDoneRound) return;
  matchEndBegin({ team: msg.team === 'red' || msg.team === 'blue' ? msg.team : null, name: safeName(String(msg.name || 'Someone')), scores: msg.scores });
}

BC.on('frame', function () {
  if (!matchEndState) {
    if (MODES_winnerId != null && MODES_round !== matchEndDoneRound) matchEndBegin(matchEndResult());
    return;
  }
  // The next round started, however it got there.
  if (MODES_round !== matchEndState.round) { matchEndClear(); return; }
  const left = matchEndState.endAt - performance.now();
  matchEndEl.lastChild.textContent = left > 0 ? 'Next match in ' + Math.ceil(left / 1000) : 'Starting…';
  if (left > 0 || matchEndState.restarted) {
    if (left < -MATCH_END_GRACE_MS) matchEndClear();
    return;
  }
  matchEndState.restarted = true;
  if (!MODES_canConfigure()) return;
  const inRoom = MODES_sessionInfo().inRoom;
  MODES_resetMatch();
  if (!inRoom) { matchEndClear(); if (alive) doRespawn(); }
}, 90);
