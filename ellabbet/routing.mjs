/** Visual-only orthogonal routing. Never changes the circuit or electrical nodes. */
const STEP=20, COLS=47, ROWS=28;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const gridPoint=id=>({x:20+(id%COLS)*STEP,y:20+Math.floor(id/COLS)*STEP});
const gridId=p=>Math.round((p.y-20)/STEP)*COLS+Math.round((p.x-20)/STEP);
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
export function portPoint(port,circuit){
 const c=circuit.components.find(c=>c.id===port.split(':')[0]);
 if(!c)return {x:0,y:0};
 if(c.type==='junction')return {x:c.x,y:c.y};
 const sign=port.endsWith(':a')?-1:1,angle=c.rotation*Math.PI/180;
 return {x:Math.round(c.x+sign*77*Math.cos(angle)),y:Math.round(c.y+sign*77*Math.sin(angle))};
}
export function componentObstacles(circuit){
 return circuit.components.map(c=>c.type==='junction'
  ?{left:c.x-55,right:c.x+55,top:c.y+5,bottom:c.y+55}
  :{left:c.x-69,right:c.x+69,top:c.y-47,bottom:c.y+47});
}
export function wireObstacles(circuit,wire){
 const contacts=circuit.components.flatMap(c=>c.type==='junction'?[c.id]:[c.id+':a',c.id+':b']);
 return [...componentObstacles(circuit),...contacts.filter(p=>p!==wire.a&&p!==wire.b).map(id=>{const p=portPoint(id,circuit);return {left:p.x-24,right:p.x+24,top:p.y-24,bottom:p.y+24};})];
}
export function segmentHitsRect(a,b,r){
 if(a.x===b.x)return a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom;
 if(a.y===b.y)return a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right;
 return true;
}
function compact(points){
 const result=[];
 for(const p of points){if(result.length&&same(result.at(-1),p))continue;while(result.length>1){const a=result.at(-2),b=result.at(-1);if((a.x===b.x&&b.x===p.x&&(b.y-a.y)*(p.y-b.y)>=0)||(a.y===b.y&&b.y===p.y&&(b.x-a.x)*(p.x-b.x)>=0))result.pop();else break;}result.push(p);}
 return result;
}
function anchors(port,circuit,obstacles){
 const c=circuit.components.find(c=>c.id===port.split(':')[0]),p=portPoint(port,circuit);
 const sign=port.endsWith(':a')?-1:1,angle=c.rotation*Math.PI/180;
 const dirs=c.type==='junction'?[[0,-1],[-1,0],[1,0],[0,1]]:[[Math.round(sign*Math.cos(angle)),Math.round(sign*Math.sin(angle))]];
 const candidates=[];
 for(const [dx,dy]of dirs){
  for(const distance of [12,32,52,72,92]){
   const far=dx?{x:clamp((dx<0?Math.floor((p.x-distance)/STEP):Math.ceil((p.x+distance)/STEP))*STEP,20,940),y:p.y}:{x:p.x,y:clamp((dy<0?Math.floor((p.y-distance)/STEP):Math.ceil((p.y+distance)/STEP))*STEP,20,560)};
   const end={x:clamp(Math.round(far.x/STEP)*STEP,20,940),y:clamp(Math.round(far.y/STEP)*STEP,20,560)};
   const path=compact([p,far,end]);
   if(path.slice(1).some((point,i)=>obstacles.some(r=>segmentHitsRect(path[i],point,r))))continue;
   if(obstacles.some(r=>end.x>r.left&&end.x<r.right&&end.y>r.top&&end.y<r.bottom))continue;
   candidates.push({path,end,id:gridId(end)});break;
  }
 }
 return candidates;
}
class Heap{
 constructor(){this.items=[];this.sequence=0;}
 push(value,priority){const item={value,priority,sequence:this.sequence++};let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.less(this.items[p],item))break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
 less(a,b){return a.priority<b.priority||a.priority===b.priority&&a.sequence<b.sequence;}
 pop(){if(!this.items.length)return null;const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.less(this.items[c+1],this.items[c]))c++;if(this.less(last,this.items[c]))break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first.value;}
}
function search(start,end,blocked,usedEdges,usedNodes){
 const count=COLS*ROWS*4,costs=new Float64Array(count);costs.fill(Infinity);const parents=new Int32Array(count);parents.fill(-1);const queue=new Heap();
 const distance=id=>Math.abs(id%COLS-end%COLS)+Math.abs(Math.floor(id/COLS)-Math.floor(end/COLS));
 for(let d=0;d<4;d++){costs[start*4+d]=0;queue.push({key:start*4+d,cost:0},distance(start));}
 while(queue.items.length){
  const entry=queue.pop(),key=entry.key,id=Math.floor(key/4),dir=key%4;
  if(entry.cost!==costs[key])continue;
  if(id===end){const path=[];for(let k=key;k!==-1;k=parents[k])path.push(Math.floor(k/4));return {ids:path.reverse(),cost:costs[key]};}
  const x=id%COLS,y=Math.floor(id/COLS);
  // Stable ordering makes repeated renders and exports visually deterministic.
  const next=[[x,y-1],[x+1,y],[x,y+1],[x-1,y]];
  for(let nd=0;nd<4;nd++){
   const [nx,ny]=next[nd];if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const ni=ny*COLS+nx;if(blocked[ni])continue;
   const edge=usedEdges.get(edgeKey(id,ni))||0,node=usedNodes.get(ni)||0;
   const cost=entry.cost+1+(dir===nd?0:.3)+edge*80+(ni===end?0:node*3),nk=ni*4+nd;
   if(cost>=costs[nk])continue;costs[nk]=cost;parents[nk]=key;queue.push({key:nk,cost},cost+distance(ni));
  }
 }
 return null;
}
export function routeWires(circuit){
 const usedEdges=new Map(),usedNodes=new Map(),routes=[];
 // Keep connection order stable. Each subsequent route avoids reusing earlier lanes.
 for(const [index,wire]of circuit.wires.entries()){
  const obstacles=wireObstacles(circuit,wire),blocked=new Uint8Array(COLS*ROWS);
  for(let i=0;i<blocked.length;i++){const p=gridPoint(i);blocked[i]=Number(obstacles.some(r=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom));}
  const starts=anchors(wire.a,circuit,obstacles),ends=anchors(wire.b,circuit,obstacles);let best=null;
  for(const a of starts)for(const b of ends){const found=search(a.id,b.id,blocked,usedEdges,usedNodes);if(found&&(!best||found.cost<best.cost))best={...found,a,b};}
  let points;
  if(best){
   points=compact([...best.a.path,...best.ids.map(gridPoint),...best.b.path.slice().reverse()]);
   for(let i=0;i<best.ids.length;i++){const id=best.ids[i];usedNodes.set(id,(usedNodes.get(id)||0)+1);if(i){const key=edgeKey(best.ids[i-1],id);usedEdges.set(key,(usedEdges.get(key)||0)+1);}}
  }else{
   // Overlapping component bodies can make obstacle-free drawing impossible.
   // Keep endpoints explicit; the UI marks this route dashed, never as a new node.
   const a=portPoint(wire.a,circuit),b=portPoint(wire.b,circuit),y=20+(index%3)*20;
   points=compact([a,{x:a.x,y},{x:b.x,y},b]);
  }
  routes.push({id:wire.id,points,blocked:!best,d:points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')});
 }
 return routes;
}
