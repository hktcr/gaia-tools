import {coord,accuracy,timestamp,age} from './core.mjs';
export function createPNG(sample, exportedAt, bird, doc=document) {
  const canvas=doc.createElement('canvas');canvas.width=1080;canvas.height=1120;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas saknas');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1080,1120);
  const text=(value,x,y,size,color='#1A1A1A',weight=500)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;ctx.fillText(value,x,y);};
  text('POSITION',72,92,22,'#2B5A2B',700);
  text('Här är du',72,168,60,'#1A1A1A',700);
  if(bird?.complete && bird.naturalWidth)ctx.drawImage(bird,832,57,176,153);
  ctx.fillStyle='#F4F7F1';ctx.beginPath();ctx.roundRect(54,237,972,420,24);ctx.fill();
  text('LATITUD',88,292,23,'#52604F',700);
  text(coord(sample.latitude),86,389,86,'#1A1A1A',700);
  text('LONGITUD',88,455,23,'#52604F',700);
  text(coord(sample.longitude),86,552,86,'#1A1A1A',700);
  text('Decimalgrader · WGS 84',88,618,23,'#52604F');
  text('RAPPORTERAD NOGGRANNHET',72,718,22,'#52604F',700);
  text(`± ${accuracy(sample.accuracy)} m`,72,772,40,'#2B5A2B',700);
  text('MÄTTID',72,833,22,'#52604F',700);
  text(timestamp(sample.timestamp),72,874,27);
  text('EXPORTERAD',72,939,22,'#52604F',700);
  text(timestamp(exportedAt),72,980,27);
  text(`Mätningens ålder vid export: ${age(sample.timestamp,exportedAt)}`,72,1027,24,'#52604F');
  text('Enhetens uppskattning. Ingen garanti för exakt GPS-position.',72,1080,22,'#52604F');
  const bytes=atob(canvas.toDataURL('image/png').split(',')[1]);
  const array=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);
  return new Blob([array],{type:'image/png'});
}
