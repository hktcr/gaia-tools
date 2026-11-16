(function(){
'use strict';
const root=document.getElementById('kmclear');if(!root)return;
const get=id=>root.querySelector('#'+id);
get('kc-add').addEventListener('click',function(){
const open=this.getAttribute('aria-expanded')!=='true';
this.setAttribute('aria-expanded',String(open));get('kc-added').hidden=!open;
this.textContent=open?'Ta bort det nya temapaketet':'Prova: lägg till ett temapaket';
get('kc-update').textContent=open?'Det nya paketet hittar U1 genom Endosymbios. Varken uppgiften eller dess taggar har ändrats.':'Alla ”U1” visar samma original. Uppgiften kopieras inte.';
});
get('kc-common-button').addEventListener('click',function(){
const open=this.getAttribute('aria-expanded')!=='true';
this.setAttribute('aria-expanded',String(open));get('kc-common').hidden=!open;
this.textContent=open?'Dölj gemensamma funktioner':'Visa vad båda redan har';
});
})();