
'use strict';
const CARDS=JSON.parse(document.getElementById('catalogData').textContent);
const IMAGES=JSON.parse(document.getElementById('imageData').textContent);
const COLORS={Laranja:'#ff632b',Roxo:'#8b35ff',Verde:'#9cda19',Rosa:'#ff2789',Genérica:'#aeb5c2'};
const STORAGE_KEY='overdrive-collection-1-deck-v2',PAGE_SIZE=24;
const LIBRARY_KEY='overdrive-saved-decks-v1',ACTIVE_KEY='overdrive-active-deck-v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const byId=new Map(CARDS.map(c=>[c.id,c]));
const get=id=>byId.get(id);
const imageURLs=new Map();
const count=map=>Object.values(map).reduce((a,b)=>a+b,0);
const generic=(d,z='main')=>Object.entries(d[z]).reduce((n,[id,q])=>n+(get(id)?.color==='Genérica'?q:0),0);
let deck={name:'Meu primeiro Overdrive',fighter:null,main:{},extra:{}},view='database',pile=[],hand=[],noticeTimer,page=1,printing=false;
let trainingDeck=null;
let selectedCost='',curveScope='main',library=[],activeSavedId=null,pointerDrag=null,suppressClickUntil=0;
function imageURL(id){return IMAGES[id];}
function validate(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||typeof d.name!=='string'||d.name.length>80)throw Error('Formato de baralho inválido.');
 for(const z of ['main','extra'])if(!d[z]||typeof d[z]!=='object'||Array.isArray(d[z]))throw Error('Formato de baralho inválido.');
 if(d.fighter!==null&&typeof d.fighter!=='string')throw Error('Lutador inválido.');
 const fighter=d.fighter?get(d.fighter):null;
 if(d.fighter&&fighter?.type!=='Lutador')throw Error('Lutador inválido para esta coleção.');
 for(const z of ['main','extra'])for(const [id,q] of Object.entries(d[z])){
  const c=get(id);
  if(!c||!Number.isInteger(q)||q<1||q>3||c.type==='Lutador')throw Error('Carta ou quantidade inválida.');
  if(!fighter)throw Error('Escolha um lutador primeiro.');
  if(c.color!=='Genérica'&&!fighter.colors.includes(c.color))throw Error('Esta cor não pertence ao seu lutador.');
  if((d.main[id]||0)+(d.extra[id]||0)>3)throw Error('Limite de 3 cópias por carta, somando principal e adicional.');
 }
 if(count(d.main)>40)throw Error('Limite de 40 cartas no principal.');
 if(count(d.extra)>15)throw Error('Limite de 15 cartas no adicional.');
 if(generic(d)>10)throw Error('Limite de 10 ações genéricas no baralho principal. O adicional permite até 15 ações, sem limite específico de genéricas.');
 return d;
}
function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,5500);}
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)deck=validate(JSON.parse(saved));}catch(e){notify('O baralho salvo não pôde ser carregado. Importe um arquivo válido desta coleção.');}
try{
 const saved=JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]');
 if(Array.isArray(saved))library=saved.filter(entry=>{
  try{return typeof entry.id==='string'&&typeof entry.updatedAt==='string'&&Number.isFinite(Date.parse(entry.updatedAt))&&!!validate(entry.deck);}catch(e){return false;}
 });
 activeSavedId=localStorage.getItem(ACTIVE_KEY);
 if(!library.some(entry=>entry.id===activeSavedId))activeSavedId=null;
}catch(e){notify('Não foi possível carregar a biblioteca. O rascunho atual continua disponível.');}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(deck));}catch(e){notify('Não foi possível salvar neste navegador. Use Exportar para guardar seu baralho.');}}
function changed(){save();pile=[];hand=[];renderDeck();renderCards();renderHand();}
function cardHTML(c,print=false){return `<div class="card original" style="--card-color:${COLORS[c.color]}"><img src="${imageURL(c.id)}" alt="${esc(c.name)} — ${esc(c.type)}${c.subtype?' • '+esc(c.subtype):''} — ${esc(c.color)}" draggable="false" ${print?'':'loading="lazy"'} decoding="async" width="751" height="1048"></div>`;}
function compatible(c){const f=get(deck.fighter);return c.type==='Lutador'||!!f&&(c.color==='Genérica'||f.colors.includes(c.color));}
function canAdd(c,z){
 if(!compatible(c)||c.type==='Lutador')return false;
 if((deck.main[c.id]||0)+(deck.extra[c.id]||0)>=3)return false;
 if(count(deck[z])>=(z==='main'?40:15))return false;
 return z==='extra'||c.color!=='Genérica'||generic(deck)<10;
}
function renderCards(){
 const collection=$('collectionFilter').value;
 const q=normalize($('search').value.trim()),color=$('colorFilter').value,type=$('typeFilter').value,group=$('groupFilter').value,zone=$('zoneFilter').value;
 const list=CARDS.filter(c=>(!collection||collection==='first-drive'&&c.id.startsWith('OF-C1-'))&&(!q||normalize(`${c.name} ${c.searchText} ${c.id} ${c.source} ${c.type} ${c.subtype} ${c.group} ${c.zone||''}`).includes(q))&&(!color||c.color===color)&&(!type||c.type===type)&&(selectedCost===''||String(c.cost)===selectedCost)&&(!group||c.color===group)&&(!zone||c.type==='Golpe'&&c.zone===zone)&&(!$('compatibleOnly').checked||view!=='builder'||compatible(c)));
 const totalPages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(page,totalPages);
 $('results').textContent=`${list.length} de ${CARDS.length} cartas · Clique na arte para ampliar`;
 $('cardsGrid').innerHTML=list.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(c=>{
  const actions=c.type==='Lutador'?`<button data-add="${c.id}" ${deck.fighter===c.id?'disabled':''}>${deck.fighter===c.id?'Selecionado':'Escolher lutador'}</button>`:['main','extra'].map(z=>`<button data-add="${c.id}" data-zone="${z}" ${canAdd(c,z)?'':'disabled'} title="${!deck.fighter?'Escolha um lutador primeiro':!compatible(c)?'Cor incompatível com o lutador':'Adicionar uma cópia'}">+ ${z==='main'?'Principal':'Adicional'}</button>`).join('');
  return `<div class="tile"><button class="art-button" data-detail="${c.id}" draggable="false" ${view==='builder'?`data-pointer-drag="${c.id}" data-drag-source="catalog"`:''} aria-label="Ver ${esc(c.name)}">${cardHTML(c)}</button><div class="tile-label">${esc(c.name)}${view==='builder'?`<button class="drag-grip" data-pointer-drag="${c.id}" data-drag-source="catalog" aria-label="Arrastar ${esc(c.name)}" title="Arraste para sua decklist">⠿</button>`:''}</div><div class="muted">${esc(c.type)}${c.subtype?' • '+esc(c.subtype):''} · ${esc(c.color)}${c.zone?' · '+esc(c.zone):''}</div>${view==='builder'?`<div class="tile-actions">${actions}</div>`:''}</div>`;
 }).join('')||'<div class="empty">Nenhuma carta corresponde aos filtros.</div>';
 $('pageStatus').textContent=`Página ${page} de ${totalPages}`;$('previousPage').disabled=page===1;$('nextPage').disabled=page>=totalPages;
}
function add(id,zone){
 const c=get(id);if(!c)return;
 const next=JSON.parse(JSON.stringify(deck));
 if(c.type==='Lutador'){
  next.fighter=id;
  try{validate(next);}catch(e){notify('Remova as cartas de cores incompatíveis antes de trocar o lutador.');return;}
 }else{
  if(!['main','extra'].includes(zone))return;
  next[zone][id]=(next[zone][id]||0)+1;
 }
 try{deck=validate(next);changed();}catch(e){notify(e.message);}
}
function remove(id,z){
 if(z==='fighter'){
  if(count(deck.main)+count(deck.extra)){notify('Remova as cartas do baralho antes de remover o lutador.');return;}
  deck.fighter=null;
 }else if(['main','extra'].includes(z)&&deck[z][id]){if(--deck[z][id]===0)delete deck[z][id];}else return;
 changed();
}
function move(id,from){
 if(!['main','extra'].includes(from)||!deck[from][id])return;
 const to=from==='main'?'extra':'main',next=JSON.parse(JSON.stringify(deck));
 if(--next[from][id]===0)delete next[from][id];next[to][id]=(next[to][id]||0)+1;
 try{deck=validate(next);changed();}catch(e){notify(e.message);}
}
function costDistribution(d,scope='main'){
 const zones=scope==='both'?['main','extra']:[scope];
 const bins=Object.fromEntries(['0','1','2','3','4','5','6','X'].map(k=>[k,0]));
 let fixedTotal=0,fixedCount=0,total=0;
 for(const z of zones)for(const [id,q] of Object.entries(d[z])){
  const cost=get(id).cost;bins[String(cost)]=(bins[String(cost)]||0)+q;total+=q;
  if(typeof cost==='number'){fixedTotal+=cost*q;fixedCount+=q;}
 }
 return {bins,total,average:fixedCount?fixedTotal/fixedCount:null,variable:bins.X};
}
function renderCurve(){
 const {bins,total,average,variable}=costDistribution(deck,curveScope),max=Math.max(1,...Object.values(bins));
 const summary=Object.entries(bins).map(([cost,n])=>`Custo ${cost}: ${n} ${n===1?'carta':'cartas'}`).join('; ');
 $('costCurve').setAttribute('aria-label',`Curva de custos. ${summary}.`);
 $('costCurve').innerHTML=Object.entries(bins).map(([cost,n])=>`<div class="curve-column" aria-hidden="true"><span class="curve-count">${n}</span><div class="curve-track"><div class="curve-bar ${cost==='X'?'variable':''}" style="height:${n/max*100}%"></div></div><span class="curve-cost">${cost}</span></div>`).join('');
 $('curveSummary').textContent=`${total} ${total===1?'carta':'cartas'} · Média dos custos fixos: ${average===null?'—':average.toLocaleString('pt-BR',{maximumFractionDigits:2})}${variable?' · '+variable+' com custo X':''}`;
 document.querySelectorAll('[data-curve-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.curveScope===curveScope)));
}
function snapshot(d){return {name:d.name,fighter:d.fighter,main:{...d.main},extra:{...d.extra}};}
function signature(d){return JSON.stringify({name:d.name,fighter:d.fighter,main:Object.entries(d.main).sort(),extra:Object.entries(d.extra).sort()});}
function isDirty(){const saved=library.find(entry=>entry.id===activeSavedId);return !saved||signature(saved.deck)!==signature(deck);}
function renderSaveStatus(){
 const saved=library.find(entry=>entry.id===activeSavedId);
 $('saveStatus').textContent=saved?(isDirty()?'Alterações no rascunho · clique em Salvar baralho':'Salvo na biblioteca · '+new Date(saved.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'})):'Rascunho automático · salve por nome para guardar na biblioteca';
 $('openLibrary').textContent=`Meus baralhos (${library.length})`;
}
function setActiveSaved(id){activeSavedId=id;try{if(id)localStorage.setItem(ACTIVE_KEY,id);else localStorage.removeItem(ACTIVE_KEY);}catch(e){/* O rascunho continua exportável. */}}
function persistLibrary(next){try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(next));library=next;return true;}catch(e){notify('A biblioteca não pôde ser salva. Baixe o arquivo do baralho para guardar uma cópia.');return false;}}
function saveNamedDeck(asNew=false){
 try{validate(deck);}catch(e){notify(e.message);return;}
 const name=deck.name.trim();if(!name){notify('Dê um nome ao seu baralho antes de salvar.');$('deckName').focus();return;}
 const id=!asNew&&activeSavedId&&library.some(entry=>entry.id===activeSavedId)?activeSavedId:crypto.randomUUID();
 const entry={id,updatedAt:new Date().toISOString(),deck:{...snapshot(deck),name}};
 const next=[entry,...library.filter(item=>item.id!==id)];
 if(!persistLibrary(next))return;
 deck.name=name;setActiveSaved(id);save();renderDeck();notify('Baralho salvo na sua biblioteca.');
}
function renderLibrary(){
 $('savedDecks').innerHTML=library.map(entry=>{
  const d=entry.deck,fighter=get(d.fighter);
  return `<article class="saved-deck"><div class="saved-summary">${fighter?`<img src="${imageURL(fighter.id)}" alt="${esc(fighter.name)}" width="52" height="73">`:'<div class="saved-placeholder">◇</div>'}<div><h3>${esc(d.name)}</h3><p>${fighter?esc(fighter.name):'Sem lutador'} · ${count(d.main)} principal · ${count(d.extra)} adicional</p><span class="muted">${new Date(entry.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'})}</span></div></div><div class="actions"><button class="primary" data-load-deck="${esc(entry.id)}">Abrir</button><button data-download-deck="${esc(entry.id)}">Baixar arquivo</button><button data-delete-deck="${esc(entry.id)}">Excluir</button></div></article>`;
 }).join('')||'<div class="empty">Sua biblioteca está vazia. Monte um baralho, dê um nome e clique em “Salvar baralho”.</div>';
}
function loadNamedDeck(id){
 const entry=library.find(item=>item.id===id);if(!entry)return;
 if(isDirty()&&(deck.fighter||count(deck.main)||count(deck.extra))&&!confirm('Abrir este baralho e substituir o rascunho atual? Salve o rascunho primeiro se quiser mantê-lo.'))return;
 deck=snapshot(validate(entry.deck));setActiveSaved(id);changed();$('libraryDialog').close();notify('Baralho aberto.');
}
function deleteNamedDeck(id){
 const entry=library.find(item=>item.id===id);if(!entry||!confirm(`Excluir “${entry.deck.name}” da biblioteca?`))return;
 if(!persistLibrary(library.filter(item=>item.id!==id)))return;
 if(activeSavedId===id)setActiveSaved(null);
 renderLibrary();renderSaveStatus();notify('Baralho excluído da biblioteca.');
}
function downloadDeck(d){
 const url=URL.createObjectURL(new Blob([JSON.stringify({collection:'overdrive-first-collection',version:2,...snapshot(d)},null,2)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download=(normalize(d.name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'overdrive-deck')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function validDrag(data){return data&&get(data.id)&&['catalog','main','extra','fighter'].includes(data.source)&&
 (data.source==='catalog'||data.source==='fighter'&&deck.fighter===data.id||['main','extra'].includes(data.source)&&deck[data.source][data.id]>0);}
function canDrop(data,target){
 if(!validDrag(data)||!['main','extra','fighter'].includes(target))return false;
 const c=get(data.id);
 if(c.type==='Lutador'){
  if(target!=='fighter')return false;
  try{validate({...snapshot(deck),fighter:c.id});return true;}catch(e){return false;}
 }
 if(target==='fighter')return false;
 if(data.source===target)return true;
 if(data.source==='catalog')return canAdd(c,target);
 return count(deck[target])<(target==='main'?40:15);
}
function performDrop(data,target){
 if(!validDrag(data))return;
 const c=get(data.id);
 if(!['main','extra','fighter'].includes(target))return;
 if(c.type==='Lutador'){
  if(target!=='fighter'){notify('Solte o lutador na área Lutador.');return;}
  add(data.id);return;
 }
 if(target==='fighter'){notify('Esta área aceita apenas lutadores.');return;}
 if(data.source===target)return;
 if(data.source==='catalog')add(data.id,target);
 else if(['main','extra'].includes(data.source))move(data.id,data.source);
}
function clearDropHighlights(){document.querySelectorAll('.drop-hover,.drop-invalid').forEach(el=>el.classList.remove('drop-hover','drop-invalid'));}
function readDrag(event){try{return JSON.parse(event.dataTransfer.getData('application/x-overdrive-card')||event.dataTransfer.getData('text/plain'));}catch(e){return null;}}
let nativeDrag=null;
document.addEventListener('dragstart',e=>{
 const source=e.target.closest('[data-drag-id]');if(!source||view!=='builder'){e.preventDefault();return;}
 nativeDrag={id:source.dataset.dragId,source:source.dataset.dragSource};
 e.dataTransfer.setData('application/x-overdrive-card',JSON.stringify(nativeDrag));e.dataTransfer.setData('text/plain',JSON.stringify(nativeDrag));e.dataTransfer.effectAllowed=nativeDrag.source==='catalog'?'copy':'move';
 document.body.classList.add('dragging');
});
document.addEventListener('dragover',e=>{
 const target=e.target.closest('[data-drop-zone]');if(!target||!nativeDrag)return;
 e.preventDefault();clearDropHighlights();const valid=canDrop(nativeDrag,target.dataset.dropZone);
 target.classList.add(valid?'drop-hover':'drop-invalid');e.dataTransfer.dropEffect=valid?(nativeDrag.source==='catalog'?'copy':'move'):'none';
});
document.addEventListener('dragleave',e=>{const target=e.target.closest('[data-drop-zone]');if(target&&!target.contains(e.relatedTarget))target.classList.remove('drop-hover','drop-invalid');});
document.addEventListener('drop',e=>{
 const target=e.target.closest('[data-drop-zone]');if(target){e.preventDefault();performDrop(readDrag(e),target.dataset.dropZone);}
 nativeDrag=null;clearDropHighlights();document.body.classList.remove('dragging');suppressClickUntil=Date.now()+200;
});
document.addEventListener('dragend',()=>{nativeDrag=null;clearDropHighlights();document.body.classList.remove('dragging');suppressClickUntil=Date.now()+200;});
function endPointerDrag(){
 if(pointerDrag?.ghost)pointerDrag.ghost.remove();pointerDrag=null;clearDropHighlights();document.body.classList.remove('dragging');
}
document.addEventListener('pointerdown',e=>{
 const grip=e.target.closest('[data-pointer-drag]');if(!grip||view!=='builder'||e.button!==0)return;
 pointerDrag={id:grip.dataset.pointerDrag,source:grip.dataset.dragSource,x:e.clientX,y:e.clientY,pointerId:e.pointerId,active:false,ghost:null};
 grip.setPointerCapture(e.pointerId);if(grip.classList.contains('drag-grip'))e.preventDefault();
});
document.addEventListener('pointermove',e=>{
 const data=pointerDrag;if(!data||data.pointerId!==e.pointerId)return;
 if(!data.active&&Math.hypot(e.clientX-data.x,e.clientY-data.y)<8)return;
 e.preventDefault();
 if(!data.active){data.active=true;data.ghost=document.createElement('div');data.ghost.className='drag-ghost';data.ghost.innerHTML=cardHTML(get(data.id));document.body.append(data.ghost);document.body.classList.add('dragging');}
 data.ghost.style.left=(e.clientX+12)+'px';data.ghost.style.top=(e.clientY+12)+'px';
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop-zone]');clearDropHighlights();
 if(target)target.classList.add(canDrop(data,target.dataset.dropZone)?'drop-hover':'drop-invalid');
 if(e.clientY<65)window.scrollBy(0,-14);else if(e.clientY>window.innerHeight-65)window.scrollBy(0,14);
});
document.addEventListener('pointerup',e=>{
 if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
 const data=pointerDrag,target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop-zone]');
 if(data.active){if(target)performDrop(data,target.dataset.dropZone);suppressClickUntil=Date.now()+300;}
 endPointerDrag();
});
document.addEventListener('pointercancel',endPointerDrag);
function renderDeck(){
 $('deckName').value=deck.name;$('mainCount').textContent=count(deck.main);$('extraCount').textContent=count(deck.extra);$('genericCount').textContent=generic(deck);
 const section=(title,map,z)=>`<section class="deck-section drop-area" data-drop-zone="${z}" aria-label="Área do ${title.toLocaleLowerCase('pt-BR')}"><h3>${title} <span class="drop-hint">Solte cartas aqui</span></h3>${Object.entries(map).sort(([a],[b])=>get(a).name.localeCompare(get(b).name,'pt-BR')).map(([id,q])=>{
  const c=get(id),meta=z==='fighter'?c.color:`Energia ${c.cost}${c.zone?' · '+c.zone:''}`;
  return `<div class="row visual-deck-row"><button class="deck-preview ${z==='fighter'?'fighter-preview':''}" data-detail="${id}" draggable="false" data-pointer-drag="${id}" data-drag-source="${z}" aria-label="Ver ${esc(c.name)} na decklist">${cardHTML(c,true)}</button><div class="deck-row-info"><button class="deck-card-name" data-detail="${id}" draggable="false" data-pointer-drag="${id}" data-drag-source="${z}">${q}× ${esc(c.name)}</button><span class="deck-row-meta">${esc(meta)}</span></div><div class="row-controls">${z!=='fighter'?`<button class="drag-grip" data-pointer-drag="${id}" data-drag-source="${z}" aria-label="Arrastar ${esc(c.name)}">⠿</button><button data-move="${id}" data-zone="${z}" title="Mover uma cópia para ${z==='main'?'adicional':'principal'}" aria-label="Mover ${esc(c.name)} para ${z==='main'?'adicional':'principal'}">⇄</button>`:''}<button data-remove="${id}" data-zone="${z}" aria-label="Remover uma cópia de ${esc(c.name)}">−</button></div></div>`;
 }).join('')||'<div class="drop-empty">Arraste '+(z==='fighter'?'seu lutador':'cartas')+' para esta área</div>'}</section>`;
 $('deckContents').innerHTML=section('Lutador',deck.fighter?{[deck.fighter]:1}:{},'fighter')+section('Principal',deck.main,'main')+section('Adicional',deck.extra,'extra');
 $('deckPdf').disabled=$('printPlay').disabled=!deck.fighter||printing;
 $('exportDeckImage').disabled=!deck.fighter;
 const simDeck=trainingDeck||deck;
 $('simDeckInfo').textContent=`${simDeck.name||'Baralho sem nome'} · ${count(simDeck.main)} cartas no principal · ${simDeck.fighter?get(simDeck.fighter).name:'Nenhum lutador selecionado'}`;
 $('compatibleLabel').hidden=view!=='builder';
 $('mobileDropDock').hidden=view!=='builder';
 $('dockFighter').textContent=deck.fighter?'1 / 1':'0 / 1';$('dockMain').textContent=`${count(deck.main)} / 40`;$('dockExtra').textContent=`${count(deck.extra)} / 15`;
 renderCurve();renderSaveStatus();
}
function details(id){
 const c=get(id);if(!c)return;
 const field=(label,value)=>value===null||value===undefined||value===''?'':`<dt>${label}</dt><dd>${esc(value)}</dd>`;
 $('cardDialog').classList.remove('zoomed');
 $('cardDetail').innerHTML=`<div class="detail"><div>${cardHTML(c)}<button id="zoomArt" class="zoom-control" aria-expanded="false">Ampliar arte</button></div><div class="detail-info"><div class="eyebrow">FIRST DRIVE</div><h2>${esc(c.name)}</h2><dl>${field('Tipo',c.type+(c.subtype?' • '+c.subtype:''))}${field('Zona do golpe',c.zone)}${field('Cor',c.color)}${field('Origem',({Verde:'Espírito',Laranja:'Vontade',Roxo:'Determinação',Rosa:'Ritmo'})[c.color]||'Genérica')}${field('Custo impresso',c.cost)}${field('Custo secundário impresso',c.alternateCost)}${field(c.type==='Lutador'?'Poder do lutador':'Ataque',c.power)}${field('Bloqueio',c.block)}${field('Cores permitidas',c.colors?.join(', '))}${field('Referência no catálogo',c.id)}${field('Arquivo da coleção',c.source)}</dl><p class="help">O texto completo, as habilidades e os símbolos estão na arte original. Use “Ampliar arte” para ler em tamanho maior.</p>${view==='builder'?`<div class="actions">${c.type==='Lutador'?`<button data-add="${c.id}">Escolher lutador</button>`:`<button data-add="${c.id}" data-zone="main" ${canAdd(c,'main')?'':'disabled'}>+ Principal</button><button data-add="${c.id}" data-zone="extra" ${canAdd(c,'extra')?'':'disabled'}>+ Adicional</button>`}</div>`:''}</div></div>`;
 if(!$('cardDialog').open)$('cardDialog').showModal();
 $('zoomArt').onclick=()=>{const zoom=$('cardDialog').classList.toggle('zoomed');$('zoomArt').textContent=zoom?'Voltar aos detalhes':'Ampliar arte';$('zoomArt').setAttribute('aria-expanded',String(zoom));};
}
function setView(v,localManual=false){
 if(v==='match'&&!localManual){window.open('arena.html','_blank','noopener');return;}
 view=v;if($('tournamentView'))$('tournamentView').hidden=v!=='tournaments';document.querySelectorAll('nav button').forEach(b=>{const active=b.dataset.view===v;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 document.body.classList.toggle('builder-active',v==='builder');
 $('catalogView').hidden=!['database','builder'].includes(v);$('simulatorView').hidden=v!=='simulator';$('deckPanel').hidden=v!=='builder';$('workspace').style.gridTemplateColumns=v==='builder'?'':'1fr';
 if($('matchView'))$('matchView').hidden=v!=='match';if($('rulesView'))$('rulesView').hidden=v!=='rules';
 if(v==='match'&&typeof MatchGame!=='undefined')MatchGame.refresh();
 const labels={tournaments:['CIRCUITO OVERDRIVE','Prepare-se para competir.','Eventos, inscrições e decklists da comunidade.'],database:['FIRST DRIVE','Lutar, sangrar e vencer.','As 107 cartas da coleção First Drive, prontas para explorar.'],builder:['SELEÇÃO DE LUTADOR','Monte seu baralho.','Escolha seu lutador e adicione cartas ao principal ou ao adicional.'],simulator:['MODO TREINO','Teste sua abertura.','Embaralhe seu baralho e descubra como sua estratégia chega à mão.'],match:['TRIBUNO MUNDIAL','Entre na arena.','Controle os dois lados no campo oficial: cartas, energias e efeitos manuais.'],rules:['LIVRO DE REGRAS V0.2','Domine o combate.','Consulte o guia oficial fornecido pelo criador do jogo.']};
 [$('sectionLabel').textContent,$('pageTitle').textContent,$('pageDescription').textContent]=labels[v];renderCards();renderDeck();
}
function renderHand(){
 $('hand').innerHTML=hand.map(id=>`<button class="art-button" data-detail="${id}" aria-label="Ver ${esc(get(id).name)}">${cardHTML(get(id))}</button>`).join('')||'<div class="empty">Sua mão aparecerá aqui.</div>';
 $('remaining').textContent=`${pile.length} no baralho · ${hand.length} na mão`;$('drawOne').disabled=!pile.length;
}
function randomIndex(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomIndex(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
async function printDeck(play){
 if(printing)return;
 try{validate(deck);}catch(e){notify(e.message);return;}
 if(!deck.fighter){notify('Selecione um lutador.');return;}
 printing=true;renderDeck();
 try{
  if(play){
   const all=[deck.fighter,...['main','extra'].flatMap(z=>Object.entries(deck[z]).flatMap(([id,q])=>Array(q).fill(id)))],sheets=[];
   for(let i=0;i<all.length;i+=9)sheets.push(`<div class="print-sheet">${all.slice(i,i+9).map(id=>cardHTML(get(id),true)).join('')}</div>`);
   $('printArea').innerHTML=sheets.join('');
   await Promise.all([...$('printArea').querySelectorAll('img')].map(img=>img.decode()));
  }else{
   const table=(title,map)=>`<h2>${title}</h2><table><thead><tr><th>Qtd.</th><th>Carta</th><th>Referência</th><th>Cor</th></tr></thead><tbody>${Object.entries(map).sort(([a],[b])=>get(a).name.localeCompare(get(b).name,'pt-BR')).map(([id,q])=>`<tr><td>${q}</td><td>${esc(get(id).name)}</td><td>${id}</td><td>${get(id).color}</td></tr>`).join('')||'<tr><td colspan="4">Nenhuma carta</td></tr>'}</tbody></table>`;
   $('printArea').innerHTML=`<div class="deck-print"><h1>Overdrive Fighters</h1><h2>${esc(deck.name||'Baralho sem nome')}</h2><p>First Drive · Principal: ${count(deck.main)}/40 · Adicional: ${count(deck.extra)}/15 · Genéricas no principal: ${generic(deck)}/10 · Genéricas no adicional: ${generic(deck,'extra')} (dentro das 15 vagas)</p>${table('Lutador',{[deck.fighter]:1})}${table('Baralho principal',deck.main)}${table('Baralho adicional',deck.extra)}<p>As referências OF-C1 são identificadores internos do catálogo, baseados nos nomes dos arquivos.</p></div>`;
  }
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  window.print();
 }catch(e){notify('Não foi possível preparar a impressão. Tente novamente.');}
 finally{printing=false;renderDeck();}
}
window.addEventListener('afterprint',()=>{$('printArea').replaceChildren();});
Object.keys(COLORS).forEach(c=>$('colorFilter').add(new Option(c,c)));
[['Espírito (Verde)','Verde'],['Vontade (Laranja)','Laranja'],['Determinação (Roxo)','Roxo'],['Ritmo (Rosa)','Rosa']].forEach(([label,color])=>$('groupFilter').add(new Option(label,color)));
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
['search','colorFilter','typeFilter','groupFilter','zoneFilter','collectionFilter','compatibleOnly'].forEach(id=>$(id).addEventListener('input',()=>{page=1;renderCards();}));
$('previousPage').onclick=()=>{page--;renderCards();};$('nextPage').onclick=()=>{page++;renderCards();};
document.addEventListener('click',e=>{
 if(Date.now()<suppressClickUntil){e.preventDefault();return;}
 const detail=e.target.closest('[data-detail]'),a=e.target.closest('[data-add]'),r=e.target.closest('[data-remove]'),m=e.target.closest('[data-move]'),cost=e.target.closest('[data-cost]'),scope=e.target.closest('[data-curve-scope]'),load=e.target.closest('[data-load-deck]'),download=e.target.closest('[data-download-deck]'),del=e.target.closest('[data-delete-deck]');
 if(detail)details(detail.dataset.detail);
 if(a&&!a.disabled){add(a.dataset.add,a.dataset.zone);if($('cardDialog').open)details(a.dataset.add);}
 if(r)remove(r.dataset.remove,r.dataset.zone);
 if(m)move(m.dataset.move,m.dataset.zone);
 if(cost){selectedCost=selectedCost===cost.dataset.cost?'':cost.dataset.cost;page=1;document.querySelectorAll('[data-cost]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cost===selectedCost)));renderCards();}
 if(scope){curveScope=scope.dataset.curveScope;renderCurve();}
 if(load)loadNamedDeck(load.dataset.loadDeck);
 if(download){const entry=library.find(item=>item.id===download.dataset.downloadDeck);if(entry)downloadDeck(entry.deck);}
 if(del)deleteNamedDeck(del.dataset.deleteDeck);
});
$('closeDialog').onclick=()=>$('cardDialog').close();
$('cardDialog').addEventListener('click',e=>{if(e.target===$('cardDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('deckName').addEventListener('input',()=>{deck.name=$('deckName').value;save();renderSaveStatus();});
$('clearDeck').onclick=()=>{if(!(deck.fighter||count(deck.main)||count(deck.extra))||confirm('Começar um novo baralho? O rascunho atual será substituído. Os baralhos da biblioteca serão mantidos.')){deck={name:'Novo baralho',fighter:null,main:{},extra:{}};setActiveSaved(null);changed();}};
$('saveDeck').onclick=()=>saveNamedDeck(false);$('saveNewDeck').onclick=()=>saveNamedDeck(true);
$('openLibrary').onclick=()=>{renderLibrary();$('libraryDialog').showModal();};
$('closeLibrary').onclick=()=>$('libraryDialog').close();
$('newHand').onclick=()=>{
 const size=Number($('handSize').value),total=count((trainingDeck||deck).main);
 if(!Number.isInteger(size)||size<1||size>40){notify('Escolha uma mão entre 1 e 40 cartas.');return;}
 if(total<size){notify(`O principal precisa de pelo menos ${size} cartas para esta mão.`);return;}
 pile=shuffle(Object.entries((trainingDeck||deck).main).flatMap(([id,q])=>Array(q).fill(id)));hand=pile.splice(0,size);renderHand();
};
$('drawOne').onclick=()=>{if(pile.length){hand.push(pile.shift());renderHand();}};
$('deckPdf').onclick=()=>printDeck(false);$('printPlay').onclick=()=>printDeck(true);
$('exportDeck').onclick=()=>downloadDeck(deck);
$('importDeck').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>100000)throw Error('Arquivo muito grande.');
  const d=validate(JSON.parse(await file.text()));
  if(isDirty()&&(deck.fighter||count(deck.main)||count(deck.extra))&&!confirm('Importar este baralho e substituir o rascunho atual?')){e.target.value='';return;}
  deck={name:d.name,fighter:d.fighter,main:{...d.main},extra:{...d.extra}};setActiveSaved(null);changed();notify('Baralho importado. Clique em Salvar baralho para guardá-lo na biblioteca.');
 }catch(err){notify('Não foi possível importar: '+err.message);}
 e.target.value='';
};
setView('database');renderHand();



if(location.hash==='#mesa-manual')setView('match',true);

if(location.hash==='#decks')setView('builder');if(location.hash==='#regras')setView('rules');
