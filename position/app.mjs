import {createMeasurement,MEASUREMENT_MS,ERROR_TEXT,coord,accuracy,age,timestamp} from './core.mjs';
import {createPNG} from './export.mjs';
const $=id=>document.getElementById(id);
let sample=null, start=0, exportBusy=false, previewURL=null;
const actions=[$('copy'),$('share'),$('save')];
function available(){actions.forEach(button=>button.disabled=!sample||measurement.active||exportBusy);}
function cleanPreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('image-preview').hidden=true;$('export-image').removeAttribute('src');}
function showSample(value){
  $('latitude').textContent=value?coord(value.latitude):'—';
  $('longitude').textContent=value?coord(value.longitude):'—';
  $('accuracy').textContent=value?`± ${accuracy(value.accuracy)} m`:'—';
  $('measured-time').textContent=value?new Intl.DateTimeFormat('sv-SE',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(value.timestamp):'—';
  $('measured-date').textContent=value?new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium'}).format(value.timestamp):'';
  $('measured-time').title=value?timestamp(value.timestamp):'';
}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
const measurement=createMeasurement({geo:navigator.geolocation,secure:window.isSecureContext,
  onChange(state){
    start=state.start;$('status').textContent=state.accepted?'Förfinar mätningen':'Söker position';
    $('measure').disabled=true;
    message(state.accepted?'Position hittad. Väntar in fler färska mätvärden för bästa rapporterade noggrannhet.':'Mäter i upp till 12 sekunder. Håll telefonen stilla, gärna utomhus.');
    updateClock();available();
  },
  onComplete(result){
    sample=result.sample;showSample(sample);
    $('measure').disabled=false;$('measure-label').textContent=sample?'Mät igen':'Mät min position';
    $('status').textContent=sample?'Mätning klar':'Ingen ny position';
    message(sample?'Mätningen är klar. Noggrannheten är enhetens uppskattning, ingen garanti för exakt GPS.':ERROR_TEXT[result.error]||ERROR_TEXT.unavailable,!!result.error);
    $('export-message').textContent=sample?'Kopiera bilden och klistra in den i chatten.':'Mät först. Klistra sedan in bilden i chatten.';
    updateClock();available();
  }
});
function updateClock(){
  if(measurement.active){
    const seconds=Math.max(0,Math.ceil((MEASUREMENT_MS-(Date.now()-start))/1000));
    $('measure-label').textContent=`Mäter… ${seconds} s`;$('age').textContent='';
  }else{
    $('age').textContent=sample?age(sample.timestamp):'';
    if(sample && Date.now()-sample.timestamp>60000)$('status').textContent='Tidigare mätning';
  }
}
$('measure').addEventListener('click',()=>{
  if(measurement.active)return;
  if(document.visibilityState==='hidden')return;
  sample=null;showSample(null);cleanPreview();$('export-message').textContent='Väntar på en ny mätning…';available();measurement.start();
});
let ticker=setInterval(updateClock,1000);
function leave(){
  if(measurement.active)measurement.cancel('hidden');
  clearInterval(ticker);ticker=null;
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')leave();
  else{
    if(!ticker)ticker=setInterval(updateClock,1000);
    updateClock();
    if(sample){$('status').textContent='Tidigare mätning';message('Du är tillbaka. Mät igen om du behöver din position nu.');}
  }
});
window.addEventListener('pagehide',()=>{leave();cleanPreview();});
window.addEventListener('pageshow',()=>{if(!ticker)ticker=setInterval(updateClock,1000);updateClock();});
function makeExport(){
  if(!sample||measurement.active)throw new Error('Mät först');
  const exportedAt=Date.now();
  const blob=createPNG({...sample},exportedAt,$('bird'));
  const filename=`position-${new Date(exportedAt).toISOString().replace(/[:.]/g,'-')}.png`;
  return {blob,filename};
}
function preview(blob){
  cleanPreview();previewURL=URL.createObjectURL(blob);$('export-image').src=previewURL;$('image-preview').hidden=false;
}
async function exportAction(action){
  if(exportBusy||!sample||measurement.active)return;
  exportBusy=true;available();
  let artifact;
  try{
    // PNG encoding is synchronous so clipboard/share keep this click's user activation.
    artifact=makeExport();
    if(action==='copy'){
      if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined')throw new Error('copy-unsupported');
      await navigator.clipboard.write([new ClipboardItem({'image/png':artifact.blob})]);
      $('export-message').textContent='Bilden är kopierad. Öppna chatten och välj Klistra in.';
    }else if(action==='share'){
      const file=new File([artifact.blob],artifact.filename,{type:'image/png'});
      if(!navigator.canShare?.({files:[file]}) || !navigator.share)throw new Error('share-unsupported');
      await navigator.share({files:[file],title:'Position'});
      $('export-message').textContent='Bilden har lämnats till enhetens delningsfunktion.';
    }else{
      preview(artifact.blob);
      const a=document.createElement('a');a.href=previewURL;a.download=artifact.filename;a.hidden=true;document.body.append(a);a.click();a.remove();
      $('export-message').textContent='PNG-filen är klar. Om hämtningen inte startar kan du spara bilden nedan.';
    }
  }catch(error){
    if(error.name==='AbortError')$('export-message').textContent='Delningen avbröts. Bilden finns kvar att kopiera eller spara.';
    else if(artifact){
      preview(artifact.blob);
      $('export-message').textContent=action==='copy'?'Bilden kunde inte kopieras här. Tryck Dela bild eller Spara PNG.':action==='share'?'Bilddelning stöds inte här. Tryck Spara PNG och bifoga filen i chatten.':'Spara bilden nedan genom att hålla inne den.';
    }else $('export-message').textContent='Bilden kunde inte skapas. Försök igen eller öppna sidan i en annan webbläsare.';
  }finally{exportBusy=false;available();}
}
$('copy').addEventListener('click',()=>exportAction('copy'));
$('share').addEventListener('click',()=>exportAction('share'));
$('save').addEventListener('click',()=>exportAction('save'));
if(!window.isSecureContext){$('status').textContent='Säker anslutning krävs';message(ERROR_TEXT.insecure,true);}
else if(!navigator.geolocation){$('status').textContent='Platsmätning saknas';message(ERROR_TEXT.unsupported,true);}
