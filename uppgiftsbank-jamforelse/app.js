(function(){
'use strict';
const root=document.getElementById('kmcompare');
if(!root)return;
const M=window.KMComparison;
const el=id=>root.querySelector('#'+id);
const defaults=()=>({endo:'assigned',euk:'assigned',resp:'none',selection:'none'});
const initialRules=()=>({cell:{any:['euk'],all:[],not:[]},evolution:{any:['endo','selection'],all:[],not:[]}});
let states=defaults(),rules=initialRules(),extra=false;
const names={cell:'Den eukaryota cellen',evolution:'Evolutionära processer',endo:'Endosymbios'};
const pill=t=>'<span class="km-pill">'+M.tags.find(x=>x.id===t).label+'</span>';
function mode(name){
root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===name)));
['units','flock','tags'].forEach(id=>el('km-'+id).hidden=id!==name);
}
function renderUnits(){
const reviewed=root.querySelector('input[name="unit-stage"]:checked').value==='reviewed';
const units=reviewed?['euk','endo']:['euk','resp'];
const multiple=el('km-multiple').checked;
const selected=M.unitCandidates(units,multiple);
el('km-unit-tags').innerHTML=units.map(pill).join('')+'<span class="km-small">'+(reviewed?'Satta för hand':'Gissade från kapitlet')+'</span>';
el('km-unit-results').innerHTML=M.chapters.map(c=>'<div class="km-chapter"><strong>'+c.title+'</strong><div class="km-pills">'+c.units.map(pill).join('')+'</div><span>'+(selected.some(x=>x.id===c.id)?'Matchning vald':'Ingen placering vald')+'</span></div>').join('');
el('km-unit-status').textContent=reviewed?(multiple?'Två relevanta kapitel matchar samma uppgift. Här är den skissade utbyggnaden aktiverad.':'Båda relevanta kapitlen matchar, men första versionens gräns väljer bara ett i denna bok.'):(multiple?'Båda ärvda enheterna ger placeringar. Fler platser löser inte den för breda taggningen.':'Det är lika många gemensamma enheter. Bokens ordning ger Cellandning, trots att uppgiften gäller mitokondriens ursprung.');
}
function renderFlock(){
const refined=root.querySelector('input[name="flock-stage"]:checked').value==='similar';
const manual=el('km-manual').checked,blocked=el('km-excluded').checked;
const counts=refined?[0,2,1]:[3,2,1];
el('km-siblings').innerHTML=M.chapters.map((c,i)=>'<div class="km-sibling"><span>'+c.title+'</span><span class="km-count">'+counts[i]+' syskon</span></div>').join('');
const found=M.flockCandidates(refined,manual,blocked?['energy']:[]);
el('km-flock-results').innerHTML=found.length?'<div class="km-chapter"><strong>'+found[0].title+'</strong><span>'+(manual?'Manuell placering · säker länk':found[0].count+' av '+(refined?3:6)+' syskon · gissad länk')+'</span></div>':'<p>Förslaget till Cellandning är spärrat.</p>';
el('km-flock-status').textContent=manual?'Det manuella valet ligger kvar även när underlaget för gissningen ändras.':!found.length?'Spärren hindrar den borttagna länken från att komma tillbaka. Bilden lägger inte in någon alternativ länk automatiskt.':refined?'Liknande syskon ger ett annat förslag. Underlaget är fortfarande de kända syskonens placeringar.':'Majoriteten ger ett förslag, men säger inte säkert vad just denna uppgift handlar om.';
}
el('km-tag-controls').innerHTML=M.tags.map(t=>'<label class="km-tag-row" for="km-tag-'+t.id+'"><span>'+t.label+'</span><select id="km-tag-'+t.id+'" data-task-tag="'+t.id+'"><option value="none">Ingen tagg</option><option value="assigned">Tilldelad</option><option value="blocked">Blockerad</option></select></label>').join('');
el('km-rule-controls').innerHTML=[['any','Minst en av dessa taggar'],['all','Alla dessa taggar'],['not','Uteslut uppgifter med någon av dessa taggar']].map(([key,label])=>'<fieldset><legend>'+label+'</legend>'+M.tags.map(t=>'<label><input type="checkbox" data-rule="'+key+'" data-tag="'+t.id+'"> '+t.label+'</label>').join('')+'</fieldset>').join('');
el('km-bank').innerHTML=M.tasks.slice(1).map(t=>'<p><strong>'+t.id+' · '+t.title+'</strong></p><div class="km-pills">'+t.tags.map(pill).join('')+'</div>').join('');
function syncRules(){
const rule=rules[el('km-package').value];
root.querySelectorAll('[data-rule]').forEach(input=>{input.checked=rule[input.dataset.rule].includes(input.dataset.tag);});
}
function syncTags(){root.querySelectorAll('[data-task-tag]').forEach(select=>{select.value=states[select.dataset.taskTag];});}
function renderPackages(){
const tasks=M.tasks.map(t=>t.id==='U1'?{...t,tags:M.taskTags(states)}:t);
el('km-package-results').innerHTML=Object.entries(rules).map(([id,rule])=>{
const matches=tasks.filter(t=>M.matches(t.tags,rule));
const describe=(key,label)=>rule[key].length?'<div><strong>'+label+':</strong> '+rule[key].map(t=>M.tags.find(x=>x.id===t).label).join(key==='all'?' + ':' eller ')+'</div>':'';
return '<article class="km-result"><h3>'+names[id]+'</h3>'+describe('any','Minst en')+describe('all','Alla')+describe('not','Uteslut')+(matches.length?'<ul>'+matches.map(t=>'<li><strong>'+t.id+'</strong> · '+t.title+'</li>').join('')+'</ul>':'<p>Inga uppgifter matchar.</p>')+'</article>';
}).join('');
}
root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.mode)));
root.querySelectorAll('input[name="unit-stage"]').forEach(input=>input.addEventListener('change',renderUnits));
el('km-multiple').addEventListener('change',renderUnits);
root.querySelectorAll('input[name="flock-stage"]').forEach(input=>input.addEventListener('change',renderFlock));
el('km-manual').addEventListener('change',renderFlock);
el('km-excluded').addEventListener('change',renderFlock);
root.querySelectorAll('[data-task-tag]').forEach(select=>select.addEventListener('change',()=>{
states[select.dataset.taskTag]=select.value;
el('km-ai-status').textContent='Taggbeslutet har ändrats. Paketens urval räknas om.';
renderPackages();
}));
root.querySelectorAll('[data-rule]').forEach(input=>input.addEventListener('change',()=>{
const rule=rules[el('km-package').value],key=input.dataset.rule,tag=input.dataset.tag;
rule[key]=input.checked?[...rule[key],tag]:rule[key].filter(x=>x!==tag);
renderPackages();
}));
el('km-package').addEventListener('change',syncRules);
el('km-ai').addEventListener('click',()=>{
const outcome=M.propose(states,'endo');
el('km-ai-status').textContent=outcome==='blocked'?'Endosymbios skulle föreslås utifrån uppgiftens innehåll, men taggen är spärrad. Spärren ligger kvar.':outcome==='existing'?'Endosymbios är redan tilldelad. Ingen ändring görs.':'Förslag: Endosymbios. Uppgiften gäller mitokondriens ursprung. Välj Tilldelad om du vill godkänna. Detta är ett förberett exempel, inte ett AI-anrop.';
});
el('km-new-package').addEventListener('click',()=>{
if(extra)return;
extra=true;rules.endo={any:['endo'],all:[],not:[]};
const option=document.createElement('option');option.value='endo';option.textContent='Endosymbios';el('km-package').append(option);
el('km-new-package').disabled=true;el('km-new-package').textContent='Paket tillagt utan att ändra uppgifterna';
renderPackages();
});
el('km-reset').addEventListener('click',()=>{
states=defaults();rules=initialRules();extra=false;
const added=el('km-package').querySelector('option[value="endo"]');if(added)added.remove();
el('km-package').value='cell';el('km-new-package').disabled=false;el('km-new-package').textContent='Lägg till ett paket om endosymbios';
root.querySelector('input[name="unit-stage"][value="inherited"]').checked=true;
root.querySelector('input[name="flock-stage"][value="all"]').checked=true;
['km-multiple','km-manual','km-excluded'].forEach(id=>el(id).checked=false);
el('km-ai-status').textContent='Förslaget lägger inte till en tagg automatiskt.';
syncTags();syncRules();renderUnits();renderFlock();renderPackages();
});
syncTags();syncRules();renderUnits();renderFlock();renderPackages();
})();