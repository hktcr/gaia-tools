(function (root) {
  'use strict';
  const normalize = value => String(value).toLocaleLowerCase('sv').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function filterTasks(data, filters) {
    const terms = normalize(filters.query || '').trim().split(/\s+/).filter(Boolean);
    return data.tasks.filter(task => {
      const subject = data.subjects.find(item => item.id === task.subject);
      const packs = task.packages.map(id => data.packages.find(p => p.id === id).label);
      const haystack = normalize([task.id, task.title, task.prompt, subject.label, task.skill,
        ...task.concepts, ...packs, ...task.placements.map(p => data.books.find(b => b.id === p.book).label + ' ' + p.chapter)].join(' '));
      return terms.every(term => haystack.includes(term)) &&
        (!filters.subject || filters.subject === task.subject) &&
        (!filters.book || task.placements.some(p => p.book === filters.book)) &&
        (!filters.package || task.packages.includes(filters.package));
    });
  }
  function visibleRelations(data, tasks, includeProposed) {
    const ids = new Set(tasks.map(task => task.id));
    return data.relations.filter(r => ids.has(r.from) && ids.has(r.to) && (includeProposed || r.status === 'approved'));
  }
  function memberships(data, task, lens) {
    if (lens === 'books') return task.placements.map(p => p.book);
    if (lens === 'packages') return task.packages.length ? task.packages : ['unpacked'];
    return [task.subject];
  }
  function hubsFor(data, lens) {
    if (lens === 'books') return data.books;
    if (lens === 'packages') return [...data.packages, { id: 'unpacked', label: 'Utan exempelpaket', color: '#a2b1c8' }];
    return data.subjects;
  }
  function layout(data, lens) {
    const hubs = hubsFor(data, lens);
    const positions = new Map();
    hubs.forEach((hub, i) => {
      const angle = (i / hubs.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(hub.id, { x: Math.cos(angle) * 185, y: Math.sin(angle) * 137, z: Math.sin(angle * 2) * 75 });
    });
    const result = {
      hubs: hubs.map(h => ({ ...h, ...positions.get(h.id), hub: true })),
      nodes: data.tasks.map((task, i) => {
        const ids = memberships(data, task, lens);
        const anchors = ids.map(id => positions.get(id));
        const center = anchors.reduce((a, p) => ({ x: a.x + p.x / anchors.length, y: a.y + p.y / anchors.length, z: a.z + p.z / anchors.length }), { x: 0, y: 0, z: 0 });
        const peers = data.tasks.filter(t => memberships(data, t, lens)[0] === ids[0]);
        const index = peers.findIndex(t => t.id === task.id);
        const angle = index * 2.399963229728653;
        const radius = 28 + Math.sqrt(index + 1) * 22;
        return { ...task, x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius,
          z: center.z + ((i * 37) % 93 - 46), hub: false };
      })
    };
    // Deterministic spacing keeps the starting projection legible without implying a metric.
    for (let pass = 0; pass < 14; pass++) {
      for (let i = 0; i < result.nodes.length; i++) for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i], b = result.nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        if (distance < 31 && distance > 0) {
          const move = (31 - distance) / 2;
          a.x -= dx / distance * move; a.y -= dy / distance * move;
          b.x += dx / distance * move; b.y += dy / distance * move;
        }
      }
    }
    return result;
  }
  const api = { normalize, filterTasks, visibleRelations, memberships, hubsFor, layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GraphModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
