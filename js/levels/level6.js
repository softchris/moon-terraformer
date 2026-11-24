export default {
  id: 6,
  key: 'oceans',
  icon: '🌊',
  title: 'Fill the Oceans',
  tagline: 'Join two datasets and choose where the first seas go.',
  accomplishment: 'Oceans filled',
  briefing: `<p>The final mission. You have a list of ocean <b>basins</b> (volume in gigaliters) and a separate list of how much <b>water supply</b> each region receives per year. Combine them with a <b>Merge</b> in <i>join</i> mode, matching on <b>region</b>.</p>
  <p>Then compute <b>fill_years = volume ÷ supply</b> with a <b>Set</b> expression, keep basins that fill in <b>10 years or less</b>, sort the fastest first and pick the top <b>three</b>. Those become the first oceans.</p>`,
  steps: [
    'Add two <b>HTTP Request</b> nodes from the trigger: <b>/basins</b> and <b>/water/supply</b>.',
    '<b>Merge</b> them: mode <b>join</b>, match field <b>region</b>.',
    '<b>Set</b> <b>fill_years</b> = <b>{{ $json.volume / $json.supply }}</b>.',
    '<b>Filter</b> fill_years ≤ 10 → <b>Sort</b> fill_years ascending → <b>Limit</b> 3 → <b>First Oceans</b>.',
  ],
  hints: [
    'Both HTTP nodes connect to the same trigger. Then one goes into Merge input 1 and the other into input 2.',
    'Expressions go inside double curly braces. {{ $json.volume / $json.supply }} divides two fields on the same item.',
    'Sort ascending puts the smallest fill_years (the quickest ocean to fill) first.',
  ],
  allowed: ['http', 'merge', 'set', 'filter', 'sort', 'limit', 'summarize'],
  fields: ['region', 'volume', 'supply', 'fill_years'],
  trigger: { label: 'Terraform Request', icon: '🌍', items: [{ request: 'Plan the first oceans' }] },
  endpoints: {
    '/basins': [
      { region: 'Mare Imbrium', volume: 900 },
      { region: 'Mare Serenitatis', volume: 400 },
      { region: 'Mare Tranquillitatis', volume: 700 },
      { region: 'Mare Crisium', volume: 150 },
      { region: 'Oceanus Procellarum', volume: 2600 },
      { region: 'Mare Nubium', volume: 500 },
    ],
    '/water/supply': [
      { region: 'Mare Imbrium', supply: 150 },
      { region: 'Mare Serenitatis', supply: 100 },
      { region: 'Mare Tranquillitatis', supply: 70 },
      { region: 'Mare Crisium', supply: 30 },
      { region: 'Oceanus Procellarum', supply: 130 },
      { region: 'Mare Nubium', supply: 25 },
    ],
  },
  sinks: [
    {
      id: 'oceans', label: 'First Oceans', icon: '🌊', y: 120,
      goal: 'The three fastest-filling basins, quickest first, each with fill_years',
      check(items) {
        if (!items.length) return { ok: false, msg: 'No basins selected yet.' };
        const got = items.map((i) => i.region);
        if (items.some((i) => i.fill_years === undefined)) return { ok: false, msg: 'Each item needs a fill_years field (Set node with the expression).' };
        if (items.length !== 3) return { ok: false, msg: `${items.length} basins arrived, expected exactly 3. Filter, sort, then Limit.` };
        const want = ['Mare Serenitatis', 'Mare Crisium', 'Mare Imbrium'];
        if (got.join() !== want.join()) return { ok: false, msg: `Got ${got.join(', ')}. Expected the quickest first: ${want.join(', ')}.` };
        return { ok: true, msg: 'Three oceans will form first.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 130 },
  sinkX: 1500,
  cutscene: 'oceans',
};
