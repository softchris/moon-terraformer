const nums = (items, k) => items.map((i) => i[k]).sort((a, b) => a - b).join(',');

export default {
  id: 1,
  key: 'landing',
  icon: '🚀',
  title: 'Touchdown',
  tagline: 'Land the lander on the Moon.',
  accomplishment: 'Lander on the surface',
  briefing: `<p>Your lander is falling toward the Moon and telemetry is streaming in as <b>items</b>, one per second.
  Below <b>150 m</b> the retro thrusters must fire at <b>100%</b> thrust. Above that, coast.</p>
  <p>In n8n, an <b>IF</b> node splits items into a <i>true</i> and a <i>false</i> branch, and an <b>Edit Fields (Set)</b> node adds data to every item that passes through it.</p>`,
  steps: [
    'Drag an <b>IF</b> node onto the canvas and connect <b>Telemetry Feed</b> to it.',
    'Click the IF node and set it to <b>altitude is less than 150</b>.',
    'Drag a <b>Set</b> node, add a field <b>thrust</b> with value <b>100</b>, and wire IF <i>true</i> → Set → <b>Retro Thrusters</b>.',
    'Wire IF <i>false</i> straight to <b>Coast</b>, then press <b>Execute</b>.',
  ],
  hints: [
    'Connect nodes by dragging from the dot on the right of one node to the dot on the left of the next.',
    'The IF condition field is "altitude", the operator is "is less than", the value is 150.',
    'Only the items going to Retro Thrusters need the thrust field; put the Set node after the IF true output.',
  ],
  allowed: ['if', 'set'],
  fields: ['stage', 'altitude', 'speed', 'thrust'],
  trigger: {
    label: 'Telemetry Feed',
    icon: '📡',
    items: [
      { stage: 'T-30s', altitude: 540, speed: 41 },
      { stage: 'T-20s', altitude: 320, speed: 33 },
      { stage: 'T-10s', altitude: 140, speed: 21 },
      { stage: 'T-05s', altitude: 60, speed: 12 },
    ],
  },
  sinks: [
    {
      id: 'thrusters', label: 'Retro Thrusters', icon: '🔥', y: 40,
      goal: 'Items below 150 m, each with thrust = 100',
      check(items) {
        if (!items.length) return { ok: false, msg: 'Nothing reached the thrusters yet.' };
        if (nums(items, 'altitude') !== '60,140') return { ok: false, msg: 'Only the items below 150 m should reach the thrusters.' };
        if (!items.every((i) => i.thrust === 100)) return { ok: false, msg: 'Every item needs a field thrust set to 100 (a number).' };
        return { ok: true, msg: 'Burn programmed.' };
      },
    },
    {
      id: 'coast', label: 'Coast', icon: '🛰', y: 220,
      goal: 'Items at 150 m or higher',
      check(items) {
        if (!items.length) return { ok: false, msg: 'Nothing is coasting yet.' };
        if (nums(items, 'altitude') !== '320,540') return { ok: false, msg: 'Only the high-altitude items should coast.' };
        return { ok: true, msg: 'Coasting.' };
      },
    },
  ],
  triggerPos: { x: 40, y: 120 },
  sinkX: 760,
  cutscene: 'landing',
};
