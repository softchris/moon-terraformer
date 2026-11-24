const key = (items) => items.map((i) => `${i.gas}:${i.sum_output_kpa}`).sort().join('|');

export default {
  id: 5,
  key: 'plant',
  icon: '🌫',
  title: 'Create Atmosphere',
  tagline: 'Total the working gas generators per gas.',
  accomplishment: 'Atmosphere forming',
  briefing: `<p>Ten gas generators are venting nitrogen, oxygen, argon and water vapor. Some have <b>faulted</b> and produce nothing, so their numbers must not count.</p>
  <p>Drop the faulty ones with a <b>Filter</b>, total the output <b>per gas</b> with a <b>Summarize</b> grouped by <b>gas</b>, and then use an <b>IF</b> to split the gases into <i>stable</i> (at least <b>40 kPa</b>) and <i>deficit</i>.</p>`,
  steps: [
    '<b>Filter</b>: <b>status</b> is equal to <b>online</b>.',
    '<b>Summarize</b>: sum of <b>output_kpa</b>, <b>Group by gas</b>.',
    '<b>IF</b> <b>sum_output_kpa</b> ≥ <b>40</b>: true → <b>Stable</b>, false → <b>Deficit</b>.',
  ],
  hints: [
    'Without the Filter, a faulty generator inflates the total and can push a gas over the threshold it has not really reached.',
    'In Summarize, fill in "Group by" with the field name gas, otherwise you get a single grand total.',
    'After Summarize the field to check in the IF node is called sum_output_kpa.',
  ],
  allowed: ['filter', 'summarize', 'if', 'set', 'sort', 'limit'],
  fields: ['gas', 'output_kpa', 'status', 'sum_output_kpa'],
  trigger: {
    label: 'Generator Telemetry', icon: '🏭',
    items: [
      { id: 'g-01', gas: 'nitrogen', output_kpa: 22, status: 'online' },
      { id: 'g-02', gas: 'nitrogen', output_kpa: 19, status: 'online' },
      { id: 'g-03', gas: 'nitrogen', output_kpa: 25, status: 'fault' },
      { id: 'g-04', gas: 'oxygen', output_kpa: 12, status: 'online' },
      { id: 'g-05', gas: 'oxygen', output_kpa: 9, status: 'online' },
      { id: 'g-06', gas: 'oxygen', output_kpa: 25, status: 'fault' },
      { id: 'g-07', gas: 'argon', output_kpa: 8, status: 'online' },
      { id: 'g-08', gas: 'argon', output_kpa: 6, status: 'fault' },
      { id: 'g-09', gas: 'water_vapor', output_kpa: 30, status: 'online' },
      { id: 'g-10', gas: 'water_vapor', output_kpa: 18, status: 'online' },
    ],
  },
  sinks: [
    {
      id: 'stable', label: 'Stable', icon: '✅', y: 60,
      goal: 'Gases with at least 40 kPa from working generators',
      check(items) {
        if (!items.length) return { ok: false, msg: 'No gas is marked stable yet.' };
        if (key(items) !== 'nitrogen:41|water_vapor:48') return { ok: false, msg: 'Expected nitrogen (41) and water_vapor (48), one item per gas. Did you filter out faults and group by gas?' };
        return { ok: true, msg: 'Nitrogen and water vapor are stable.' };
      },
    },
    {
      id: 'deficit', label: 'Deficit', icon: '⚠️', y: 230,
      goal: 'Gases still under 40 kPa',
      check(items) {
        if (!items.length) return { ok: false, msg: 'Nothing flagged as deficit yet.' };
        if (key(items) !== 'argon:8|oxygen:21') return { ok: false, msg: 'Expected oxygen (21) and argon (8). Faulty generators must not be counted.' };
        return { ok: true, msg: 'Oxygen and argon need more generators.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 140 },
  sinkX: 1060,
  cutscene: 'plant',
};
