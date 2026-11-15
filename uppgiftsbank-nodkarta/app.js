(function () {
  'use strict';
  const data=window.GraphData, model=window.GraphModel, $=id=>document.getElementById(id);
  const canvas=$('graph'), context=canvas.getContext('2d');
  const state={lens:'themes',view:'map',contexts:[],compare:false,match:'all',selected:null,query:'',includeProposed:false,showRelations:true,yaw:-.13,pitch:.16,zoom:1,hover:null};
  const taskById=id=>data.tasks.find(t=>t.id===id), labelFor=(items,id)=>items.find(i=>i.id===id)?.label||id;
  const subjectOf=task=>data.subjects.find(s=>s.id===task.subject);
  const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  let filtered=[],graphLayout,projected=[],canvasWidth=0,canvasHeight=0,frame=0,drag=null,pendingActivation=null,openId=null,panelOrigin=null,detailOriginTask=null;
  const panelTriggers={'filter-panel':'toggle-filters','info-panel':'toggle-info','detail-panel':null,'context-panel':'toggle-contexts'};
  function closePanel(restore=true){
    if(!openId)return;
    $(openId).hidden=true;
    if(panelTriggers[openId])$(panelTriggers[openId]).setAttribute('aria-expanded','false');
    openId=null;$('map-toolbar').inert=false;$('visual-area').inert=false;
    if(restore){
      const result=detailOriginTask&&$('task-list').querySelector(`[data-task="${detailOriginTask}"]`);
      const target=result||(panelOrigin?.isConnected?panelOrigin:null)||$('show-map');
      target.focus({preventScroll:true});
      if(result)result.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    detailOriginTask=null;
  }
  function openPanel(id,focus){
    const origin=document.activeElement;
    if(openId)closePanel(false);
    panelOrigin=origin;openId=id;$(id).hidden=false;
    if(panelTriggers[id])$(panelTriggers[id]).setAttribute('aria-expanded','true');
    $('map-toolbar').inert=true;$('visual-area').inert=true;
    (focus||$(id).querySelector('button')).focus({preventScroll:true});
  }
  [['toggle-filters','filter-panel','close-filters'],['toggle-info','info-panel','close-info'],['toggle-contexts','context-panel','close-contexts']].forEach(([trigger,id,close])=>{
    $(trigger).addEventListener('click',()=>openPanel(id,id==='filter-panel'?$('search'):$(close)));
    $(close).addEventListener('click',()=>closePanel());
  });
  $('apply-contexts').addEventListener('click',()=>closePanel());
  $('apply-filters').addEventListener('click',()=>closePanel());$('close-detail').addEventListener('click',()=>closePanel());
  document.addEventListener('keydown',event=>{
    if(!openId)return;
    if(event.key==='Escape'){event.preventDefault();closePanel();return;}
    if(event.key!=='Tab')return;
    const controls=[...$(openId).querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],summary,[tabindex="0"]')].filter(n=>n.getClientRects().length);
    const i=controls.indexOf(document.activeElement);
    if(i===-1||(event.shiftKey&&i===0)||(!event.shiftKey&&i===controls.length-1)){
      event.preventDefault();controls[event.shiftKey?controls.length-1:0]?.focus();
    }
  });
  const lensLabels={themes:'teman',books:'böcker',packages:'paket',subjects:'ämnen'};
  function selectionTitle(){
    if(!state.contexts.length)return `Alla ${data.tasks.length} uppgifter`;
    return state.contexts.map(id=>labelFor(model.hubsFor(data,state.lens),id)).join(' + ');
  }
  function chooseContext(id){
    if(state.compare){
      if(state.contexts.includes(id))state.contexts=state.contexts.filter(x=>x!==id);
      else state.contexts=state.contexts.length<2?[...state.contexts,id]:[state.contexts[0],id];
    }else state.contexts=state.contexts.length===1&&state.contexts[0]===id?[]:[id];
    state.selected=null;state.hover=null;resetCamera();refresh(true);
    if(openId==='context-panel'&&(!state.compare||state.contexts.length===2))closePanel();
  }
  function renderChoices(){
    const previous=document.activeElement?.dataset.context;
    $('context-choices').replaceChildren();
    model.hubsFor(data,state.lens).forEach(h=>{
      const count=data.tasks.filter(t=>model.memberships(data,t,state.lens).includes(h.id)).length;
      const b=node('button','',h.label);b.type='button';b.dataset.context=h.id;b.setAttribute('aria-pressed',String(state.contexts.includes(h.id)));
      b.append(node('span','choice-count',String(count)));b.addEventListener('click',()=>chooseContext(h.id));$('context-choices').append(b);
    });
    $('context-choices').setAttribute('aria-label',`Välj bland ${lensLabels[state.lens]}`);
    if(previous)$('context-choices').querySelector(`[data-context="${previous}"]`)?.focus({preventScroll:true});
  }
  function refresh(rebuild=false){
    filtered=model.filterTasks(data,state);
    if(!filtered.some(t=>t.id===state.selected))state.selected=null;
    graphLayout=model.layout(data,state.lens,filtered);
    $('results-title').textContent=selectionTitle();
    const compareText=state.contexts.length===2?(state.match==='all'?'gemensamma uppgifter':'uppgifter i minst ett av de två'):'uppgifter';
    $('results').textContent=`${filtered.length} ${compareText}${state.query?` · Sök: ${state.query}`:''}${state.compare&&state.contexts.length<2?' · Välj två sammanhang':''}`;
    $('filter-feedback').textContent=`${filtered.length} av ${data.tasks.length} uppgifter matchar.`;
    $('empty-map').hidden=filtered.length>0;$('empty-list').hidden=filtered.length>0;
    $('compare').setAttribute('aria-pressed',String(state.compare));
    $('compare').textContent=state.compare?'Avsluta jämförelse':'Jämför två';
    $('match-modes').hidden=state.contexts.length<2;
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.match)));
    document.querySelectorAll('[data-lens]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lens===state.lens)));
    if(rebuild)renderChoices();
    renderList();renderAnchors();scheduleDraw();updateBounds();
  }
  function renderList(){
    const previous=document.activeElement?.dataset.task;
    $('task-list').replaceChildren();
    filtered.forEach(task=>{
      const li=node('li'),b=node('button');b.type='button';b.dataset.task=task.id;
      b.setAttribute('aria-pressed',String(task.id===state.selected));b.setAttribute('aria-controls','detail-panel');
      b.append(node('span','list-id',task.id),node('span','list-title',task.title),node('span','list-meta',`${subjectOf(task).label} · ${task.skill}`));
      if(state.contexts.length===2&&state.match==='any'){
        const own=model.memberships(data,task,state.lens);
        b.append(node('span','list-meta',state.contexts.every(id=>own.includes(id))?'Gemensam för båda':labelFor(model.hubsFor(data,state.lens),state.contexts.find(id=>own.includes(id)))));
      }
      b.addEventListener('click',()=>selectTask(task.id,'list'));li.append(b);$('task-list').append(li);
    });
    if(previous&&!openId)$('task-list').querySelector(`[data-task="${previous}"]`)?.focus({preventScroll:true});
  }
  function renderAnchors(){
    const previous=document.activeElement?.dataset.hub;
    $('graph-anchors').replaceChildren();
    graphLayout.hubs.forEach(h=>{
      const b=node('button','',h.short||h.label);b.type='button';b.dataset.hub=h.id;
      const count=filtered.filter(t=>model.memberships(data,t,state.lens).includes(h.id)).length;
      b.append(node('span','',`${count} uppgifter`));b.setAttribute('aria-pressed',String(state.contexts.includes(h.id)));
      b.setAttribute('aria-label',`${h.label}, ${count} uppgifter. Välj sammanhang.`);
      b.addEventListener('click',()=>chooseContext(h.id));$('graph-anchors').append(b);
    });
    if(previous)$('graph-anchors').querySelector(`[data-hub="${previous}"]`)?.focus({preventScroll:true});
  }
  function section(title){const n=node('section','metadata-block');n.append(node('h4','',title));return n;}
  function renderDetail(){
    const task=taskById(state.selected);if(!task)return;
    const root=$('detail');root.replaceChildren();$('detail-panel').scrollTop=0;
    const head=node('div','record-head'),id=node('p','record-id',task.id);id.append(node('span','version',`Original · version ${task.version}`));
    const title=node('h3','',task.title);title.id='detail-title';title.tabIndex=-1;
    head.append(id,title,node('span','subject-badge',subjectOf(task).label),node('p','detail-prompt',task.prompt));root.append(head);
    [['Teman',task.themes.map(id=>labelFor(data.themes,id))],['Begrepp & förmåga',[...task.concepts,task.skill]],['Exempelpaket',task.packages.map(id=>labelFor(data.packages,id))]].forEach(([name,labels])=>{
      const s=section(name),tags=node('div','tags');labels.forEach(text=>tags.append(node('span','tag',text)));s.append(tags);root.append(s);
    });
    const placement=section(`${task.placements.length} bokplaceringar, ett original`),list=node('ul','placements');
    task.placements.forEach(p=>{const li=node('li');li.append(node('b','',labelFor(data.books,p.book)),node('span','',p.chapter));list.append(li);});placement.append(list);root.append(placement);
    const relations=section('Typade relationer'),links=node('ul','relations-list');
    const connected=data.relations.filter(e=>(e.from===task.id||e.to===task.id)&&(state.includeProposed||e.status==='approved'));
    connected.forEach(e=>{
      const outgoing=e.from===task.id,target=taskById(outgoing?e.to:e.from),inside=filtered.some(t=>t.id===target.id),li=node('li');
      const type=e.type==='related'?'Relaterad till':outgoing?'Kräver förkunskap':'Är förkunskap till';
      const label=node('p','relationship-label',type);label.append(node('span','status-badge',e.status==='proposed'?'Förslag':'Godkänd (demo)'));
      const b=node('button','',`${target.id} · ${target.title}${inside?'':' · Visa alla för att följa länken'}`);b.type='button';
      b.addEventListener('click',()=>{if(!inside){resetSelection();refresh(true);}selectTask(target.id,'relationship');});
      li.append(label,b,node('p','relation-reason',e.reason));links.append(li);
    });
    if(!connected.length)links.append(node('li','small','Inga typade relationer för detta exempel.'));relations.append(links);root.append(relations);
    const nav=node('nav','detail-nav');nav.setAttribute('aria-label','Bläddra bland matchande uppgifter');const position=filtered.findIndex(t=>t.id===task.id);
    [['← Föregående',position-1],['Nästa →',position+1]].forEach(([text,i])=>{const b=node('button','',text);b.type='button';b.disabled=i<0||i>=filtered.length;b.addEventListener('click',()=>selectTask(filtered[i].id,'navigation'));nav.append(b);});root.append(nav);
  }
  function selectTask(id,origin){
    state.selected=id;state.hover=null;renderList();renderDetail();scheduleDraw();
    if(openId!=='detail-panel'){openPanel('detail-panel',$('detail-title'));detailOriginTask=origin==='list'?id:null;}
    else $('detail-title').focus({preventScroll:true});
  }
  function setView(view){
    if(openId)closePanel(false);state.view=view;$('explorer').classList.toggle('list-view',view==='list');
    $('map-panel').hidden=view!=='map';$('map-bottom').hidden=view!=='map';
    $('show-map').setAttribute('aria-pressed',String(view==='map'));$('show-list').setAttribute('aria-pressed',String(view==='list'));
    $('expand-results').textContent=view==='map'?'Visa lista':'Visa 3D';$('expand-results').setAttribute('aria-label',view==='map'?'Visa uppgifterna i en fullständig lista':'Visa samma urval i 3D-kartan');
    if(view==='map')resize();else $('task-list').scrollTop=0;
  }
  function resetSelection(){state.contexts=[];state.compare=false;state.match='all';state.query='';state.selected=null;$('search').value='';resetCamera();}
  $('show-map').addEventListener('click',()=>setView('map'));$('show-list').addEventListener('click',()=>setView('list'));
  $('expand-results').addEventListener('click',()=>setView(state.view==='map'?'list':'map'));
  document.querySelectorAll('[data-lens]').forEach(b=>b.addEventListener('click',()=>{state.lens=b.dataset.lens;state.contexts=[];state.selected=null;state.hover=null;resetCamera();refresh(true);}));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.match=b.dataset.mode;state.selected=null;refresh();}));
  $('compare').addEventListener('click',()=>{state.compare=!state.compare;if(!state.compare){state.contexts=state.contexts.slice(0,1);state.match='all';}refresh(true);});
  $('clear-filters').addEventListener('click',()=>{resetSelection();refresh(true);});
  $('search').addEventListener('input',e=>{state.query=e.target.value;state.selected=null;refresh();});
  $('relations').addEventListener('change',e=>{state.showRelations=e.target.checked;scheduleDraw();});
  $('proposals').addEventListener('change',e=>{state.includeProposed=e.target.checked;scheduleDraw();});
  const themes=['system','light','dark'];let themeIndex=0;
  $('theme').addEventListener('click',()=>{themeIndex=(themeIndex+1)%3;if(themeIndex)document.documentElement.dataset.theme=themes[themeIndex];else delete document.documentElement.dataset.theme;$('theme').textContent='Utseende: '+['system','ljust','mörkt'][themeIndex];});
  $('demo-disclosure').textContent=`${data.tasks.length} påhittade uppgifter, ${data.themes.length} teman, ${data.books.length} böcker och ${data.packages.length} paket. Inget kursplaneinnehåll. Avstånd i kartan är inte mätvärden.`;
  function zoom(amount){state.zoom=Math.min(2,Math.max(.65,state.zoom+amount));scheduleDraw();}
  function resetCamera(){state.yaw=-.13;state.pitch=.16;state.zoom=1;}
  function resetView(){resetCamera();scheduleDraw();}
  $('zoom-in').addEventListener('click',()=>zoom(.15));$('zoom-out').addEventListener('click',()=>zoom(-.15));$('reset-view').addEventListener('click',resetView);
  canvas.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const actions={ArrowLeft:()=>{state.yaw-=.14;},ArrowRight:()=>{state.yaw+=.14;},ArrowUp:()=>{state.pitch=Math.max(-1.1,state.pitch-.1);},ArrowDown:()=>{state.pitch=Math.min(1.1,state.pitch+.1);},'+':()=>zoom(.15),'=':()=>zoom(.15),'-':()=>zoom(-.15),Home:resetView,h:resetView,H:resetView};
    if(actions[e.key]){e.preventDefault();actions[e.key]();scheduleDraw();}
  });
  const localPoint=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  function hitTest(p){return projected.map(n=>({...n,distance:Math.hypot(n.sx-p.x,n.sy-p.y)})).filter(n=>n.distance<Math.max(n.radius+8,n.hub?22:16)).sort((a,b)=>a.distance-b.distance)[0];}
  canvas.addEventListener('pointerdown',e=>{pendingActivation=null;if(e.button!==0||!e.isPrimary)return;const p=localPoint(e);drag={id:e.pointerId,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',e=>{const p=localPoint(e);if(drag&&drag.id===e.pointerId){if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>9)drag.moved=true;if(drag.moved){state.yaw+=(p.x-drag.x)*.007;state.pitch=Math.max(-1.1,Math.min(1.1,state.pitch+(p.y-drag.y)*.005));}drag.x=p.x;drag.y=p.y;scheduleDraw();}else{const id=hitTest(p)?.id||null;if(id!==state.hover){state.hover=id;canvas.style.cursor=id?'pointer':'grab';scheduleDraw();}}});
  canvas.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const moved=drag.moved;drag=null;canvas.classList.remove('dragging');
    // Recognize the original target before releasing capture, but leave the DOM unchanged.
    // Touch compatibility mouse events must finish before a dialog replaces their target.
    const hit=!moved&&hitTest(localPoint(e));
    pendingActivation=hit?{id:hit.id,hub:hit.hub}:null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('click',e=>{
    const hit=pendingActivation;pendingActivation=null;e.preventDefault();
    if(!hit)return; // Includes the click emitted after a drag or cancelled gesture.
    if(hit.hub)chooseContext(hit.id);
    else{canvas.focus({preventScroll:true});selectTask(hit.id,'canvas');}
  });
  const cancelDrag=()=>{drag=null;pendingActivation=null;canvas.classList.remove('dragging');};
  canvas.addEventListener('pointercancel',cancelDrag);
  canvas.addEventListener('lostpointercapture',e=>{if(drag&&drag.id===e.pointerId)cancelDrag();});
  canvas.addEventListener('pointerleave',()=>{state.hover=null;scheduleDraw();});
  function updateBounds(){
    const compact=window.innerHeight<=540;
    if(compact!==$('explorer').classList.contains('compact-layout')){
      if(openId==='context-panel'){closePanel(false);$('show-map').focus({preventScroll:true});}
      $('explorer').classList.toggle('compact-layout',compact);$('toggle-contexts').hidden=!compact;
      ['lens-tabs','context-choices'].forEach(id=>{if(compact)$('context-panel').insertBefore($(id),$('apply-contexts'));else $('map-toolbar').append($(id));});
      const selection=document.querySelector('.selection-tools');
      if(compact)$('context-panel').insertBefore(selection,$('apply-contexts'));else $('map-toolbar').append(selection);
    }
    $('explorer').style.setProperty('--top',`${$('map-toolbar').getBoundingClientRect().bottom+7}px`);
  }
  function resize(){updateBounds();if(state.view!=='map'||!context)return;const r=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);canvasWidth=r.width;canvasHeight=r.height;canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);context.setTransform(ratio,0,0,ratio,0,0);scheduleDraw();}
  function rotate(p){const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch),x=p.x*cy+p.z*sy,z1=-p.x*sy+p.z*cy,y=p.y*cp-z1*sp,z=p.y*sp+z1*cp,perspective=850/(850-z);return{...p,rx:x*perspective,ry:y*perspective,depth:z};}
  function projections(){
    const all=[...graphLayout.hubs,...graphLayout.nodes].map(rotate);if(!all.length)return[];
    const top=$('map-toolbar').getBoundingClientRect().bottom+16,bottom=$('map-bottom').getBoundingClientRect().top-12,height=Math.max(1,bottom-top),margin=canvasWidth<600?25:80;
    const xs=all.map(p=>p.rx),ys=all.map(p=>p.ry),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const fit=Math.max(.01,Math.min((canvasWidth-2*margin)/(maxX-minX+90),Math.max(1,height-30)/(maxY-minY+70)))*state.zoom;
    const points=all.map(p=>({...p,sx:canvasWidth/2+(p.rx-(minX+maxX)/2)*fit,sy:top+height/2+(p.ry-(minY+maxY)/2)*fit,radius:Math.max(4.5,Math.min(7,5*state.zoom))}));
    const placed=[],hubPoints=points.filter(p=>p.hub);
    // Adapt the number of columns to real screen space, never clamp several buttons to the same row.
    const narrow=canvasWidth<600||height<210, gap=7, buttonHeight=44;
    const availableRows=Math.max(0,Math.floor((height+gap)/(buttonHeight+gap)));
    const maxColumns=Math.max(1,Math.floor((canvasWidth-20+gap)/(58+gap)));
    const capacity=availableRows*maxColumns;
    const ordered=[...hubPoints].sort((a,b)=>Number(state.contexts.includes(b.id))-Number(state.contexts.includes(a.id)));
    const visible=narrow?ordered.slice(0,capacity):ordered;
    const columns=narrow?Math.min(maxColumns,Math.max(2,Math.ceil(visible.length/Math.max(1,availableRows)))):2;
    const rows=Math.ceil(visible.length/columns);
    const buttonWidth=Math.min(110,(canvasWidth-20-gap*(columns-1))/columns);
    hubPoints.forEach(p=>{
      const b=$('graph-anchors').querySelector(`[data-hub="${p.id}"]`),index=visible.indexOf(p);
      if(!b)return;
      b.hidden=index<0;b.style.width=narrow?`${buttonWidth}px`:'';
      if(index<0)return;
      const w=b.offsetWidth||110,h=b.offsetHeight||44;
      let x=Math.max(w/2+10,Math.min(canvasWidth-w/2-10,p.sx)),y=Math.max(top+h/2,Math.min(bottom-h/2,p.sy));
      if(narrow){
        const col=index%columns,row=Math.floor(index/columns);
        x=10+buttonWidth/2+col*(canvasWidth-20-buttonWidth)/Math.max(1,columns-1);
        y=top+h/2+row*(height-h)/Math.max(1,rows-1);
      }else for(let attempt=0;attempt<12;attempt++){
        const collision=placed.find(q=>Math.abs(q.x-x)<(q.w+w)/2+7&&Math.abs(q.y-y)<(q.h+h)/2+7);
        if(!collision)break;y+=h+9;if(y>bottom-h/2){y=top+h/2;x=Math.max(w/2+10,x-w-12);}
      }
      placed.push({x,y,w,h});p.labelX=x;p.labelY=y;
      b.style.left=`${x}px`;b.style.top=`${y}px`;
    });return points;
  }
  function strokeEdge(a,b,color,width,dash,arrow){if(!a||!b)return;context.beginPath();context.strokeStyle=color;context.lineWidth=width;context.setLineDash(dash||[]);context.moveTo(a.sx,a.sy);context.lineTo(b.sx,b.sy);context.stroke();context.setLineDash([]);if(arrow){const angle=Math.atan2(b.sy-a.sy,b.sx-a.sx),d=Math.hypot(b.sx-a.sx,b.sy-a.sy);if(d<26)return;const x=b.sx-Math.cos(angle)*11,y=b.sy-Math.sin(angle)*11;context.beginPath();context.fillStyle=color;context.moveTo(x,y);context.lineTo(x-Math.cos(angle-.45)*7,y-Math.sin(angle-.45)*7);context.lineTo(x-Math.cos(angle+.45)*7,y-Math.sin(angle+.45)*7);context.closePath();context.fill();}}
  function draw(){
    frame=0;if(!context||state.view!=='map'||!graphLayout||!canvasWidth)return;
    const glow=context.createRadialGradient(canvasWidth*.5,canvasHeight*.5,10,canvasWidth*.5,canvasHeight*.5,canvasWidth*.8);glow.addColorStop(0,'#20364c');glow.addColorStop(1,'#101d2b');context.fillStyle=glow;context.fillRect(0,0,canvasWidth,canvasHeight);
    projected=projections();const byId=new Map(projected.map(p=>[p.id,p])),points=projected.filter(p=>!p.hub),hubs=projected.filter(p=>p.hub);
    points.forEach(p=>model.memberships(data,p,state.lens).forEach(id=>{const highlight=p.id===state.selected||p.id===state.hover||state.contexts.includes(id);strokeEdge(byId.get(id),p,highlight?'#bddbc980':'#9eb6ca30',highlight?1.2:.7);}));
    if(state.showRelations)model.visibleRelations(data,filtered,state.includeProposed).forEach(e=>{const highlighted=e.from===state.selected||e.to===state.selected||e.from===state.hover||e.to===state.hover;const color=e.status==='proposed'?'#f2c86f':e.type==='prerequisite'?'#c3adfa':'#8bc8ed';strokeEdge(byId.get(e.from),byId.get(e.to),color+(highlighted?'e0':'65'),highlighted?2:1,e.status==='proposed'?[7,5]:e.type==='prerequisite'?[2,4]:[],e.type==='prerequisite');});
    points.sort((a,b)=>a.depth-b.depth).forEach(p=>{const selected=p.id===state.selected,hover=p.id===state.hover,color=subjectOf(p).color;if(selected||hover){context.beginPath();context.arc(p.sx,p.sy,p.radius+6,0,Math.PI*2);context.strokeStyle='#effff8';context.lineWidth=2;context.stroke();}context.beginPath();context.arc(p.sx,p.sy,p.radius,0,Math.PI*2);context.fillStyle=color;context.fill();if(selected||hover||filtered.length<15){context.font='600 10px ui-monospace,monospace';context.textAlign='center';context.fillStyle='#f4f8fa';context.fillText(p.id,p.sx,p.sy+p.radius+13);}});
    hubs.forEach(h=>{if(Number.isFinite(h.labelX))strokeEdge(h,{sx:h.labelX,sy:h.labelY},'#c2d7e660',1);context.beginPath();context.arc(h.sx,h.sy,4,0,Math.PI*2);context.fillStyle='#e1f1eb';context.fill();});
    // Canvas is a visual complement. The same exact task IDs remain readable and selectable in the DOM list.
    canvas.dataset.visibleTasks=filtered.map(t=>t.id).join(',');canvas.dataset.zoom=state.zoom.toFixed(2);
  }
  function scheduleDraw(){if(!frame)frame=requestAnimationFrame(draw);}
  window.addEventListener('resize',resize);
  refresh(true);
  if(!context){setView('list');$('show-map').disabled=true;}
  else{new ResizeObserver(resize).observe(canvas);new ResizeObserver(()=>{updateBounds();scheduleDraw();}).observe($('map-toolbar'));resize();}
})();
