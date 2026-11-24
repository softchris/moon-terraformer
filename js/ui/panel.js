import { NODE_TYPES, OPS } from '../engine/node-types.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const json = (items) => esc(items.map((i) => JSON.stringify(i)).join('\n')) || '<i>no items</i>';

export class Panel {
  constructor({ palette, mission, node, tabs }, handlers) {
    this.palEl = palette; this.missionEl = mission; this.nodeEl = node; this.tabsEl = tabs; this.h = handlers;
    this.hintsShown = 0;
    tabs.addEventListener('click', (e) => { const t = e.target.dataset.tab; if (t) this.tab(t); });
    mission.addEventListener('click', (e) => {
      if (e.target.id === 'hintBtn') { this.hintsShown = Math.min(this.level.hints.length, this.hintsShown + 1); this.renderMission(); }
    });
  }
  tab(name) {
    this.tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    this.missionEl.hidden = name !== 'mission'; this.nodeEl.hidden = name !== 'node';
  }

  /* ----- palette ----- */
  setLevel(level) {
    this.level = level; this.hintsShown = 0; this.val = null;
    document.getElementById('fieldsDl').innerHTML = (level.fields || []).map((f) => `<option value="${f}">`).join('');
    this.palEl.innerHTML = '<h4>Nodes</h4>';
    for (const t of level.allowed) {
      const d = NODE_TYPES[t], el = document.createElement('div');
      el.className = 'pal-item'; el.draggable = true; el.style.setProperty('--c', d.color); el.title = d.desc;
      el.innerHTML = `<span class="pi">${d.icon}</span><span><b>${d.short || d.label}</b><small>${d.desc.split('.')[0]}</small></span>`;
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/node-type', t); e.dataTransfer.effectAllowed = 'copy'; });
      el.addEventListener('click', () => this.h.onAdd(t));
      this.palEl.appendChild(el);
    }
    const tip = document.createElement('p'); tip.className = 'pal-tip'; tip.innerHTML = 'Drag onto the canvas, or click to add.<br>Select a wire or node and press <kbd>Delete</kbd> to remove it.';
    this.palEl.appendChild(tip);
    this.renderMission(); this.showNode(null); this.tab('mission');
  }
  setValidation(val) { this.val = val; this.renderMission(); }

  /* ----- mission tab ----- */
  renderMission() {
    const L = this.level, v = this.val;
    const objectives = L.sinks.map((s) => {
      const r = v && v[s.id], st = r ? (r.ok ? 'ok' : 'bad') : '';
      return `<li class="${st}"><span class="dot">${r ? (r.ok ? '✓' : '✗') : '○'}</span><div><b>${s.icon} ${s.label}</b><small>${s.goal}</small>${r && !r.ok ? `<em>${esc(r.msg)}</em>` : ''}</div></li>`;
    }).join('');
    this.missionEl.innerHTML = `
      <h2>${L.icon} Mission ${L.id}: ${L.title}</h2>
      <div class="briefing">${L.briefing}</div>
      <h3>Objectives</h3><ul class="objectives">${objectives}</ul>
      <h3>Steps</h3><ol class="steps">${L.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      <div class="hints">${L.hints.slice(0, this.hintsShown).map((h) => `<p>💡 ${h}</p>`).join('')}
      ${this.hintsShown < L.hints.length ? `<button id="hintBtn" class="ghost">Need a hint? (${this.hintsShown}/${L.hints.length})</button>` : ''}</div>
      <h3>Incoming data · ${L.trigger.label}</h3><pre class="data">${json(L.trigger.items)}</pre>`;
  }

  /* ----- node tab ----- */
  showNode(node, run) {
    const el = this.nodeEl;
    if (!node) { el.innerHTML = '<p class="empty">Select a node to configure it and inspect its data.</p>'; return; }
    const d = NODE_TYPES[node.type];
    el.innerHTML = `<div class="node-head" style="--c:${d.color}"><span class="pi">${node.icon || d.icon}</span><div><b>${node.label || d.label}</b><small>${d.desc}</small></div></div>`;
    const form = document.createElement('div'); form.className = 'form'; el.appendChild(form);
    for (const p of d.params) form.appendChild(this.param(node, p));
    if (!d.params.length) form.innerHTML = '<p class="empty">Nothing to configure.</p>';
    const out = document.createElement('div'); out.className = 'run-data'; el.appendChild(out); this.runEl = out;
    if (run) this.showRunData(node, run);
    if (node.id !== this.curNode) this.tab('node');
    this.curNode = node.id;
  }
  showRunData(node, run) {
    const r = run.results.get(node.id), d = NODE_TYPES[node.type]; if (!this.runEl || !r) return;
    let h = '';
    if (r.status === 'error') h += `<div class="err-box">⚠ ${esc(r.error)}</div>`;
    if (r.status === 'idle') h += '<p class="empty">This node did not run: no items reached it.</p>';
    if (r.status !== 'idle') {
      r.inputs.forEach((a, i) => { h += `<h3>Input${r.inputs.length > 1 ? ' ' + (i + 1) : ''} · ${a.length} item${a.length === 1 ? '' : 's'}</h3><pre class="data">${json(a)}</pre>`; });
      r.outputs.forEach((a, i) => { h += `<h3>Output${d.outputs.length > 1 ? ' ' + d.outputs[i] : ''} · ${a.length} item${a.length === 1 ? '' : 's'}</h3><pre class="data">${json(a)}</pre>`; });
    }
    this.runEl.innerHTML = h;
  }
  clearRunData() { if (this.runEl) this.runEl.innerHTML = ''; }

  param(node, p) {
    const row = document.createElement('label'); row.className = 'row';
    const set = (v) => { node.params[p.key] = v; this.h.onParam(node); };
    row.innerHTML = `<span>${p.label}</span>`;
    let inp;
    if (p.kind === 'field') { inp = document.createElement('input'); inp.setAttribute('list', 'fieldsDl'); inp.placeholder = 'e.g. altitude'; inp.value = node.params[p.key] ?? ''; inp.oninput = () => set(inp.value); }
    else if (p.kind === 'text') { inp = document.createElement('input'); inp.value = node.params[p.key] ?? ''; inp.oninput = () => set(inp.value); }
    else if (p.kind === 'number') { inp = document.createElement('input'); inp.type = 'number'; inp.value = node.params[p.key] ?? ''; inp.oninput = () => set(inp.value === '' ? '' : Number(inp.value)); }
    else if (p.kind === 'op') { inp = document.createElement('select'); inp.innerHTML = OPS.map((o) => `<option value="${o.v}">${o.l}</option>`).join(''); inp.value = node.params[p.key]; inp.onchange = () => set(inp.value); }
    else if (p.kind === 'select') {
      inp = document.createElement('select');
      const opts = p.optionsFrom ? [{ v: '', l: '— choose —' }, ...Object.keys(this.level.endpoints || {}).map((k) => ({ v: k, l: k }))] : p.options;
      inp.innerHTML = opts.map((o) => `<option value="${o.v}">${o.l}</option>`).join(''); inp.value = node.params[p.key] ?? ''; inp.onchange = () => set(inp.value);
    } else if (p.kind === 'fieldlist') {
      inp = document.createElement('div'); inp.className = 'fieldlist';
      const draw = () => {
        inp.innerHTML = '';
        node.params[p.key].forEach((f, i) => {
          const r = document.createElement('div'); r.className = 'fl-row';
          const n = document.createElement('input'); n.placeholder = 'field name'; n.value = f.name; n.setAttribute('list', 'fieldsDl'); n.oninput = () => { f.name = n.value; this.h.onParam(node); };
          const v = document.createElement('input'); v.placeholder = 'value or {{ $json.x }}'; v.value = f.value; v.oninput = () => { f.value = v.value; this.h.onParam(node); };
          const x = document.createElement('button'); x.className = 'ghost'; x.textContent = '✕'; x.onclick = (e) => { e.preventDefault(); node.params[p.key].splice(i, 1); if (!node.params[p.key].length) node.params[p.key].push({ name: '', value: '' }); draw(); this.h.onParam(node); };
          r.append(n, v, x); inp.appendChild(r);
        });
        const add = document.createElement('button'); add.className = 'ghost'; add.textContent = '+ Add field'; add.onclick = (e) => { e.preventDefault(); node.params[p.key].push({ name: '', value: '' }); draw(); };
        inp.appendChild(add);
      };
      draw();
    }
    row.appendChild(inp);
    return row;
  }
}
