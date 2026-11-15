(function(root){
'use strict';
const tags=[{id:'endo',label:'Endosymbios'},{id:'euk',label:'Eukaryota celler'},{id:'resp',label:'Cellandning'},{id:'selection',label:'Naturligt urval'}];
const tasks=[
{id:'U1',title:'Mitokondriens ursprung',tags:['endo','euk']},
{id:'U2',title:'Cellkärnans uppgift',tags:['euk']},
{id:'U3',title:'Bakterier och antibiotikaresistens',tags:['selection']},
{id:'U4',title:'Energiomvandling i mitokondrien',tags:['resp','euk']}
];
const chapters=[
{id:'energy',title:'Cellandning',units:['resp']},
{id:'cell',title:'Den eukaryota cellen',units:['euk']},
{id:'evolution',title:'Evolution',units:['endo','selection']}
];
function unitCandidates(units,multiple){
const candidates=chapters.map(c=>({...c,score:c.units.filter(t=>units.includes(t)).length})).filter(c=>c.score>0);
if(multiple)return candidates;
return candidates.sort((a,b)=>b.score-a.score).slice(0,1);
}
function flockCandidates(refined,manual,excluded){
if(manual)return [{...chapters.find(c=>c.id==='evolution'),kind:'manual',count:null}];
const counts=refined?{energy:0,cell:2,evolution:1}:{energy:3,cell:2,evolution:1};
return chapters.filter(c=>counts[c.id]>0).map(c=>({...c,count:counts[c.id],kind:'proposal'})).sort((a,b)=>b.count-a.count).slice(0,1).filter(c=>!excluded.includes(c.id));
}
function matches(tags,rule){
return (!rule.any.length||rule.any.some(t=>tags.includes(t)))&&rule.all.every(t=>tags.includes(t))&&!rule.not.some(t=>tags.includes(t));
}
function taskTags(states){return tags.filter(t=>states[t.id]==='assigned').map(t=>t.id);}
function propose(states,tag){return states[tag]==='blocked'?'blocked':states[tag]==='assigned'?'existing':'proposal';}
const api={tags,tasks,chapters,unitCandidates,flockCandidates,matches,taskTags,propose};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KMComparison=api;
})(typeof window!=='undefined'?window:globalThis);
