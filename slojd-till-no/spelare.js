(() => {
  'use strict';
  const doc = document;
  const root = doc.getElementById('spelare');
  const slides = Array.from(doc.querySelectorAll('.bildruta'));
  const tabs = Array.from(doc.querySelectorAll('.dots a'));
  const caption = doc.getElementById('bildnummer');
  const prev = doc.getElementById('forra');
  const next = doc.getElementById('nasta');
  const controls = doc.getElementById('kontroller');
  const screen = doc.getElementById('fullscreen');
  const msg = doc.getElementById('meddelande');
  const slidesById = new Map(slides.map((slide, index) => ['#'+slide.id,index]));
  let index = 0;
  let timer;
  const show = (target,{write=false,focus=false,scroll=false}={}) => {
    index = Math.max(0,Math.min(target,slides.length-1));
    slides.forEach((slide,n) => { slide.hidden = index!==n; });
    tabs.forEach((tab,n) => { if(n===index) tab.setAttribute('aria-current','step'); else tab.removeAttribute('aria-current'); });
    caption.textContent = 'Bild '+(index+1)+' av '+slides.length;
    prev.disabled = index===0;
    next.disabled = index===slides.length-1;
    if(write && location.hash!=='#'+slides[index].id) {
      history.replaceState(null,'','#'+slides[index].id);
    }
    if(focus || (doc.activeElement===next && next.disabled) || (doc.activeElement===prev && prev.disabled)) {
      slides[index].querySelector('h1').focus({preventScroll:true});
    }
    if(scroll && window.scrollY) window.scrollTo({top:0,behavior:'instant'});
  };
  const go = target => show(target,{write:true,scroll:true});
  show(slidesById.get(location.hash) ?? 0);
  doc.documentElement.classList.add('js-ready');
  controls.hidden = false;
  tabs.forEach((tab,n) => tab.addEventListener('click', event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {event.preventDefault();go(n);} }));
  prev.addEventListener('click',() => go(index-1));
  next.addEventListener('click',() => go(index+1));
  window.addEventListener('hashchange',() => show(slidesById.get(location.hash) ?? 0));
  const announce = message => {
    msg.textContent=message;
    clearTimeout(timer);
    timer=setTimeout(() => {msg.textContent='';},5500);
  };
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  const enter = root.requestFullscreen || root.webkitRequestFullscreen;
  const active = () => doc.fullscreenElement === root || doc.webkitFullscreenElement === root;
  const updateButton=() => {
    screen.querySelector('span').textContent=active()?'Lämna helskärm':'Helskärm';
    screen.setAttribute('aria-pressed',String(active()));
  };
  const fullscreen = async () => {
    try {
      if(active() && exit) await exit.call(doc);
      else if(enter && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) await enter.call(root);
      else announce('Helskärm stöds inte här. Presentationen fungerar ändå.');
    } catch {
      announce('Kunde inte öppna helskärm. Presentationen fungerar ändå.');
    }
  };
  screen.hidden=false;
  updateButton();
  screen.addEventListener('click',fullscreen);
  doc.addEventListener('fullscreenchange',updateButton);
  doc.addEventListener('webkitfullscreenchange',updateButton);
  window.addEventListener('keydown',event => {
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,[contenteditable]')) return;
    const keys={ArrowRight:index+1,PageDown:index+1,ArrowLeft:index-1,PageUp:index-1,Home:0,End:slides.length-1};
    if(Object.hasOwn(keys,event.key)){event.preventDefault();go(keys[event.key]);}
    else if(event.key===' '&&!event.target.closest('button,a')){event.preventDefault();go(index+1);}
  });
  const stage=doc.getElementById('lektion');
  let touch=null;
  stage.addEventListener('touchstart', event => {
    touch=event.touches.length===1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
  },{passive:true});
  stage.addEventListener('touchmove',event=>{if(event.touches.length!==1) touch=null;},{passive:true});
  stage.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  stage.addEventListener('touchend',event=>{
    if(!touch || event.changedTouches.length!==1) return;
    const dx=event.changedTouches[0].clientX-touch.x,dy=event.changedTouches[0].clientY-touch.y;
    touch=null;
    if(Math.abs(dx)>70&&Math.abs(dx)>1.7*Math.abs(dy)) go(index+(dx<0?1:-1));
  },{passive:true});
})();
