import { loadAssets } from './assets.js';
import { World } from './world.js';
import { CUTSCENES } from './cutscenes.js';
import { LEVELS, COMING_SOON, startGraph } from './levels/index.js';
import { Editor } from './canvas/editor.js';
import { Panel } from './ui/panel.js';
import { execute, validate } from './engine/executor.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('moon.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('moon.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem('moon.' + k); } catch { /* ignore */ } },
};

let world, editor, panel;
let done = store.get('done', 0);
let busy = false;
const level = () => LEVELS[done];

/* ───────── captions ───────── */
const capEl = $('caption'); let capTimer;
const ui = {
  caption(text) { clearTimeout(capTimer); capEl.textContent = text; capEl.classList.add('show'); },
  clear() { capEl.classList.remove('show'); },
  sfx: (n, o) => audio.sfx(n, o), loop: (n, f) => audio.loop(n, f), stopLoop: (n, f) => audio.stopLoop(n, f),
};

/* ───────── HUD ───────── */
function renderHud() {
  const L = level();
  $('missionCard').innerHTML = L
    ? `<div class="eyebrow">Mission ${L.id} of ${LEVELS.length}</div><h2>${L.icon} ${L.title}</h2><p>${L.tagline}</p><button id="openEditor" class="primary">Open workflow editor</button>${done ? '<p class="small-hint">Tip: click any structure on the Moon to inspect it.</p>' : ''}`
    : `<div class="eyebrow">All missions complete</div><h2>🌍 The Moon is alive</h2><p>You landed, built a base, found water, made air and filled the oceans. A dead rock is now a world.</p><p class="small-hint">Tip: click any structure on the Moon to inspect it.</p>`;
  $('progressCard').innerHTML = `<div class="eyebrow">Terraforming progress</div><ul>${
    LEVELS.map((l, i) => `<li class="${i < done ? 'done' : i === done ? 'current' : ''}"><span>${i < done ? '✓' : l.icon}</span>${l.accomplishment}</li>`).join('')
  }${COMING_SOON.map((c) => `<li class="soon"><span>${c.icon}</span>${c.title}<em>soon</em></li>`).join('')}</ul>`;
  const b = $('openEditor'); if (b) b.onclick = openEditor;
}

/* ───────── click-to-inspect structures ───────── */
const canInspect = () => world && !$('hud').hidden && !busy;
function showInfo(info) {
  const c = $('infoCard');
  c.innerHTML = `<button class="ghost x" id="infoX" title="Close">✕</button><div class="eyebrow">Structure</div><h3>${info.title}</h3><p>${info.desc}</p><span class="tagline">Built in Mission ${info.mission}: ${info.missionTitle}</span>`;
  c.hidden = false; $('infoX').onclick = closeInfo;
}
function closeInfo() { $('infoCard').hidden = true; if (world) { world.deselect(); if (!busy) world.setAuto(true); } }
function bindInspect() {
  const cv = $('scene'); let down = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', (e) => {
    if (!down || !canInspect()) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 5) return;
    const hit = world.pick(e.clientX, e.clientY);
    if (!hit) { if (!$('infoCard').hidden) closeInfo(); return; }
    audio.sfx('click'); world.select(hit.object); showInfo(hit.info); world.focus(hit.object);
  });
  cv.addEventListener('pointermove', (e) => { cv.style.cursor = canInspect() && world.pick(e.clientX, e.clientY) ? 'pointer' : ''; });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('infoCard').hidden) closeInfo(); });
}

/* ───────── editor ───────── */
function toast(msg, kind = '') {
  const t = $('toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 3200);
}
function openEditor() {
  const L = level(); if (!L || busy) return;
  closeInfo();
  const graph = store.get('graph.' + L.id, null) || startGraph(L);
  $('hud').hidden = true;
  $('editor').hidden = false; audio.sfx('click'); audio.setMood('editor');
  $('edTitle').textContent = `Mission ${L.id}: ${L.title}`;
  panel.setLevel(L);
  editor.load(graph, L);
  requestAnimationFrame(() => editor.fit());
}
function closeEditor() { $('editor').hidden = true; $('hud').hidden = false; audio.setMood('hub'); }

async function runWorkflow() {
  if (busy) return; const L = level();
  const graph = editor.getGraph();
  const res = execute(graph, { level: L }), val = validate(L, res);
  busy = true; $('runBtn').disabled = true;
  const ok = await editor.playRun(res, val);
  busy = false; $('runBtn').disabled = false;
  if (ok === false) return;
  panel.setValidation(val);
  if (editor.selected) panel.showRunData(editor.node(editor.selected), res);
  const errs = [...res.results.values()].filter((r) => r.status === 'error');
  if (val.allOk) {
    toast('Workflow complete. Mission success!', 'ok'); audio.sfx('success');
    await new Promise((r) => setTimeout(r, 1300));
    await completeLevel(L);
  } else if (errs.length) {
    toast('A node failed: select the red node to see why.', 'bad'); audio.sfx('fail'); panel.tab('mission');
  } else {
    toast('Not quite. Check the objectives for what is missing.', 'bad'); audio.sfx('fail'); panel.tab('mission');
  }
}

async function completeLevel(L) {
  busy = true;
  closeInfo(); closeEditor(); $('hud').hidden = true; audio.setMood('cutscene');
  const next = Math.max(done, L.id);
  await CUTSCENES[L.cutscene](world, ui);
  ui.clear();
  done = next; store.set('done', done); store.del('graph.' + L.id);
  world.setAuto(true); audio.setMood('hub');
  busy = false;
  renderHud(); $('hud').hidden = false;
}

/* ───────── boot ───────── */
async function boot() {
  const fill = $('loadFill');
  await loadAssets((p) => { fill.style.width = Math.round(p * 100) + '%'; });
  world = new World($('scene'));
  world.restore(done);
  let last = performance.now();
  world.renderer.setAnimationLoop((now) => { world.update((now - last) / 1000); last = now; });

  editor = new Editor($('canvasWrap'), {
    onChange: (g) => { const L = level(); if (L) store.set('graph.' + L.id, g); panel.clearRunData(); },
    sfx: (n) => audio.sfx(n),
    onSelect: (node) => { panel.showNode(node, editor.lastRun); if (!node) panel.tab('mission'); },
  });
  panel = new Panel({ palette: $('palette'), mission: $('tabMission'), node: $('tabNode'), tabs: $('tabs') }, {
    onAdd: (t) => editor.addNodeAtCenter(t),
    onParam: (node) => { editor.refreshNode(node.id); editor.changed(); },
  });

  bindInspect();
  $('runBtn').onclick = runWorkflow;
  $('closeBtn').onclick = () => { if (!busy) closeEditor(); };
  $('clearBtn').onclick = () => { const L = level(); store.del('graph.' + L.id); editor.load(startGraph(L), L); panel.setValidation(null); panel.showNode(null); };
  $('resetBtn').onclick = () => { if (confirm('Reset all progress and start from orbit?')) { store.del('done'); LEVELS.forEach((l) => store.del('graph.' + l.id)); location.reload(); } };

  const start = $('startBtn');
  start.disabled = false; start.textContent = done ? 'Continue mission' : 'Begin mission';
  const mute = $('muteBtn'); const paintMute = () => { mute.textContent = audio.muted ? '🔇' : '🔊'; mute.title = (audio.muted ? 'Unmute' : 'Mute') + ' (M)'; };
  paintMute(); mute.onclick = () => { audio.start(); audio.toggleMute(); paintMute(); };
  window.addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { audio.start(); audio.toggleMute(); paintMute(); } });
  start.onclick = () => { audio.start(); audio.sfx('click'); audio.setMood('hub'); $('intro').classList.add('gone'); renderHud(); $('hud').hidden = false; };
  $('loadFill').parentElement.style.display = 'none';

  // Dev helpers: ?dev lets you jump around from the console
  window.__game = { world, editor, panel, LEVELS, startGraph, execute, validate,
    audio, play: (name) => CUTSCENES[name](world, ui).then(() => { ui.clear(); world.setAuto(true); }),
    open: openEditor, setDone: (n) => { done = n; store.set('done', n); renderHud(); } };
}
boot().catch((e) => { console.error(e); $('startBtn').textContent = 'Failed to load: ' + e.message; });
