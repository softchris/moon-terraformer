export default {
  id: 3,
  key: 'telescope',
  icon: '🔭',
  title: 'Deep-Space Telescope',
  tagline: 'Pick the single best site for the telescope.',
  accomplishment: 'Telescope online',
  briefing: `<p>Surveyors scored eight candidate sites. A telescope needs a site <b>in sunlight</b> (shadow = no) with <b>flatness of at least 70</b>, and among those, the <b>highest elevation</b> wins.</p>
  <p>Chain <b>Filter → Filter → Sort → Limit</b>. n8n runs each node over <i>all</i> items at once, which is what makes data pipelines like this so compact.</p>`,
  steps: [
    'Filter 1: <b>shadow is equal to no</b>.',
    'Filter 2: <b>flatness is greater than or equal to 70</b>.',
    'Sort by <b>elevation</b>, descending.',
    'Limit to <b>1</b> item, connect to <b>Telescope Site</b>, and Execute.',
  ],
  hints: [
    'You can click an item list on a node after executing to see what went in and what came out.',
    'Remember: Sort order "Descending" puts the highest elevation first.',
    'After Sort, Limit keeps only the first item, which is the winner.',
  ],
  allowed: ['filter', 'sort', 'limit', 'set', 'if'],
  fields: ['site', 'elevation', 'flatness', 'shadow'],
  trigger: {
    label: 'Survey Results',
    icon: '🗺',
    items: [
      { site: 'Peak Alpha', elevation: 1800, flatness: 82, shadow: 'no' },
      { site: 'Crater Floor B', elevation: 200, flatness: 95, shadow: 'no' },
      { site: 'Ridge Gamma', elevation: 2400, flatness: 55, shadow: 'no' },
      { site: 'Mount Delta', elevation: 2900, flatness: 90, shadow: 'yes' },
      { site: 'Plateau Epsilon', elevation: 2200, flatness: 78, shadow: 'no' },
      { site: 'Basin Zeta', elevation: 900, flatness: 88, shadow: 'no' },
      { site: 'Spire Eta', elevation: 3100, flatness: 30, shadow: 'no' },
      { site: 'Terrace Theta', elevation: 2600, flatness: 91, shadow: 'yes' },
    ],
  },
  sinks: [
    {
      id: 'site', label: 'Telescope Site', icon: '📍', y: 120,
      goal: 'Exactly one site: the best sunlit, flat, high-elevation one',
      check(items) {
        if (!items.length) return { ok: false, msg: 'No site selected yet.' };
        if (items.length > 1) return { ok: false, msg: `${items.length} sites arrived. Only one telescope fits: use Limit.` };
        if (items[0].shadow !== 'no') return { ok: false, msg: 'That site is in permanent shadow.' };
        if (items[0].flatness < 70) return { ok: false, msg: 'That site is too bumpy (flatness under 70).' };
        if (items[0].site !== 'Plateau Epsilon') return { ok: false, msg: 'There is a higher site that still qualifies. Check your Sort.' };
        return { ok: true, msg: 'Plateau Epsilon selected.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 120 },
  sinkX: 1060,
  cutscene: 'telescope',
};
