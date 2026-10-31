(async function(){
'use strict';
const $=id=>document.getElementById(id),T=window.OverdriveTutorial,storageKey='of-tutorial-012-progress',back='assets/original-3.png';
let catalog,lesson,completed=new Set(),zoomOwner=null,reaction=null,pinnedUid=null,transitioning=false;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(key=>T.topics.some(t=>t[0]===key)));}catch{}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function art(c){if(c.token){const n=(c.name||c.tokenDefinition?.name||'').toLowerCase();return 'assets/tokens/galacstrix-'+(n.includes('tigre')?'tigre':n.includes('coruja')?'coruja':n.includes('corvo')?'corvo':'dragao')+'.webp';}return 'assets/'+c.id+'.webp';}
function card(c,opts={}){
 if(!c)return '';const d=lesson.engine.def(c),target=lesson.targets().includes('card:'+c.uid),faceDown=!!opts.hidden||opts.energy&&c.active===false;
 const label=d.name+(faceDown?opts.energy?' · energia inativa, virada para baixo':' · preparada, virada para baixo':'')+(target?' — sua próxima ação':'');
 return `<button class="card ${opts.energy&&c.active===false?'inactive ':''}${target?'target':''}" data-card="${escape(c.uid)}" data-face-down="${faceDown}" aria-label="${escape(label)}" title="${escape(label)}"><img src="${faceDown?back:escape(art(c))}" alt="${faceDown?'Verso da carta':escape(d.name)}" decoding="async">${opts.energy?'<span class="badge">'+(c.active?'ATIVA':'INATIVA')+'</span>':opts.hidden?'<span class="badge">PREPARADA</span>':''}</button>`;
}
function score(side){const d=lesson.engine.def(side.fighter),color=d.color.toLowerCase(),seq=lesson.engine.script(side.fighter).sequence;return side.hp+' VIDA · PODER '+side.power+' <span class="od-icons" aria-label="Overdrive '+side.od+' de 3">'+seq.map((zone,i)=>'<img class="'+(i<side.od?'lit':'')+'" src="assets/zones/'+color+'-'+zone.toLowerCase()+'.png" alt="'+(i+1)+'hit: '+zone+'" title="'+(i+1)+'hit: '+zone+'">').join('')+'</span>';}
function tokenArena(){return new Set([...lesson.engine.s.combats,...lesson.engine.s.completed].filter(b=>b.token&&!b.cancelled).map(b=>b.uid));}
function extras(p){
 const side=lesson.engine.s.players[p],slots=Array.from({length:4},(_,i)=>{
  const c=side.extra.find(c=>c.slot===i);let body='';
  if(c?.token&&tokenArena().has(c.uid))body='<span class="empty-slot">NA ARENA</span>';
  else if(c&&p&&!c.public)body='<img class="hidden-extra" src="'+back+'" alt="Carta preparada oculta de Hanma">';
  else if(c)body=card(c,{hidden:!c.public&&!c.token});
  return '<div class="extra-slot" data-extra-slot="'+i+'"><span class="slot-label">EXTRA '+(i+1)+'</span>'+body+'</div>';
 });
 slots.splice(2,0,'<div id="'+(p?'enemy':'own')+'Fighter" class="fighter-slot"><span class="slot-label">LUTADOR</span>'+card(side.fighter)+'</div>');return slots.join('');
}
function pile(id,label,cards,deck=false){const el=$(id),top=cards.at(-1);el.classList.toggle('has-cards',cards.length>0);el.innerHTML=(cards.length?'<img src="'+(deck?back:escape(art(top)))+'" alt="'+(deck?'Verso do baralho':'Topo do descarte')+'">':'')+'<small>'+label+' · '+cards.length+'</small>';}
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
 if(lesson.done)return ['normal','surprise','Aprendi! Vamos ao próximo treino?','Muito bem, Blossom!'];
 if(maps[lesson.key])return maps[lesson.key][Math.min(lesson.index,maps[lesson.key].length-1)];
 const cycle=[['doubt','normal','Deixa eu entender isso...','Observe o campo destacado.'],['surprise','doubt','Ah! Então é assim?','Examine a carta com calma.'],['angry','surprise','Agora vou mostrar que aprendi!','Vamos ver sua próxima ação.'],['normal','normal','Certo! Qual é o próximo passo?','Continue seguindo o objetivo.']];return cycle[lesson.index%cycle.length];
}
function portrait(id,fighter,emotion,animate){const img=$(id),next='assets/tutorial/'+fighter+'-'+emotion+'.webp';if(img.getAttribute('src')!==next)img.src=next;img.dataset.emotion=emotion;if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const current=img.src;img.decode().catch(()=>{}).then(()=>{if(img.src===current)img.animate([{opacity:.45,filter:'brightness(1.12)'},{opacity:1,filter:'brightness(1)'}],{duration:280,easing:'ease-out'});});}}
function render(animate=false){
 const e=lesson.engine,s=e.s,step=lesson.step,targets=lesson.targets(),own=s.players[0],enemy=s.players[1],n=T.topics.findIndex(t=>t[0]===lesson.key);
 $('chapterNumber').textContent=String(n+1).padStart(2,'0')+' / 12';$('chapterTitle').textContent=T.topics[n][1];$('ownScore').innerHTML=score(own);$('enemyScore').innerHTML=score(enemy);
 const phase={combat:'Combates',preparation:'Início de turno',end:'Fim de turno',mulligan:'Mulligan'};$('turnLabel').textContent='Turno '+s.turn+' · '+(phase[s.phase]||s.phase)+' · '+(s.active?'Hanma':'Blossom');
 $('ownStamina').innerHTML=own.stamina.map(c=>card(c,{energy:true})).join('');$('enemyStamina').innerHTML=enemy.stamina.map(c=>card(c,{energy:true})).join('');$('ownExtra').innerHTML=extras(0);$('enemyExtra').innerHTML=extras(1);$('hand').innerHTML=own.hand.map(c=>card(c)).join('');$('handCount').textContent=own.hand.length+' cartas';$('ownEnergyCount').textContent=e.energies(0,true).length+'/'+own.stamina.length;$('enemyEnergyCount').textContent=e.energies(1,true).length+'/'+enemy.stamina.length;
 const current=e.current(),arena=[...own.arena,...enemy.arena,...[...tokenArena()].map(uid=>e.find(uid)?.card).filter(Boolean)];$('combatCards').innerHTML=arena.map(c=>card(c)).join('');const last=s.history.at(-1);$('combatResult').textContent=current?'Golpe de '+(current.p?'Hanma':'Blossom')+' · '+current.zone+' · ATAQUE '+current.attack+(current.responseRevide?' · REVIDE':''):last?'Último combate: ATQ '+last.attack+' − BLOQ '+last.block+' · DANO '+last.damage:(s.phase==='mulligan'?'Abertura · escolha as cartas para trocar.':'Observe o objetivo e interaja com o campo.');
 pile('ownDeck','BARALHO',own.deck,true);pile('enemyDeck','BARALHO',enemy.deck,true);pile('ownDiscard','DESCARTE',own.discard);pile('enemyDiscard','DESCARTE',enemy.discard);$('ownBanished').textContent='BANIDAS · '+own.banished.length;
 document.querySelectorAll('[data-zone]').forEach(el=>{const highlighted=targets.includes('zone:'+el.dataset.zone);el.classList.toggle(el.classList.contains('pile')||el.classList.contains('banish')?'target':'target-zone',highlighted);});
 document.querySelectorAll('[data-region]').forEach(el=>el.classList.toggle('target-region',targets.includes('zone:'+el.dataset.region)));
 const speaker=step.speaker||'hanma';$('dialogue').dataset.speaker=speaker;$('dialogue').setAttribute('aria-label','Instruções de '+(speaker==='hanma'?'Hanma':'Blossom'));$('speaker').textContent=speaker.toUpperCase();$('dialogText').innerHTML=step.text;$('objective').textContent=step.task;$('choices').innerHTML=(step.choices||[]).map((label,i)=>`<button data-answer="${i}">${escape(label)}</button>`).join('');$('feedback').textContent=lesson.feedback;$('stepLabel').textContent=lesson.done?'TREINO CONCLUÍDO':'PASSO '+(lesson.index+1)+' / '+lesson.steps.length;$('nextLesson').hidden=!lesson.done;$('nextLesson').textContent=n===T.topics.length-1?'Voltar ao menu →':'Próxima lição →';
 const [b,h,bl,hl]=reaction||defaultReaction();portrait('blossomPortrait','blossom',b,animate);portrait('hanmaPortrait','hanma',h,animate);$('blossomLine').textContent=bl;$('hanmaLine').textContent=hl;document.querySelectorAll('.mentor').forEach(el=>el.classList.toggle('speaking',el.classList.contains(speaker)));
 if(lesson.done){completed.add(lesson.key);try{localStorage.setItem(storageKey,JSON.stringify([...completed]));}catch{$('feedback').textContent+=' O progresso não pôde ser salvo neste navegador.';}}
 $('progressLabel').textContent=completed.size+' / 12';$('chapters').innerHTML=T.topics.map(([key,label],i)=>`<button data-lesson="${key}" class="${key===lesson.key?'current ':''}${completed.has(key)?'done':''}" ${key===lesson.key?'aria-current="step"':''}>${String(i+1).padStart(2,'0')} · ${label}</button>`).join('');
 window.dispatchEvent(new CustomEvent('of-tutorial-render',{detail:{lesson:lesson.key,step:lesson.index,done:lesson.done}}));
}
function load(key){hideZoom();lesson=new T.Lesson(catalog,key);reaction=null;history.replaceState(null,'','tutorial.html?lesson='+encodeURIComponent(key));$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','false');render(true);}
async function switchLesson(key){
 if(transitioning)return;
 if(key===lesson.key||matchMedia('(prefers-reduced-motion: reduce)').matches){load(key);return;}
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
 if(transitioning)return;
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
 const table=document.querySelector('.table-area').getBoundingClientRect(),field=$('field').getBoundingClientRect(),gutter=field.left-table.left,width=Math.max(105,Math.min(180,gutter-20));
 box.style.width=width+'px';box.style.left=Math.max(4,gutter-width-14)+'px';box.style.top=Math.max(75,field.top-table.top+field.height*.45-box.offsetHeight/2)+'px';
}
function zoom(el){
 const uid=typeof el==='string'?el:el.dataset.card,f=lesson.engine.find(uid);if(!f||f.p===1&&f.z==='extra'&&!f.card.public)return;
 const c=f.card,d=lesson.engine.def(c),box=$('cardZoom'),img=box.querySelector('img');img.src=art(c);img.alt=d.name;box.querySelector('p').textContent=d.name+' · '+d.type+' · '+(d.searchText||'Consulte os valores e símbolos na carta.');box.hidden=false;zoomOwner=typeof el==='string'?null:el;positionZoom();img.decode().catch(()=>{}).then(positionZoom);
}
function restoreZoom(){if(pinnedUid)zoom(pinnedUid);else hideZoom(false);}
try{
 const response=await fetch('arena-core/catalog.json');if(!response.ok)throw Error('Catálogo indisponível');catalog=await response.json();
 document.querySelector('.table-area').append($('cardZoom'));addEventListener('resize',positionZoom);
 $('chaptersOpen').addEventListener('click',()=>{$('chapters').hidden=!$('chapters').hidden;$('chaptersOpen').setAttribute('aria-expanded',String(!$('chapters').hidden));});$('restart').addEventListener('click',()=>{if(!transitioning)load(lesson.key);});$('nextLesson').addEventListener('click',()=>{const n=T.topics.findIndex(t=>t[0]===lesson.key);if(n===T.topics.length-1)location.href='home.html';else switchLesson(T.topics[n+1][0]);});$('review').addEventListener('click',()=>{if(lesson.lastSpeech){$('dialogText').innerHTML=lesson.lastSpeech.text;$('speaker').textContent=lesson.lastSpeech.speaker.toUpperCase();}});
 document.addEventListener('click',ev=>{
  const region=ev.target.closest('[data-region]');if(region&&lesson.targets().includes('zone:'+region.dataset.region)){act('zone:'+region.dataset.region);return;}
  const el=ev.target.closest('button');if(!el)return;if(el.dataset.lesson){switchLesson(el.dataset.lesson);return;}if(el.dataset.answer!==undefined){act('answer:'+el.dataset.answer);return;}if(el.dataset.card){const uid=el.dataset.card;act('card:'+uid);pinnedUid=uid;zoom(uid);return;}if(el.dataset.zone)act('zone:'+el.dataset.zone);
 });
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('chapters').hidden=true;$('chaptersOpen').setAttribute('aria-expanded','false');hideZoom();}});
 document.addEventListener('pointerover',ev=>{const el=ev.target.closest('[data-card]');if(el&&zoomOwner!==el)zoom(el);});document.addEventListener('pointerout',ev=>{if(ev.target.closest('[data-card]')&&!ev.relatedTarget?.closest('[data-card]'))restoreZoom();});document.addEventListener('focusin',ev=>{const el=ev.target.closest('[data-card]');if(el)zoom(el);});document.addEventListener('focusout',restoreZoom);
 const requested=new URLSearchParams(location.search).get('lesson');load(T.topics.some(t=>t[0]===requested)?requested:'types');
 window.OverdriveTutorialUI={get lesson(){return lesson;},get completed(){return [...completed];}};
}catch(error){$('loadError').hidden=false;$('loadError').textContent='O tutorial não pôde abrir: '+error.message+'. Recarregue a página ou volte ao menu.';}
})();
