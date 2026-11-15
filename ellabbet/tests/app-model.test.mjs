import test from 'node:test';
import assert from 'node:assert/strict';
import {solveCircuit} from '../solver.mjs';
import {fixture,emptyCircuit,emptyWork,newComponent,addWire,solverInput,clone,validateState,initialState,topology} from '../model.mjs';
import {checkTask,TASKS} from '../tasks.mjs';
function put(c,type,value){const comp=newComponent(c,type);if(value!==undefined)comp.value=value;c.components.push(comp);return comp.id;}
function connect(c,a,b){addWire(c,a,b);}
function snapshot(c){return {time:'2026-11-15T10:00:00Z',note:'',circuit:clone(c)};}
function work(...cs){const w=emptyWork();w.circuit=clone(cs.at(-1));w.observations=cs.map(snapshot);return w;}
function serial(types){const c=emptyCircuit(),b=put(c,'battery'),ids=types.map(t=>put(c,t));let previous=b+':a';for(const id of ids){connect(c,previous,id+':a');previous=id+':b';}connect(c,previous,b+':b');for(const x of c.components)if(x.type==='switch')x.closed=true;return c;}
function open(c){const other=clone(c);other.components.find(c=>c.type==='switch').closed=false;return other;}
function switchedParallel(common=false){const c=fixture('parallel');const sw=put(c,'switch');c.components.find(x=>x.id===sw).closed=true;const old=c.wires.filter(w=>w.a==='c1:a');c.wires=c.wires.filter(w=>w.a!=='c1:a');connect(c,'c1:a',sw+':a');for(const w of old)connect(c,common||w.b==='c2:a'?sw+':b':'c1:a',w.b);return c;}
export const scenarios={};
scenarios.E01=[fixture('single')];
let c=serial(['lamp','switch']);scenarios.E02=[c,open(c)];
c=serial(['ammeter','lamp']);let v=put(c,'voltmeter');connect(c,v+':a','c3:a');connect(c,v+':b','c3:b');scenarios.E03=[c];
c=serial(['ammeter','lamp']);let after=clone(c);after.wires=[];connect(after,'c1:a','c3:a');connect(after,'c3:b','c2:a');connect(after,'c2:b','c1:b');scenarios.E04=[c,after];
c=serial(['resistor']);let changed=clone(c);changed.components[0].value=9;scenarios.E05=[c,changed];
changed=clone(c);changed.components[1].value=200;scenarios.E06=[c,changed];
c=serial(['lamp','lamp','switch']);scenarios.E07=[c,open(c)];
c=switchedParallel(false);scenarios.E08=[c,open(c)];
c=fixture('parallel');c.components.filter(c=>c.type==='lamp').forEach((x,i)=>{x.type='resistor';x.value=i?60:30;});scenarios.E09=[c];
c=switchedParallel(true);scenarios.E10=[...scenarios.E08,c,open(c)];
scenarios.E11=[fixture('single')];
c=fixture('single');changed=clone(c);changed.components[1].x+=80;changed.components[1].rotation=90;scenarios.E12=[c,changed];
test('Actual app adapter solves all supplied fixtures',()=>{for(const kind of ['single','series','parallel','parts','broken']){const r=solveCircuit(solverInput(fixture(kind)));assert.equal(r.status,'ok',kind+JSON.stringify(r.errors));}assert.ok(Math.abs(solveCircuit(solverInput(fixture('single'))).source.current-6/31)<1e-10);});
test('Adapter sends strict value and closed properties',()=>{const c=serial(['switch','voltmeter','lamp']);const input=solverInput(c);for(const x of input.components){assert.equal(Object.hasOwn(x,'closed'),x.type==='switch');assert.equal(Object.hasOwn(x,'value'),['lamp','battery','resistor','ammeter'].includes(x.type));}assert.equal(solveCircuit(input).status,'ok');});
for(const task of TASKS){test(task.id+' accepts a valid, saved observation sequence',()=>{const cs=scenarios[task.id];assert.equal(checkTask(task.id,work(...cs)).pass,true);});test(task.id+' does not accept mere component presence or an empty observation list',()=>{const w=emptyWork();w.circuit=clone(scenarios[task.id].at(-1));assert.equal(checkTask(task.id,w).pass,false);});}
test('E07 rejects equal-current parallel lamps',()=>{const c=switchedParallel(true);assert.equal(checkTask('E07',work(c,open(c))).pass,false);});
test('E07 rejects tiny bypass branch despite rounded equality',()=>{const c=serial(['switch','resistor','resistor','resistor','resistor','resistor','lamp','lamp']);c.components[0].value=1.5;for(const x of c.components.filter(c=>c.type==='resistor'))x.value=1000;const r=put(c,'resistor',1000);connect(c,r+':a','c8:a');connect(c,r+':b','c8:b');assert.equal(checkTask('E07',work(c,open(c))).pass,false);});
test('E04 rejects moving meter across a closed switch on same side',()=>{const c=serial(['switch','ammeter','lamp']);const other=clone(c);other.wires=[];connect(other,'c1:a','c3:a');connect(other,'c3:b','c2:a');connect(other,'c2:b','c4:a');connect(other,'c4:b','c1:b');assert.equal(checkTask('E04',work(c,other)).pass,false);});
test('E04 rejects reversed meter polarity in same physical location',()=>{const c=scenarios.E04[0],b=clone(c);b.wires=b.wires.map(w=>({...w,a:w.a==='c2:a'?'c2:b':w.a==='c2:b'?'c2:a':w.a,b:w.b==='c2:a'?'c2:b':w.b==='c2:b'?'c2:a':w.b}));assert.equal(checkTask('E04',work(c,b)).pass,false);});
test('E03 rejects merely parallel ammeter with matching current',()=>{const c=fixture('single');const a=put(c,'ammeter');connect(c,a+':a','c2:a');connect(c,a+':b','c2:b');assert.equal(checkTask('E03',work(c)).pass,false);});
test('E08 rejects a common switch that turns both lamps off',()=>{const c=switchedParallel(true);assert.equal(checkTask('E08',work(c,open(c))).pass,false);});
test('E05 rejects changing resistor as well as voltage',()=>{const cs=clone(scenarios.E05);cs[1].components[1].value=200;assert.equal(checkTask('E05',work(...cs)).pass,false);});
test('E06 rejects changing battery as well as resistor',()=>{const cs=clone(scenarios.E06);cs[1].components[0].value=9;assert.equal(checkTask('E06',work(...cs)).pass,false);});
test('E12 rejects rewiring with similar geometry',()=>{const cs=clone(scenarios.E12);cs[1].wires.pop();assert.equal(checkTask('E12',work(...cs)).pass,false);});
test('Moving and rotating do not alter topology or physics',()=>{for(const kind of ['single','series','parallel']){const a=fixture(kind),b=clone(a);b.components.forEach(x=>{x.x=200;x.y=200;x.rotation=270;});assert.equal(topology(a),topology(b));assert.deepEqual(solveCircuit(solverInput(a)),solveCircuit(solverInput(b)));}});
test('Trip stays latched after wiring change until explicit reset',()=>{const c=fixture('single');connect(c,'c1:a','c1:b');assert.equal(solveCircuit(solverInput(c)).status,'tripped');c.tripped=true;c.wires.pop();assert.equal(solveCircuit(solverInput(c)).status,'tripped');c.tripped=false;assert.equal(solveCircuit(solverInput(c)).status,'ok');});
test('JSON roundtrip validates full task state and immutable history',()=>{const s=initialState();for(const t of TASKS){const w=work(...scenarios[t.id]);w.completion={version:s.version,time:'2026-11-15T10:00:00Z',circuit:clone(w.circuit),observations:clone(w.observations),prediction:'Min tanke',explanation:'Min förklaring',oral:true};s.works[t.id]=w;}const result=validateState(JSON.parse(JSON.stringify(s)));assert.deepEqual(result,s);const historic=JSON.stringify(result.works.E01.completion);result.works.E01.circuit.components[0].value=8;assert.equal(JSON.stringify(result.works.E01.completion),historic);});
test('Unknown versions and unsafe numeric/schema imports rejected',()=>{const s=initialState();assert.throws(()=>validateState({...s,schema:2}));assert.throws(()=>validateState({...s,version:'2.0'}));for(const v of [-1,0,NaN,Infinity,100000]){const bad=clone(s);bad.works.free.circuit=fixture('single');bad.works.free.circuit.components[0].value=v;assert.throws(()=>validateState(bad));}const broken=clone(s);broken.works.free.circuit=fixture('single');broken.works.free.circuit.wires[0].a='missing';assert.throws(()=>validateState(broken));});
test('Component and wire limits stop additions without silent loss',()=>{const c=emptyCircuit();for(let i=0;i<24;i++)put(c,'lamp');assert.throws(()=>put(c,'lamp'));put(c,'battery');assert.throws(()=>put(c,'battery'));assert.equal(c.components.length,25);});
test('Student text stays plain data, not executable markup',()=>{const s=initialState();s.works.free.explanation='<img src=x onerror=alert(1)>';assert.equal(validateState(s).works.free.explanation,s.works.free.explanation);});
