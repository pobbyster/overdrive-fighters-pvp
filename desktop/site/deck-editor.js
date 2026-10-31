(() => {
 document.body.classList.add('desktop-editor');
 document.title='Editor de Decks | Overdrive Fighters';
 const header=document.querySelector('header');
 header.innerHTML='<a class="back-button" href="home.html" aria-label="Voltar ao menu principal">✕ Menu</a><h1>Editor de Decks</h1><div id="editorTools" class="editor-tools"></div>';
 for(const id of ['deckName','clearDeck','openLibrary','saveDeck','saveNewDeck'])document.getElementById('editorTools').append(document.getElementById(id));
 const catalog=document.getElementById('catalogView'),workspace=document.getElementById('workspace');
 const aside=document.getElementById('deckPanel'),catalogColumn=workspace.firstElementChild;
 catalogColumn.className='desktop-catalog';
 const filterWrap=document.createElement('div');filterWrap.className='desktop-filters';
 for(const selector of ['.toolbar','.energy-filter','.catalog-options'])filterWrap.append(catalog.querySelector(selector));
 catalogColumn.prepend(filterWrap);
 catalog.querySelector('.catalog-layout').hidden=true;
 const center=document.createElement('section');center.className='deck-board';center.setAttribute('aria-label','Lutador e baralhos');
 center.append(document.getElementById('deckContents'));
 const help=document.createElement('p');help.className='deck-board-help';help.textContent='Arraste cartas para as áreas ou use + Principal / + Adicional. Use ⇄ para transferir uma cópia e − para remover.';center.append(help);
 const preview=document.createElement('section');preview.className='editor-preview';preview.innerHTML='<div class="eyebrow">CARTA EM DESTAQUE</div><img id="editorArt" alt="Prévia da carta" hidden><h2 id="editorCardName">Escolha seu lutador</h2><p id="editorCardMeta">Passe o mouse ou dê foco a uma carta para ler seus detalhes.</p><p id="editorCardText"></p>';
 aside.prepend(preview);
 workspace.replaceChildren(aside,center,catalogColumn);
 aside.querySelector(':scope > h2').hidden=true;
 document.getElementById('groupFilter').hidden=true;
 document.getElementById('groupFilter').value='';
 aside.querySelector('.curve-panel').open=false;
 aside.querySelectorAll(':scope > .help').forEach(el=>el.hidden=true);
 document.getElementById('mobileDropDock').hidden=true;
 document.getElementById('deckName').placeholder='Nome do deck';
 let previewId=null,previewTimer;
 const previewCard=id=>{
  if(previewId===id)return;previewId=id;clearTimeout(previewTimer);
  const c=get(id);if(!c)return;
  const art=document.getElementById('editorArt');art.src=thumbnailURL(id);art.alt=c.name;art.hidden=false;
  previewTimer=setTimeout(()=>{const image=new Image();image.src=imageURL(id);image.decode().catch(()=>{}).then(()=>{if(previewId===id)art.src=imageURL(id);});},100);
  document.getElementById('editorCardName').textContent=c.name;
  document.getElementById('editorCardMeta').textContent=[c.type,c.color,c.specialPermanent?'Permanente especial · somente no Adicional':c.type==='Lutador'?'Poder '+c.power:'Custo '+c.cost,c.zone].filter(Boolean).join(' · ');
  document.getElementById('editorCardText').textContent=c.searchText||'Consulte o texto na arte da carta.';
 };
 const originalRender=renderDeck;
 const orderKey='overdrive-editor-type-order';let organized=false,orderMode='type';try{const saved=localStorage.getItem(orderKey);organized=['true','type','name'].includes(saved);orderMode=saved==='name'?'name':'type';}catch{}
 const compareEntries=([a],[b])=>{const x=get(a),y=get(b),rank={Lutador:0,Golpe:1,Guarda:2,Truque:3};return (orderMode==='type'?(rank[x.type]??4)-(rank[y.type]??4):0)||x.name.localeCompare(y.name,'pt-BR',{sensitivity:'base',numeric:true});};
 const orderTools=document.createElement('div');orderTools.className='deck-order-tools';
 const order=document.createElement('select');order.id='deckOrder';order.setAttribute('aria-label','Organizar baralho por');order.innerHTML='<option value="type">Tipo: Golpe → Guarda → Truque</option><option value="name">Nome: A–Z</option>';order.value=orderMode;
 const organize=document.createElement('button');organize.id='organizeDeck';organize.type='button';organize.className='rivals-hud-link';organize.textContent='Organizar';organize.title='Organizar principal e adicional pela opção selecionada';orderTools.append(order,organize);center.prepend(orderTools);
 organize.onclick=()=>{organized=true;orderMode=order.value;try{localStorage.setItem(orderKey,orderMode);}catch{}for(const zone of ['main','extra'])deck[zone]=Object.fromEntries(Object.entries(deck[zone]).sort(compareEntries));changed();notify(orderMode==='type'?'Organizado: Golpe, Guarda e Truque, com nomes de A–Z.':'Baralho organizado por nome, de A–Z.');};
 const originalCards=renderCards;
 renderCards=function(){originalCards();document.querySelectorAll('#cardsGrid img').forEach((img,i)=>{img.loading=i<6?'eager':'lazy';img.fetchPriority=i<6?'high':'low';});};
 renderDeck=function(){
  originalRender();
  for(const section of document.querySelectorAll('#deckContents .deck-section')){
   const zone=section.dataset.dropZone,map=zone==='fighter'?(deck.fighter?{[deck.fighter]:1}:{}):deck[zone],max=zone==='main'?40:zone==='extra'?15:1;
   section.querySelector('h3').innerHTML=`${zone==='fighter'?'Lutador':zone==='main'?'Baralho principal':'Baralho adicional'} <span class="board-count">${count(map)} / ${max}</span>`;
   section.querySelectorAll('.visual-deck-row').forEach(row=>row.remove());
   const grid=document.createElement('div');grid.className='board-cards';
   if(zone==='extra')grid.style.setProperty('--extra-count',Math.max(1,count(map)));
   for(const [id,q] of (organized?Object.entries(map).sort(compareEntries):Object.entries(map)))for(let i=0;i<q;i++){
    const c=get(id),tile=document.createElement('div');tile.className='board-card';
    tile.innerHTML=`<button class="board-art" data-detail="${id}" data-pointer-drag="${id}" data-drag-source="${zone}" aria-label="Ver ${esc(c.name)}">${cardHTML(c)}</button><div class="board-card-controls">${zone==='fighter'?'':`<button data-move="${id}" data-zone="${zone}" aria-label="Mover ${esc(c.name)} para ${zone==='main'?'adicional':'principal'}">⇄</button>`}<button data-remove="${id}" data-zone="${zone}" aria-label="Remover ${esc(c.name)}">−</button></div>`;
    grid.append(tile);
   }
   section.append(grid);
  }
  document.getElementById('mobileDropDock').hidden=true;
  let validation='';
  if(!deck.fighter)validation='Escolha um lutador para liberar suas cores.';
  else if(count(deck.main)!==40)validation=`Principal: faltam ${40-count(deck.main)} ações.`;
  else if(count(deck.extra)!==0&&count(deck.extra)!==15)validation=`Adicional opcional: complete 15 cartas ou deixe vazio.`;
  else validation='Estrutura completa. A Arena verificará os scripts das cartas.';
  help.textContent=validation+' Arraste cartas, use os botões +, ⇄ ou −.';
 };
 for(const event of ['pointerover','focusin'])workspace.addEventListener(event,e=>{
  const target=e.target.closest('[data-detail],[data-add],[data-pointer-drag]');if(target)previewCard(target.dataset.detail||target.dataset.add||target.dataset.pointerDrag);
 });
 // Capture only mouse gestures on card art; keyboard, touch, controls and drag stay available.
 workspace.addEventListener('click',e=>{
  const art=e.target.closest('.board-art,.art-button');
  if(!art||e.button!==0||e.detail===0||e.pointerType==='touch')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(Date.now()<suppressClickUntil)return;
  const id=art.dataset.detail;
  if(id)add(id,'main');
 },true);
 workspace.addEventListener('contextmenu',e=>{
  const art=e.target.closest('.board-art,.art-button');if(!art)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=art.dataset.detail,c=get(id);if(!c)return;
  if(e.shiftKey){if(c.type!=='Lutador')add(id,'extra');return;}
  if(c.type==='Lutador'){if(deck.fighter===id)remove(id,'fighter');return;}
  const zone=art.dataset.dragSource==='extra'?'extra':art.dataset.dragSource==='main'?'main':deck.main[id]?'main':'extra';
  if(deck[zone][id])remove(id,zone);
 },true);
 const shortcuts=document.createElement('p');shortcuts.className='mouse-shortcuts';
 shortcuts.textContent='Mouse: esquerdo adiciona ao principal · direito remove 1 cópia · Shift + direito adiciona ao adicional.';
 center.prepend(shortcuts);
 setView('builder');
 if(deck.fighter)previewCard(deck.fighter);
})();
