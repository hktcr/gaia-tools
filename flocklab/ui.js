'use strict';
(() => {
 const get = id=>document.getElementById(id), canvas=get('field'), wrap=get('canvaswrap'), container=get('observation'), ctx=canvas.getContext('2d');
 const engine=new FlockEngine(wrap.clientWidth,wrap.clientHeight), cfg=engine.config, counts=get('counts'), play=get('play'), expand=get('expand');
 let w=engine.w,h=engine.h,dpr=1,playing=false,last=0,acc=0,drag=null,keyPoint=null,countText='';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const selected=()=>document.querySelector('input[name=predator]:checked').value;
 const selectedAngle=()=>Number(get('angle').value)*Math.PI/180;
 function changeState(state){playing=state;play.textContent=state?'Pausa':'Starta';play.classList.toggle('is-running',state);get('fieldstatus').textContent=state?'PÅGÅR':'PAUSAD';acc=0;}
 function launch(x,y,a){
   const type=selected();
   engine.spawn(type,x,y,a);
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
 function render(){
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.fillStyle='#172c27';ctx.fillRect(0,0,w,h);
   ctx.lineWidth=1;ctx.strokeStyle='#92a58f22';ctx.beginPath();
   for(let x=24;x<w;x+=48){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,h);}
   for(let y=24;y<h;y+=48){ctx.moveTo(0,y+.5);ctx.lineTo(w,y+.5);}
   ctx.stroke();
   for(const b of engine.birds)glyph(b.x,b.y,b.a);
   for(const p of engine.predators){
     if(get('show-radius').checked){ctx.save();ctx.strokeStyle=p.type==='hawk'?'#9fd9eb8a':'#f2a4938a';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(p.x,p.y,cfg.predatorRadius*engine.scale,0,2*Math.PI);ctx.stroke();ctx.restore();}
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
   const nw=Math.max(1,wrap.clientWidth),nh=Math.max(1,wrap.clientHeight);
   if(keyPoint)keyPoint={x:keyPoint.x*nw/w,y:keyPoint.y*nh/h};
   dpr=Math.min(2.5,window.devicePixelRatio||1);canvas.width=Math.round(dpr*nw);canvas.height=Math.round(dpr*nh);w=nw;h=nh;engine.resize(w,h);render();
 }
 const frame=ts=>{
   const elapsed=last?Math.min((ts-last)/1000,.06):0;last=ts;
   if(playing){acc+=elapsed;while(acc>=1/60){engine.step(1/60);acc-=1/60;}render();}
   requestAnimationFrame(frame);
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
 play.addEventListener('click',()=>{applyCount(true);changeState(!playing);});
 get('reset').addEventListener('click',()=>{engine.reset();changeState(false);render();});
 get('angle').addEventListener('change',render);get('show-radius').addEventListener('change',render);
 const count=get('count'), down=get('count-down'), up=get('count-up');
 function applyCount(commit=false){
   const raw=count.value, val=count.valueAsNumber;
   if(!Number.isFinite(val)||raw===''){if(commit)count.value=cfg.count;return;}
   if(!commit&&(val<1||val>FlockEngine.maxBirds||!Number.isInteger(val)))return;
   cfg.count=clamp(Math.round(val),1,FlockEngine.maxBirds);
   if(commit)count.value=cfg.count;
   down.disabled=cfg.count<=1;up.disabled=cfg.count>=FlockEngine.maxBirds;
   engine.step(0);render();
 }
 count.addEventListener('input',()=>applyCount());
 count.addEventListener('change',()=>applyCount(true));
 count.addEventListener('keydown',e=>{if(e.key==='Enter'){applyCount(true);count.select();}});
 for(const [button,increment] of [[down,-1],[up,1]])button.addEventListener('click',()=>{count.value=clamp(cfg.count+increment,1,FlockEngine.maxBirds);applyCount(true);});
 const sliderDefs=[
 ['speed','Småfåglarnas fart',15,180,1],['turnNoise','Slump i svängarna',0,6,.1],
  ['seekStrength','Kraft mot grannens position',0,6,.05],['alignStrength','Kraft mot grannens riktning',0,6,.05],
  ['predatorRadius','Reaktionsavstånd',10,250,1],['repelStrength','Styrka på flyktreaktion',0,12,.1],
  ['falconSpeed','Pilgrimsfalkens fart',80,800,5],['hawkSpeed','Hökens fart',20,250,5],['hawkSeconds','Hökens tid i fältet',2,35,1,' s']
 ];
 const fmt=new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2});
 for(const [id,label,min,max,step,suffix=''] of sliderDefs){
   const row=document.createElement('label'),name=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');
   name.textContent=label;row.htmlFor=id;output.htmlFor=id;input.id=id;input.type='range';input.min=min;input.max=max;input.step=step;
   const show=()=>{output.textContent=fmt.format(cfg[id])+suffix;};input.value=cfg[id];show();
   input.addEventListener('input',()=>{cfg[id]=Number(input.value);show();if(id==='count'&&!playing){engine.reset();render();}});
   row.append(name,output,input);get('settings').append(row);
 }
 function sync(){
   count.value=cfg.count;down.disabled=cfg.count<=1;up.disabled=cfg.count>=FlockEngine.maxBirds;
   for(const id of ['seek','align'])get(id).checked=cfg[id];
   for(const id of ['seekMode','alignMode'])get(id).value=cfg[id];
   for(const [id,,,,,suffix=''] of sliderDefs){const input=get(id);input.value=cfg[id];input.previousElementSibling.textContent=fmt.format(cfg[id])+suffix;}
 }
 for(const id of ['seek','align','seekMode','alignMode'])get(id).addEventListener('change',()=>{cfg[id]=get(id).type==='checkbox'?get(id).checked:get(id).value;});
 get('defaults').addEventListener('click',()=>{Object.assign(cfg,FlockEngine.defaults);sync();engine.reset();render();});
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
 if('ResizeObserver' in window)new ResizeObserver(resize).observe(wrap);else window.addEventListener('resize',resize);
 sync();resize();requestAnimationFrame(frame);
})();
