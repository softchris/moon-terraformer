export default {
  id: 2,
  key: 'base',
  icon: '🏗',
  title: 'Moon Base',
  tagline: 'Gather supplies and queue up construction.',
  accomplishment: 'Moon base constructed',
  briefing: `<p>Supply depots on Earth each expose an API. Call all three (<b>regolith</b>, <b>solar</b>, <b>habitat</b>), combine their parts into <b>one list</b>, and throw out the defective parts: anything with <b>qty = 0</b>.</p>
  <p>A <b>HTTP Request</b> node fetches data, <b>Merge</b> combines two streams (chain two Merges for three), and <b>Filter</b> keeps only matching items.</p>`,
  steps: [
    'Add three <b>HTTP Request</b> nodes, each fed by <b>Mission Start</b>, and pick a different URL on each.',
    'Combine them with <b>Merge</b> nodes (mode Append). Merge has two inputs, so chain two of them.',
    'Add a <b>Filter</b>: <b>qty is greater than 0</b>.',
    'Connect the Filter to <b>Construction Queue</b> and Execute.',
  ],
  hints: [
    'One trigger output can feed many nodes: drag several wires from the same dot.',
    'Merge #1: regolith + solar. Merge #2: (that result) + habitat.',
    'Filter field is "qty". Condition: is greater than, value 0.',
  ],
  allowed: ['http', 'merge', 'filter', 'set'],
  fields: ['category', 'part', 'qty'],
  trigger: { label: 'Mission Start', icon: '▶', items: [{ request: 'Build habitat base' }] },
  endpoints: {
    '/supplies/regolith': [
      { category: 'regolith', part: 'Regolith bricks', qty: 40 },
      { category: 'regolith', part: 'Sealant', qty: 0 },
    ],
    '/supplies/solar': [
      { category: 'solar', part: 'Solar panel', qty: 6 },
      { category: 'solar', part: 'Battery pack', qty: 4 },
    ],
    '/supplies/habitat': [
      { category: 'habitat', part: 'Airlock', qty: 1 },
      { category: 'habitat', part: 'Dome panel', qty: 12 },
      { category: 'habitat', part: 'Faulty valve', qty: 0 },
    ],
  },
  sinks: [
    {
      id: 'queue', label: 'Construction Queue', icon: '🧱', y: 130,
      goal: 'All 5 working parts from all three depots',
      check(items) {
        if (!items.length) return { ok: false, msg: 'The queue is empty.' };
        const cats = new Set(items.map((i) => i.category));
        const missing = ['regolith', 'solar', 'habitat'].filter((c) => !cats.has(c));
        if (missing.length) return { ok: false, msg: 'Missing supplies from: ' + missing.join(', ') + '.' };
        if (items.some((i) => Number(i.qty) === 0)) return { ok: false, msg: 'Defective parts (qty 0) are still in the queue.' };
        if (items.length !== 5) return { ok: false, msg: `Expected 5 parts, got ${items.length}. Check for duplicates.` };
        return { ok: true, msg: 'Construction can begin.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 130 },
  sinkX: 900,
  cutscene: 'base',
};
