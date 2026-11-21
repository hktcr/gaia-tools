'use strict';
(() => {
 const get = id=>document.getElementById(id), canvas=get('field'), wrap=get('canvaswrap'), container=get('observation'), ctx=canvas.getContext('2d');
 const engine=new FlockEngine(wrap.clientWidth,wrap.clientHeight), cfg=engine.config, counts=get('counts'), play=get('play'), expand=get('expand');
 const stats=new FlockStats({chart:get('stats-chart'),reason:get('stats-reason'),summary:get('stats-summary'),events:get('stats-events'),exportButton:get('stats-export')});
 const statPoint={},showRadius=get('show-radius'), trial=get('trial'), statsPanel=get('stats-panel'), trialTab=get('trial-tab'), statsTab=get('stats-tab');
 let inStats=false, stepCount=0, frameHandle=0, lastLoggedCount=cfg.count, grid=null;
 let w=engine.w,h=engine.h,dpr=1,playing=false,last=0,acc=0,drag=null,keyPoint=null,countText='';
 const growthInputs=['growth','growth-batch','growth-interval','growth-unit','growth-cap'].map(get);
 const [growthToggle,growthBatch,growthInterval,growthUnit,growthCap]=growthInputs;
 const growthStatus=get('growth-status');
 const growth={enabled:false,batch:10,interval:1,unit:'seconds',cap:FlockEngine.maxBirds};
 let startCount=cfg.count,nextGrowthStep=Infinity,capLogged=false;
 const limitCount=()=>growth.enabled?growth.cap:FlockEngine.maxBirds;
 function growthPeriod(){return growth.interval*(growth.unit==='minutes'?3600:60);}
 function growthDescription(){return growth.batch+' per '+growth.interval+' '+(growth.unit==='minutes'?'min':'s')+' · max '+growth.cap;}
 function updateGrowthStatus(){
   if(!growthStatus)return;
   const label=!growth.enabled?'Tillväxt av.':(cfg.count>=growth.cap?'Max nått: '+growth.cap+' småfåglar.':'Tillväxt på: '+growthDescription()+'.');
   if(growthStatus.textContent!==label)growthStatus.textContent=label;
 }
 function syncGrowth(){
   if(growthToggle){growthToggle.checked=growth.enabled;growthBatch.max=growthCap.max=FlockEngine.maxBirds;growthBatch.value=growth.batch;growthInterval.value=growth.interval;growthUnit.value=growth.unit;growthCap.value=growth.cap;}
   updateGrowthStatus();
 }
 function rescheduleGrowth(){nextGrowthStep=growth.enabled?stepCount+growthPeriod():Infinity;capLogged=false;updateGrowthStatus();}
 function readGrowth(){
   const bounded=(input,old,lo,hi)=>input.value!==''&&Number.isFinite(input.valueAsNumber)?clamp(Math.round(input.valueAsNumber),lo,hi):old;
   const old=growth.enabled+'|'+growthDescription();
   growth.enabled=growthToggle.checked;growth.batch=bounded(growthBatch,growth.batch,1,FlockEngine.maxBirds);
   growth.interval=bounded(growthInterval,growth.interval,1,3600);
   growth.unit=growthUnit.value==='minutes'?'minutes':'seconds';
   growth.cap=bounded(growthCap,growth.cap,1,FlockEngine.maxBirds);
   if(old!==growth.enabled+'|'+growthDescription()){
     if(cfg.count>limitCount()){
       commitCount(limitCount());
       eventAt('Antal minskat till nytt max → '+cfg.count);
     }else syncCount();
     rescheduleGrowth();
     eventAt(growth.enabled?'Tillväxt ändrad: '+growthDescription():'Tillväxt av');
   }
   syncGrowth();
 }
 function tickGrowth(){
   if(!growth.enabled||stepCount<nextGrowthStep)return;
   nextGrowthStep+=growthPeriod();
   if(cfg.count>=growth.cap)return;
   commitCount(Math.min(growth.cap,cfg.count+growth.batch));
   if(cfg.count===growth.cap&&!capLogged){capLogged=true;eventAt('Tillväxt nådde max · '+cfg.count+' småfåglar');}
 }
 function setView(stat){
   const next=stat?statsTab:trialTab,prev=stat?trialTab:statsTab;
   inStats=stat;trial.hidden=stat;statsPanel.hidden=!stat;
   next.setAttribute('aria-selected','true'); next.tabIndex=0; prev.setAttribute('aria-selected','false');prev.tabIndex=-1;
   if(stat)stats.render();else resize();
 }
 for(const button of [trialTab,statsTab]){
   button.addEventListener('click',()=>setView(button===statsTab));
   button.addEventListener('keydown',e=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
     e.preventDefault(); const next=e.key==='End'||(e.key!=='Home'&&button===trialTab)?statsTab:trialTab;setView(next===statsTab);next.focus();
   });
 }
 function eventAt(label){stats.addEvent(stepCount/60,label);if(inStats)stats.render();}
 function clearRun(){stepCount=0;stats.clear();lastLoggedCount=cfg.count;rescheduleGrowth();if(inStats)stats.render();}
 function playState(state){
   if(state&&!stats.size){stats.record(0,engine.getStats(statPoint));eventAt('Försöket startat · '+cfg.count+' småfåglar');if(growth.enabled)eventAt('Tillväxt vid start: '+growthDescription());}
   else if(state!==playing)eventAt(state?'Fortsatt':'Pausad');
 }

 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const selected=()=>document.querySelector('input[name=predator]:checked').value;
 const selectedAngle=()=>Number(get('angle').value)*Math.PI/180;
 function changeState(state){playing=state;play.textContent=state?'Pausa':'Starta';get('stats-play').textContent=state?'Pausa':'Starta';play.classList.toggle('is-running',state);get('fieldstatus').textContent=state?'PÅGÅR':'PAUSAD';acc=0;last=0;
   if(playing&&!frameHandle)frameHandle=requestAnimationFrame(frame);
   else if(!playing&&frameHandle){cancelAnimationFrame(frameHandle);frameHandle=0;}
 }
 function launch(x,y,a){
   const type=selected();
   engine.spawn(type,x,y,a);
   eventAt(type==='falcon'?'Pilgrimsfalk släpptes in':'Hök släpptes in');
   get('announce').textContent=(type==='falcon'?'Pilgrimsfalk':'Hök')+' placerad i fältet.';
   render();
 }
 function glyph(x,y,a,type) {
   const small=!type,s=small?1:type==='falcon'?2.2:2.65;
   ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(s,s);
   ctx.strokeStyle=type==='falcon'?'#f2a493':type==='hawk'?'#9fd9eb':'#f3f0d9';
   ctx.lineWidth=small?1.25:1.1;ctx.lineCap='round';ctx.lineJoin='round';
   ctx.beginPath();
   if(type==='hawk'){ctx.moveTo(-4,-3);ctx.lineTo(0,-3);ctx.lineTo(4.5,0);ctx.lineTo(0,3);ctx.lineTo(-4,3);ctx.lineTo(-2.3,0);ctx.closePath();}
   else if(type==='falcon'){ctx.moveTo(-5,-3);ctx.lineTo(5,0);ctx.lineTo(-5,3);ctx.lineTo(-1.8,0);ctx.closePath();}
   else {ctx.moveTo(-3.8,-3.5);ctx.lineTo(3,0);ctx.lineTo(-3.8,3.5);ctx.moveTo(-3.8,0);ctx.lineTo(4.8,0);}
   ctx.stroke();ctx.restore();
 }
 const spriteBins=64,spriteSide=30,spriteRadius=7.5;
 let spriteAtlas;
 function atlas(){
   const a=document.createElement('canvas');a.width=spriteSide*spriteBins;a.height=spriteSide;
   const c=a.getContext('2d'); c.strokeStyle='#f3f0d9';c.lineCap='round';c.lineJoin='round';c.lineWidth=1.25;
   for(let i=0;i<spriteBins;i++){
     c.save();c.translate(i*spriteSide+spriteSide/2,spriteSide/2);c.scale(2,2);c.rotate(2*Math.PI*i/spriteBins);c.beginPath();
     c.moveTo(-3.8,-3.5);c.lineTo(3,0);c.lineTo(-3.8,3.5);c.moveTo(-3.8,0);c.lineTo(4.8,0);c.stroke();c.restore();
   }
   return a;
 }
 function render(){
   if(inStats)return;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.fillStyle='#172c27';ctx.fillRect(0,0,w,h);
   if(!grid){
     grid=new Path2D();
     for(let x=24;x<w;x+=48){grid.moveTo(x+.5,0);grid.lineTo(x+.5,h);}
     for(let y=24;y<h;y+=48){grid.moveTo(0,y+.5);grid.lineTo(w,y+.5);}
   }
   ctx.lineWidth=1;ctx.strokeStyle='#92a58f22';ctx.stroke(grid);
   ctx.strokeStyle='#f3f0d9';ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
   if(engine.birds.length>500){
     spriteAtlas??=atlas();
     const k=spriteBins/(2*Math.PI);
     for(const b of engine.birds){
       const tile=(Math.round(b.a*k)+spriteBins)&(spriteBins-1);
       ctx.drawImage(spriteAtlas,tile*spriteSide,0,spriteSide,spriteSide,b.x-spriteRadius,b.y-spriteRadius,2*spriteRadius,2*spriteRadius);
     }
   }else{
     for(const b of engine.birds){
       const x=b.x,y=b.y,c=Math.cos(b.a),s=Math.sin(b.a);
       ctx.moveTo(x-3.8*c+3.5*s,y-3.8*s-3.5*c);ctx.lineTo(x+3*c,y+3*s);ctx.lineTo(x-3.8*c-3.5*s,y-3.8*s+3.5*c);
       ctx.moveTo(x-3.8*c,y-3.8*s);ctx.lineTo(x+4.8*c,y+4.8*s);
     }
     ctx.stroke();
   }
   for(const p of engine.predators){
     if(showRadius.checked){ctx.save();ctx.strokeStyle=p.type==='hawk'?'#9fd9eb8a':'#f2a4938a';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(p.x,p.y,cfg.predatorRadius*engine.scale,0,2*Math.PI);ctx.stroke();ctx.restore();}
     glyph(p.x,p.y,p.a,p.type);
   }
   if(drag||keyPoint){
     const {x,y}=drag||keyPoint;
     const a=drag&&Math.hypot(drag.cx-x,drag.cy-y)>8?Math.atan2(drag.cy-y,drag.cx-x):selectedAngle();
     const length=drag?Math.max(23,Math.min(110,Math.hypot(drag.cx-x,drag.cy-y))):27;
     const hx=x+Math.cos(a)*length,hy=y+Math.sin(a)*length;
     ctx.strokeStyle='#fae0a1';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.moveTo(x,y);ctx.lineTo(hx,hy);
     ctx.lineTo(hx-7*Math.cos(a-.48),hy-7*Math.sin(a-.48));ctx.moveTo(hx,hy);ctx.lineTo(hx-7*Math.cos(a+.48),hy-7*Math.sin(a+.48));ctx.stroke();
   }
   const value=engine.birds.length+(engine.birds.length===1?' småfågel / ':' småfåglar / ')+engine.predators.length+(engine.predators.length===1?' rovfågel':' rovfåglar');
   if(value!==countText){counts.textContent=value;countText=value;}
 }
 function resize(){
   const nw=wrap.clientWidth,nh=wrap.clientHeight;
   if(nw<2||nh<2)return; // The stats tab hides but does not shrink the world.
   if(keyPoint&&(nw!==w||nh!==h)){keyPoint.x*=nw/w;keyPoint.y*=nh/h;}
   dpr=Math.min(2.5,window.devicePixelRatio||1,Math.sqrt(3200000/(nw*nh)));
   const px=Math.round(dpr*nw),py=Math.round(dpr*nh);
   if(canvas.width!==px)canvas.width=px;if(canvas.height!==py)canvas.height=py;
   if(nw!==w||nh!==h){w=nw;h=nh;grid=null;engine.resize(w,h);if(stepCount>0)eventAt('Flygfältets format ändrades');}
   render();
 }
 const frame=ts=>{
   frameHandle=0;if(!playing||document.hidden)return;
   const elapsed=last?Math.min((ts-last)/1000,.06):0;last=ts;
   acc+=elapsed;
   while(acc>=1/60){
     engine.step(1/60);acc-=1/60;stepCount++;tickGrowth();
     if(stepCount%60===0&&stats.record(stepCount/60,engine.getStats(statPoint))&&inStats)stats.render();
   }
   if(!inStats)render();
   frameHandle=requestAnimationFrame(frame);
 };
 function local(e){const box=canvas.getBoundingClientRect();return {x:clamp((e.clientX-box.left)*w/box.width,0,w),y:clamp((e.clientY-box.top)*h/box.height,0,h)};}
 canvas.addEventListener('pointerdown',e=>{
   if(drag||e.button!==0)return;
   e.preventDefault();keyPoint=null;const {x,y}=local(e);
   drag={id:e.pointerId,x,y,cx:x,cy:y};canvas.setPointerCapture(e.pointerId);render();
 });
 canvas.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const {x,y}=local(e);drag.cx=x;drag.cy=y;render();
 });
 canvas.addEventListener('pointerup',e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const {x,y}=local(e),{x:sx,y:sy}=drag;drag=null;
   launch(sx,sy,Math.hypot(x-sx,y-sy)>8?Math.atan2(y-sy,x-sx):selectedAngle());
 });
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;render();});
 canvas.addEventListener('focus',()=>{keyPoint={x:w/2,y:h/2};render();});
 canvas.addEventListener('blur',()=>{keyPoint=null;render();});
 canvas.addEventListener('keydown',e=>{
   const move={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];
   if(!move&&e.key!=='Enter')return;
   e.preventDefault();if(!keyPoint)keyPoint={x:w/2,y:h/2};
   if(move){keyPoint.x=clamp(keyPoint.x+move[0]*18,2,w-2);keyPoint.y=clamp(keyPoint.y+move[1]*18,2,h-2);render();}
   else launch(keyPoint.x,keyPoint.y,selectedAngle());
 });
 get('release').addEventListener('click',()=>launch(w/2,h/2,selectedAngle()));
 for(const button of [play,get('stats-play')])button.addEventListener('click',()=>{applyCount(true);playState(!playing);changeState(!playing);});
 get('reset').addEventListener('click',()=>{cfg.count=Math.min(startCount,limitCount());syncCount();engine.reset();changeState(false);clearRun();render();});
 get('angle').addEventListener('change',render);get('show-radius').addEventListener('change',render);
 const count=get('count'), down=get('count-down'), up=get('count-up');
 function syncCount(){count.max=limitCount();count.value=cfg.count;down.disabled=cfg.count<=1;up.disabled=cfg.count>=limitCount();}
 function commitCount(value){cfg.count=value;lastLoggedCount=value;syncCount();engine.step(0);updateGrowthStatus();render();}
 for(const input of growthInputs){if(input)input.addEventListener('change',readGrowth);}
 document.addEventListener('visibilitychange',()=>{
   last=0;acc=0;
   if(document.hidden&&frameHandle){cancelAnimationFrame(frameHandle);frameHandle=0;}
   else if(!document.hidden&&playing&&!frameHandle)frameHandle=requestAnimationFrame(frame);
 });
 function applyCount(commit=false){
   const raw=count.value, val=count.valueAsNumber;
   if(!Number.isFinite(val)||raw===''){if(commit)count.value=cfg.count;return;}
   if(!commit&&(val<1||val>limitCount()||!Number.isInteger(val)))return;
   cfg.count=clamp(Math.round(val),1,limitCount());
   if(commit)count.value=cfg.count;
   down.disabled=cfg.count<=1;up.disabled=cfg.count>=limitCount();
   engine.step(0);updateGrowthStatus();render();
   if(commit&&cfg.count!==lastLoggedCount){lastLoggedCount=cfg.count;if(!stats.size)startCount=cfg.count;if(playing||stepCount)eventAt('Antal småfåglar → '+cfg.count);}
 }
 count.addEventListener('input',()=>applyCount());
 count.addEventListener('change',()=>applyCount(true));
 count.addEventListener('keydown',e=>{if(e.key==='Enter'){applyCount(true);count.select();}});
 for(const [button,increment] of [[down,-1],[up,1]])button.addEventListener('click',()=>{count.value=clamp(cfg.count+increment,1,limitCount());applyCount(true);});
 const sliderDefs=[
 ['speed','Småfåglarnas fart',15,180,1,' enheter/s'],['turnNoise','Slump i svängarna',0,6,.1,' rad/s'],
  ['seekStrength','Sökstyrka mot grannens position',0,6,.05,' /s'],['alignStrength','Synkstyrka för riktning och fart',0,6,.05,' /s'],
  ['predatorRadius','Reaktionsavstånd',10,250,1,' enheter'],['repelStrength','Flyktstyrka',0,12,.1,' /s'],
  ['falconSpeed','Pilgrimsfalkens fart',80,800,5,' enheter/s'],['hawkSpeed','Hökens fart',20,250,5,' enheter/s'],['hawkSeconds','Hökens tid i fältet',2,35,1,' s']
 ];
 const fmt=new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2});
 for(const [id,label,min,max,step,suffix=''] of sliderDefs){
   const row=document.createElement('label'),name=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');
   name.textContent=label;row.htmlFor=id;output.htmlFor=id;input.id=id;input.type='range';input.min=min;input.max=max;input.step=step;
   const show=()=>{output.textContent=fmt.format(cfg[id])+suffix;};input.value=cfg[id];show();
   input.addEventListener('input',()=>{cfg[id]=Number(input.value);show();if(id==='predatorRadius')render();});
   row.dataset.parameterGroup=['speed','turnNoise','seekStrength','alignStrength'].includes(id)?'smallbirds':'predators';
   input.addEventListener('change',()=>{if(stats.size)eventAt(label+' → '+fmt.format(cfg[id])+suffix);});
   row.append(name,output,input);get('settings').append(row);
 }
 function sync(){
   syncCount();syncGrowth();
   for(const id of ['seek','align'])get(id).checked=cfg[id];
   for(const id of ['seekMode','alignMode'])get(id).value=cfg[id];
   for(const [id,,,,,suffix=''] of sliderDefs){const input=get(id);input.value=cfg[id];input.previousElementSibling.textContent=fmt.format(cfg[id])+suffix;}
 }
 for(const id of ['seek','align','seekMode','alignMode'])get(id).addEventListener('change',()=>{
   const x=get(id),rule=id.startsWith('seek')?'seek':'align';cfg[id]=x.type==='checkbox'?x.checked:x.value;
   const name=rule==='seek'?'Sök upp':'Synkronisera';
   eventAt(name+': '+(cfg[rule]?(cfg[rule+'Mode']==='random'?'slumpmässig fågel':'närmaste fågel'):'av'));
 });
 get('defaults').addEventListener('click',()=>{Object.assign(cfg,FlockEngine.defaults);Object.assign(growth,{enabled:false,batch:10,interval:1,unit:'seconds',cap:FlockEngine.maxBirds});startCount=cfg.count;sync();engine.reset();changeState(false);clearRun();render();});
 function expanded(){return document.fullscreenElement===container||container.classList.contains('expanded');}
 function syncExpanded(){
   const on=expanded(), full=get('fullscreen-predator-slot'), rad=get('predatorRadius').closest('label'), show=get('show-radius').closest('label');
   get(on?'fullscreen-rule-slot':'live-rule-slot').append(get('live-rules'));
   if(on){full.append(rad,show);}
   else{
     get('normal-radius-toggle').append(show);
     get('settings').insertBefore(rad,get('repelStrength').closest('label'));
     get('fullscreen-rules').open=false;
   }
   expand.textContent=on?'Avsluta helskärm':'Helskärm';expand.setAttribute('aria-pressed',String(on));resize();
 }
 function overlay(on){container.classList.toggle('expanded',on);document.body.classList.toggle('has-overlay',on);syncExpanded();}
 expand.addEventListener('click',async()=>{
   if(container.classList.contains('expanded')){overlay(false);return;}
   if(document.fullscreenElement===container){await document.exitFullscreen();return;}
   if(container.requestFullscreen){try{await container.requestFullscreen();if(document.fullscreenElement===container)return;}catch{ /* CSS fallback */ }}
   overlay(true);
 });
 document.addEventListener('fullscreenchange',syncExpanded);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&container.classList.contains('expanded')){overlay(false);expand.focus();}});
 if('ResizeObserver' in window){new ResizeObserver(resize).observe(wrap);new ResizeObserver(()=>{if(inStats)stats.render();}).observe(get('stats-chart'));}else window.addEventListener('resize',()=>{if(inStats)stats.render();else resize();});
 sync();resize();
})();
