/** Tiny force-directed layout for the relationship map (deterministic, no deps). */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export function forceLayout(ids: string[], edges: GraphEdge[], width: number, height: number, iterations = 300): Map<string, GraphNode> {
  const n = ids.length;
  const nodes = new Map<string, GraphNode>();
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.35;
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    nodes.set(id, { id, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
  if (n < 2) return nodes;

  const k = Math.sqrt((width * height) / n) * 0.6;
  let temp = width / 8;
  for (let it = 0; it < iterations; it++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes.get(ids[i])!;
        const b = nodes.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        disp.get(a.id)!.x += dx;
        disp.get(a.id)!.y += dy;
        disp.get(b.id)!.x -= dx;
        disp.get(b.id)!.y -= dy;
      }
    }
    // Attraction along edges.
    for (const e of edges) {
      const a = nodes.get(e.source);
      const b = nodes.get(e.target);
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const force = (dist * dist) / k;
      disp.get(a.id)!.x -= (dx / dist) * force;
      disp.get(a.id)!.y -= (dy / dist) * force;
      disp.get(b.id)!.x += (dx / dist) * force;
      disp.get(b.id)!.y += (dy / dist) * force;
    }
    // Move, limited by temperature; gentle pull to the center.
    for (const id of ids) {
      const node = nodes.get(id)!;
      const d = disp.get(id)!;
      d.x += (cx - node.x) * 0.02;
      d.y += (cy - node.y) * 0.02;
      const len = Math.max(0.01, Math.hypot(d.x, d.y));
      node.x += (d.x / len) * Math.min(len, temp);
      node.y += (d.y / len) * Math.min(len, temp);
      node.x = Math.max(60, Math.min(width - 60, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    }
    temp *= 0.985;
  }
  return nodes;
}
