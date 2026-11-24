const names = (items) => items.map((i) => i.site).sort().join('|');

export default {
  id: 4,
  key: 'mine',
  icon: '💧',
  title: 'Extract Water',
  tagline: 'Triage the polar ice deposits and fill the tanks.',
  accomplishment: 'Water extraction online',
  briefing: `<p>Orbital scans found nine polar ice deposits. Sort them with a <b>Switch</b>: deposits with <b>ice_pct ≥ 60</b> get drilled now, those with <b>≥ 20</b> need a second survey, and everything else is skipped.</p>
  <p>A Switch checks its rules <b>in order and the first match wins</b>. That means a rich deposit never leaks into Rule 2 even though 80 is also "≥ 20". Then a <b>Summarize</b> node adds up the liters from the drill list so the tank crew knows how much water to expect.</p>`,
  steps: [
    'Add a <b>Switch</b>. Field <b>ice_pct</b>. Rule 1: <b>≥ 60</b>. Rule 2: <b>≥ 20</b>.',
    'Connect <b>Rule 1</b> → <b>Summarize</b> (sum of <b>liters</b>) → <b>Water Tank</b>.',
    'Connect <b>Rule 2</b> → <b>Resurvey</b>, and <b>Fallback</b> → <b>Skip</b>.',
    'Execute and read the item counts on each wire.',
  ],
  hints: [
    'Rule order matters: put the strictest rule (60) first, so it grabs the rich deposits before Rule 2 sees them.',
    'The Summarize node produces one item with a field named sum_liters.',
    'Click the Switch node after executing to see which items went to which output.',
  ],
  allowed: ['switch', 'summarize', 'filter', 'set', 'sort'],
  fields: ['site', 'ice_pct', 'liters', 'sum_liters'],
  trigger: {
    label: 'Ice Survey', icon: '🛰',
    items: [
      { site: 'Shackleton Rim', ice_pct: 82, liters: 1200 },
      { site: 'Cabeus Floor', ice_pct: 64, liters: 900 },
      { site: 'Haworth Basin', ice_pct: 45, liters: 600 },
      { site: 'Faustini Crater', ice_pct: 71, liters: 1000 },
      { site: 'Shoemaker', ice_pct: 12, liters: 150 },
      { site: 'de Gerlache', ice_pct: 55, liters: 700 },
      { site: 'Nobile Rim', ice_pct: 33, liters: 400 },
      { site: 'Amundsen Floor', ice_pct: 91, liters: 1500 },
      { site: 'Wiechert Plain', ice_pct: 8, liters: 90 },
    ],
  },
  sinks: [
    {
      id: 'tank', label: 'Water Tank', icon: '🛢', y: 10,
      goal: 'One item: the total liters from the rich (≥ 60%) deposits',
      check(items) {
        if (!items.length) return { ok: false, msg: 'No water has reached the tank yet.' };
        if (items.length > 1) return { ok: false, msg: `${items.length} items arrived. Use Summarize to collapse them into one total.` };
        if (items[0].sum_liters === undefined) return { ok: false, msg: 'The item needs a sum_liters field (Summarize → Sum of liters).' };
        if (items[0].sum_liters !== 4600) return { ok: false, msg: `The total is ${items[0].sum_liters}, expected 4600. Check which deposits reached Rule 1.` };
        return { ok: true, msg: '4,600 liters incoming.' };
      },
    },
    {
      id: 'resurvey', label: 'Resurvey', icon: '🔎', y: 170,
      goal: 'The three medium deposits (20–59% ice)',
      check(items) {
        if (!items.length) return { ok: false, msg: 'Nothing queued for resurvey.' };
        if (names(items) !== 'Haworth Basin|Nobile Rim|de Gerlache') return { ok: false, msg: `Expected the three 20–59% deposits, got ${items.length} item(s). Rule 1 should take the 60%+ ones first.` };
        return { ok: true, msg: 'Resurvey scheduled.' };
      },
    },
    {
      id: 'skip', label: 'Skip', icon: '🚫', y: 330,
      goal: 'The two poor deposits (under 20% ice)',
      check(items) {
        if (!items.length) return { ok: false, msg: 'Nothing was skipped. Connect the Fallback output.' };
        if (names(items) !== 'Shoemaker|Wiechert Plain') return { ok: false, msg: 'Only the two deposits under 20% belong here. Use the Fallback output.' };
        return { ok: true, msg: 'Poor deposits skipped.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 150 },
  sinkX: 1020,
  cutscene: 'mine',
};
