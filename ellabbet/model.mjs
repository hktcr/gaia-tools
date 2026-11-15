export const VERSION = '1.0.0';
export const STORAGE_KEY = 'se.gaia-tools.ellabbet.v1';
export const TYPES = {battery:'Batteri',lamp:'Lampa',resistor:'Motstånd',switch:'Brytare',ammeter:'Amperemeter',voltmeter:'Voltmeter',junction:'Förgreningspunkt'};
export const LIMITS = {components:25,wires:60,junctions:16,observations:12,bytes:2000000};
export const clone = value => JSON.parse(JSON.stringify(value));
export const emptyCircuit = () => ({components:[],wires:[],tripped:false,fault:null});
export const emptyWork = () => ({circuit:emptyCircuit(),prediction:'',explanation:'',observations:[],hints:0,oral:false,repeat:false,completion:null});
export const initialState = () => ({schema:1,version:VERSION,mode:'free',task:'E01',works:{free:emptyWork()},theme:'system'});
export function ports(circuit) { return circuit.components.flatMap(c => c.type==='junction'?[{id:c.id,name:c.label}]:[{id:c.id+':a',name:c.label+(c.type==='battery'?' +':c.type==='voltmeter'?' röd (+)':' A')},{id:c.id+':b',name:c.label+(c.type==='battery'?' −':c.type==='voltmeter'?' svart (−)':' B')}]); }
export function solverInput(circuit) { return {nodes:ports(circuit).map(p=>p.id),wires:circuit.wires.map(({a,b})=>({a,b})),components:circuit.components.filter(c=>c.type!=='junction').map(c=>({id:c.id,type:c.type,a:c.id+':a',b:c.id+':b',...(['battery','resistor','lamp','ammeter'].includes(c.type)?{value:c.value}:{}),...(c.type==='switch'?{closed:c.closed}:{})})),tripped:circuit.tripped}; }
export function newComponent(circuit,type) {
  if(!Object.hasOwn(TYPES,type)) throw new Error('Okänd komponent.');
  if(type==='battery' && circuit.components.some(c=>c.type==='battery')) throw new Error('En batterikälla åt gången i den här versionen.');
  if(type==='junction' ? circuit.components.filter(c=>c.type==='junction').length>=16 : (type==='battery'?false:circuit.components.filter(c=>!['junction','battery'].includes(c.type)).length>=24)) throw new Error('Gränsen är 24 övriga komponenter, ett batteri och 16 förgreningspunkter.');
  let n=1; while(circuit.components.some(c=>c.id==='c'+n))n++;
  const count=circuit.components.filter(c=>c.type===type).length+1;
  const values={battery:6,lamp:30,resistor:100,ammeter:0.01,voltmeter:0,switch:0,junction:0};
  return {id:'c'+n,type,label:TYPES[type]+(type==='battery'?'':' '+count),value:values[type],closed:false,x:140+((n-1)%4)*210,y:140+Math.floor((n-1)/4)%3*150,rotation:0};
}
export function addWire(circuit,a,b) {
  const ids=new Set(ports(circuit).map(p=>p.id));
  if(!ids.has(a)||!ids.has(b))throw new Error('Välj två befintliga anslutningar.');
  if(a===b)throw new Error('Välj två olika anslutningar.');
  if(circuit.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))throw new Error('De anslutningarna har redan en ledning.');
  if(circuit.wires.length>=60)throw new Error('Högst 60 ledningar i den här versionen.');
  let n=1;while(circuit.wires.some(w=>w.id==='w'+n))n++;
  circuit.wires.push({id:'w'+n,a,b});
}
export function fixture(kind='single') {
  const c=emptyCircuit();
  const put=(type,x,y,closed=false)=>{const p=newComponent(c,type);Object.assign(p,{x,y,closed});c.components.push(p);return p.id;};
  const battery=put('battery',160,290),l1=put('lamp',490,150);
  const wire=(a,b)=>addWire(c,a,b);
  if(kind==='parts')return c;
  if(kind==='parallel') { const l2=put('lamp',490,400);wire(battery+':a',l1+':a');wire(battery+':a',l2+':a');wire(battery+':b',l1+':b');wire(battery+':b',l2+':b'); }
  else if(kind==='series') {const l2=put('lamp',700,350);wire(battery+':a',l1+':a');wire(l1+':b',l2+':a');wire(l2+':b',battery+':b');}
  else {wire(battery+':a',l1+':a');if(kind!=='broken')wire(battery+':b',l1+':b');}
  return c;
}
export function topology(circuit,{ignoreValues=[],ignoreSwitch=false,ignoreTypes=[]}={}) {
  const components=circuit.components.filter(c=>!ignoreTypes.includes(c.type)).map(c=>({id:c.id,type:c.type,value:ignoreValues.includes(c.type)?null:c.value,closed:ignoreSwitch?null:c.closed})).sort((a,b)=>a.id.localeCompare(b.id));
  return JSON.stringify({components,wires:circuit.wires.map(w=>[w.a,w.b].sort()).sort((a,b)=>a.join('|').localeCompare(b.join('|')))});
}
const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v,max=1600)=>typeof v==='string'&&v.length<=max;
function need(condition,message){if(!condition)throw new Error(message);}
export function validateCircuit(input) {
  need(isObject(input)&&Array.isArray(input.components)&&Array.isArray(input.wires),'Kretsdata saknas.');
  need(input.components.length<=41 && input.wires.length<=60,'Filen har för många komponenter eller ledningar.');
  const ids=new Set();let batteries=0,passive=0,junctions=0;
  const components=input.components.map(c=>{
    need(isObject(c)&&/^c\d{1,5}$/.test(c.id)&&!ids.has(c.id)&&Object.hasOwn(TYPES,c.type),'Ogiltig eller upprepad komponent.');ids.add(c.id);
    need(text(c.label,60)&&finite(c.x,100,860)&&finite(c.y,100,480)&&[0,90,180,270].includes(c.rotation),'Ogiltig komponentplacering.');
    need(typeof c.closed==='boolean','Brytarläge saknas.');
    if(c.type==='battery'){batteries++;need(finite(c.value,1.5,9)&&Math.abs(c.value*10-Math.round(c.value*10))<1e-8,'Batteriet måste vara 1,5–9 V i steg om 0,1 V.');}
    else if(c.type==='resistor')need(finite(c.value,10,1000),'Motståndet måste vara 10–1000 Ω.');
    else if(c.type==='lamp')need(c.value===30,'Modellampan ska vara 30 Ω.');
    else if(c.type==='ammeter')need(c.value===0.01,'Amperemeterns resistans är 0,01 Ω.');
    else need(c.value===0,'Ogiltigt komponentvärde.');
    if(c.type==='junction')junctions++;else if(c.type!=='battery')passive++;
    return {id:c.id,type:c.type,label:c.label,value:c.value,closed:c.closed,x:c.x,y:c.y,rotation:c.rotation};
  });
  need(batteries<=1&&passive<=24&&junctions<=16,'Kretsen överskrider modellens gränser.');
  const validPorts=new Set(ports({components}).map(p=>p.id));const wires=[],wireIds=new Set(),pairs=new Set();
  for(const w of input.wires){need(isObject(w)&&/^w\d{1,5}$/.test(w.id)&&!wireIds.has(w.id)&&validPorts.has(w.a)&&validPorts.has(w.b)&&w.a!==w.b,'Ogiltig ledning.');const pair=[w.a,w.b].sort().join('|');need(!pairs.has(pair),'Upprepad ledning.');pairs.add(pair);wireIds.add(w.id);wires.push({id:w.id,a:w.a,b:w.b});}
  need(typeof input.tripped==='boolean','Skyddsläge saknas.');
  const fault=isObject(input.fault)&&finite(input.fault.current,0,100)?{current:input.fault.current,kind:['short-circuit','meter-short','overload'].includes(input.fault.kind)?input.fault.kind:'overload'}:null;
  return {components,wires,tripped:input.tripped,fault};
}
function validateObservations(items){
  need(Array.isArray(items)&&items.length<=LIMITS.observations,'För många mätningar.');
  return items.map(o=>{need(isObject(o)&&text(o.time,50)&&text(o.note,300),'Ogiltig mätning.');return {time:o.time,note:o.note,circuit:validateCircuit(o.circuit)};});
}
function validateWork(w){
  need(isObject(w)&&text(w.prediction)&&text(w.explanation)&&Number.isInteger(w.hints)&&w.hints>=0&&w.hints<=3&&typeof w.oral==='boolean'&&typeof w.repeat==='boolean','Ogiltig uppdragsdata.');
  let completion=null;
  if(w.completion!==null){const h=w.completion;need(isObject(h)&&text(h.version,30)&&text(h.time,50)&&text(h.prediction)&&text(h.explanation),'Ogiltig historik.');completion={version:h.version,time:h.time,circuit:validateCircuit(h.circuit),observations:validateObservations(h.observations),prediction:h.prediction,explanation:h.explanation,oral:!!h.oral};}
  return {circuit:validateCircuit(w.circuit),prediction:w.prediction,explanation:w.explanation,observations:validateObservations(w.observations),hints:w.hints,oral:w.oral,repeat:w.repeat,completion};
}
export function validateState(input) {
  need(isObject(input)&&input.schema===1&&input.version===VERSION,'Filen har en annan eller okänd dataversion. Det befintliga arbetet ändrades inte.');
  need(['free','guided'].includes(input.mode)&&/^E(0[1-9]|1[0-2])$/.test(input.task)&&isObject(input.works),'Ogiltig arbetsvy.');
  const works={};for(const [key,w]of Object.entries(input.works)){need(key==='free'||/^E(0[1-9]|1[0-2])$/.test(key),'Okänt uppdrag i filen.');works[key]=validateWork(w);}
  need(works.free,'Fritt bygge saknas.');
  return {schema:1,version:VERSION,mode:input.mode,task:input.task,works,theme:['system','light','dark'].includes(input.theme)?input.theme:'system'};
}
