// Mock n8n-style nodes. Items are plain JSON objects.
// run({inputs, params, ctx}) -> array of outputs (one array of items per output port)

export const OPS = [
  { v: 'eq', l: 'is equal to', s: '=' },
  { v: 'neq', l: 'is not equal to', s: '≠' },
  { v: 'gt', l: 'is greater than', s: '>' },
  { v: 'gte', l: 'is greater than or equal to', s: '≥' },
  { v: 'lt', l: 'is less than', s: '<' },
  { v: 'lte', l: 'is less than or equal to', s: '≤' },
  { v: 'contains', l: 'contains', s: 'contains' },
];
const opSym = (v) => (OPS.find((o) => o.v === v) || {}).s || '?';

export const clone = (x) => JSON.parse(JSON.stringify(x));
export const getPath = (obj, path) =>
  String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function compare(a, op, bRaw) {
  const b = String(bRaw ?? '');
  const an = typeof a === 'number' ? a : typeof a === 'string' && a.trim() !== '' ? Number(a) : NaN;
  const bn = Number(b);
  const numeric = !isNaN(an) && b.trim() !== '' && !isNaN(bn);
  switch (op) {
    case 'eq': return numeric ? an === bn : String(a) === b;
    case 'neq': return !compare(a, 'eq', bRaw);
    case 'gt': return numeric && an > bn;
    case 'gte': return numeric && an >= bn;
    case 'lt': return numeric && an < bn;
    case 'lte': return numeric && an <= bn;
    case 'contains': return String(a ?? '').toLowerCase().includes(b.toLowerCase());
    default: return false;
  }
}

export function evalValue(raw, json) {
  if (typeof raw !== 'string') return raw;
  const s = raw.trim();
  const run = (e) => {
    try { return new Function('$json', `"use strict"; return (${e});`)(json); }
    catch (err) { throw new Error('Expression error: ' + err.message); }
  };
  const whole = s.match(/^\{\{([\s\S]+)\}\}$/);
  if (whole && !whole[1].includes('{{')) return run(whole[1]);
  if (s.includes('{{')) return s.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => String(run(e)));
  if (s !== '' && !isNaN(Number(s))) return Number(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  return raw;
}

const needField = (p) => { if (!String(p.field || '').trim()) throw new Error('Choose a field to check'); };

export const NODE_TYPES = {
  trigger: {
    label: 'Trigger', icon: '⚡', color: '#ff6d5a', inputs: 0, outputs: ['Output'], params: [], fixed: true,
    desc: 'Starts the workflow and provides the first items.',
    summary: () => '',
    run: ({ ctx }) => [clone(ctx.level.trigger.items)],
  },
  sink: {
    label: 'Mission Output', icon: '🎯', color: '#3ddc97', inputs: 1, outputs: [], params: [], fixed: true,
    desc: 'Whatever arrives here is delivered to the mission.',
    summary: () => '',
    run: () => [],
  },
  set: {
    label: 'Edit Fields (Set)', short: 'Set', icon: '✎', color: '#8f7bff', inputs: 1, outputs: ['Output'],
    desc: 'Add or change fields on every item. Values may use expressions like {{ $json.altitude }}.',
    params: [{ key: 'fields', kind: 'fieldlist', label: 'Fields to set' }],
    defaults: () => ({ fields: [{ name: '', value: '' }] }),
    summary: (p) => p.fields.filter((f) => f.name).map((f) => `${f.name} = ${f.value}`).join(', ') || 'not configured',
    run({ inputs, params }) {
      const fields = params.fields.filter((f) => String(f.name).trim());
      if (!fields.length) throw new Error('Add at least one field name');
      return [inputs[0].map((it) => {
        const o = { ...it };
        for (const f of fields) o[f.name.trim()] = evalValue(f.value, it);
        return o;
      })];
    },
  },
  if: {
    label: 'IF', icon: '⑂', color: '#36c2a0', inputs: 1, outputs: ['true', 'false'],
    desc: 'Split items into two branches: those that match the condition (true) and the rest (false).',
    params: [
      { key: 'field', kind: 'field', label: 'Field' },
      { key: 'op', kind: 'op', label: 'Condition' },
      { key: 'value', kind: 'text', label: 'Value' },
    ],
    defaults: () => ({ field: '', op: 'eq', value: '' }),
    summary: (p) => (p.field ? `${p.field} ${opSym(p.op)} ${p.value}` : 'not configured'),
    run({ inputs, params }) {
      needField(params);
      const t = [], f = [];
      for (const it of inputs[0]) (compare(getPath(it, params.field), params.op, params.value) ? t : f).push(it);
      return [t, f];
    },
  },
  http: {
    label: 'HTTP Request', short: 'HTTP', icon: '🌐', color: '#4a90ff', inputs: 1, outputs: ['Output'],
    desc: 'Call a supply-depot API and return its items.',
    params: [{ key: 'url', kind: 'select', label: 'URL', optionsFrom: 'endpoints' }],
    defaults: () => ({ url: '' }),
    summary: (p) => p.url || 'no URL selected',
    run({ inputs, params, ctx }) {
      if (!params.url) throw new Error('Pick a URL to request');
      const data = (ctx.level.endpoints || {})[params.url];
      if (!data) throw new Error('404 Not Found: ' + params.url);
      const out = [];
      for (let i = 0; i < inputs[0].length; i++) out.push(...clone(data));
      return [out];
    },
  },
  merge: {
    label: 'Merge', icon: '⛙', color: '#27b0c9', inputs: 2, outputs: ['Output'],
    desc: 'Combine the items from two inputs into one stream.',
    params: [
      { key: 'mode', kind: 'select', label: 'Mode', options: [
        { v: 'append', l: 'Append (input 1, then input 2)' },
        { v: 'position', l: 'Combine by position' },
        { v: 'key', l: 'Combine by matching field (join)' },
      ] },
      { key: 'key', kind: 'field', label: 'Match field (for join mode)' },
    ],
    defaults: () => ({ mode: 'append', key: '' }),
    summary: (p) => (p.mode === 'position' ? 'combine by position' : p.mode === 'key' ? `join on ${p.key || '?'}` : 'append'),
    run({ inputs, params }) {
      const [a, b] = inputs;
      if (params.mode === 'key') {
        const k = String(params.key || '').trim();
        if (!k) throw new Error('Choose the field to match on');
        return [a.filter((x) => b.some((y) => getPath(y, k) === getPath(x, k)))
          .map((x) => ({ ...x, ...b.find((y) => getPath(y, k) === getPath(x, k)) }))];
      }
      if (params.mode === 'position') {
        const n = Math.max(a.length, b.length), out = [];
        for (let i = 0; i < n; i++) out.push({ ...(a[i] || {}), ...(b[i] || {}) });
        return [out];
      }
      return [[...a, ...b]];
    },
  },
  filter: {
    label: 'Filter', icon: '⛛', color: '#e8a33d', inputs: 1, outputs: ['Kept'],
    desc: 'Keep only the items that match the condition. Everything else is dropped.',
    params: [
      { key: 'field', kind: 'field', label: 'Field' },
      { key: 'op', kind: 'op', label: 'Condition' },
      { key: 'value', kind: 'text', label: 'Value' },
    ],
    defaults: () => ({ field: '', op: 'eq', value: '' }),
    summary: (p) => (p.field ? `${p.field} ${opSym(p.op)} ${p.value}` : 'not configured'),
    run({ inputs, params }) {
      needField(params);
      return [inputs[0].filter((it) => compare(getPath(it, params.field), params.op, params.value))];
    },
  },
  sort: {
    label: 'Sort', icon: '⇅', color: '#d96bb0', inputs: 1, outputs: ['Output'],
    desc: 'Order the items by a field.',
    params: [
      { key: 'field', kind: 'field', label: 'Field' },
      { key: 'order', kind: 'select', label: 'Order', options: [
        { v: 'asc', l: 'Ascending (low → high)' }, { v: 'desc', l: 'Descending (high → low)' },
      ] },
    ],
    defaults: () => ({ field: '', order: 'asc' }),
    summary: (p) => (p.field ? `${p.field} ${p.order === 'desc' ? '↓' : '↑'}` : 'not configured'),
    run({ inputs, params }) {
      needField(params);
      const dir = params.order === 'desc' ? -1 : 1;
      return [[...inputs[0]].sort((x, y) => {
        const a = getPath(x, params.field), b = getPath(y, params.field);
        if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
        return String(a).localeCompare(String(b)) * dir;
      })];
    },
  },
  switch: {
    label: 'Switch', icon: '⇶', color: '#e86bb0', inputs: 1, outputs: ['Rule 1', 'Rule 2', 'Fallback'],
    desc: 'Route each item to one output. Rules are checked in order and the first match wins; the rest go to Fallback.',
    params: [
      { key: 'field', kind: 'field', label: 'Field to check' },
      { key: 'op1', kind: 'op', label: 'Rule 1: condition' },
      { key: 'value1', kind: 'text', label: 'Rule 1: value' },
      { key: 'op2', kind: 'op', label: 'Rule 2: condition' },
      { key: 'value2', kind: 'text', label: 'Rule 2: value' },
    ],
    defaults: () => ({ field: '', op1: 'gte', value1: '', op2: 'gte', value2: '' }),
    summary: (p) => (p.field ? `${p.field}: ${opSym(p.op1)} ${p.value1} | ${opSym(p.op2)} ${p.value2}` : 'not configured'),
    run({ inputs, params }) {
      needField(params);
      const o = [[], [], []];
      for (const it of inputs[0]) {
        const v = getPath(it, params.field);
        if (compare(v, params.op1, params.value1)) o[0].push(it);
        else if (compare(v, params.op2, params.value2)) o[1].push(it);
        else o[2].push(it);
      }
      return o;
    },
  },
  summarize: {
    label: 'Summarize', icon: 'Σ', color: '#5aa9ff', inputs: 1, outputs: ['Output'],
    desc: 'Collapse many items into one (or one per group) by summing, counting, averaging or taking min/max.',
    params: [
      { key: 'op', kind: 'select', label: 'Operation', options: [
        { v: 'sum', l: 'Sum' }, { v: 'count', l: 'Count' }, { v: 'average', l: 'Average' }, { v: 'min', l: 'Min' }, { v: 'max', l: 'Max' },
      ] },
      { key: 'field', kind: 'field', label: 'Field to summarize' },
      { key: 'groupBy', kind: 'field', label: 'Group by (optional)' },
    ],
    defaults: () => ({ op: 'sum', field: '', groupBy: '' }),
    summary: (p) => (p.op === 'count' ? 'count' : p.field ? `${p.op} of ${p.field}` : 'not configured') + (p.groupBy ? ` by ${p.groupBy}` : ''),
    run({ inputs, params }) {
      const op = params.op, f = String(params.field || '').trim(), g = String(params.groupBy || '').trim();
      if (op !== 'count' && !f) throw new Error('Choose the field to summarize');
      const groups = new Map();
      for (const it of inputs[0]) { const k = g ? getPath(it, g) : '__all'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
      const out = [];
      for (const [k, items] of groups) {
        const nums = op === 'count' ? [] : items.map((i) => Number(getPath(i, f))).filter((n) => !isNaN(n));
        let v;
        if (op === 'count') v = items.length;
        else if (op === 'sum') v = nums.reduce((a, b) => a + b, 0);
        else if (op === 'average') v = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        else if (op === 'min') v = Math.min(...nums);
        else v = Math.max(...nums);
        const row = {}; if (g) row[g] = k; row[op === 'count' ? 'count' : `${op}_${f}`] = Math.round(v * 1000) / 1000;
        out.push(row);
      }
      return [out];
    },
  },
  limit: {
    label: 'Limit', icon: '⏍', color: '#9aa4b8', inputs: 1, outputs: ['Output'],
    desc: 'Keep only the first N items.',
    params: [{ key: 'n', kind: 'number', label: 'Max items' }],
    defaults: () => ({ n: 5 }),
    summary: (p) => `first ${p.n}`,
    run({ inputs, params }) {
      const n = Number(params.n);
      if (!(n >= 0)) throw new Error('Max items must be a number');
      return [inputs[0].slice(0, n)];
    },
  },
};
