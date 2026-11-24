import { NODE_TYPES } from '../engine/node-types.js';

const NW = 72;
let uid = 1;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export const nodeHeight = (def) => Math.max(72, 30 * Math.max(def.inputs, def.outputs.length) + 16);

export class Editor {
  constructor(root, handlers = {}) {
    this.root = root; this.h = handlers;
    this.graph = { nodes: [], edges: [] };
    this.view = { x: 0, y: 0, s: 1 };
    this.selected = null; this.selEdge = null; this.edgeInfo = new Map();
    root.innerHTML = `<div class="vp"><svg class="wires"></svg><div class="nodes"></div></div>
      <div class="zoom-ctl"><button data-z="in" title="Zoom in">+</button><button data-z="out" title="Zoom out">−</button><button data-z="fit" title="Fit to view">⤢</button></div>`;
    this.vp = root.querySelector('.vp'); this.wires = root.querySelector('.wires'); this.nodesEl = root.querySelector('.nodes');
    this.bind();
  }

  /* ---------- graph ---------- */
  load(graph, level) {
    this.level = level;
    this.graph = JSON.parse(JSON.stringify(graph));
    uid = 1 + Math.max(0, ...this.graph.nodes.map((n) => Number(String(n.id).replace(/\D/g, '')) || 0), ...this.graph.edges.map((e) => Number(String(e.id).replace(/\D/g, '')) || 0));
    this.selected = null; this.selEdge = null; this.edgeInfo.clear();
    this.render(); this.fit();
  }
  getGraph() { return JSON.parse(JSON.stringify(this.graph)); }
  changed() { this.clearResults(); this.h.onChange && this.h.onChange(this.getGraph()); }

  addNode(type, x, y) {
    const def = NODE_TYPES[type];
    const node = { id: 'n' + uid++, type, x: Math.round(x), y: Math.round(y), params: def.defaults ? def.defaults() : {} };
    this.graph.nodes.push(node); this.render(); this.select(node.id); this.changed(); this.h.sfx && this.h.sfx('add');
    return node;
  }
  addNodeAtCenter(type) {
    const r = this.root.getBoundingClientRect();
    const jitter = (this.graph.nodes.length % 5) * 24;
    const p = this.toGraph(r.left + r.width / 2 + jitter - 36, r.top + r.height / 2 + jitter - 36);
    return this.addNode(type, p.x, p.y);
  }
  removeNode(id) {
    const n = this.graph.nodes.find((n) => n.id === id);
    if (!n || n.locked) return;
    this.graph.nodes = this.graph.nodes.filter((x) => x.id !== id);
    this.graph.edges = this.graph.edges.filter((e) => e.from !== id && e.to !== id);
    if (this.selected === id) this.select(null);
    this.render(); this.changed(); this.h.sfx && this.h.sfx('remove');
  }
  removeEdge(id) { this.graph.edges = this.graph.edges.filter((e) => e.id !== id); this.selEdge = null; this.renderEdges(); this.changed(); this.h.sfx && this.h.sfx('remove'); }
  connect(from, fromPort, to, toPort) {
    if (from === to) return;
    if (this.graph.edges.some((e) => e.from === from && e.fromPort === fromPort && e.to === to && e.toPort === toPort)) return;
    this.graph.edges.push({ id: 'e' + uid++, from, fromPort, to, toPort });
    this.renderEdges(); this.changed(); this.h.sfx && this.h.sfx('connect');
  }
  node(id) { return this.graph.nodes.find((n) => n.id === id); }
  def(n) { return NODE_TYPES[n.type]; }
  refreshNode(id) { const n = this.node(id), el = this.nodesEl.querySelector(`[data-id="${id}"] .node-sub`); if (el) el.textContent = this.subtitle(n); }
  subtitle(n) { const d = this.def(n); return d.summary ? d.summary(n.params || {}) : ''; }

  /* ---------- geometry ---------- */
  portPos(n, kind, i) {
    const d = this.def(n), h = nodeHeight(d), cnt = kind === 'out' ? d.outputs.length : d.inputs;
    return { x: n.x + (kind === 'out' ? NW : 0), y: n.y + (h * (i + 1)) / (cnt + 1) };
  }
  toGraph(cx, cy) { const r = this.root.getBoundingClientRect(); return { x: (cx - r.left - this.view.x) / this.view.s, y: (cy - r.top - this.view.y) / this.view.s }; }
  applyView() {
    const { x, y, s } = this.view;
    this.vp.style.transform = `translate(${x}px,${y}px) scale(${s})`;
    this.root.style.backgroundPosition = `${x}px ${y}px`; this.root.style.backgroundSize = `${24 * s}px ${24 * s}px`;
  }
  fit() {
    const ns = this.graph.nodes; if (!ns.length) return;
    const r = this.root.getBoundingClientRect(); if (!r.width) return;
    const minX = Math.min(...ns.map((n) => n.x)) - 40, maxX = Math.max(...ns.map((n) => n.x + NW)) + 90;
    const minY = Math.min(...ns.map((n) => n.y)) - 40, maxY = Math.max(...ns.map((n) => n.y + 110)) + 20;
    const s = Math.min(1.1, r.width / (maxX - minX), r.height / (maxY - minY));
    this.view = { s, x: (r.width - (maxX - minX) * s) / 2 - minX * s, y: (r.height - (maxY - minY) * s) / 2 - minY * s };
    this.applyView();
  }
  zoom(f, cx, cy) {
    const r = this.root.getBoundingClientRect(); cx = cx ?? r.left + r.width / 2; cy = cy ?? r.top + r.height / 2;
    const s0 = this.view.s, s = Math.min(1.6, Math.max(0.35, s0 * f)), k = s / s0;
    this.view.x = cx - r.left - (cx - r.left - this.view.x) * k; this.view.y = cy - r.top - (cy - r.top - this.view.y) * k; this.view.s = s;
    this.applyView();
  }

  /* ---------- render ---------- */
  render() {
    this.nodesEl.innerHTML = '';
    for (const n of this.graph.nodes) this.nodesEl.appendChild(this.nodeEl(n));
    this.renderEdges(); this.applyView();
  }
  nodeEl(n) {
    const d = this.def(n), h = nodeHeight(d);
    const el = document.createElement('div');
    el.className = 'node' + (n.id === this.selected ? ' selected' : '') + ' t-' + n.type;
    el.dataset.id = n.id; el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${NW}px;height:${h}px;--c:${d.color}`;
    let html = `<div class="node-box"><span class="icon">${n.icon || d.icon}</span></div><div class="badge"></div>`;
    for (let i = 0; i < d.inputs; i++) html += `<div class="port in" data-port="${i}" style="top:${(h * (i + 1)) / (d.inputs + 1)}px"></div>`;
    d.outputs.forEach((o, i) => {
      const y = (h * (i + 1)) / (d.outputs.length + 1);
      html += `<div class="port out" data-port="${i}" style="top:${y}px"></div>`;
      if (d.outputs.length > 1) html += `<div class="out-label" style="top:${y}px">${o}</div>`;
    });
    html += `<div class="node-label" style="top:${h + 6}px">${n.label || d.label}<small class="node-sub">${this.subtitle(n)}</small></div>`;
    el.innerHTML = html;
    return el;
  }
  pathD(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }
  renderEdges() {
    this.wires.innerHTML = '';
    for (const e of this.graph.edges) {
      const a = this.node(e.from), b = this.node(e.to); if (!a || !b) continue;
      const p1 = this.portPos(a, 'out', e.fromPort), p2 = this.portPos(b, 'in', e.toPort), d = this.pathD(p1, p2);
      const info = this.edgeInfo.get(e.id), g = svg('g', { class: 'edge' + (e.id === this.selEdge ? ' sel' : '') + (info ? (info.count > 0 ? ' live' : ' empty') : '') });
      g.dataset.id = e.id;
      g.appendChild(svg('path', { d, class: 'hit' })); g.appendChild(svg('path', { d, class: 'line' }));
      const mx = (p1.x + 3 * (p1.x + Math.max(40, Math.abs(p2.x - p1.x) * 0.5)) + 3 * (p2.x - Math.max(40, Math.abs(p2.x - p1.x) * 0.5)) + p2.x) / 8, my = (p1.y + p2.y) / 2;
      if (info && info.count !== undefined) {
        const t = svg('g', { class: 'count', transform: `translate(${mx},${my})` });
        const txt = `${info.count} item${info.count === 1 ? '' : 's'}`;
        t.appendChild(svg('rect', { x: -26, y: -9, width: 52, height: 18, rx: 9 }));
        const tx = svg('text', { 'text-anchor': 'middle', y: 4 }); tx.textContent = txt; t.appendChild(tx); g.appendChild(t);
      } else if (e.id === this.selEdge) {
        const t = svg('g', { class: 'del', transform: `translate(${mx},${my})` });
        t.appendChild(svg('circle', { r: 10 })); const tx = svg('text', { 'text-anchor': 'middle', y: 4 }); tx.textContent = '✕'; t.appendChild(tx); g.appendChild(t);
      }
      this.wires.appendChild(g);
    }
  }
  select(id) {
    this.selected = id; this.selEdge = null;
    this.nodesEl.querySelectorAll('.node').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
    this.renderEdges();
    this.h.onSelect && this.h.onSelect(id ? this.node(id) : null);
  }

  /* ---------- interaction ---------- */
  bind() {
    const root = this.root;
    root.querySelector('.zoom-ctl').addEventListener('click', (e) => {
      const z = e.target.dataset.z; if (z === 'in') this.zoom(1.2); else if (z === 'out') this.zoom(1 / 1.2); else if (z === 'fit') this.fit();
    });
    root.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
    root.addEventListener('dragover', (e) => e.preventDefault());
    root.addEventListener('drop', (e) => {
      e.preventDefault(); const type = e.dataTransfer.getData('text/node-type'); if (!type) return;
      const p = this.toGraph(e.clientX, e.clientY); this.addNode(type, p.x - NW / 2, p.y - 36);
    });
    window.addEventListener('keydown', (e) => {
      if (!root.offsetParent || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selEdge) this.removeEdge(this.selEdge); else if (this.selected) this.removeNode(this.selected);
      }
    });

    root.addEventListener('pointerdown', (e) => {
      const portEl = e.target.closest('.port'), nodeEl = e.target.closest('.node'), edgeEl = e.target.closest('.edge');
      if (portEl && portEl.classList.contains('out')) return this.startConnect(e, nodeEl.dataset.id, Number(portEl.dataset.port));
      if (nodeEl) return this.startDrag(e, nodeEl);
      if (edgeEl) {
        if (e.target.closest('.del')) return this.removeEdge(edgeEl.dataset.id);
        this.selEdge = edgeEl.dataset.id; this.selected = null; this.nodesEl.querySelectorAll('.node.selected').forEach((n) => n.classList.remove('selected'));
        this.renderEdges(); this.h.onSelect && this.h.onSelect(null); return;
      }
      if (e.target.closest('.zoom-ctl')) return;
      this.select(null); this.startPan(e);
    });
    root.addEventListener('dblclick', (e) => { const edgeEl = e.target.closest('.edge'); if (edgeEl) this.removeEdge(edgeEl.dataset.id); });
  }
  drag(e, onMove, onUp) {
    const mv = (ev) => onMove(ev), up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); onUp && onUp(ev); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  startPan(e) {
    const s = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
    this.root.classList.add('panning');
    this.drag(e, (ev) => { this.view.x = s.vx + ev.clientX - s.x; this.view.y = s.vy + ev.clientY - s.y; this.applyView(); }, () => this.root.classList.remove('panning'));
  }
  startDrag(e, el) {
    const n = this.node(el.dataset.id); this.select(n.id);
    const s = { x: e.clientX, y: e.clientY, nx: n.x, ny: n.y }; let moved = false;
    this.drag(e, (ev) => {
      moved = true; n.x = Math.round(s.nx + (ev.clientX - s.x) / this.view.s); n.y = Math.round(s.ny + (ev.clientY - s.y) / this.view.s);
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; this.renderEdges();
    }, () => { if (moved) this.h.onChange && this.h.onChange(this.getGraph()); });
  }
  startConnect(e, fromId, port) {
    e.stopPropagation();
    const from = this.node(fromId), p1 = this.portPos(from, 'out', port);
    const tmp = svg('path', { class: 'temp-wire' }); this.wires.appendChild(tmp);
    this.root.classList.add('connecting');
    const upd = (ev) => { const g = this.toGraph(ev.clientX, ev.clientY); tmp.setAttribute('d', this.pathD(p1, g)); };
    upd(e);
    this.drag(e, upd, (ev) => {
      tmp.remove(); this.root.classList.remove('connecting');
      const t = document.elementFromPoint(ev.clientX, ev.clientY); if (!t) return;
      const nodeEl = t.closest && t.closest('.node'); if (!nodeEl) return;
      const to = this.node(nodeEl.dataset.id), td = this.def(to); if (!td.inputs) return;
      const portEl = t.closest('.port.in');
      let tp = portEl ? Number(portEl.dataset.port) : 0;
      if (!portEl && td.inputs > 1) { // pick first free input
        const used = new Set(this.graph.edges.filter((x) => x.to === to.id).map((x) => x.toPort));
        tp = [...Array(td.inputs).keys()].find((i) => !used.has(i)) ?? 0;
      }
      this.connect(fromId, port, to.id, tp);
    });
  }

  /* ---------- run visualisation ---------- */
  clearResults() {
    this.runToken = (this.runToken || 0) + 1;
    this.edgeInfo.clear(); this.lastRun = null;
    this.nodesEl.querySelectorAll('.node').forEach((el) => {
      el.classList.remove('running', 'ok', 'err', 'idle', 'bad'); el.querySelector('.badge').textContent = ''; el.removeAttribute('title');
    });
    this.renderEdges();
  }
  async playRun(run, val) {
    this.clearResults(); const token = this.runToken; this.lastRun = run;
    for (const id of run.order) {
      if (token !== this.runToken) return false;
      const r = run.results.get(id), el = this.nodesEl.querySelector(`[data-id="${id}"]`); if (!el) continue;
      if (r.status === 'idle') { el.classList.add('idle'); continue; }
      el.classList.add('running'); await delay(230);
      if (token !== this.runToken) return false;
      el.classList.remove('running');
      this.h.sfx && this.h.sfx(r.status === 'error' ? 'error' : 'step');
      const badge = el.querySelector('.badge'), node = this.node(id);
      if (r.status === 'error') { el.classList.add('err'); badge.textContent = '!'; el.title = r.error; }
      else if (node.type === 'sink') { const v = val[id]; el.classList.add(v.ok ? 'ok' : 'bad'); badge.textContent = v.ok ? '✓' : '✗'; el.title = v.msg; }
      else { el.classList.add('ok'); badge.textContent = '✓'; }
      for (const e of this.graph.edges.filter((e) => e.from === id)) this.edgeInfo.set(e.id, { count: run.edgeCounts.get(e.id) });
      this.renderEdges();
    }
    // sinks that never received anything
    for (const s of this.graph.nodes.filter((n) => n.type === 'sink')) {
      const el = this.nodesEl.querySelector(`[data-id="${s.id}"]`), v = val[s.id];
      if (el && el.classList.contains('idle')) { el.classList.remove('idle'); el.classList.add('bad'); el.querySelector('.badge').textContent = '✗'; el.title = v.msg; }
    }
    return true;
  }
}
