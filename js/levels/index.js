import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';
import level5 from './level5.js';
import level6 from './level6.js';

export const LEVELS = [level1, level2, level3, level4, level5, level6];

export const COMING_SOON = [];

export function startGraph(level) {
  const nodes = [
    { id: 'trigger', type: 'trigger', label: level.trigger.label, icon: level.trigger.icon, x: level.triggerPos.x, y: level.triggerPos.y, params: {}, locked: true },
    ...level.sinks.map((s) => ({ id: s.id, type: 'sink', label: s.label, icon: s.icon, x: level.sinkX, y: s.y, params: {}, locked: true })),
  ];
  return { nodes, edges: [] };
}
