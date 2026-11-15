(function () {
  'use strict';
  const data = window.GraphData;
  const model = window.GraphModel;
  const $ = id => document.getElementById(id);
  const canvas = $('graph');
  const context = canvas.getContext('2d');
  const state = { lens: 'subjects', view: 'map', selected: 'EX-03', query: '', subject: '', book: '', package: '',
    includeProposed: false, showRelations: true, yaw: -0.13, pitch: 0.16, zoom: 1, hover: null };
  let filtered = [], graphLayout, projected = [], canvasWidth = 0, canvasHeight = 0, frame = 0, drag = null;
  const taskById = id => data.tasks.find(task => task.id === id);
  const labelFor = (items, id) => items.find(item => item.id === id)?.label || id;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const subjectOf = task => data.subjects.find(subject => subject.id === task.subject);

  [['subject-filter', data.subjects], ['book-filter', data.books], ['package-filter', data.packages]].forEach(([id, items]) => {
    items.forEach(item => { const option = node('option', '', item.label); option.value = item.id; $(id).append(option); });
  });


  let detailOrigin = null, detailOriginTask = null;
  function setDetailModal(active) {
    document.querySelector('.visual-area').inert = active;
    document.querySelector('.map-toolbar').inert = active;
  }
  const closePanel = (id, trigger) => {
    $(id).hidden = true;
    if (id === 'detail-panel') setDetailModal(false);
    if (trigger) $(trigger).setAttribute('aria-expanded', 'false');
  };
  const panels = [['filter-panel','toggle-filters'],['info-panel','toggle-info'],['detail-panel',null]];
  function openPanel(id) {
    panels.forEach(([other,trigger]) => { if(other !== id) closePanel(other,trigger); });
    $(id).hidden = false;
    if (id === 'detail-panel') setDetailModal(true);
    const entry = panels.find(([panel]) => panel === id);
    if(entry[1]) $(entry[1]).setAttribute('aria-expanded','true');
  }
  function dismissPanel(id, trigger) {
    closePanel(id, trigger);
    if (trigger) { $(trigger).focus({preventScroll:true}); return; }
    // List buttons are recreated by refresh(); resolve the original task by ID.
    const listOrigin = detailOriginTask && state.view === 'list'
      ? Array.from($('task-list').querySelectorAll('[data-task]')).find(button => button.dataset.task === detailOriginTask)
      : null;
    const target = listOrigin || (detailOrigin?.isConnected && !detailOrigin.closest('[hidden], [inert]') ? detailOrigin : null);
    if (target) target.focus({preventScroll:true});
    else $(state.view === 'map' ? 'graph' : 'show-list').focus({preventScroll:true});
  }
  [['toggle-filters','filter-panel','close-filters'],['toggle-info','info-panel','close-info']].forEach(([trigger,id,close])=>{
    $(trigger).addEventListener('click',()=>{
      if(!$(id).hidden) dismissPanel(id,trigger);
      else { openPanel(id); $(id === 'filter-panel' ? 'search' : close).focus({preventScroll:true}); }
    });
    $(close).addEventListener('click',()=>dismissPanel(id,trigger));
  });
  $('close-detail').addEventListener('click',()=>dismissPanel('detail-panel',null));

  // Non-modal panels yield to the next focus target instead of covering it.
  function revealFocusTarget(target) {
    if (!target) return;
    panels.forEach(([id, trigger]) => {
      if (!trigger || $(id).hidden) return;
      if (!$(id).contains(target) && !$(trigger).contains(target)) closePanel(id, trigger);
    });
  }
  document.addEventListener('focusout', event => revealFocusTarget(event.relatedTarget));
  document.addEventListener('focusin', event => revealFocusTarget(event.target));

  document.addEventListener('keydown',event=>{
    if (event.key === 'Tab' && !$('detail-panel').hidden) {
      const controls = Array.from($('detail-panel').querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      )).filter(element => !element.closest('[hidden], [inert]') && element.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const current = controls.indexOf(document.activeElement);
      if (current === -1 || (event.shiftKey && current === 0) || (!event.shiftKey && current === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
      return;
    }
    if(event.key !== 'Escape') return;
    const opened = panels.find(([id])=>!$(id).hidden);
    if(opened){ event.preventDefault(); dismissPanel(...opened); }
  });

  function resetFilters() {
    state.query = state.subject = state.book = state.package = '';
    $('search').value = $('subject-filter').value = $('book-filter').value = $('package-filter').value = '';
  }
  function refresh(announcement) {
    filtered = model.filterTasks(data, state);
    if (!filtered.some(task => task.id === state.selected)) state.selected = filtered[0]?.id || null;
    graphLayout = model.layout(data, state.lens);
    $('empty-map').hidden = filtered.length > 0;
    $('empty-list').hidden = filtered.length > 0;
    const edges = model.visibleRelations(data, filtered, state.includeProposed);
    const proposed = edges.filter(edge => edge.status === 'proposed').length;
    $('results').textContent = announcement || `${filtered.length} av ${data.tasks.length} original · ${edges.length - proposed} godkända demorelationer${state.includeProposed ? ` · ${proposed} förslag` : ''}`;
    renderList(); renderDetail(); scheduleDraw();
  }
  function renderList() {
    const previous = document.activeElement?.dataset.task;
    $('task-list').replaceChildren();
    filtered.forEach(task => {
      const item = node('li');
      const button = node('button'); button.type = 'button'; button.dataset.task = task.id;
      button.setAttribute('aria-pressed', String(task.id === state.selected));
      button.setAttribute('aria-controls', 'detail-panel');
      button.append(node('span', 'list-id', task.id), node('span', 'list-title', task.title),
        node('span', 'list-meta', `${subjectOf(task).label} · ${task.skill}`),
        node('span', 'list-meta', `${task.placements.length} bokplacering${task.placements.length === 1 ? '' : 'ar'} · ${task.packages.length} paket`));
      button.addEventListener('click', () => selectTask(task.id, 'list'));
      item.append(button); $('task-list').append(item);
    });
    if (previous && $('detail-panel').hidden) $('task-list').querySelector(`[data-task="${previous}"]`)?.focus({ preventScroll: true });
  }
  function section(title) {
    const block = node('section', 'metadata-block'); block.append(node('h4', '', title)); return block;
  }
  function renderDetail() {
    const root = $('detail'); root.replaceChildren();
    $('detail-panel').scrollTop = 0;
    const task = taskById(state.selected);
    if (!task) {
      const title = node('h3', '', 'Inget original valt'); title.id = 'detail-title';
      root.append(title, node('p', 'small', 'Ändra filtren för att hitta en uppgift.')); return;
    }
    const head = node('div', 'record-head');
    const id = node('p', 'record-id', task.id); id.append(node('span', 'version', 'Original · version ' + task.version));
    const title = node('h3', '', task.title); title.id = 'detail-title';
    const badge = node('span', 'subject-badge'); badge.append(node('i'), document.createTextNode(subjectOf(task).label));
    head.append(id, title, badge, node('p', 'detail-prompt', task.prompt)); root.append(head);
    const concepts = section('Begrepp & förmåga'); const tags = node('div', 'tags');
    [...task.concepts, task.skill].forEach(tag => tags.append(node('span', 'tag', tag))); concepts.append(tags); root.append(concepts);
    const placement = section(`${task.placements.length} bokplacering${task.placements.length === 1 ? '' : 'ar'}, ett original`);
    const list = node('ul', 'placements');
    task.placements.forEach(p => { const li = node('li'); li.append(node('b', '', labelFor(data.books, p.book)), node('span', '', p.chapter)); list.append(li); });
    placement.append(list); root.append(placement);
    const packages = section('Exempelpaket'); const packTags = node('div', 'tags');
    if (!task.packages.length) packTags.append(node('span', 'small', 'Inget exempelpaket valt.'));
    task.packages.forEach(id => packTags.append(node('span', 'tag', labelFor(data.packages, id)))); packages.append(packTags); root.append(packages);
    const relations = section('Typade relationer'); const relationList = node('ul', 'relations-list');
    const connected = data.relations.filter(edge => (edge.from === task.id || edge.to === task.id) && (state.includeProposed || edge.status === 'approved'));
    connected.forEach(edge => {
      const outgoing = edge.from === task.id;
      const target = taskById(outgoing ? edge.to : edge.from);
      const inSelection = filtered.some(item => item.id === target.id);
      const li = node('li');
      const type = edge.type === 'related' ? 'Relaterad till' : (outgoing ? 'Kräver förkunskap' : 'Är förkunskap till');
      const label = node('p', 'relationship-label', type);
      label.append(node('span', 'status-badge' + (edge.status === 'proposed' ? ' proposed' : ''), edge.status === 'proposed' ? 'Förslag' : 'Godkänd (demo)'));
      const button = node('button', '', `${target.id} · ${target.title}${inSelection ? '' : ' (utanför urvalet)'}`); button.type = 'button';
      if (!inSelection) button.title = 'Visa uppgiften och nollställ filtren';
      button.addEventListener('click', () => {
        if (!inSelection) resetFilters();
        selectTask(target.id, 'relationship', !inSelection);
      });
      li.append(label, button, node('p', 'relation-reason', edge.reason)); relationList.append(li);
    });
    if (!connected.length) relationList.append(node('li', 'small', 'Inga typade relationer visas för detta exempel.'));
    relations.append(relationList); root.append(relations);
    const notice = node('p', 'notice', 'Huvudområdet styr en vy. Bokplaceringar och paket pekar på samma original. Alla taggar och statusar är syntetiska exempel.'); root.append(notice);
    const nav = node('nav', 'detail-nav'); nav.setAttribute('aria-label', 'Bläddra bland filtrerade uppgifter');
    const position = filtered.findIndex(item => item.id === task.id);
    [['← Föregående', position - 1], ['Nästa →', position + 1]].forEach(([label, index]) => {
      const button = node('button', '', label); button.type = 'button'; button.disabled = index < 0 || index >= filtered.length;
      button.addEventListener('click', () => selectTask(filtered[index].id, 'navigation'));
      nav.append(button);
    }); root.append(nav);
  }
  function selectTask(id, origin, cleared) {
    if ($('detail-panel').hidden) {
      detailOrigin = document.activeElement;
      detailOriginTask = origin === 'list' ? id : null;
    }
    openPanel('detail-panel');
    state.selected = id; state.hover = null;
    refresh(`${id}: ${taskById(id).title} valt.${cleared ? ' Filtren är nollställda för att visa uppgiften.' : ''}`);
    if (!$('detail-panel').hidden) {
      const title = $('detail-title'); title.tabIndex = -1; title.focus({ preventScroll: true });
    }
  }
  function setView(view) {
    closePanel('detail-panel',null);
    closePanel('filter-panel','toggle-filters');
    closePanel('info-panel','toggle-info');
    state.view = view;
    $('map-panel').hidden = view !== 'map'; $('list-panel').hidden = view !== 'list';
    $('show-map').setAttribute('aria-pressed', String(view === 'map'));
    $('show-list').setAttribute('aria-pressed', String(view === 'list'));
    $('zoom-label').hidden = view !== 'map';
    if (view === 'map') resize();
    $('results').textContent = `${view === 'map' ? '3D-karta' : '2D-lista'}: ${filtered.length} av ${data.tasks.length} original. Samma urval i båda vyerna.`;
  }

  $('show-map').addEventListener('click', () => setView('map'));
  $('show-list').addEventListener('click', () => setView('list'));
  $('search').addEventListener('input', event => { state.query = event.target.value; refresh(); });
  [['subject-filter', 'subject'], ['book-filter', 'book'], ['package-filter', 'package']].forEach(([id, field]) => {
    $(id).addEventListener('change', event => { state[field] = event.target.value; refresh(); });
  });
  $('clear-filters').addEventListener('click', () => { resetFilters(); refresh(); });
  document.querySelectorAll('input[name="lens"]').forEach(input => input.addEventListener('change', () => {
    state.lens = input.value;
    $('map-caption').textContent = input.value === 'subjects' ? 'Ämnesankaret ordnar kartan. Originalet finns bara en gång.' :
      input.value === 'books' ? 'Flera bokplaceringar pekar på samma nod. Inga kopior skapas.' : 'Ett original kan ingå i flera paket. Kartan byter lins, inte innehåll.';
    refresh();
  }));
  $('relations').addEventListener('change', event => { state.showRelations = event.target.checked; scheduleDraw(); });
  $('proposals').addEventListener('change', event => { state.includeProposed = event.target.checked; refresh(); });
  const themes = ['system', 'light', 'dark']; let themeIndex = 0;
  $('theme').addEventListener('click', () => {
    themeIndex = (themeIndex + 1) % themes.length;
    if (themes[themeIndex] === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = themes[themeIndex];
    $('theme').textContent = 'Tema: ' + ['system', 'ljust', 'mörkt'][themeIndex];
  });

  function zoom(amount) {
    state.zoom = Math.min(1.85, Math.max(0.65, state.zoom + amount));
    $('zoom-label').textContent = `Zoom ${Math.round(state.zoom * 100)} %`; scheduleDraw();
  }
  function resetView() { state.yaw = -0.13; state.pitch = 0.16; state.zoom = 1; zoom(0); }
  $('zoom-in').addEventListener('click', () => zoom(0.15)); $('zoom-out').addEventListener('click', () => zoom(-0.15));
  $('reset-view').addEventListener('click', resetView);
  canvas.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const actions = {
      ArrowLeft: () => { state.yaw -= 0.14; }, ArrowRight: () => { state.yaw += 0.14; },
      ArrowUp: () => { state.pitch = Math.max(-1.1, state.pitch - 0.1); }, ArrowDown: () => { state.pitch = Math.min(1.1, state.pitch + 0.1); },
      '+': () => zoom(0.15), '=': () => zoom(0.15), '-': () => zoom(-0.15), h: resetView, H: resetView, Home: resetView
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); scheduleDraw(); }
  });
  function localPoint(event) { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function hitTest(point) {
    return projected.filter(p => !p.hub).sort((a, b) => b.depth - a.depth)
      .find(p => Math.hypot(p.sx - point.x, p.sy - point.y) < Math.max(p.radius + 7, 14));
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = localPoint(event); drag = { id: event.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false };
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    const p = localPoint(event);
    if (drag && drag.id === event.pointerId) {
      if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > 5) drag.moved = true;
      if (drag.moved) { state.yaw += (p.x - drag.x) * 0.007; state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + (p.y - drag.y) * 0.005)); }
      drag.x = p.x; drag.y = p.y; scheduleDraw();
    } else {
      const hit = hitTest(p); const id = hit?.id || null;
      if (id !== state.hover) { state.hover = id; canvas.style.cursor = id ? 'pointer' : 'grab'; scheduleDraw(); }
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved; drag = null; canvas.classList.remove('dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!moved) { const hit = hitTest(localPoint(event)); if (hit) selectTask(hit.id, 'canvas'); }
  });
  canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
  canvas.addEventListener('pointerleave', () => { state.hover = null; scheduleDraw(); });

  function resize() {
    if (state.view !== 'map') return;
    const r = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = r.width; canvasHeight = r.height;
    canvas.width = Math.round(r.width * ratio); canvas.height = Math.round(r.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0); scheduleDraw();
  }
  function project(p) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const x = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
    const y = p.y * cp - z1 * sp, z = p.y * sp + z1 * cp;
    const perspective = 720 / (720 - z);
    const fit = Math.min((canvasWidth - 65) / 550, (canvasHeight - 150) / 390) * state.zoom;
    return { ...p, sx: canvasWidth / 2 + x * fit * perspective, sy: canvasHeight / 2 + y * fit * perspective - 2,
      depth: z, radius: Math.max(4.7, 6 * perspective * Math.min(state.zoom, 1.3)), perspective };
  }
  function strokeEdge(a, b, color, width, dash, arrow) {
    context.beginPath(); context.strokeStyle = color; context.lineWidth = width; context.setLineDash(dash || []);
    context.moveTo(a.sx, a.sy); context.lineTo(b.sx, b.sy); context.stroke(); context.setLineDash([]);
    if (arrow) {
      const angle = Math.atan2(b.sy - a.sy, b.sx - a.sx), distance = Math.hypot(b.sx - a.sx, b.sy - a.sy);
      if (distance < 26) return;
      const endX = b.sx - Math.cos(angle) * 12, endY = b.sy - Math.sin(angle) * 12;
      context.beginPath(); context.fillStyle = color; context.moveTo(endX, endY);
      context.lineTo(endX - Math.cos(angle - 0.45) * 7, endY - Math.sin(angle - 0.45) * 7);
      context.lineTo(endX - Math.cos(angle + 0.45) * 7, endY - Math.sin(angle + 0.45) * 7); context.closePath(); context.fill();
    }
  }
  function label(text, x, y, color, font, align, background) {
    context.font = font; context.textAlign = align || 'center'; context.textBaseline = 'middle';
    const width = context.measureText(text).width;
    const left = align === 'left' ? x - 5 : x - width / 2 - 5;
    if (background) { context.fillStyle = '#101d2beb'; context.fillRect(left, y - 10, width + 10, 20); }
    context.fillStyle = color; context.fillText(text, x, y);
  }
  function draw() {
    frame = 0; if (state.view !== 'map' || !graphLayout || !canvasWidth) return;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    const glow = context.createRadialGradient(canvasWidth * .48, canvasHeight * .48, 20, canvasWidth * .5, canvasHeight * .5, canvasWidth * .7);
    glow.addColorStop(0, '#1b2d40'); glow.addColorStop(1, '#101d2b'); context.fillStyle = glow; context.fillRect(0, 0, canvasWidth, canvasHeight);
    // Quiet depth cues, not data. Positions and distances have no quantitative meaning.
    context.strokeStyle = '#9dbbdf0d'; context.lineWidth = 1;
    for (let r = 70; r < canvasWidth; r += 65) { context.beginPath(); context.ellipse(canvasWidth / 2, canvasHeight / 2, r, r * .55, 0, 0, Math.PI * 2); context.stroke(); }
    const visibleIds = new Set(filtered.map(task => task.id));
    const hubs = graphLayout.hubs.map(project);
    const points = graphLayout.nodes.filter(n => visibleIds.has(n.id)).map(project);
    projected = [...hubs, ...points];
    const byId = new Map(projected.map(p => [p.id, p]));
    // Every original is projected once, even when it is a member of two books or packages.
    points.forEach(point => model.memberships(data, point, state.lens).forEach(id => {
      const hub = byId.get(id); const highlight = point.id === state.selected || point.id === state.hover;
      strokeEdge(hub, point, highlight ? '#d6e5f180' : '#90a8c023', highlight ? 1.4 : .8);
    }));
    if (state.showRelations) model.visibleRelations(data, filtered, state.includeProposed).forEach(edge => {
      const highlight = edge.from === state.selected || edge.to === state.selected || edge.from === state.hover || edge.to === state.hover;
      const color = edge.status === 'proposed' ? '#f2c86f' : edge.type === 'prerequisite' ? '#c3adfa' : '#8bc8ed';
      strokeEdge(byId.get(edge.from), byId.get(edge.to), color + (highlight ? 'e0' : '55'), highlight ? 1.8 : 1.1,
        edge.status === 'proposed' ? [7, 5] : edge.type === 'prerequisite' ? [2, 4] : [], edge.type === 'prerequisite');
    });
    points.sort((a, b) => a.depth - b.depth).forEach(point => {
      const selected = point.id === state.selected, hover = point.id === state.hover, color = subjectOf(point).color;
      context.globalAlpha = selected || hover ? 1 : .75 + Math.max(0, point.depth + 100) / 1000;
      if (selected || hover) { context.beginPath(); context.arc(point.sx, point.sy, point.radius + (selected ? 7 : 4), 0, Math.PI * 2); context.strokeStyle = color + '88'; context.lineWidth = 1.5; context.stroke(); }
      context.beginPath(); context.arc(point.sx, point.sy, point.radius, 0, Math.PI * 2); context.fillStyle = color; context.fill();
      if (selected) { context.beginPath(); context.arc(point.sx, point.sy, 2, 0, Math.PI * 2); context.fillStyle = '#101d2b'; context.fill(); }
      context.globalAlpha = 1;
      if (selected || hover || state.zoom > 1.3) label(point.id, point.sx, point.sy + point.radius + 11, selected || hover ? '#f4f7fa' : '#b4c4d6', `${selected ? 650 : 400} 9px ui-monospace, monospace`);
    });
    hubs.forEach(hub => {
      const count = points.filter(point => model.memberships(data, point, state.lens).includes(hub.id)).length;
      if (!count) return;
      context.beginPath(); context.arc(hub.sx, hub.sy, 16, 0, Math.PI * 2); context.strokeStyle = hub.color + '45'; context.lineWidth = 1; context.stroke();
      context.beginPath(); context.moveTo(hub.sx - 3, hub.sy); context.lineTo(hub.sx + 3, hub.sy); context.moveTo(hub.sx, hub.sy - 3); context.lineTo(hub.sx, hub.sy + 3); context.strokeStyle = hub.color + 'bb'; context.stroke();
      const text = (hub.short || hub.label) + ' · ' + count;
      const x = Math.max(75, Math.min(canvasWidth - 75, hub.sx));
      label(text, x, hub.sy - 26, hub.color, '650 11px system-ui, sans-serif', 'center', true);
    });
    const focus = byId.get(state.hover || state.selected);
    if (focus) {
      let title = `${focus.id} · ${focus.title}`;
      context.font = '600 11px system-ui';
      while (context.measureText(title).width > canvasWidth - 48) title = title.slice(0, -2) + '…';
      label(title, 21, canvasHeight - 103, '#eef4fa', '600 11px system-ui, sans-serif', 'left', true);
    }
  }
  function scheduleDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  // No automatic rotation or continuous animation. Reduced-motion users get the same still view.
  if (!context) { setView('list'); $('show-map').disabled = true; }
  else new ResizeObserver(resize).observe(canvas);
  refresh(); if (context) resize();
})();
