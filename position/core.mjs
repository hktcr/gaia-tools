export const MEASUREMENT_MS = 12000;
export const FRESH_MS = 5000;
export const ERROR_TEXT = {
  denied: 'Platsåtkomst är nekad. Tillåt plats för sidan i webbläsarens inställningar och försök igen.',
  unavailable: 'Din enhet kunde inte hitta en färsk position. Gå gärna ut eller närmare ett fönster och försök igen.',
  timeout: 'Ingen färsk position kom fram i tid. Försök igen, gärna utomhus.',
  insecure: 'Position behöver en säker anslutning. Öppna sidan via HTTPS.',
  unsupported: 'Den här webbläsaren stöder inte platsmätning. Öppna sidan i en modern mobilwebbläsare.',
  hidden: 'Mätningen avbröts när du lämnade sidan. Tryck på Mät min position för en ny mätning.'
};
export function toSample(position, start, now) {
  const c = position?.coords, timestamp = position?.timestamp;
  if (!c || !Number.isFinite(timestamp) || timestamp < start || timestamp > now || now - timestamp > FRESH_MS) return null;
  if (![c.latitude, c.longitude, c.accuracy].every(Number.isFinite) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180 || c.accuracy <= 0) return null;
  return { latitude:c.latitude, longitude:c.longitude, accuracy:c.accuracy, timestamp };
}
export function bestFresh(samples, now) {
  return samples.filter(s=>s.timestamp <= now && now-s.timestamp <= FRESH_MS)
    .sort((a,b)=>a.accuracy-b.accuracy || b.timestamp-a.timestamp)[0] || null;
}
export function createMeasurement({geo, secure=true, now=Date.now, setTimer=setTimeout, clearTimer=clearTimeout, onChange=()=>{}, onComplete=()=>{}}) {
  let run=null, serial=0;
  function stop() {
    if (!run) return;
    if (run.watch !== null) geo.clearWatch(run.watch);
    clearTimer(run.timer);
    run=null;
  }
  function finish(reason) {
    if (!run) return;
    const active=run;
    const sample=reason ? null : bestFresh(active.samples, now());
    const error=reason || (sample ? null : active.lastError || 'timeout');
    stop();
    onComplete({sample, error, accepted:active.samples.length});
  }
  return {
    get active(){return run!==null;},
    start() {
      if (run) return false;
      if (!secure || !geo) {
        onComplete({sample:null,error:!secure?'insecure':'unsupported',accepted:0}); return false;
      }
      const current={id:++serial,start:now(),samples:[],watch:null,timer:null,lastError:null};
      run=current;
      current.timer=setTimer(()=>finish(),MEASUREMENT_MS);
      onChange({measuring:true,start:current.start,accepted:0,best:null});
      try {
        const watch=geo.watchPosition(position=>{
          if (run!==current) return;
          const sample=toSample(position,current.start,now());
          if (!sample) return;
          current.samples=current.samples.filter(s=>now()-s.timestamp<=FRESH_MS);
          current.samples.push(sample);
          // Bound memory even if a provider supplies unusually frequent callbacks.
          if(current.samples.length>200) current.samples.splice(0,current.samples.length-200);
          onChange({measuring:true,start:current.start,accepted:current.samples.length,best:bestFresh(current.samples,now())});
        },error=>{
          if (run!==current) return;
          if(error.code===1) finish('denied');
          else current.lastError=error.code===3?'timeout':'unavailable';
        },{enableHighAccuracy:true,maximumAge:0,timeout:10000});
        if (run===current) current.watch=watch;
        else geo.clearWatch(watch);
      } catch(error) { finish(error?.name==='SecurityError'?'denied':'unavailable'); }
      return true;
    },
    cancel(reason='hidden'){finish(reason);},
    dispose(){stop();serial++;}
  };
}
export function coord(value){return value.toFixed(6).replace('.',',');}
export function accuracy(value){return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(value);}
export function timestamp(value){
  const date=new Date(value);
  const parts=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
  const minutes=-date.getTimezoneOffset();
  const offset=`${minutes>=0?'+':'−'}${String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')}:${String(Math.abs(minutes)%60).padStart(2,'0')}`;
  return `${parts} (UTC${offset})`;
}
export function age(value,now=Date.now()){
  const seconds=Math.max(0,Math.floor((now-value)/1000));
  if(seconds<60)return `${seconds} s sedan`;
  if(seconds<3600)return `${Math.floor(seconds/60)} min ${seconds%60} s sedan`;
  return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min sedan`;
}
