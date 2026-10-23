/* A composição visual move os controles existentes: os listeners, IDs,
 * validações, armazenamento e conexões continuam sob seus módulos originais. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),asset=name=>'assets/rivals/'+name+'.webp';
 function artButton(el,name,label){if(!el)return;el.classList.add('rivals-art-button');el.setAttribute('aria-label',label);el.title=label;el.replaceChildren(Object.assign(document.createElement('img'),{src:asset(name),alt:label,draggable:false}));}
 function panel(title,subtitle){const el=document.createElement('section');el.className='rivals-panel';const heading=document.createElement('h2');heading.innerHTML='<small>'+subtitle+'</small><span>'+title+'</span>';el.append(heading);return el;}
 function moveLabel(id,container){const el=$(id)?.closest('label');if(el)container.append(el);}
 document.body.classList.add('rivals-design');
 if(document.body.classList.contains('main-menu')){
  document.body.classList.add('rivals-home');document.querySelector('.menu-logo').src=asset('logo');
  const names=[['arena.html','ai','Arena IA'],['arena.html?pvp','pvp','Arena PvP'],['decks.html','menu-decks','Decks'],['tutorial.html','tutorial','Tutorial'],['rules.html','rules','Guia de Regras'],['settings.html','settings','Configurações']];
  for(const [href,name,label]of names)artButton(document.querySelector('.main-options a[href="'+href+'"]'),name,label);
  artButton($('exitGame'),'exit','Sair');
 }
 if($('setup')){
  const setup=$('setup'),pvp=new URLSearchParams(location.search).has('pvp');
  document.body.classList.add('rivals-arena');document.body.classList.toggle('rivals-pvp',pvp);
  const settings=setup.querySelector('.selection-settings'),selection=setup.querySelector('.selection-card'),poster=setup.querySelector('.duel-poster');
  const own=panel('JOGADOR','CONFIGURAÇÕES'),left=document.createElement('div');left.className='rivals-left';left.append(own);
  moveLabel('playerDeck',own);if($('deckCompatibility'))own.append($('deckCompatibility'));
  const tools=document.querySelector('.pvp-deck-tools');if(tools){const details=document.createElement('details');details.className='rivals-deck-import';details.innerHTML='<summary>Importar / editar baralhos</summary>';details.append(tools);own.append(details);}
  const links=document.createElement('div');links.className='rivals-deck-links';links.innerHTML='<a href="decks.html">CRIAR / EDITAR BARALHO</a><button type="button" id="rivalsExportDeck">EXPORTAR</button>';own.append(links);
  links.querySelector('#rivalsExportDeck').onclick=()=>{const deck=OverdriveArena.selectedDeck();if(!deck)return;const url=URL.createObjectURL(new Blob([JSON.stringify(deck,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=(deck.name||'baralho').replace(/[^\p{L}\p{N} _-]/gu,'')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const center=document.createElement('div');center.className='rivals-center';
  const title=document.createElement('img');title.className='rivals-choose-title';title.src=asset('choose-fighter');title.alt='Escolha seu lutador';center.append(title,poster);
  const versus=poster.querySelector('.poster-divider');versus.replaceChildren(Object.assign(document.createElement('img'),{src:asset('versus'),alt:'VS'}));
  center.append($('startGame'));artButton(center.querySelector('#startGame'),'battle','Entrar na batalha');
  const caption=selection.querySelector('.selected-deck-caption');if(caption)center.append(caption);
  const enemy=panel('ADVERSÁRIA IA','CONFIGURAÇÕES');moveLabel('opponent',enemy);left.append(enemy);
  const game=panel('DE JOGO','CONFIGURAÇÕES');game.classList.add('selection-settings');
  for(const id of ['duelFormat','gameMode','aiDifficulty','startingPlayer','showTutorial'])moveLabel(id,game);
  if($('difficultyHint'))game.append($('difficultyHint'));
  const more=document.createElement('details');more.className='rivals-more';more.innerHTML='<summary>Cartas e compatibilidade</summary>';const supported=$('supportedCards');if(supported)more.append(supported);game.append(more);
  // Keep any unanticipated extension controls reachable instead of discarding them.
  for(const el of [...settings.children])if(!['H2','SPAN','P','DETAILS'].includes(el.tagName)&&el.querySelector('input,select,button'))game.append(el);
  setup.replaceChildren(left,center,game);
  // As artes dos novos lutadores incluem a moldura da carta. Para os pôsteres,
  // usamos apenas a ilustração, sem alterar as cartas e os retratos em combate.
  const portraitNames={'OF-C1-114':'Arcturus','OF-C1-120':'Mourner','OF-C1-126':'Placide','OF-C1-132':'Rynhard','OF-RVAS-001':'Missbigotten'};
  for(const image of poster.querySelectorAll('.poster-half img')){
   const update=()=>{const name=portraitNames[image.dataset.fighter],selection={'OF-C1-114':1,'OF-C1-089':15,'OF-C1-126':5,'OF-C1-132':7,'OF-C1-051':11,'OF-C1-032':9,'OF-C1-070':13,'OF-C1-120':3,'OF-RVAS-001':17,'OF-RVAS-029':19}[image.dataset.fighter];image.toggleAttribute('data-rivals-portrait',!!name);if(!pvp&&selection){const url=asset('selection-'+(selection+(image.closest('.poster-enemy')?1:0)));if(image.getAttribute('src')!==url)image.src=url;}else if(name){const url=asset('fighter-'+name);if(image.getAttribute('src')!==url)image.src=url;}};
   new MutationObserver(update).observe(image,{attributes:true,attributeFilter:['src','data-fighter']});update();
  }
  const launch=document.querySelector('.session-launch');if(launch){launch.classList.add('rivals-launch');artButton($('matchHistory'),'history','Histórico e replays');artButton($('challengeLibrary'),'challenges','Desafios de aprendizado');}
  if(pvp){
   const lobby=$('pvpLobby'),brand=document.createElement('img');brand.className='rivals-pvp-logo';brand.src=asset('logo');brand.alt='Overdrive Fighters — Rivais Ascendentes';
   enemy.hidden=true;left.prepend(brand);left.append(caption);own.querySelector('h2 span').textContent='SEU BARALHO';center.hidden=true;game.hidden=true;
   const config=document.createElement('section');config.className='rivals-pvp-config';moveLabel('gameMode',config);lobby.querySelector('.pvp-fields').before(config);
   setup.append(lobby);lobby.classList.add('rivals-panel');artButton($('pvpReady'),'battle','Confirmar meu deck e entrar na batalha');
  }
  function updateState(){document.body.classList.toggle('rivals-playing',!$('game').hidden);}
  new MutationObserver(updateState).observe($('game'),{attributes:true,attributeFilter:['hidden']});updateState();
 }
 if(document.body.classList.contains('desktop-editor')){
  document.body.classList.add('rivals-editor');
  const h=document.querySelector('header h1');h.innerHTML='<span>EDITOR DE</span><strong>DECKS</strong>';
  for(const [id,name,label]of [['clearDeck','create','Criar novo baralho'],['openLibrary','decks','Abrir meus decks'],['saveDeck','save','Salvar baralho'],['saveNewDeck','save-new','Salvar como novo']])artButton($(id),name,label);
 }
 // Audio state is owned by game-settings.js. Styling follows the same state.
 function installSound(){const toggle=document.querySelector('.audio-toggle,.sound-toggle,#soundToggle,#globalSound');
 if(toggle){toggle.classList.add('rivals-sound');const update=()=>{toggle.style.backgroundImage='url("'+asset(window.OverdriveSettings?.get().muted?'sound-off':'sound-on')+'")';};new MutationObserver(update).observe(toggle,{childList:true});update();}}
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',installSound,{once:true});else installSound();
})();
