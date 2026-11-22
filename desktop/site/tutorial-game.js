(async function(){
'use strict';
const $=id=>document.getElementById(id),T=window.OverdriveTutorial,storageKey='of-tutorial-012-progress',back='assets/original-3.png';
let catalog,lesson,completed=new Set(),zoomOwner=null,reaction=null,pinnedUid=null,transitioning=false,menuOpen=true;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(key=>T.topics.some(t=>t[0]===key)));}catch{}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function art(c){if(c.token){const n=(c.name||c.tokenDefinition?.name||'').toLowerCase();return 'assets/tokens/galacstrix-'+(n.includes('tigre')?'tigre':n.includes('coruja')?'coruja':n.includes('corvo')?'corvo':'dragao')+'.webp';}return 'assets/'+c.id+'.webp';}
function card(c,opts={}){
 if(!c)return '';const d=lesson.engine.def(c),target=lesson.targets().includes('card:'+c.uid),faceDown=!!opts.hidden||opts.energy&&c.active===false;
 const fighterSide=d.type==='Lutador'?lesson.engine.s.players.find(s=>s.fighter.uid===c.uid):null,transformation=fighterSide?.super021?.card,superReady=!transformation&&fighterSide?.superReserve?.length&&(fighterSide.superCharge||0)>=(d.superMax||99);
 const label=d.name+(faceDown?opts.energy?' · energia inativa, virada para baixo':' · preparada, virada para baixo':'')+(target?' — sua próxima ação':'');
 return `<button class="card ${transformation?'transformed021 ':superReady?'super-ready021 ':''}${opts.energy&&c.active===false?'inactive ':''}${target?'target':''}" data-card="${escape(c.uid)}" data-face-down="${faceDown}" aria-label="${escape(label)}" title="${escape(label)}"><img src="${faceDown?back:escape(art(transformation||c))}" alt="${faceDown?'Verso da carta':escape(d.name)}" decoding="async">${transformation?'<img class="super-underlay021" src="'+escape(art(c))+'" alt="Lutador original">':''}${opts.energy?'<span class="badge">'+(c.active?'ATIVA':'INATIVA')+'</span>':opts.hidden?'<span class="badge">PREPARADA</span>':''}</button>`;
}
function score(side){const d=lesson.engine.def(side.fighter),color=d.color.toLowerCase(),seq=lesson.engine.script(side.fighter).sequence;return '<span class="training-health018"><i style="width:'+Math.max(0,Math.min(100,side.hp/30*100))+'%"></i></span>'+side.hp+' VIDA · PODER '+side.power+' <span class="training-super018" '+(side===lesson.engine.s.players[0]?'data-focus="super"':'')+' aria-label="Super '+(side.superCharge||0)+' de '+(d.superMax||0)+'">SUPER '+[0,1,2,3,4].map(i=>'<i class="'+(i<(side.superCharge||0)?'filled ':'')+(i>=(d.superMax||0)?'unavailable':'')+'"></i>').join('')+'</span>'+' <span class="od-icons" aria-label="Overdrive '+side.od+' de 3">'+seq.map((zone,i)=>'<img class="'+(i<side.od?'lit':'')+'" src="assets/zones/'+color+'-'+zone.toLowerCase()+'.png" alt="'+(i+1)+'hit: '+zone+'" title="'+(i+1)+'hit: '+zone+'">').join('')+'</span>';}
function tokenArena(){return new Set([...lesson.engine.s.combats,...lesson.engine.s.completed].filter(b=>b.token&&!b.cancelled).map(b=>b.uid));}
function extras(p){
 const side=lesson.engine.s.players[p],slots=Array.from({length:4},(_,i)=>{
  const c=side.extra.find(c=>c.slot===i);let body='';
  if(c?.token&&tokenArena().has(c.uid))body='<span class="empty-slot">NA ARENA</span>';
  else if(c&&p&&!c.public)body='<img class="hidden-extra" src="'+back+'" alt="Carta preparada oculta de Hanma">';
  else if(c)body=card(c,{hidden:!c.public&&!c.token});
  return '<div class="extra-slot" data-extra-slot="'+i+'"><span class="slot-label">EXTRA '+(i+1)+'</span>'+body+'</div>';
 });
 slots.splice(2,0,'<div id="'+(p?'enemy':'own')+'Fighter" class="fighter-slot" '+(!p?'data-zone="fighter" data-region="fighter" data-focus="fighter"':'')+'><span class="slot-label">LUTADOR</span>'+card(side.fighter)+'</div>');return slots.join('');
}
function pile(id,label,cards,deck=false){const el=$(id),top=cards.at(-1);el.classList.toggle('has-cards',cards.length>0);el.innerHTML=(cards.length?'<img src="'+(deck?back:escape(art(top)))+'" alt="'+(deck?'Verso do baralho':'Topo do descarte')+'">':'')+'<small>'+label+' · '+cards.length+'</small>';}
function renderFocus018(){
 const area=document.querySelector('.table-area');
 if(menuOpen||!lesson||lesson.done){OverdriveTutorialFocus.clear();return;}
 const focus=lesson.step.focus;
 const aliases={deck:'#ownDeck',discard:'#ownDiscard',banished:'#ownBanished',arena:'.combat',consultation:'#hand,#cardZoom',start:'[data-control="start"]',prepare:'[data-control="prepare"]',combat:'[data-control="combat"]',end:'[data-control="end"]',response:'[data-control="response"]',options:'[data-control="options"]',extra:'#ownExtra',energy:'#ownStamina'};
 let nodes=focus?[...area.querySelectorAll(aliases[focus]||'[data-focus="'+focus+'"]')]:[];
 if(!nodes.length)nodes=lesson.targets().flatMap(token=>token.startsWith('card:')?[...area.querySelectorAll('[data-card="'+token.slice(5)+'"]')]:token.startsWith('zone:')?[...area.querySelectorAll('[data-region="'+token.slice(5)+'"],[data-zone="'+token.slice(5)+'"]')]:token.startsWith('control:')?[...area.querySelectorAll('[data-control="'+token.slice(8)+'"]')]:[]);
 if(!nodes.length)nodes=[$('field')];
 if(focus==='field')nodes=[$('field')];
 OverdriveTutorialFocus.set(nodes,area);
}
function renderArena018(){
 const e=lesson.engine,s=e.s,current=s.phase==='mulligan'?'prepare':s.phase==='preparation'?(s.preparedTurn?'prepare':'start'):s.phase;
 for(const b of $('trainingControls018').querySelectorAll('[data-control]')){
  const isCurrent=b.dataset.phase===current;
  b.classList.toggle('current018',isCurrent);b.setAttribute('aria-current',isCurrent?'step':'false');
  b.classList.toggle('target',lesson.targets().includes('control:'+b.dataset.control));
  b.title=b.getAttribute('aria-label')+(isCurrent?' · Fase atual':'')+' · Siga o objetivo do treino';
 }
 $('trainingEnemyHand').innerHTML=s.players[1].hand.map(()=>'<img src="'+back+'" alt="Carta oculta">').join('');
 const b=e.current(),last=s.history.at(-1),block=b?b.blocks.filter(g=>!g.cancelled).reduce((n,g)=>n+g.value,0)+(b.aggregateBlockBonus||0):last?.block||0,attack=b?.attack??last?.attack??0;
 $('trainingAttack018').textContent=attack;$('trainingBlock018').textContent=block;$('trainingDamage018').textContent=b?Math.max(0,attack-block):last?.damage||0;
 const reference=$('referenceStrip018');reference.hidden=!['icons','colors','conditions'].includes(lesson.key);
 reference.dataset.focus=lesson.key;
 const items=lesson.key==='icons'?[['atq','Ataque'],['blq','Bloqueio'],['poder','Poder'],['super','Super']]:lesson.key==='conditions'?[['gatilho','Gatilho'],['continuacao','Continuação'],['finalizador','Finalização']]:[['energia-azul','Azul'],['energia-verde','Verde'],['energia-rosa','Rosa'],['energia-roxa','Roxo'],['energia-laranja','Laranja'],['energia-generica','Genérica']];
 reference.innerHTML=items.map(([file,label])=>'<span><img src="assets/hud018/icons/'+file+'.png" alt="'+label+'">'+label+'</span>').join('');
 renderFocus018();
}
function defaultReaction(){
 const maps={
  types:[['doubt','normal','O que cada carta faz?','Vamos aprender lutando.'],['surprise','normal','Então esta é minha defesa!','Reconheça a Guarda.'],['doubt','doubt','E este Truque aqui?','Leia o efeito da carta.'],['angry','surprise','Preparado para meu disparo?','Pode vir, Blossom!']],
  cost:[['doubt','normal','Três energias. Entendi!','Observe a Estâmina.'],['normal','doubt','Hora de pagar meu Golpe!','Qual energia você usará?'],['doubt','normal','Qual delas vou escolher?','Uma energia ativa sua.'],['surprise','normal','A energia ficou inativa!','Isso mesmo! Custo pago.']],
  combat:[['surprise','angry','Ei, você vai atacar mesmo?!','Defenda-se, Blossom!'],['angry','normal','Pode vir! Tenho uma Guarda.','Observe o ataque e o bloqueio.'],['normal','surprise','Hah! Não senti nada!','Excelente defesa!']],
  revide:[['surprise','normal','Posso atacar no seu turno?!','Sim. Esta é sua oportunidade!'],['angry','surprise','Agora é minha vez de revidar!','Seu Golpe resolve primeiro.'],['doubt','normal','Mas o turno ainda é seu?','Revide não muda o turno.']],
  replenish:[['doubt','normal','Minha mão está pequena...','Vamos usar a reposição.'],['normal','doubt','Quero mais duas cartas!','Quanto precisa pagar?'],['surprise','normal','Voltei a ter quatro cartas!','Uma reposição por turno.']],
  overdrive:[['doubt','normal','Qual é o primeiro símbolo?','Inferior. Mire com cuidado.'],['normal','normal','Inferior pronto. Próximo!','Agora um Golpe Superior.'],['angry','surprise','Mais um Golpe Superior!','Sua sequência está quase lá.'],['surprise','surprise','Overdrive! Finalmente!','Use um Golpe da Estâmina!']],
  mulligan:[['doubt','normal','Esta mão pode melhorar?','Podemos fazer uma troca.'],['normal','doubt','Esta Guarda vai para lá!','Qual energia virá à mão?'],['doubt','normal','Vou escolher com cuidado.','Troque quantidades iguais.'],['normal','surprise','Agora sim! Vamos lutar!','Sua abertura está pronta.']]
 };
 if(lesson.done)return ['normal','surprise','Aprendi! Qual assunto escolho agora?','Muito bem, Blossom!'];
 if(maps[lesson.key])return maps[lesson.key][Math.min(lesson.index,maps[lesson.key].length-1)];
 const cycle=[['doubt','normal','Deixa eu entender isso...','Observe o campo destacado.'],['surprise','doubt','Ah! Então é assim?','Examine a carta com calma.'],['angry','surprise','Agora vou mostrar que aprendi!','Vamos ver sua próxima ação.'],['normal','normal','Certo! Qual é o próximo passo?','Continue seguindo o objetivo.']];return cycle[lesson.index%cycle.length];
}
function portrait(id,fighter,emotion,animate){const img=$(id),next='assets/tutorial/'+fighter+'-'+emotion+'.webp';if(img.getAttribute('src')!==next)img.src=next;img.dataset.emotion=emotion;if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const current=img.src;img.decode().catch(()=>{}).then(()=>{if(img.src===current)img.animate([{opacity:.45,filter:'brightness(1.12)'},{opacity:1,filter:'brightness(1)'}],{duration:280,easing:'ease-out'});});}}
function render(animate=false){
 const e=lesson.engine,s=e.s,step=lesson.step,targets=lesson.targets(),own=s.players[0],enemy=s.players[1],n=T.topics.findIndex(t=>t[0]===lesson.key);
 $('chapterNumber').textContent='TREINO LIVRE';$('chapterTitle').textContent=T.topics[n][1];$('ownScore').innerHTML=score(own);$('enemyScore').innerHTML=score(enemy);
 const phase={combat:'Combate',preparation:s.preparedTurn?'Preparação':'Início de turno',end:'Fim de turno',mulligan:'Mulligan'};$('turnLabel').textContent='Turno '+s.turn+' · '+(phase[s.phase]||s.phase)+' · '+(s.active?'Hanma':'Blossom');
 $('ownStamina').innerHTML=own.stamina.map(c=>card(c,{energy:true})).join('');$('enemyStamina').innerHTML=enemy.stamina.map(c=>card(c,{energy:true})).join('');$('ownExtra').innerHTML=extras(0);$('enemyExtra').innerHTML=extras(1);$('hand').innerHTML=own.hand.map(c=>card(c)).join('');$('handCount').textContent=own.hand.length+' cartas';$('ownEnergyCount').textContent=e.energies(0,true).length+'/'+own.stamina.length;$('enemyEnergyCount').textContent=e.energies(1,true).length+'/'+enemy.stamina.length;
 const current=e.current(),arena=[...own.arena,...enemy.arena,...[...tokenArena()].map(uid=>e.find(uid)?.card).filter(Boolean)];$('combatCards').innerHTML=arena.map(c=>card(c)).join('');const last=s.history.at(-1);$('combatResult').textContent=current?'Golpe de '+(current.p?'Hanma':'Blossom')+' · '+current.zone+' · ATAQUE '+current.attack+(current.responseRevide?' · REVIDE':''):last?'Último combate: ATQ '+last.attack+' − BLOQ '+last.block+' · DANO '+last.damage:(s.phase==='mulligan'?'Abertura · escolha as cartas para trocar.':'Observe o objetivo e interaja com o campo.');
 pile('ownDeck','BARALHO',own.deck,true);pile('enemyDeck','BARALHO',enemy.deck,true);pile('ownDiscard','DESCARTE',own.discard);pile('enemyDiscard','DESCARTE',enemy.discard);$('ownBanished').textContent='BANIDAS · '+own.banished.length;
 document.querySelectorAll('[data-zone]').forEach(el=>{const highlighted=targets.includes('zone:'+el.dataset.zone);el.classList.toggle(el.classList.contains('pile')||el.classList.contains('banish')?'target':'target-zone',highlighted);});
 document.querySelectorAll('[data-region]').forEach(el=>el.classList.toggle('target-region',targets.includes('zone:'+el.dataset.region)));
 const speaker=step.speaker||'hanma';$('dialogue').dataset.speaker=speaker;$('dialogue').setAttribute('aria-label','Instruções de '+(speaker==='hanma'?'Hanma':'Blossom'));$('speaker').textContent=speaker.toUpperCase();$('dialogText').innerHTML=step.text;$('objective').textContent=step.task;$('choices').innerHTML=(step.choices||[]).map((label,i)=>`<button data-answer="${i}">${escape(label)}</button>`).join('');$('feedback').textContent=lesson.feedback;$('stepLabel').textContent=lesson.done?'TREINO CONCLUÍDO':'PASSO '+(lesson.index+1)+' / '+lesson.steps.length;$('nextLesson').hidden=!lesson.done;$('nextLesson').textContent='Escolher outro assunto →';
 const [b,h,bl,hl]=reaction||defaultReaction();portrait('blossomPortrait','blossom',b,animate);portrait('hanmaPortrait','hanma',h,animate);$('blossomLine').textContent=bl;$('hanmaLine').textContent=hl;document.querySelectorAll('.mentor').forEach(el=>el.classList.toggle('speaking',el.classList.contains(speaker)));
 if(lesson.done){completed.add(lesson.key);try{localStorage.setItem(storageKey,JSON.stringify([...completed]));}catch{$('feedback').textContent+=' O progresso não pôde ser salvo neste navegador.';}}
 renderTopicMenu();
 renderArena018();
 window.dispatchEvent(new CustomEvent('of-tutorial-render',{detail:{lesson:lesson.key,step:lesson.index,done:lesson.done}}));
}
const topicGroups=[['Comece por aqui',['interface','turn','zones','types','mulligan']],['Jogue suas cartas',['icons','colors','cost','combat','revide','replenish','extra']],['Habilidades e palavras-chave',['overdrive','super','keywords','specifics','conditions']]];
const summaries={interface:'Onde clicar, consultar cartas e usar Resposta e Opções.',turn:'Quando preparar, combater e encerrar seu turno.',zones:'Mão, Estâmina, Arena, Descarte e Banimento.',types:'Lutadores, Golpes, Guardas e Truques.',mulligan:'Troque sua mão inicial antes de começar.',icons:'Leia custo, ataque, bloqueio, Poder e Zona.',colors:'Reconheça as cores e os requisitos de energia.',cost:'Escolha as energias para pagar uma Ação.',combat:'Ataque, bloqueie e entenda o dano.',revide:'Descubra quando você pode contra-atacar.',replenish:'Pague energias para completar sua mão.',extra:'Prepare cartas e use os quatro espaços.',overdrive:'Complete a sequência do seu Lutador.',super:'Carregue cinco barras e ative sua transformação.',keywords:'Regras comuns, como Ímpeto, Quebra e Defletir.',specifics:'Fluir, Foco, Preparo, Fúria, Fluxo e Recarga.',conditions:'Gatilho, Continuação e Finalização na sequência.'};
function renderTopicMenu(){
 $('progressLabel').textContent=completed.size+' / '+T.topics.length;
 $('topicGroups').innerHTML=topicGroups.map(([title,keys])=>'<section class="topic-group"><h2>'+title+'</h2><div class="topic-grid">'+keys.map(key=>{const label=T.topics.find(t=>t[0]===key)[1];return '<button data-lesson="'+key+'"><span class="topic-state">'+(completed.has(key)?'✓ Praticado':'Treino livre')+'</span><strong>'+label+'</strong><span>'+summaries[key]+'</span></button>';}).join('')+'</div></section>').join('');
}
function showMenu(focus=true){
 if(transitioning)return;menuOpen=true;hideZoom();OverdriveTutorialFocus.clear();$('tutorialTraining').hidden=true;$('tutorialMenu').hidden=false;$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','true');renderTopicMenu();history.replaceState(null,'','tutorial.html');if(focus)$('menuTitle').focus();window.scrollTo(0,0);
}
function load(key){menuOpen=false;$('tutorialMenu').hidden=true;$('tutorialTraining').hidden=false;hideZoom();lesson=new T.Lesson(catalog,key);reaction=null;history.replaceState(null,'','tutorial.html?lesson='+encodeURIComponent(key));$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','false');render(true);}
async function switchLesson(key){
 if(transitioning)return;
 if(menuOpen||!lesson||key===lesson.key||matchMedia('(prefers-reduced-motion: reduce)').matches){load(key);return;}
 const main=document.querySelector('main'),direction=T.topics.findIndex(t=>t[0]===key)>T.topics.findIndex(t=>t[0]===lesson.key)?1:-1;
 transitioning=true;main.inert=true;main.dataset.transition='out';hideZoom();$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','false');
 try{
  await main.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX('+(-direction*55)+'vw)',opacity:0}],{duration:180,easing:'ease-in',fill:'forwards'}).finished;
  load(key);main.dataset.transition='in';
  const entering=main.animate([{transform:'translateX('+(direction*55)+'vw)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:240,easing:'ease-out',fill:'forwards'});
  for(const animation of main.getAnimations())if(animation!==entering)animation.cancel();
  await entering.finished;entering.cancel();
 }finally{for(const animation of main.getAnimations())animation.cancel();main.inert=false;delete main.dataset.transition;transitioning=false;}
}
function act(token){
 if(transitioning||menuOpen||!lesson)return;
 hideZoom();const before=lesson.engine.s.players.map(p=>p.hp),past=lesson.engine.s.completed.length,ok=lesson.act(token);reaction=null;
 if(!ok)reaction=token.startsWith('answer:')?['angry','doubt','Grr... vou tentar outra vez.','Leia a condição com calma.']:['doubt','normal','Espera... qual opção?','Veja o destaque dourado.'];
 else if(lesson.engine.s.players[1].hp<before[1])reaction=['normal','angry','Boom! Bem na sua cara!','Belo golpe! Observe o resultado.'];
 else if(lesson.engine.s.players[0].hp<before[0])reaction=['surprise','normal','Ei! Isso ainda me atingiu?!','Confira o dano e o efeito.'];
 else if(lesson.engine.s.completed.length>past&&lesson.engine.s.completed.at(-1)?.blocks.length)reaction=['normal','surprise','Hah! Nem senti esse golpe!','Boa defesa, Blossom!'];
 render(true);
}
function hideZoom(clearPin=true){$('cardZoom').hidden=true;zoomOwner=null;if(clearPin)pinnedUid=null;}
function positionZoom(){
 const box=$('cardZoom');if(box.hidden)return;
 if(innerWidth<=760){box.style.removeProperty('left');box.style.removeProperty('top');box.style.removeProperty('width');return;}
 const table=document.querySelector('.table-area').getBoundingClientRect(),field=$('field').getBoundingClientRect(),gutter=field.left-table.left,width=Math.min(180,Math.max(105,field.left-24));
 box.style.width=width+'px';box.style.left=Math.max(8-table.left,gutter-width-14)+'px';box.style.top=Math.max(75,field.top-table.top+field.height*.45-box.offsetHeight/2)+'px';
}
function zoom(el){
 const uid=typeof el==='string'?el:el.dataset.card,f=lesson.engine.find(uid);if(!f||f.p===1&&f.z==='extra'&&!f.card.public)return;
 const c=f.card,d=lesson.engine.def(c),box=$('cardZoom'),img=box.querySelector('img');img.src=art(c);img.alt=d.name;box.querySelector('p').textContent=d.name+' · '+d.type+' · '+(d.searchText||'Consulte os valores e símbolos na carta.');box.hidden=false;if(lesson.step.focus==='consultation')renderFocus018();zoomOwner=typeof el==='string'?null:el;positionZoom();img.decode().catch(()=>{}).then(positionZoom);
}
function restoreZoom(){if(pinnedUid)zoom(pinnedUid);else hideZoom(false);}
try{
 const response=await fetch('arena-core/catalog.json');if(!response.ok)throw Error('Catálogo indisponível');catalog=await response.json();
 document.querySelector('.table-area').append($('cardZoom'));addEventListener('resize',()=>{positionZoom();renderFocus018();});document.querySelector('#ownStamina').dataset.region='energy';document.querySelector('#ownStamina').dataset.zone='energy';document.querySelector('#ownStamina').dataset.focus='energy';
 for(const region of document.querySelectorAll('[data-zone]:not(button)')){region.tabIndex=0;region.setAttribute('role','group');}
 $('chaptersOpen').addEventListener('click',()=>showMenu());$('restart').addEventListener('click',()=>{if(!transitioning)load(lesson.key);});$('nextLesson').addEventListener('click',()=>showMenu());$('review').addEventListener('click',()=>{if(lesson.lastSpeech){$('dialogText').innerHTML=lesson.lastSpeech.text;$('speaker').textContent=lesson.lastSpeech.speaker.toUpperCase();}});
 document.addEventListener('click',ev=>{
  const topic=ev.target.closest('[data-lesson]');if(topic){switchLesson(topic.dataset.lesson);return;}if(menuOpen||!lesson)return;
  const region=ev.composedPath().find(el=>el instanceof Element&&el.dataset.region&&lesson.targets().includes('zone:'+el.dataset.region));if(region){act('zone:'+region.dataset.region);return;}
  const el=ev.target.closest('button');if(!el)return;if(el.dataset.control){act('control:'+el.dataset.control);return;}if(el.dataset.lesson){switchLesson(el.dataset.lesson);return;}if(el.dataset.answer!==undefined){act('answer:'+el.dataset.answer);return;}if(el.dataset.card){const uid=el.dataset.card;act('card:'+uid);pinnedUid=uid;zoom(uid);return;}if(el.dataset.zone)act('zone:'+el.dataset.zone);
 });
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','false');hideZoom();}else if(['Enter',' '].includes(ev.key)&&ev.target.matches('[data-zone]:not(button)')){ev.preventDefault();act('zone:'+ev.target.dataset.zone);}});
 document.addEventListener('pointerover',ev=>{const el=ev.target.closest('[data-card]');if(el&&zoomOwner!==el)zoom(el);});document.addEventListener('pointerout',ev=>{if(ev.target.closest('[data-card]')&&!ev.relatedTarget?.closest('[data-card]'))restoreZoom();});document.addEventListener('focusin',ev=>{const el=ev.target.closest('[data-card]');if(el)zoom(el);});document.addEventListener('focusout',restoreZoom);
 const requested=new URLSearchParams(location.search).get('lesson');if(T.topics.some(t=>t[0]===requested))load(requested);else showMenu(false);
 window.OverdriveTutorialUI={get menuOpen(){return menuOpen;},get lesson(){return lesson;},get completed(){return [...completed];}};
}catch(error){$('loadError').hidden=false;$('loadError').textContent='O tutorial não pôde abrir: '+error.message+'. Recarregue a página ou volte ao menu.';}
})();
