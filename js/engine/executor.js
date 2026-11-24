import { NODE_TYPES, clone } from './node-types.js';

// Runs a graph. Every node is evaluated (post-order, so upstream first).
// A node only "executes" if it is a trigger or received at least one item.
export function execute(graph, ctx) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const results = new Map();
  const visiting = new Set();
  const order = [];

  function evalNode(id) {
    if (results.has(id)) return results.get(id);
    const node = nodes.get(id);
    const def = NODE_TYPES[node.type];
    const res = { id, status: 'idle', error: null, inputs: [], outputs: [] };
    if (visiting.has(id)) {
      res.status = 'error'; res.error = 'Loop detected: a node cannot feed itself';
      results.set(id, res); order.push(id); return res;
    }
    visiting.add(id);
    res.inputs = Array.from({ length: def.inputs }, () => []);
    for (const e of graph.edges.filter((e) => e.to === id)) {
      const up = evalNode(e.from);
      const out = up.outputs[e.fromPort] || [];
      if (res.inputs[e.toPort]) res.inputs[e.toPort].push(...clone(out));
    }
    visiting.delete(id);
    const total = res.inputs.reduce((s, a) => s + a.length, 0);
    res.outputs = def.outputs.map(() => []);
    if (node.type === 'trigger' || total > 0) {
      try {
        res.outputs = def.run({ inputs: res.inputs, params: node.params || {}, ctx, node });
        res.status = 'success';
      } catch (err) {
        res.status = 'error'; res.error = err.message; res.outputs = def.outputs.map(() => []);
      }
    }
    results.set(id, res); order.push(id);
    return res;
  }

  for (const n of graph.nodes) evalNode(n.id);

  const edgeCounts = new Map();
  for (const e of graph.edges) {
    const r = results.get(e.from);
    edgeCounts.set(e.id, (r.outputs[e.fromPort] || []).length);
  }
  return { results, order, edgeCounts };
}

export function validate(level, run) {
  const out = {};
  for (const s of level.sinks) {
    const r = run.results.get(s.id);
    const items = (r && r.inputs[0]) || [];
    out[s.id] = { items, ...s.check(items) };
  }
  out.allOk = level.sinks.every((s) => out[s.id].ok);
  return out;
}
