(function (root) {
  'use strict';
  const normalize = value => String(value).toLocaleLowerCase('sv').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function memberships(data, task, lens) {
    if (lens === 'books') return [...new Set(task.placements.map(p => p.book))];
    if (lens === 'packages') return task.packages.length ? task.packages : ['unpacked'];
    if (lens === 'themes') return task.themes;
    return [task.subject];
  }
  function hubsFor(data, lens) {
    if (lens === 'packages') return data.tasks.some(t => !t.packages.length) ? [...data.packages, {id:'unpacked',label:'Utan paket',color:'#a2b1c8'}] : data.packages;
    return data[lens];
  }
  function filterTasks(data, filters) {
    const terms = normalize(filters.query || '').trim().split(/\s+/).filter(Boolean);
    return data.tasks.filter(task => {
      const labels = (items, ids) => ids.map(id => items.find(item => item.id === id)?.label || id);
      const haystack = normalize([task.id, task.title, task.prompt, ...labels(data.subjects,[task.subject]), task.skill,
        ...task.concepts, ...labels(data.packages,task.packages), ...labels(data.themes,task.themes),
        ...task.placements.map(p => labels(data.books,[p.book])[0] + ' ' + p.chapter)].join(' '));
      const selected = filters.contexts || [];
      const ids = memberships(data, task, filters.lens || 'themes');
      const matchesContext = !selected.length || (filters.match === 'any' ? selected.some(id => ids.includes(id)) : selected.every(id => ids.includes(id)));
      return terms.every(term => haystack.includes(term)) && matchesContext;
    });
  }
  function visibleRelations(data, tasks, includeProposed) {
    const ids = new Set(tasks.map(task => task.id));
    return data.relations.filter(r => ids.has(r.from) && ids.has(r.to) && (includeProposed || r.status === 'approved'));
  }
  function layout(data, lens, tasks = data.tasks) {
    const allHubs = hubsFor(data, lens);
    const hubs = allHubs.filter(h => tasks.some(t => memberships(data,t,lens).includes(h.id)));
    const positions = new Map();
    hubs.forEach((hub,i) => {
      const angle = i / hubs.length * Math.PI * 2 - Math.PI / 2;
      positions.set(hub.id,{x:Math.cos(angle)*210,y:Math.sin(angle)*155,z:Math.sin(angle*2)*45});
    });
    const result = {hubs:hubs.map(h=>({...h,...positions.get(h.id),hub:true})),nodes:tasks.map((task,i)=>{
      const ids = memberships(data,task,lens);
      const anchors = ids.map(id=>positions.get(id));
      const center = anchors.reduce((a,p)=>({x:a.x+p.x/anchors.length,y:a.y+p.y/anchors.length,z:a.z+p.z/anchors.length}),{x:0,y:0,z:0});
      const angle = i * 2.399963229728653;
      const radius = 35 + Math.sqrt(i+1)*13;
      return {...task,x:center.x*.62+Math.cos(angle)*radius,y:center.y*.62+Math.sin(angle)*radius,z:center.z+((i*37)%93-46),hub:false};
    })};
    for(let pass=0;pass<18;pass++) {
      const points=[...result.hubs,...result.nodes];
      for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
        const a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.hub||b.hub?48:28;
        if(d<min&&d>0){const move=(min-d)/2;if(!a.hub){a.x-=dx/d*move;a.y-=dy/d*move;}if(!b.hub){b.x+=dx/d*move;b.y+=dy/d*move;}}
      }
    }
    return result;
  }
  const api={normalize,filterTasks,visibleRelations,memberships,hubsFor,layout};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.GraphModel=api;
})(typeof window!=='undefined'?window:globalThis);
