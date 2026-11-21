(function(root,factory){
 const Stat=factory();if(typeof module==='object'&&module.exports)module.exports=Stat;else root.FlockStats=Stat;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const N=3600,E=64, keys=['polarization','nearestPct','affectedPct'];
 const specs=[
  {label:'Polarisering',unit:'',max:1,color:'#8e4e25',dash:[],shape:'circle'},
  {label:'Närmaste granne',unit:' %',max:10,color:'#1f6151',dash:[6,3],shape:'square'},
  {label:'Inom reaktionsavstånd',unit:' %',max:100,color:'#384f7a',dash:[2,3],shape:'triangle'},
  {label:'Antal småfåglar',unit:'',max:100,color:'#704f80',dash:[10,3,2,3],shape:'diamond'}
 ];
 const fmt=new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2});
 const timeLabel=t=>{const s=Math.floor(t);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 class FlockStats {
  constructor({chart=null,reason=null,summary=null,events=null,exportButton=null,resetButton=null}={}){
   Object.assign(this,{chart,reason,summary,events,exportButton});
   this.buffer=new Float32Array(N*6);
   this.eventTimes=new Float32Array(E);
   this.eventLabels=new Array(E);
   this.clear();
   exportButton?.addEventListener('click',()=>this.download());
   resetButton?.addEventListener('click',()=>{this.clear();if(chart?.clientWidth)this.render();});
  }
  clear(){this.head=0;this.size=0;this.eventHead=0;this.eventSize=0;this.eventLabels.fill(undefined);this.bucket=-1;this.eventDirty=true;if(this.exportButton)this.exportButton.disabled=true;}
  reset(){this.clear();}
  record(seconds,data){
   if(!Number.isFinite(seconds)||seconds<0||!data)return false;
   const bucket=Math.floor(seconds);if(bucket<=this.bucket)return false;this.bucket=bucket;
   const i=this.head*6,n=Number.isFinite(data.count)?Math.max(0,data.count):0,p=Number.isFinite(data.predators)?Math.max(0,data.predators):0;
   this.buffer[i]=seconds;this.buffer[i+1]=n;this.buffer[i+2]=p;
   for(let k=0;k<3;k++){const v=data[keys[k]],max=k===0?1:k===1?Infinity:100;this.buffer[i+3+k]=typeof v==='number'&&Number.isFinite(v)&&n>=(k===1?2:1)?Math.max(0,Math.min(max,v)):NaN;}
   this.head=(this.head+1)%N;this.size=Math.min(this.size+1,N);
   if(this.exportButton)this.exportButton.disabled=false;return true;
  }
  addEvent(seconds,label){
   if(!Number.isFinite(seconds)||seconds<0||!label)return;
   this.eventTimes[this.eventHead]=seconds;this.eventLabels[this.eventHead]=String(label).slice(0,160);
   this.eventHead=(this.eventHead+1)%E;this.eventSize=Math.min(E,this.eventSize+1);this.eventDirty=true;
  }
  _index(j){return ((this.head-this.size+j+N)%N)*6;}
  _eventIndex(j){return (this.eventHead-this.eventSize+j+E)%E;}
  toCSV(){
   const rows=['"tid_s","småfåglar","rovfåglar","polarisering_0_1","närmaste_granne_pct_kortsida","inom_reaktionsavstånd_pct","händelse"'];
   let j=0,e=0;
   while(j<this.size||e<this.eventSize){
    const sample=j<this.size?this._index(j):-1, event=e<this.eventSize?this._eventIndex(e):-1;
    if(sample>=0&&(event<0||this.buffer[sample]<=this.eventTimes[event])){
     const str=[];for(let k=0;k<6;k++){const v=this.buffer[sample+k];str.push(Number.isFinite(v)?csvCell(+v.toFixed(4)):'""');}rows.push(str.join(',')+',""');j++;
    }else{
     let label=this.eventLabels[event];if(/^[=+@\-\t\r]/.test(label))label="'"+label;
     rows.push([csvCell(+this.eventTimes[event].toFixed(4)),'','','','','',csvCell(label)].join(','));e++;
    }
   }
   return '\ufeff'+rows.join('\r\n')+'\r\n';
  }
  download(){
   if(!this.size||typeof document==='undefined')return;
   const url=URL.createObjectURL(new Blob([this.toCSV()],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
   a.href=url;a.download='flocklabbet-statistik.csv';a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  render(){
   const b=this.buffer, has=this.size>0, first=has?this._index(0):0,last=has?this._index(this.size-1):0;
   const mins=[Infinity,Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity,-Infinity];
   const value=(i,k)=>b[k===3?i+1:i+3+k];
   for(let j=0;j<this.size;j++){const i=this._index(j);for(let k=0;k<4;k++){const v=value(i,k);if(Number.isFinite(v)){mins[k]=Math.min(mins[k],v);maxs[k]=Math.max(maxs[k],v);}}}
   if(this.reason)this.reason.textContent=has?'En mätning per simulerad sekund. Visar som mest den senaste timmen.':'Starta simuleringen för att samla mätvärden.';
   if(this.summary){
    const desc=(v,k)=>Number.isFinite(v)?fmt.format(v)+specs[k].unit:'saknas';
    this.summary.textContent=has?`${b[last+1]} småfåglar och ${b[last+2]} rovfåglar vid ${timeLabel(b[last])}. `+specs.map((s,k)=>s.label+': nu '+desc(value(last,k),k)+', min '+desc(mins[k],k)+', max '+desc(maxs[k],k)+'.').join(' '):'Inga mätvärden ännu.';
   }
   if(this.events&&this.eventDirty){
    this.events.replaceChildren();this.eventDirty=false;
    for(let j=this.eventSize-1;j>=Math.max(0,this.eventSize-8);j--){const i=this._eventIndex(j),item=this.events.ownerDocument.createElement(this.events.matches('ul,ol')?'li':'div');item.textContent=timeLabel(this.eventTimes[i])+' '+this.eventLabels[i];this.events.append(item);}
   }
   const cv=this.chart;if(!cv||!cv.clientWidth||!cv.clientHeight)return;
   const w=cv.clientWidth,h=cv.clientHeight,d=Math.min(2,globalThis.devicePixelRatio||1);
   const bw=Math.round(w*d),bh=Math.round(h*d);if(cv.width!==bw)cv.width=bw;if(cv.height!==bh)cv.height=bh;
   const c=cv.getContext('2d');if(!c)return;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);c.font='12px system-ui';c.textBaseline='middle';
   const left=36,right=w-12,pad=8,row=(h-26)/4;
   if(right<=left||row<36)return;
   const from=has?b[first]:0,to=has?Math.max(from+10,b[last]):10,x=t=>left+(t-from)/(to-from)*(right-left);
   for(let k=0;k<4;k++){
    const s=specs[k],top=pad+k*row+22,bottom=pad+(k+1)*row-5,mx=k===1?Math.max(s.max,Math.ceil(maxs[k]/5)*5):k===3?Math.max(s.max,Math.ceil(maxs[k]/100)*100):s.max;
    const y=v=>bottom-v/mx*(bottom-top);
    c.fillStyle='#30382f';c.fillText(s.label+(k===1?' (% av kortsidan)':k===2?' (%)':''),left,top-11);
    c.fillText(fmt.format(mx),1,top);c.fillText('0',14,bottom);
    c.strokeStyle='#788576';c.lineWidth=.7;c.setLineDash([]);c.beginPath();c.moveTo(left,top);c.lineTo(right,top);c.moveTo(left,bottom);c.lineTo(right,bottom);c.stroke();
    if(!has)continue;
    c.strokeStyle='#a6a99b';c.lineWidth=.6;c.setLineDash([1,4]);c.beginPath();
    for(let j=0;j<this.eventSize;j++){const t=this.eventTimes[this._eventIndex(j)];if(t>=from&&t<=to){c.moveTo(x(t),top);c.lineTo(x(t),bottom);}}c.stroke();
    c.strokeStyle=s.color;c.lineWidth=1.55;c.setLineDash(s.dash);c.beginPath();let pen=false;
    for(let j=0;j<this.size;j++){const i=this._index(j),v=value(i,k);if(!Number.isFinite(v)){pen=false;continue;}if(pen)c.lineTo(x(b[i]),y(v));else c.moveTo(x(b[i]),y(v));pen=true;}c.stroke();
    const v=value(last,k);if(!Number.isFinite(v))continue;
    const lx=x(b[last]),ly=y(v);c.fillStyle=s.color;c.setLineDash([]);c.beginPath();
    if(s.shape==='circle')c.arc(lx,ly,3,0,2*Math.PI);
    if(s.shape==='square')c.rect(lx-3,ly-3,6,6);
    if(s.shape==='triangle'){c.moveTo(lx,ly-4);c.lineTo(lx+4,ly+3);c.lineTo(lx-4,ly+3);c.closePath();}
    if(s.shape==='diamond'){c.moveTo(lx,ly-4);c.lineTo(lx+4,ly);c.lineTo(lx,ly+4);c.lineTo(lx-4,ly);c.closePath();}
    c.fill();
   }
   c.fillStyle='#30382f';c.fillText(timeLabel(from),left,h-9);const end=timeLabel(to);c.fillText(end,right-c.measureText(end).width,h-9);
  }
 }
 return FlockStats;
});
