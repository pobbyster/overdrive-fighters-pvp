(() => {
 'use strict';
 const $ = id => document.getElementById(id), escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 const { Engine, chooseAI } = OverdriveCore;
 let catalog, engine, decks = [], arenaDeckOverride=null, timer, selectedBlocks = new Set(), swapHand = new Set(), swapEnergy = new Set();
 let tutorialStep = 0, tutorialReturnFocus;
 const arenaOrder = new Map(); let arenaSequence = 0;
 let selectedEnergy=new Set(),motionBusy=false,motionGeneration=0;
 const motionLayer=document.createElement('div');motionLayer.id='cardMotionLayer';motionLayer.setAttribute('aria-hidden','true');document.body.append(motionLayer);
 const motionCleanups=new Set();
 function stopMotion(){motionGeneration++;for(const clean of [...motionCleanups])clean();motionBusy=false;motionLayer.replaceChildren();$('game').removeAttribute('aria-busy');}
 function zoneElement(p,z){const prefix=p?'enemy':'own';return z==='arena'?$('sharedArena'):z==='hand'?$(prefix+'Hand'):z==='stamina'?$(prefix+'Energy'):z==='extra'?$(prefix+'Extra'):z==='deck'?$(prefix+'Deck'):z==='discard'||z==='banished'?$(prefix+'Discard'):null;}
 function motionSnapshot(){const result=new Map();if(!engine?.s)return result;
  engine.s.players.forEach((side,p)=>{for(const z of ['deck','hand','stamina','extra','arena','discard','banished'])for(const card of side[z]){
   const el=$('game').querySelector('[data-card="'+card.uid+'"], [data-motion-card="'+card.uid+'"]')||zoneElement(p,z),rect=el?.getBoundingClientRect();
   result.set(card.uid,{p,z,id:card.id,active:card.active,hidden:z==='deck'||p===1&&z==='hand'||z==='extra'&&!card.public||z==='stamina'&&!card.active,rect:rect&&{left:rect.left,top:rect.top,width:rect.width,height:rect.height},el});
  }});return result;
 }
 function animateMovements(before,opening=false){const strength=(window.OverdriveSettings?.get().motion??100)/100;if(!strength||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const after=motionSnapshot(),jobs=[];for(const [uid,to] of after){const from=before.get(uid);if(from&&from.z!==to.z)jobs.push({uid,from,to});else if(opening&&to.z==='hand')jobs.push({uid,from:{...to,z:'deck',hidden:true,rect:zoneElement(to.p,'deck').getBoundingClientRect()},to});else if(from?.z==='stamina'&&to.z==='stamina'&&from.active!==to.active||from?.z==='extra'&&to.z==='extra'&&from.hidden!==to.hidden)jobs.push({uid,from,to,flip:true});}
  // Identidades de baralhos e mãos adversárias continuam ocultas. As animações
  // dessas zonas usam somente contagens e informações públicas recebidas.
  if(engine.remote&&!opening){
   const cards=(snapshot,p,z)=>[...snapshot.values()].filter(c=>c.p===p&&c.z===z);
   const endpoint=(card,z,hidden)=>{const rect=zoneElement(card.p,z)?.getBoundingClientRect();return {...card,z,hidden,rect:rect&&{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};};
   for(let p=0;p<2;p++){
    let draws=Math.max(0,cards(before,p,'deck').length-cards(after,p,'deck').length),returns=Math.max(0,cards(after,p,'deck').length-cards(before,p,'deck').length);
    let handOut=Math.max(0,cards(before,p,'hand').length-cards(after,p,'hand').length);
    for(const [uid,to]of after){
     if(to.p!==p||before.has(uid)||jobs.some(j=>j.uid===uid)||to.z==='deck')continue;
     if(['hand','stamina'].includes(to.z)&&draws>0){jobs.push({uid,from:endpoint(to,'deck',true),to});draws--;}
     else if(p===1&&handOut>0&&['arena','extra','discard','banished'].includes(to.z)){jobs.push({uid,from:endpoint(to,'hand',true),to});handOut--;}
    }
    for(const [uid,from]of before)if(returns>0&&from.p===p&&from.z!=='deck'&&!after.has(uid)&&from.id){jobs.push({uid,from,to:endpoint(from,'deck',true)});returns--;}
   }
  }
  for(const [uid,from] of before)if(!after.has(uid)&&from.id==='TOKEN')jobs.push({uid,from,to:{...from,z:'destroyed'},vanish:true});
  if(!jobs.length)return;motionBusy=true;clearTimeout(timer);hideHover();const generation=motionGeneration;let pending=jobs.length;
  const controls=[...document.querySelectorAll('#decisionHud button:not(.hud-drag-handle),#responseHud button:not(.hud-drag-handle),#turnTools button')].map(el=>({el,disabled:el.disabled}));
  for(const {el}of controls)el.disabled=true;$('game').setAttribute('aria-busy','true');
  const finishJob=()=>{if(--pending)return;for(const {el,disabled}of controls)if(el.isConnected)el.disabled=disabled;if(generation===motionGeneration){motionBusy=false;$('game').removeAttribute('aria-busy');schedule();}};
  jobs.forEach(({uid,from,to,flip,vanish},index)=>{
   const a=from.rect,b=to.rect;if(!a?.width||!b?.width){finishJob();return;}
   const width=from.z==='hand'&&from.p===1||from.z==='deck'?Math.min(65,b.width):Math.min(100,a.width),height=width*1048/751;
   const flight=document.createElement('img');flight.className='card-flight'+(to.z==='banished'?' banish-flight':'');flight.dataset.from=from.z;flight.dataset.to=to.z;flight.dataset.player=String(to.p);
   flight.src=from.hidden||!from.id?back:art(from.id,from);flight.alt='';flight.style.cssText=`left:${a.left+a.width/2-width/2}px;top:${a.top+a.height/2-height/2}px;width:${width}px;height:${height}px`;
   motionLayer.append(flight);const target=$('game').querySelector('[data-card="'+uid+'"], [data-motion-card="'+uid+'"]');if(target)target.style.visibility='hidden';
   const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2,scale=to.z==='hand'&&to.p===1 ? .65:Math.min(1.2,b.width/width),delay=Math.min(index*65,450),duration=(flip?300:460)*(.5+.5*strength);
   const frames=flip?[{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)',offset:.5},{transform:'rotateY(0deg)'}]:[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5-32*strength}px) scale(1.08) rotate(${to.z==='banished'?-12:4}deg)`,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(${vanish ? .1 : scale}) rotate(0deg)`,opacity:vanish?0:1}];
   const animation=flight.animate(frames,{duration,delay,easing:'cubic-bezier(.25,.7,.25,1)',fill:'both'});
   const reveal=setTimeout(()=>{flight.src=to.hidden||!to.id?back:art(to.id);},delay+duration*.5);
   let done=false;const clean=()=>{if(done)return;done=true;clearTimeout(reveal);animation.cancel();flight.remove();if(target?.isConnected)target.style.visibility='';motionCleanups.delete(clean);finishJob();};
   motionCleanups.add(clean);animation.finished.then(clean,clean);
  });
 }
 const art = (id,card) => id === 'TOKEN' ? ({owl:'assets/tokens/galacstrix-coruja.webp',dragon:'assets/tokens/galacstrix-dragao.webp',raven:'assets/tokens/galacstrix-corvo.webp',tiger:'assets/tokens/galacstrix-tigre.webp'}[card?.balanceToken]||'assets/FICHA.png') : 'assets/' + id + '.webp', back = 'assets/original-3.png';
 const hoverHud = document.createElement('aside'); hoverHud.id = 'cardHoverHud'; hoverHud.className = 'card-hover-hud'; hoverHud.hidden = true;
 hoverHud.setAttribute('aria-label', 'Prévia ampliada da carta');
 const hoverImage = document.createElement('img'), hoverName = document.createElement('span'); hoverHud.append(hoverImage, hoverName); document.body.append(hoverHud);
 let hoverTimer, hoverTarget, hoverPointer;
 function hideHover() { clearTimeout(hoverTimer); hoverTarget = null; hoverHud.hidden = true; }
 function previewCard(target) {
  hideHover();
  if (!target || !target.closest("#game,#pileDialog,#decisionHud") || !engine?.s || !$('tutorial').hidden || document.querySelector('dialog[open]:not(#pileDialog)') || !cardMenu.hidden || pendingPlacement) return;
  const uid = target.dataset.card || target.dataset.previewCard, view = engine.view(0);
  const publicCard = view.players.flatMap((side, i) => [side.fighter, ...side.stamina, ...side.arena,...side.discard,...side.banished, ...side.extra.filter(c=>!c.hidden), ...(i === 0 ? side.hand : [])]).find(c => c.uid === uid);
  const candidate=view.choice?.player===0&&view.choice.uids?.includes(uid)?engine.find(uid):null;
  const card=publicCard||(candidate?.p===0&&!candidate.card.hidden?candidate.card:null);
  if (!card?.id) return;
  (target.closest('dialog')||document.body).append(hoverHud);
  hoverTarget = target;
  hoverTimer = setTimeout(() => {
   if (hoverTarget !== target || !target.isConnected) return;
   const def = engine.def(card), bounds = target.getBoundingClientRect();
   const width = Math.min(320, (innerHeight - 80) * 751 / 1048, innerWidth - 28), height = width * 1048 / 751 + 45;
   const choiceBounds=target.closest('#decisionHud')?.getBoundingClientRect();
   let left=choiceBounds&&choiceBounds.left-width-18>=12?choiceBounds.left-width-18:choiceBounds&&choiceBounds.right+width+18<=innerWidth-12?choiceBounds.right+18:bounds.right+18;
   if(left+width>innerWidth-12)left=bounds.left-width-18;
   hoverHud.style.width = width + 'px'; hoverHud.style.left = Math.max(12, Math.min(left, innerWidth - width - 12)) + 'px';
   hoverHud.style.top = Math.max(12, Math.min(bounds.top, innerHeight - height - 12)) + 'px';
   hoverImage.src = art(card.id,card); hoverImage.alt = def.name; hoverName.textContent = def.name+(target.dataset.unavailableReason?' — '+target.dataset.unavailableReason:''); hoverHud.hidden = false;
  }, 280);
 }
 for(const surface of [document])surface.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  hoverPointer = { x: event.clientX, y: event.clientY };
  const target = event.target.closest('[data-card], [data-preview-card]');
  if (target && !target.contains(event.relatedTarget)) previewCard(target);
 });
 for(const surface of [document])surface.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  hoverPointer = { x: event.clientX, y: event.clientY };
  const target = event.target.closest('[data-card], [data-preview-card]');
  if (target && target !== hoverTarget) previewCard(target);
 });
 for(const surface of [document])surface.addEventListener('pointerout', event => { if (hoverTarget && !hoverTarget.contains(event.relatedTarget)) hideHover(); });
 for(const surface of [document])surface.addEventListener('focusin', event => previewCard(event.target.closest('[data-card], [data-preview-card]')));
 for(const surface of [document])surface.addEventListener('focusout', hideHover); for(const surface of [document])surface.addEventListener('click', hideHover, true);
 window.addEventListener('scroll', () => {
  if (!hoverTarget) return;
  const target = hoverPointer && document.elementFromPoint(hoverPointer.x, hoverPointer.y)?.closest('[data-card], [data-preview-card]');
  if (target && ($('game').contains(target)||$('pileDialog').contains(target)||$('decisionHud').contains(target))) previewCard(target); else hideHover();
 }, true); window.addEventListener('resize', hideHover);
 document.addEventListener('keydown', event => { if (event.key === 'Escape') hideHover(); });
 const phases = { mulligan: 'Prepare sua abertura', preparation: 'Preparo', combat: 'Combates', end: 'Fim do turno', finished: 'Partida encerrada' };
 const steps = [
  ['#playerStats', 'Vida e objetivo', 'Cada lutador começa com 20 de vida. Você vence ao zerar a vida da IA ou quando ela precisa comprar mais cartas do que restam no baralho.'],
  ['#ownHand', 'Sua mão', 'Clique em uma carta para ampliar a arte e ver suas ações disponíveis. Golpes atacam; Guardas defendem; Truques geram efeitos. Bordas azuis indicam cartas com ações disponíveis.'],
  ['#ownEnergy', 'Estâmina e custos', 'A Estamina começa com 7 energias em Deathmatch, 5 em Advanced, 3 em Standard ou 2 em Prime. Ao anunciar uma ação, selecione suas energias ativas e confirme o pagamento. Quando a IA usar suas energias inativas, escolha quais reativar. Custos alternativos podem abrir uma oportunidade de Revide.'],
  ['#ownExtra', 'Preparar uma carta', 'Escolha uma carta da mão e um dos quatro espaços vazios da Zona Extra. Ela fica virada para baixo; clique para consultar sua arte. Pode ser usada a partir do turno seguinte. Você prepara manualmente uma carta por turno, apenas na fase Início de Turno. Colocação por efeitos segue o texto da carta.'],
  ['#combatInfo', 'Ataque, bloqueio e respostas', 'Jogue um Golpe no seu turno. Quando a IA atacar, selecione bloqueadores e confirme, ou escolha Receber golpe. O jogo calcula o dano e aplica os efeitos. Sem resposta continua a resolução quando você não quer jogar um Truque.'],
  ['#playerStats', 'Overdrive e habilidade de Blossom', 'Blossom avança com Inferior → Superior → Superior. Overdrive joga um Golpe ativo da Estâmina sem pagar custos, com bônus de Poder; depois ele vai ao descarte. Virar Blossom para comprar 1 carta exige um estado aberto do seu turno e impede Overdrive neste turno.'],
  ['#actionButtons', 'Jogue no seu ritmo', 'O campo mostra apenas ações permitidas. Repor compra cartas até completar quatro, pagando energia. Encerrar turno entrega o ataque à IA. Compras de regra, reativação, efeitos, dano e descarte acontecem automaticamente.']
 ];
 function beginTutorial() {
  hideHover();
  if (!engine?.s) { $('showTutorial').checked = true; $('showTutorial').focus(); return; }
  clearTimeout(timer); tutorialReturnFocus = document.activeElement; tutorialStep = 0; $('tutorial').hidden = false; showTutorialStep();
 }
 function showTutorialStep() {
  document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
  const [selector, title, text] = steps[tutorialStep], target = document.querySelector(selector);
  target.classList.add('tutorial-focus'); target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  $('tutorialStep').textContent = `PASSO ${tutorialStep + 1} / ${steps.length}`;
  $('tutorialTitle').textContent = title; $('tutorialText').textContent = text;
  $('tutorialBack').disabled = tutorialStep === 0; $('tutorialNext').textContent = tutorialStep === steps.length - 1 ? 'Começar a jogar' : 'Próximo'; $('tutorialNext').focus();
 }
 function finishTutorial() {
  $('tutorial').hidden = true; document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
  if (tutorialReturnFocus?.isConnected && !tutorialReturnFocus.closest('[hidden]')) tutorialReturnFocus.focus(); else $('tutorialOpen').focus();
  schedule();
 }
 $('tutorialOpen').onclick = beginTutorial; $('tutorialSkip').onclick = finishTutorial;
 $('tutorialNext').onclick = () => tutorialStep === steps.length - 1 ? finishTutorial() : (tutorialStep++, showTutorialStep());
 $('tutorialBack').onclick = () => { if (tutorialStep) { tutorialStep--; showTutorialStep(); } };
 $('tutorial').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); finishTutorial(); }
  if (e.key === 'Tab') { const buttons = [...$('tutorial').querySelectorAll('button')].filter(b => !b.disabled); const i = buttons.indexOf(document.activeElement); e.preventDefault(); buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); }
 });
 function execute(p, action) {
  if (engine.remote) { if (p === 0) engine.sendAction(action); return false; }
  const before=motionSnapshot();
  const beforeHp=engine.s.players.map(side=>side.hp),beforeWinner=engine.s.winner;
  const result = engine.execute(p, action);
  if (!result.accepted) { $('actionError').textContent = result.reason; return false; }
  dispatchEvent(new CustomEvent('of-game-sounds',{detail:engine.soundEvents||[]}));
  $('actionError').textContent = ''; selectedBlocks.clear(); selectedEnergy.clear(); swapHand.clear(); swapEnergy.clear(); render(); animateMovements(before);
  const after=motionSnapshot(),changes=[];let energy=false;for(const [uid,to] of after){const from=before.get(uid);if(from&&from.z!==to.z)changes.push({from:from.z,to:to.z});if(from?.z==='stamina'&&to.z==='stamina'&&from.active!==to.active)energy=true;}for(const [uid,from] of before)if(!after.has(uid))changes.push({from:from.z,to:'destroyed'});
  dispatchEvent(new CustomEvent('of-game-action',{detail:{changes,energy,damage:engine.s.players.some((side,i)=>side.hp<beforeHp[i]),winner:beforeWinner===null?engine.s.winner:null}}));return true;
 }
 function human(action, confirmed=false) { if (!$('tutorial').hidden||motionBusy||window.OverdriveSession?.isReplay||window.OverdriveSession?.paused) return; if(!confirmed&&window.OverdriveConfirmAction?.(action,()=>human(action,true)))return; if(['tokenAttack','play','block','replenish','fighterSkill','startSkill','balanceDiscard','expansionMournerSkill','expansionPlacideSkill','expansionExcalium'].includes(action.type))action={...action,selectEnergy:true};if (execute(0, action)) schedule(); }
  // Interação sobre o campo: menus locais, perguntas de resposta e colocação espacial.
 let pendingPlacement=null,responseAccepted=null,menuAnchor=null;
 const cardMenu=document.createElement('aside');cardMenu.id='cardMenu';cardMenu.hidden=true;cardMenu.setAttribute('role','dialog');cardMenu.setAttribute('aria-label','Opções da carta');document.body.append(cardMenu);
 const responseHud=document.createElement('aside');responseHud.id='responseHud';responseHud.hidden=true;responseHud.setAttribute('role','dialog');responseHud.setAttribute('aria-label','Janela de oportunidade');document.body.append(responseHud);
 const decisionHud=document.createElement('aside');decisionHud.id='decisionHud';decisionHud.hidden=true;decisionHud.setAttribute('role','dialog');decisionHud.setAttribute('aria-label','Escolha de jogo');decisionHud.innerHTML='<span class="eyebrow">SUA ESCOLHA</span><h2 id="decisionTitle">Escolha uma ação</h2>';document.body.append(decisionHud);
 const controlsPanel=$('actionButtons').closest('.controls');controlsPanel.classList.remove('controls');controlsPanel.classList.add('decision-body');decisionHud.append(controlsPanel);
 const turnTools=document.createElement('aside');turnTools.id='turnTools';turnTools.hidden=true;turnTools.setAttribute('aria-label','Opções do turno');document.body.append(turnTools);
 const fieldNotice=document.createElement('aside');fieldNotice.id='fieldNotice';fieldNotice.hidden=true;fieldNotice.setAttribute('role','status');document.body.append(fieldNotice);
 const responseKey=()=>engine.s.turn+':'+engine.s.revision;
 // One source of truth for both the opportunity prompt and its continuation.
 function responseContinuation(actions){
  const revide=actions.find(a=>a.type==='declineRevide');if(revide)return revide;
  const block=actions.find(a=>a.type==='block');if(block)return {type:'block',uids:[...selectedBlocks].filter(uid=>block.options.includes(uid))};
  return actions.find(a=>a.type==='pass');
 }
 function closeMenu(resume=true){cardMenu.hidden=true;cardMenu.replaceChildren();if(resume)schedule();}
 function positionMenu(anchor){menuAnchor=anchor;cardMenu.hidden=false;const r=anchor?.getBoundingClientRect()||{left:innerWidth/2,top:innerHeight/2,right:innerWidth/2};cardMenu.style.left=Math.max(12,Math.min(innerWidth-cardMenu.offsetWidth-12,r.right+10))+'px';cardMenu.style.top=Math.max(12,Math.min(innerHeight-cardMenu.offsetHeight-12,r.top))+'px';cardMenu.querySelector('button')?.focus();}
 function menuButton(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeMenu(false);fn();};cardMenu.append(b);}
 function openCard(uid,anchor){if(motionBusy)return;const loc=engine.find(uid);if(!loc)return;const energy=engine.legalActions(0).find(a=>['chooseEnergy','chooseOwnEnergy'].includes(a.type));if(energy&&loc.p===0&&loc.z==='stamina'&&energy.options.includes(uid)){if(selectedEnergy.has(uid))selectedEnergy.delete(uid);else if(selectedEnergy.size<energy.required)selectedEnergy.add(uid);render();return;}if(engine.s.phase==='mulligan'&&loc.p===0&&['hand','stamina'].includes(loc.z)){inspectCard(uid);return;}clearTimeout(timer);hideHover();closeMenu(false);responseAccepted=responseKey();responseHud.hidden=true;
 const title=document.createElement('strong');title.textContent=engine.def(loc.card).name;cardMenu.append(title);const actions=(window.OverdriveSession?.isReplay||window.OverdriveSession?.paused)?[]:engine.legalActions(0),block=actions.find(a=>a.type==='block');
 if(loc.p===0&&block?.options.includes(uid))menuButton(selectedBlocks.has(uid)?'Retirar do bloqueio':'Usar no bloqueio',()=>{if(selectedBlocks.has(uid))selectedBlocks.delete(uid);else selectedBlocks.add(uid);render();schedule();});
 for(const action of actions.filter(a=>a.uid===uid||a.type==='chooseGalacstrix'&&engine.s.choice?.uids[engine.s.choice.index]===uid)){if(action.type==='prepare')menuButton('Colocar na Zona Extra',()=>beginPlacement(action));else menuButton(action.type==='chooseGalacstrix'?(action.use?'Ativar efeito · pagar energia adicional':'Não ativar efeito'):action.type==='play'?'Ativar ação · '+actionLabel(action).replace(/^Jogar · /,''):actionLabel(action),()=>human(action));}
 if(!window.OverdriveSession?.isReplay){const reasons=engine.explainCard?.(0,uid)||[];if(reasons.length){const p=document.createElement('p');p.className='availability-reason';p.textContent=reasons.join(' ');cardMenu.append(p);}}if(loc.p===0&&loc.z==='fighter'&&engine.def(loc.card).number===89)for(const a of actions.filter(a=>a.type==='overdrive'))menuButton('Overdrive · '+engine.def(engine.find(a.uid).card).name,()=>human(a));menuButton('Ver carta e efeito',()=>inspectCard(uid));menuButton('Fechar',()=>schedule());renderInteraction(engine.view(0));positionMenu(anchor||document.querySelector('[data-card="'+uid+'"]'));}
 function pileMenu(player,anchor){clearTimeout(timer);hideHover();closeMenu(false);const title=document.createElement('strong');title.textContent=player?'Pilha da IA':'Sua pilha';cardMenu.append(title);menuButton('Ver descarte',()=>openPile(player));if(player===0)for(const a of engine.legalActions(0).filter(a=>a.type==='replenish'))menuButton(actionLabel(a),()=>human(a));menuButton('Fechar',()=>schedule());positionMenu(anchor);}
 function addPrepareAction(container,action){const b=document.createElement('button');b.textContent='Colocar na Zona Extra';b.onclick=()=>beginPlacement(action);container.append(b);}
 function beginPlacement(action){clearTimeout(timer);closeMenu(false);if($('cardDialog').open)$('cardDialog').close();if($('pileDialog').open)$('pileDialog').close();pendingPlacement={...action};render();schedule();}
 function cancelPlacement(){pendingPlacement=null;render();schedule();}
 function responseActions(actions){return actions.filter(a=>['mahaOverdrive','play','overdrive','fighterOverdrive','tokenAttack','fighterSkill','startSkill','expansionReveal','expansionMournerSkill','expansionPlacideSkill','expansionMournerOD','expansionExcalium','rivalsOverdrive','balanceDiscard','finta','desvio'].includes(a.type)||a.type==='block'&&a.options.length);}
 function endResponse(){const a=responseContinuation(engine.legalActions(0));if(a){closeMenu(false);human(a);}}
 function fitArena(){const layout=document.querySelector('#game .arena-layout');if(!layout||$('game').hidden||innerWidth<800){if(layout)layout.style.zoom='1';return;}layout.style.zoom='1';const top=layout.getBoundingClientRect().top+scrollY,available=innerHeight-top-48;layout.style.zoom=String(Math.max(.5,Math.min((window.OverdriveSettings?.get().uiScale??100)/100,available/layout.offsetHeight)));}
 // Measure after the playing theme and fight HUD have settled, including the first mulligan.
 const queueArenaFit=()=>requestAnimationFrame(fitArena);
 addEventListener('resize',queueArenaFit);
 addEventListener('of-game-render',queueArenaFit);
 document.fonts?.ready.then(queueArenaFit);
 function renderInteraction(view){document.body.classList.toggle('duel-active',!$('game').hidden);const actions=view.actions,decision=view.phase==='mulligan'?(engine.s.players[0].mulligan?1:0):(view.choice?.player??view.priority),ownDecision=decision===0&&view.winner===null;
  turnTools.replaceChildren();responseHud.replaceChildren();turnTools.hidden=$('game').hidden;responseHud.hidden=true;
  const addTool=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;turnTools.append(b);};
  if(ownDecision&&!view.choice&&!pendingPlacement){if(view.phase==='preparation'&&engine.s.preparedTurn&&!view.stack.length)addTool('Iniciar combates',()=>human({type:'pass'}));for(const a of actions.filter(a=>a.type==='end'))addTool('Encerrar turno',()=>human(a));const replen=actions.filter(a=>a.type==='replenish');if(replen.length)addTool('Repor cartas',()=>{closeMenu(false);for(const a of replen)menuButton(actionLabel(a),()=>human(a));positionMenu(turnTools);});}
  if(ownDecision&&!pendingPlacement&&(!view.choice||view.choice.kind==='revide')){const opportunity=view.choice?.kind==='revide'||view.combats.length||view.stack.length||view.active===1||view.phase==='end'||view.ending||view.autoEnd;
   if(opportunity&&responseContinuation(actions)){if(responseActions(actions).length&&responseAccepted!==responseKey()){responseHud.hidden=false;const combat=view.combats.at(-1),blocking=actions.some(a=>a.type==='block');responseHud.innerHTML='<span class="eyebrow">JANELA DE OPORTUNIDADE</span><h2>'+(blocking?'Deseja bloquear ou responder?':'Deseja ativar uma ação?')+'</h2><p>'+(view.choice?.kind==='revide'?'Você pode realizar um Golpe em Revide.':combat?'Há uma janela aberta neste combate.':'Você tem uma resposta disponível.')+'</p><div class="response-options"></div>';const row=responseHud.querySelector('div'),yes=document.createElement('button'),no=document.createElement('button');yes.className='primary';yes.textContent='Sim · escolher ação';yes.onclick=()=>{responseAccepted=responseKey();render();schedule();};no.textContent=blocking?'Não · receber Golpe':'Não · continuar';no.onclick=endResponse;row.append(yes,no);}else{addTool('Concluir resposta',endResponse);turnTools.lastElementChild.id='finishResponse';}}
  }
  const blocking=actions.some(a=>a.type==='block'),required=view.choice&&view.choice.kind!=='revide';
  decisionHud.hidden=!ownDecision||!!pendingPlacement||(!required&&!(view.phase==='mulligan'&&!engine.s.players[0].mulligan)&&!(blocking&&selectedBlocks.size>0));
  if(!decisionHud.hidden)$('decisionTitle').textContent=selectedBlocks.size?'Bloqueio · '+selectedBlocks.size+' carta(s)':view.phase==='mulligan'?'Prepare sua mão':'Resolva o efeito';
  if($('actionError').textContent){fieldNotice.hidden=false;fieldNotice.textContent=$('actionError').textContent;}else if(pendingPlacement){fieldNotice.hidden=false;fieldNotice.replaceChildren();const text=document.createElement('span');text.textContent='Escolha uma Zona Extra destacada';const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.onclick=cancelPlacement;fieldNotice.append(text,cancel);}else fieldNotice.hidden=true;
  const occupied=engine.s.players[0].extra.map(c=>c.slot);document.querySelectorAll('#ownExtra [data-extra-slot]').forEach(el=>{const free=!!pendingPlacement&&!occupied.includes(Number(el.dataset.extraSlot));el.classList.toggle('placement-target',free);if(free){el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label','Colocar na Zona Extra '+(Number(el.dataset.extraSlot)+1));}});fitArena();
  dispatchEvent(new Event('of-arena-interaction'));
 }
 $('game').addEventListener('click',e=>{if(!pendingPlacement)return;const target=e.target.closest('#ownExtra .placement-target');if(!target)return;e.stopImmediatePropagation();const a={...pendingPlacement,slot:Number(target.dataset.extraSlot)};pendingPlacement=null;human(a);},true);
 $('game').addEventListener('keydown',e=>{if(pendingPlacement&&['Enter',' '].includes(e.key)&&e.target.matches('.placement-target')){e.preventDefault();e.target.click();}});
 document.addEventListener('pointerdown',e=>{if(!cardMenu.hidden&&!cardMenu.contains(e.target)&&!e.target.closest('[data-card],.pile'))closeMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(pendingPlacement){e.preventDefault();cancelPlacement();}else if(!cardMenu.hidden){e.preventDefault();closeMenu();menuAnchor?.focus();}}});

 function schedule() {
  clearTimeout(timer);
  if (engine?.remote && engine.networkPaused) return;
  if (!engine?.s || window.OverdriveSession?.paused || window.OverdriveSession?.isReplay || motionBusy || engine.s.winner !== null || !$('tutorial').hidden || $('cardDialog').open || $('pileDialog').open || $('confirmNew').open || !cardMenu.hidden || pendingPlacement || document.querySelector('dialog[open]')) return;
  const state = engine.s, p = state.phase === 'mulligan' ? (state.players[0].mulligan ? 1 : 0) : (state.choice?.player ?? state.priority);
  if (p === 1) {
   if (engine.remote) return;
   timer = setTimeout(() => { const action = window.OverdriveSession?.mode==='training'?(engine.legalActions(1).some(a=>a.type==='block')?{type:'block',uids:[]}:chooseAI(engine.view(1),catalog)):OverdriveDesktopAI(engine.view(1), catalog, $('aiDifficulty').value, $('opponent').value.split(':')[1]); if (!action) { $('actionError').textContent = 'A IA está sem ações disponíveis. Inicie outra partida.'; return; } if (execute(1, action)) schedule(); }, 350);
   return;
  }
  // Resolve bookkeeping and uncontested windows without asking the player to click through them.
  if (['cleanup', 'triggers'].includes(state.choice?.kind)) {
   timer = setTimeout(() => { if (execute(0, chooseAI(engine.view(0), catalog))) schedule(); }, 250); return;
  }
  const actions = engine.legalActions(0);
  if(state.choice?.kind==='revide'&&!actions.some(a=>['play','overdrive','fighterOverdrive'].includes(a.type))){timer=setTimeout(()=>{if(execute(0,{type:'declineRevide'}))schedule();},200);return;}
  if(!state.choice&&state.phase==='preparation'&&!state.preparedTurn&&!state.stack.length){timer=setTimeout(()=>{if(execute(0,{type:'pass'}))schedule();},200);return;}
  const emptyBlock=actions.find(a=>a.type==='block'&&!a.options.length);if(emptyBlock){timer=setTimeout(()=>{if(execute(0,{type:'block',uids:[]}))schedule();},200);return;}
  const hasResponse = responseActions(actions).length>0||actions.some(a=>['discardChoice','declineRevide','balanceDiscard'].includes(a.type));
  const procedural = !state.choice && (state.phase === 'end' || state.phase === 'preparation' && !state.preparedTurn || state.stack.length || state.combats.length || state.active === 1 || state.autoEnd || state.ending);
  if (!hasResponse && procedural && actions.some(a => a.type === 'pass')) timer = setTimeout(() => { if (execute(0, { type: 'pass' })) schedule(); }, 180);
 }
 function cardButton(card, classes = '', tag = '', faceDown = false, hiddenExtra = false) {
  if(card.token){faceDown=false;tag=card.name+' · ATQ '+card.power+' / BLOQ '+card.power;} const def = engine.def(card), actions = engine.legalActions(0);if(def.specialPermanent)tag='Permanente especial';
  const playable = actions.some(a => a.uid === card.uid || ['block','chooseEnergy','chooseOwnEnergy'].includes(a.type) && a.options.includes(card.uid));
  if(card.lockedUntil>=engine.s.turn)tag='Energia bloqueada';
  const selected = selectedBlocks.has(card.uid) || selectedEnergy.has(card.uid) || swapHand.has(card.uid) || swapEnergy.has(card.uid);
  return `<button class="card ${classes}${playable ? ' playable' : ''}${selected ? ' selected' : ''}" data-card="${card.uid}" aria-label="${escape(def.name)}${faceDown ? hiddenExtra ? ', preparada, virada para baixo; clique para consultar' : ', energia utilizada, virada para baixo' : ''}${selected ? ', selecionada' : ''}"><img src="${faceDown ? back : art(card.id,card)}" alt="${faceDown ? hiddenExtra ? 'Carta preparada — verso da carta' : 'Energia utilizada — verso da carta' : escape(def.name)}">${tag ? `<span class="tag">${escape(tag)}</span>` : ''}</button>`;
 }
 function playmatHud(side, label) {
  const sequence = engine.script(side.fighter).sequence;
  const tagAsset = { Blossom: 'original-9.png', Hanma: 'original-7.png', 'Len Yin': 'original-8.png', Boydd: 'original-10.png' }[engine.def(side.fighter).name];
  return `<div class="od-model" role="group" aria-label="Overdrive ${label}: ${side.od} de ${sequence.length}"><span>OVERDRIVE</span><div class="od-circles">${[1, 2, 3, 4].map(n => `<span class="od-circle${n <= side.od ? ' advanced' : ''}${n === side.od ? ' current' : ''}${n > sequence.length ? ' unused' : ''}" aria-label="${n > sequence.length ? 'Etapa não usada por este lutador' : `${n}ª etapa: ${sequence[n - 1]}${n <= side.od ? ', concluída' : ''}`}">${n}<small>${n <= sequence.length ? sequence[n - 1] : '—'}</small></span>`).join('')}</div></div><div class="life-model" role="meter" aria-label="Vida ${label}" aria-valuemin="0" aria-valuemax="${Math.max(20, side.hp)}" aria-valuenow="${Math.max(0, side.hp)}"><span class="life-caption">VIDA · ${side.hp}</span><div class="fight-life${side.hp <= 5 ? ' critical' : ''}"><div class="fight-life-fill" style="--hp:${Math.min(100, Math.max(0, side.hp / 20 * 100))}%"></div><strong>${Math.max(0, side.hp)} <small>/ 20</small></strong></div></div>${tagAsset?`<img class="fighter-tag" src="assets/${tagAsset}" alt="Tag de ${escape(engine.def(side.fighter).name)} — ${label}">`:`<strong class="fighter-name-tag">${escape(engine.def(side.fighter).name)}</strong>`}`;
 }
 function extraSlots(side, turn) {
  const cards = side.extra;
  // A token keeps its source slot reserved, but its single visible card moves to combat.
  const inArena=new Set([...(engine.s.completed||[]),...engine.s.combats].flatMap(c=>[c.uid,...c.blocks.map(b=>b.uid),...(c.tricks||[])]));
  const slot = index => {
   const card = cards.find((c, i) => (c.slot ?? i) === index);
   if(card?.token&&inArena.has(card.uid))return `<div class="extra-slot" data-extra-slot="${index}" aria-label="Zona Extra ${index + 1}, ficha na Arena"><span class="slot-label">EXTRA ${index + 1}</span><span class="token-in-arena">Na Arena</span></div>`;
   return `<div class="extra-slot" data-extra-slot="${index}" aria-label="Zona Extra ${index + 1}${card ? ', ocupada' : ', vazia'}"><span class="slot-label">EXTRA ${index + 1}</span>${card ? card.hidden ? `<img class="hidden-extra" data-motion-card="${card.uid}" src="${back}" alt="Carta preparada oculta da IA">` : cardButton(card, 'small', card.ready > turn ? 'Próximo turno' : card.r06Fixed ? 'Fixar · apenas Golpe' : 'Disponível', !card.public, !card.public) : ''}</div>`;
  };
  return `<div class="extra-heading">ZONA EXTRA · ${cards.length}/4</div>${slot(0)}${slot(1)}<div class="fighter-slot"><span class="slot-label">LUTADOR</span>${[...engine.s.completed,...engine.s.combats].some(c=>c.from==='fighter'&&c.uid===side.fighter.uid)?'<span class="fighter-attacking">Em combate</span>':cardButton(side.fighter, 'small' + (side.fighterTapped ? ' tapped' : ''), side.overdriveLocked ? 'OD bloqueado' : '')}</div>${slot(2)}${slot(3)}`;
 }
 function sharedArena(view) {
  const publicCards = view.players.flatMap(side => side.arena), byUid = new Map(publicCards.map(card => [card.uid, card]));
  for(const side of view.players)for(const card of side.extra)if(card.token)byUid.set(card.uid,card);
  for(const combat of [...(view.completed||[]),...view.combats])if(combat.from==='fighter')byUid.set(combat.uid,view.players[combat.p].fighter);
  for (const card of publicCards) if (!arenaOrder.has(card.uid)) arenaOrder.set(card.uid, ++arenaSequence);
  const used = new Set(), columns = [];
  for (const combat of [...(view.completed || []), ...view.combats].sort((a, b) => a.id - b.id)) {
   const attack = byUid.get(combat.uid); if (!attack) continue;
   used.add(attack.uid);
   const blockers = combat.blocks.map(block => byUid.get(block.uid)).filter(Boolean);
   blockers.forEach(card => used.add(card.uid));
   const tricks = (combat.tricks || []).map(uid => byUid.get(uid)).filter(Boolean); tricks.forEach(card => used.add(card.uid));
   columns.push(`<div class="combat-column" data-combat="${combat.id}"><span class="combat-caption">${combat.p === 0 ? 'Você' : 'IA'}${combat.responseRevide?' · resposta em Revide':combat.revide?' · bônus REVIDE':''}<br>Zona ${combat.zone} · ${combat.attack} ataque / ${combat.blockValue??(combat.blocks.filter(b => !b.cancelled).reduce((n, b) => n + (combat.ignoreBelowPower!==undefined&&b.value<combat.ignoreBelowPower?0:b.value), 0)+(combat.aggregateBlockBonus||0))} bloqueio</span><div class="combat-cards"><div class="combat-stack" style="--block-count:${blockers.length}"><div class="attack-card">${cardButton(attack, '', ['stamina','fighter'].includes(combat.from) ? 'Overdrive · '+combat.zone : 'Golpe · '+combat.zone)}</div>${blockers.map((card, i) => `<div class="block-card" style="--block-index:${i + 1}">${cardButton(card, '', 'Bloqueio')}</div>`).join('')}</div>${tricks.map(card => `<div class="successive-card">${cardButton(card, '', 'Truque')}</div>`).join('')}</div></div>`);
  }
  for (const card of publicCards.filter(c => !used.has(c.uid)).sort((a, b) => arenaOrder.get(a.uid) - arenaOrder.get(b.uid))) columns.push(`<div class="successive-card">${cardButton(card, '', engine.def(card).type)}</div>`);
  return columns.join('') || '<span class="zone-placeholder">Zona compartilhada · Golpes, bloqueios e respostas entram aqui na sequência do combate.</span>';
 }
 function fighterStats(side, label) {
  const def = engine.def(side.fighter);
  return `<img data-preview-card="${side.fighter.uid}" class="fighter-portrait" src="${OverdriveFighterPortrait(side.fighter.id)}" alt="${escape(def.name)}"><h2>${label} · ${escape(def.name)}</h2><div class="life">${side.hp} <small>vida</small><progress value="${Math.max(0, side.hp)}" max="20" aria-label="Vida ${label}"></progress></div><div class="od" aria-label="Overdrive: ${side.od} de 3">${[1, 2, 3].map(i => `<i class="${side.od >= i ? 'on' : ''}"></i>`).join('')}</div><p>OD ${side.od}/3 · Poder ${side.power}</p><p>${engine.script(side.fighter).sequence.join(' → ')}</p>`;
 }
 function actionLabel(action) {
 if(action.type==='mahaChoose')return (engine.s.choice?.kind==='maha:curseTarget'?'Amaldiçoar · ':'Escolher · ')+engine.def(engine.find(action.uid).card).name;
 if(action.type==='mahaOverdrive')return 'Overdrive · escolher Única do Adicional';
 if(action.type==='declinePsychic')return 'Não pagar · realizar sem efeito Psychic';
 if(action.type==='expansionPlacideSkill')return 'Virar Placide · pagar 1 energia e preparar o topo';
 if(action.type==='rivalsOverdrive'&&engine.def(engine.s.players[0].fighter).number===170)return 'Overdrive Duke · dobrar o bloqueio das Guardas neste turno';
 if(action.type==='play'&&action.mode==='guardStrike')return 'Gemite como Golpe · '+action.zone;
 if(action.type==='rivalsOverdrive')return 'Overdrive · inativar energias de um lutador até o fim do turno';
 if(action.type==='rivalsChoose'){
  const kind=engine.s.choice?.kind;
  if(kind==='rivals:05Declare')return 'Declarar · '+action.option;
  if(kind==='rivals:05CopyBuff')return action.option==='attack'?'Bônus ao próximo Golpe':'Bônus ao próximo bloqueio';
  if(action.target!==undefined&&(kind?.startsWith('rivals:05')||kind?.startsWith('rivals:06')))return action.target===0?'Escolher seu lutador':'Escolher lutador adversário';
  if(action.option==='done')return 'Concluir seleção';
  if(action.option==='troca')return 'Troca · substituir este Truque por uma Ação na Estamina';
  if(action.option==='effect')return 'Efeito da Ação · comprar 1 e descartar 1';
  if(action.target!==undefined&&engine.s.choice?.kind==='rivals:odTarget')return action.target===0?'Inativar suas energias':'Inativar energias do adversário';
  if(action.target!==undefined)return action.target===0?'Seu lutador · próximo Golpe custa +1':'Adversário · próximo Golpe custa +1';
  const loc=engine.find(action.uid);return loc?.card.hidden?'Escolher Zona Extra '+(loc.card.slot+1):'Escolher · '+(loc?engine.def(loc.card).name:'carta');
 }
 if(action.type==='expansionChoose')return action.option==='done'?'Concluir seleção':action.option==='recover'?'Recuperar PuppyPunch do Descarte':action.option==='send'?'Enviar PuppyPunch do baralho ao Descarte':'Escolher · '+engine.def(engine.find(action.uid).card).name;
 if(action.type==='expansionReveal')return 'Arcturus · 1 energia verde + virar e revelar Golpes';if(action.type==='expansionMournerSkill')return 'Mourner · virar para buscar (sem custo de energia)';if(action.type==='expansionMournerOD')return 'Mourner · Overdrive (Fluxo não pode ser bloqueado)';if(action.type==='expansionExcalium')return 'Excalium · banir e revelar (sem custo de energia)';
 if(action.type==='balanceDiscard')return 'Efeito do Descarte · pagar 1 energia '+(engine.def(engine.find(action.uid).card).color||'').toLowerCase()+' ativa';if(action.type==='balanceDeclare')return 'Declarar '+action.cardType;if(action.type==='balanceTarget')return 'Escolher '+(action.target?'lutador adversário':'seu lutador');if(action.type==='balanceChoose')return (engine.s.choice?.kind==='balanceScry'?'Próxima carta do topo · ':'Escolher · ')+engine.def(engine.find(action.uid).card).name;if(action.type==='balanceSkip')return 'Continuar · nenhuma energia ativa disponível';
if(action.type==='remainingChoose'){if(action.declare)return 'Declarar '+action.value+(action.zone?' · '+action.zone:'');if(typeof action.use==='boolean')return action.use?'Pagar 1 energia · usar efeito':'Não pagar · encerrar efeito';if(action.target!==undefined)return 'Contador no lutador '+(action.target===0?'seu':'adversário');const c=engine.find(action.uid)?.card,n=c?engine.def(c).name:'carta';return action.mode==='buy'?'Comprar · '+n:action.mode==='swap'?'Estâmina · '+n+' / devolver '+engine.def(engine.find(action.energyUid).card).name:'Escolher · '+n;}
 if(action.type==='chooseGalacstrix')return action.use?'Galacstrix · pagar energia e criar ficha':'Galacstrix · não criar ficha'; if(action.type==='choosePsychicCost')return 'Custo Psychic · descartar '+engine.def(engine.find(action.uid).card).name;if(action.type==='declarePsychicType')return 'Declarar '+action.cardType;if(action.type==='acknowledgePsychic')return 'Confirmar · ocultar carta'; if(action.blockTarget)return 'Jogar · aumentar bloqueio de '+engine.def(engine.find(action.blockTarget).card).name; if(action.type==='chooseNamedCard')return 'Escolher · '+engine.def(engine.find(action.uid).card).name; if(action.type==='chooseSpiritCard')return 'Sorte de Espírito · comprar '+engine.def(engine.find(action.uid).card).name; if(action.type==='chooseSharvatZone')return 'Sharvat · Zona '+action.zone; if(action.type==='selectFlowCard')return 'Buscar Fluir · '+engine.def(engine.find(action.uid).card).name; if(action.type==='chooseHonored')return action.uid?'Defesa Honrada · banir '+engine.def(engine.find(action.uid).card).name:'Defesa Honrada · não banir'; if(action.type==='chooseAscension')return action.uid?'Ascensão · destruir '+engine.def(engine.find(action.uid).card).name:'Ascensão · não destruir'; if(action.type==='selectExtraEffect'){const target=engine.find(action.uid);return 'Destruir · '+(target.p===0?'Sua Zona Extra ':'Zona Extra adversária ')+(target.card.slot+1);}if(action.type==='selectExtraGuard')return 'Colocar na Zona Extra · '+engine.def(engine.find(action.uid).card).name; if(action.type==='chooseGuardDiscard')return 'Custo adicional · descartar '+engine.def(engine.find(action.uid).card).name; if(action.type==='chooseSuruya')return action.uid?'Descartar '+engine.def(engine.find(action.uid).card).name+' · bloqueio +1':'Suruya · não descartar';if(action.option)return action.option==='attack'?'Jogar · próximo Golpe +2':'Jogar · próximo bloqueio +2';if(action.type==='selectSearchCard')return 'Buscar Guarda · '+engine.def(engine.find(action.uid).card).name;if(action.type==='desvio')return 'Desvio · descartar com '+engine.def(engine.find(action.golpeUid).card).name;if(action.type==='fighterSkill')return engine.def(engine.s.players[0].fighter).number===70?'Virar Len Yin · 1 energia (bloqueia OD)':'Virar Boydd · 1 energia (bloqueia OD)';if(action.type==='fighterOverdrive')return 'Overdrive · '+action.zone;if(action.type==='tokenAttack')return 'Atacar com ficha · '+action.zone+(/^Galacstrix\b/i.test(engine.find(action.uid)?.card.name||'')?' · 1 energia':'');
  const name = action.uid ? engine.def(engine.find(action.uid).card).name : '';
  return { play: `${engine.s.choice?.kind === 'revide' ? 'Revide' : 'Jogar'} · ${action.mode==='banishCopy'?'Descarte · banir outra Frenecticale':action.mode==='puppy'?'alternativo · retornar PuppyPunch (sem energia)':action.mode==='life'?'Descarte · pagar '+engine.def(engine.find(action.uid).card).cost+' de vida':action.mode === 'alternative' ? 'custo alternativo' : 'custo normal'}${engine.script(engine.find(action.uid)?.card || { id: 'OF-C1-089' }).variable ? ` · X=${action.x}` : ''}`, prepare: 'Preparar na Zona Extra', overdrive: 'Ativar Overdrive', discardChoice: 'Descartar esta carta', finta: 'Finta · descartar esta carta e a Guarda correspondente', startSkill: 'Blossom · pagar 1 energia e virar para comprar 1', pass: engine.s.phase === 'preparation' ? 'Concluir preparo' : 'Sem resposta / continuar', end: 'Encerrar turno', declineRevide: 'Não revidar', replenish: `Repor ${action.n} carta${action.n > 1 ? 's' : ''}`, mulligan: 'Manter esta mão' }[action.type] || name;
 }
 function addAction(container, text, action, primary = false) {
  const button = document.createElement('button'); button.textContent = text; if (primary) button.className = 'primary';
  const location=action.uid&&engine.find(action.uid);
  if(engine.s.choice?.player===0&&location&&(location.p===0&&location.z==='deck'||['mahaChoose','expansionChoose','rivalsChoose'].includes(action.type))){
   button.classList.add('search-card');if(!location.card.hidden)button.dataset.previewCard=action.uid;button.setAttribute('aria-label',text);
   const img=document.createElement('img');img.src=location.card.hidden?back:art(location.card.id,location.card);img.alt=engine.def(location.card).name;
   const caption=document.createElement('span');caption.textContent=text;button.replaceChildren(img,caption);
  }
  button.onclick = () => { if ($('cardDialog').open) $('cardDialog').close(); if (['selectExtraGuard'].includes(action.type)||action.type==='remainingChoose'&&engine.s.choice?.kind==='fervorPick') beginPlacement(action); else human(action); }; container.append(button);
 }
 function render() {
  hideHover();
  const view = engine.view(0), own = view.players[0], enemy = view.players[1], actions = view.actions;
  $('turnLabel').textContent = `TURNO ${view.turn} / ${view.active === 0 ? 'SEU ATAQUE' : 'ATAQUE DA IA'}`;
  $('phaseLabel').textContent = phases[view.phase];
  const decision = view.phase === 'mulligan' ? (engine.s.players[0].mulligan ? 1 : 0) : (view.choice?.player ?? view.priority);
  $('gameStatus').textContent = view.winner !== null ? (view.winner === 0 ? 'Você venceu! Que tal uma nova partida?' : 'A IA venceu. Tente uma nova estratégia!') : decision === 1 ? 'A IA está pensando…' : view.choice?.kind === 'revide' ? `A IA utilizou ${view.choice.cause?.energyUids.length || 0} estâmina(s) inativa(s) sua(s). Você pode revidar com um Golpe ou recusar.` : 'Sua decisão. Clique nas cartas para ver as ações.';
  $('playerStats').innerHTML = fighterStats(own, 'Você'); $('enemyStats').innerHTML = fighterStats(enemy, 'IA');
  $('enemyHand').innerHTML = (enemy.revealedHand||[]).map(c=>'<img data-motion-card="'+c.uid+'" src="'+art(c.id)+'" alt="Carta revelada: '+escape(engine.def(c).name)+'">').join('')+Array.from({length:Math.max(0,enemy.handCount-(enemy.revealedHand||[]).length)},()=>'<img src="'+back+'" alt="Carta oculta do adversário">').join('');
  for (const [prefix, side] of [['own', own], ['enemy', enemy]]) {
   $(prefix + 'Energy').innerHTML = `<span>ESTÂMINA ${side.stamina.filter(c => c.active).length}/${side.stamina.length}</span>` + side.stamina.map(c => cardButton(c, 'energy' + (c.active ? '' : ' inactive'), '', !c.active)).join('');
   $(prefix + 'Extra').innerHTML = extraSlots(side, view.turn);
   $(prefix + 'Hud').innerHTML = playmatHud(side, prefix === 'own' ? 'Você' : 'IA');
   const deckCount=Math.max(0,side.deckCount),layers=Math.min(4,deckCount),depth=deckCount>1?Math.min(12,2+deckCount*.25):0;
   $(prefix + 'Deck').dataset.deckCount=deckCount;
   $(prefix + 'Deck').innerHTML = (layers?`<span class="deck-stack" style="--deck-depth:${depth}px">${Array.from({length:layers-1},(_,i)=>`<img class="deck-layer" style="--deck-layer:${i+1}" src="${back}" alt="" aria-hidden="true">`).join('')}<img class="deck-top" src="${back}" alt="Verso do baralho"></span>`:'<span class="deck-empty">Vazio</span>')+`<span class="pile-label">Baralho · <strong>${deckCount}</strong></span>`;
   const topDiscard = side.discard.at(-1);
   $(prefix + 'Discard').innerHTML = `${topDiscard ? `<img class="discard-top" src="${art(topDiscard.id)}" alt="Última carta descartada: ${escape(engine.def(topDiscard).name)}">` : ''}<span class="pile-label">Descarte · <strong>${side.discard.length}</strong><br>Banidas: ${side.banished.length}</span>`;
  }
  $('sharedArena').innerHTML = sharedArena(view);
  $('ownHand').innerHTML = own.hand.map(c => cardButton(c)).join('') || '<span class="zone-placeholder">Sua mão está vazia. Use Repor quando disponível.</span>';
  $('handCount').textContent = `${own.handCount} cartas`;
  const combat = view.combats.at(-1);
  $('combatInfo').textContent = combat ? `${combat.p === 0 ? 'Você ataca' : 'IA ataca'} · ${engine.def(engine.find(combat.uid).card).name} · ${combat.zone} · Ataque ${combat.attack} · Bloqueio ${combat.blocks.filter(b => !b.cancelled).reduce((n, b) => n + b.value, 0)}${combat.responseRevide?' · resposta em Revide':combat.revide?' · bônus REVIDE':''}` : view.completed?.length ? 'Combate resolvido. Os golpes permanecem na Arena até encerrar a sequência. Jogue outro Golpe ou encerre o turno.' : 'Selecione um Golpe para começar um combate. Custos e dano são automáticos.';
  const controls = $('actionButtons'); controls.replaceChildren();
  if (view.phase === 'mulligan' && !engine.s.players[0].mulligan) {
   $('decisionHint').textContent = 'Mulligan: mantenha a mão ou selecione até 2 cartas da mão e o mesmo número de energias para trocar.';
   addAction(controls, 'Manter mão e começar', { type: 'mulligan', hand: [], energy: [] }, true);
   if (swapHand.size && swapHand.size === swapEnergy.size) addAction(controls, 'Trocar cartas selecionadas', { type: 'mulligan', hand: [...swapHand], energy: [...swapEnergy] });
  } else {
   const energy=actions.find(a=>['chooseEnergy','chooseOwnEnergy'].includes(a.type));
   if(energy){$('decisionHint').textContent=energy.type==='chooseOwnEnergy'?'Selecione '+energy.required+' energia(s) ativa(s) na sua Estamina para pagar o custo.':'Selecione '+energy.required+' energia(s) inativa(s) na sua Estamina para reativar pelo custo adversário.';addAction(controls,'Confirmar energias · '+selectedEnergy.size+'/'+energy.required,{type:energy.type,uids:[...selectedEnergy]},true);controls.lastElementChild.disabled=selectedEnergy.size!==energy.required;}
   const block = actions.find(a => a.type === 'block');
   const finalHints={'maha:curseTarget':'Zeno-O-Oni · escolha o Lutador que receberá 1 marcador Amaldiçoado no começo do seu turno. Depois, resolve-se o dano por marcadores deste início de turno.','maha:protection':'Primeira remoção do demônio: escolha 1 energia ativa ou inativa para devolver ao fundo do seu Baralho. Proteção uma vez por partida.','maha:overdrive':'Escolha uma Única do Adicional para entrar na Zona Extra. Passe o mouse sobre a carta para ampliar.','maha:troca':'Escolha uma Ação da Estâmina para devolver à mão; Kashigatama! ocupa seu lugar.','maha:search':'Escolha a carta para adicionar à mão.',balanceScry:'Olhe as três cartas observadas. Selecione uma por vez, começando pela que ficará no topo.',balancePsychic09:'Declare o tipo da carta do topo do seu baralho. Não há descarte nem compra neste efeito.',psychicCost:'Efeito Psychic opcional: descarte outra carta Psychic para ativá-lo, ou escolha Não pagar para realizar a carta sem esse efeito.',bloomCost:'Florescer Sinistro: descarte outra carta da mão como custo adicional.',bloomPick:'Escolha uma ação do baralho para entrar na Estâmina inativa.',bloomReturn:'Escolha uma energia que já estava na Estâmina para devolver à mão.',ghostPick:'Dança Fantasma: compre uma das cartas com Fluir observadas ou troque-a por uma energia ativa, devolvida à mão.',mapvtaDeclare:'Entre Olhares: declare o tipo e a Zona do Golpe. É preciso acertar ambos.',fervorPick:'Fervor Protetor: escolha uma Guarda revelada para a Zona Extra, utilizável neste turno.',darsPay:'Você pode pagar 1 energia ativa para usar o efeito Darsmagius.',darsPick:'Escolha a carta Darsmagius para o efeito.',darsTarget:'Escolha o lutador que receberá o contador.'};
if(!energy)$('decisionHint').textContent = finalHints[view.choice?.kind] || (view.choice?.kind === 'extraEffect' ? 'Escolha '+(view.choice.remaining||1)+' carta(s) nas Zonas Extras indicadas para destruir.' : view.choice?.kind === 'revide' ? 'Revide disponível porque a IA utilizou sua estâmina inativa para pagar um custo. Escolha um Golpe ou Não revidar.' : block ? `Defenda-se: clique nas cartas da mão ou da Zona Extra para selecionar bloqueadores (${selectedBlocks.size} selecionados).` : view.winner !== null ? 'Partida concluída. As ações e resultados estão no registro.' : decision === 1 ? 'Aguarde a jogada da IA.' : 'Cartas com borda azul têm ações disponíveis. Clique para escolher a jogada.');
   if (block) {
    if (selectedBlocks.size) addAction(controls, 'Confirmar bloqueio', { type: 'block', uids: [...selectedBlocks] }, true);
    addAction(controls, 'Receber golpe', { type: 'block', uids: [] });
   }
   for (const a of actions.filter(a => [ 'mahaChoose','mahaOverdrive','declinePsychic','balanceDeclare','balanceTarget','balanceChoose','balanceSkip','declineRevide', 'selectSearchCard', 'chooseSuruya', 'chooseGuardDiscard', 'discardChoice', 'selectExtraEffect', 'selectExtraGuard', 'chooseAscension', 'chooseHonored', 'selectFlowCard', 'chooseSharvatZone', 'chooseSpiritCard', 'chooseNamedCard', 'choosePsychicCost', 'declarePsychicType', 'acknowledgePsychic', 'chooseGalacstrix', 'remainingChoose','expansionChoose','rivalsChoose'].includes(a.type))) addAction(controls, actionLabel(a), a, a.type === 'end' || a.type === 'declineRevide');
  }
  if(view.revealedCards?.length)for(const c of view.revealedCards){const img=document.createElement('img');img.src=art(c.id);img.alt='Carta revelada por Psychic';img.style.cssText='width:120px;max-height:170px;object-fit:contain';controls.appendChild(img);}
  if(view.choice?.kind==='psychicReveal'&&view.choice.player===0&&!view.revealedCards?.length){const c=engine.find(view.choice.uids[0])?.card;if(c){const img=document.createElement('img');img.src=art(c.id);img.alt='Carta revelada por Psychic';img.style.cssText='width:120px;max-height:170px;object-fit:contain';controls.appendChild(img);}}
  const searching=!!controls.querySelector('.search-card');controls.classList.toggle('search-card-grid',searching);decisionHud.classList.toggle('search-hud',searching);
  if(searching)$('decisionHint').textContent='Estas são as cartas disponíveis para este efeito. Selecione a carta que deseja buscar.';
  if(view.choice?.kind?.startsWith('expansion:')){const hints={'expansion:greenCost':'Arcturus: selecione 1 energia verde ativa. O lutador será virado e o adversário poderá responder.','expansion:quadraPick':'Escolha até 2 Ações. Concluir seleção permite parar antes de duas; as cartas não poderão ser ativadas neste turno.','expansion:mission':'Escolha recuperar uma Ação PuppyPunch ou enviar uma do baralho ao Descarte.','expansion:deliciasBanish':'Selecione quantas cartas deseja banir (até a quantidade disponível no Descarte adversário) e conclua.','expansion:enemyReturn':'Escolha as cartas do Descarte adversário que retornarão ao baralho dele.','expansion:troca':'Troca: selecione a Ação na sua Estamina para devolver à mão. Escapatória ocupará seu lugar, mantendo o estado de energia.','expansion:extraCost':'Custo adicional: escolha '+(view.choice.remaining||view.choice.required)+' carta(s) da Zona Extra para o fundo do baralho. Recarga considera apenas retornos anteriores a este custo.','expansion:puppyCost':'Custo alternativo: retorne uma Ação PuppyPunch do Descarte ao baralho, sem pagar energias.','expansion:revealMany':'Revele os Golpes desejados. Ao terminar, clique em Concluir seleção. Cada carta concede +1 ATQ ao próximo Golpe.','expansion:flowReturn':'Escolha as cartas com Fluxo que deseja devolver ao baralho e conclua a seleção.','expansion:placideOD':'Escolha as cartas da Zona Extra que deseja devolver ao baralho e conclua para atacar.','expansion:quadraDiscard':'Quadra!: escolha uma Ação da mão para descartar. Depois, escolha até duas Ações do baralho para preparar viradas para baixo.', 'expansion:reactivate':'Rynhard: escolha 1 energia inativa para reativar.','expansion:revealOne':'Escolha uma carta da mão para revelar ao adversário.'};$('decisionHint').textContent=hints[view.choice.kind]||'Escolha a carta para resolver o efeito.';}
  if(view.choice?.kind.startsWith('rivals:')){
   const hints={'06Start':'Duke: escolha 1 Guarda do seu baralho para começar preparada na Zona Extra.','06Search':'Fixar: escolha uma Guarda Gemite para buscar.','06Extras':'Escolha as cartas das Zonas Extras que retornarão ao baralho.','06Target':'Escolha o lutador cujas energias serão inativadas.','06Energy':'Escolha 2 energias ativas do alvo, ou todas as disponíveis se houver menos.','05Discard':'Escolha 2 cartas da mão para descartar; depois reative uma energia.','05Reactivate':'Escolha uma energia inativa sua para reativar.','05Energy':'Escolha uma energia sua para devolver à mão.','05ExtraTarget':'Escolha o dono da Zona Extra da qual deseja devolver até 3 cartas.','05Extras':'Escolha até 3 cartas para retornar ao baralho do dono; você pode concluir antes.','05Copy':'Escolha a Ação para banir e copiar o texto. Simulacro permanece Truque.','05AuraTarget':'Escolha o lutador. Compre uma carta por energia inativa dele; a quantidade será somada ao custo da sua próxima Ação.','05Declare':'Declare Golpe, Guarda ou Truque antes de revelar o topo do seu baralho.','05PrisonTarget':'Declaração correta: escolha o lutador cuja energia ficará inativa.','05PrisonEnergy':'Escolha a energia que ficará inativa até o começo do seu próximo turno.','05CopyBuff':'Escolha o bônus do efeito copiado.','05CopyBlock':'Escolha o bloqueador alvo do efeito copiado.',odTarget:'Overdrive: escolha o lutador cujas energias serão inativadas até o fim do turno.',odFreeze:'Escolha as energias ativas do alvo. Elas voltam a ficar ativas ao fim do turno.',trocaMode:'Escolha apenas um efeito: Troca OU comprar 1 carta e descartar 1 carta.',search:'Escolha uma Ação para buscar ou preparar.',top:'Escolha uma das cartas observadas. As restantes irão para o fundo na ordem observada.',troca:'Troca: a Ação vai para a mão; este Truque ocupa seu lugar na Estamina.',discard:'Escolha as cartas que deseja descartar.',extra:'Escolha as Zonas Extras. Cartas ocultas do adversário continuam ocultas.',freeze:'Escolha uma energia adversária ativa para inativar.',reactivate:'Escolha uma energia sua inativa para reativar.',tax:'Escolha o lutador cujo próximo Golpe custará +1.'};
   $('decisionHint').textContent=hints[view.choice.kind.slice(7)]||'Resolva o efeito da carta.';
  }
  $('gameLog').innerHTML = [...view.log].reverse().slice(0, 100).map(item => `<li>${escape(item.text)}</li>`).join('');
  renderInteraction(view);
  dispatchEvent(new CustomEvent('of-game-render',{detail:view}));
 }
 function inspectCard(uid) {
  const location = engine.find(uid); if (!location) return;
  const def = engine.def(location.card), actions = window.OverdriveSession?.isReplay?[]:engine.legalActions(0);
  if (engine.s.phase === 'mulligan' && location.p === 0 && ['hand', 'stamina'].includes(location.z)) {
   const selection = location.z === 'hand' ? swapHand : swapEnergy;
   if (selection.has(uid)) selection.delete(uid); else if (selection.size < 2) selection.add(uid);
   render(); return;
  }
  const block = actions.find(a => a.type === 'block');
  
  $('cardArt').src = art(def.id,location.card); $('cardArt').alt = def.name; $('cardTitle').textContent = def.name;
  $('cardInfo').textContent = `${def.type} · Custo ${engine.script(location.card).energyFree?0:def.cost ?? '—'} · ${def.zone || def.color}. ${engine.script(location.card).errata||def.searchText || ''}`;
  $('cardActions').replaceChildren();
  if (location.p === 0) for (const action of actions.filter(a => a.uid === uid)) {
   if (action.type === 'prepare') {
    const occupied = engine.s.players[0].extra.map(c => c.slot);
    addPrepareAction($('cardActions'),action);
   } else addAction($('cardActions'), actionLabel(action), action, action.type === 'play' || action.type === 'overdrive');
  }
  if (location.p === 0 && def.type === 'Lutador' && def.number===89) {
   $('cardInfo').textContent = 'Blossom: vire o lutador para comprar 1 carta em um estado aberto do seu turno. Isso impede Overdrive neste turno. Overdrive: jogue um Golpe ativo da Estâmina sem pagar custos, com o bônus de Poder; depois ele vai ao descarte.';
   for (const action of actions.filter(a => a.type === 'overdrive')) addAction($('cardActions'), `Ativar Overdrive · ${engine.def(engine.find(action.uid).card).name}`, action, true);
  }
  if (!$('cardActions').childElementCount) $('cardActions').textContent = window.OverdriveSession?.isReplay?'Reprodução de partida: use os controles do replay.':window.OverdriveSession?.paused?'Partida pausada: retome para agir.':(engine.explainCard?.(0,uid)||['Esta carta não tem ações disponíveis nesta janela.']).join(' ');
  clearTimeout(timer); $('cardDialog').showModal();
 }
 $('game').addEventListener('click', event => { const card = event.target.closest('[data-card]'); if (card && $('tutorial').hidden) openCard(card.dataset.card,card); });
 $('closeCard').onclick = () => $('cardDialog').close(); $('cardDialog').addEventListener('close', schedule);
 function openPile(player) {
  const side = engine.view(0).players[player]; $('pileTitle').textContent = (player ? 'Descarte da IA' : 'Seu descarte')+' · '+side.discard.length+' cartas';
  $('pileCards').innerHTML = (side.discard.map(c => cardButton(c)).join('') || '<p>O descarte está vazio.</p>')+(side.banished.length?'<h3 class="pile-section">Banidas · '+side.banished.length+'</h3>'+side.banished.map(c=>cardButton(c)).join(''):'');
  clearTimeout(timer); $('pileDialog').showModal();
 }
 $('pileCards').onclick=event=>{const c=event.target.closest('[data-card]');if(c){$('pileDialog').close();openCard(c.dataset.card,c);}};
 $('ownDiscard').onclick = () => pileMenu(0,$('ownDiscard')); $('enemyDiscard').onclick = () => pileMenu(1,$('enemyDiscard'));
 $('ownDeck').onclick=()=>pileMenu(0,$('ownDeck'));$('enemyDeck').onclick=()=>pileMenu(1,$('enemyDeck'));
 $('closePile').onclick = () => $('pileDialog').close(); $('pileDialog').addEventListener('close',()=>{hideHover();schedule();});
 function reset() { stopMotion();selectedEnergy.clear();clearTimeout(timer); closeMenu(false);pendingPlacement=null;responseAccepted=null;decisionHud.hidden=responseHud.hidden=turnTools.hidden=fieldNotice.hidden=true;document.body.classList.remove('duel-active'); engine = new Engine(catalog); $('game').hidden = true; $('setup').hidden = false; $('actionError').textContent = ''; $('startGame').focus(); }
 $('newGame').onclick = () => { if (!engine?.s || engine.s.winner !== null) reset(); else { clearTimeout(timer); $('confirmNew').showModal(); } };
 $('cancelNew').onclick = () => $('confirmNew').close(); $('confirmNew').addEventListener('close', schedule);
 $('confirmNewButton').onclick = () => { $('confirmNew').close(); reset(); };
 const modeLabel=document.createElement('label');modeLabel.innerHTML='Modo de jogo<select id="gameMode"><option value="deathmatch">Deathmatch · 7 energias</option><option value="advanced">Advanced · 5 energias</option><option value="prime">Prime · 2 energias</option><option value="standard" selected>Standard · 3 energias</option></select>';$('startingPlayer').closest('label').before(modeLabel);
 $('startGame').onclick = () => {
  try {
   window.OverdriveSession?.beginNormal();
   stopMotion();selectedEnergy.clear();const selected = arenaDeckOverride||decks[Number($('playerDeck').value)]; engine = new Engine(catalog); engine.validateDeck(selected);
   const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
   const opponent=OverdriveOpponentDeck(engine,$('opponent').value); engine.start(selected,opponent, $('startingPlayer').value === 'random' ? seed % 2 : Number($('startingPlayer').value), seed, $('gameMode').value);
   pendingPlacement=null;responseAccepted=null;closeMenu(false);selectedBlocks.clear(); swapHand.clear(); swapEnergy.clear(); arenaOrder.clear(); arenaSequence = 0; $('setup').hidden = true; $('game').hidden = false; dispatchEvent(new CustomEvent('of-duel-start',{detail:{id:'local:'+seed}}));render();
   animateMovements(new Map(),true);if ($('showTutorial').checked) beginTutorial(); else schedule();
  } catch (error) { $('deckCompatibility').textContent = error.message; }
 };
 $('playerDeck').onchange = () => { arenaDeckOverride=null;if(!decks.length){$('deckCompatibility').textContent='Crie e salve um baralho no editor para jogar.';$('startGame').disabled=true;return;}try { engine.validateDeck(decks[Number($('playerDeck').value)]); $('deckCompatibility').textContent = 'Lista compatível com a Arena automatizada.'; $('startGame').disabled = false; } catch (error) { $('deckCompatibility').textContent = error.message; $('startGame').disabled = true; } };
 window.OverdriveArena={engine:()=>engine,catalog:()=>catalog,selectedDeck:()=>structuredClone(arenaDeckOverride||decks[Number($('playerDeck').value)]),setDeckOverride:deck=>{arenaDeckOverride=structuredClone(deck);engine.validateDeck(arenaDeckOverride);$('startGame').disabled=false;},selectedBlocks:()=>[...selectedBlocks],human,render,schedule,pause:()=>clearTimeout(timer),response:endResponse,load:next=>{const newDuel=engine!==next||$('game').hidden;clearTimeout(timer);stopMotion();closeMenu(false);pendingPlacement=null;responseAccepted=null;selectedBlocks.clear();selectedEnergy.clear();swapHand.clear();swapEnergy.clear();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();$('tutorial').hidden=true;engine=next;$('game').hidden=false;$('setup').hidden=true;arenaOrder.clear();arenaSequence=0;if(newDuel)dispatchEvent(new CustomEvent('of-duel-start',{detail:{id:next.remote?next:next.initial?.seed}}));render();schedule();}};
 window.OverdriveArena.receiveRemote=(next,game,{animate=false,opening=false}={})=>{
  if(!animate)dispatchEvent(new Event('of-remote-resync'));
  const same=engine===next,revision=engine?.s?.revision;
  if(same&&revision===game.view.revision){next.update(game);render();schedule();return;}
  stopMotion();const before=same&&animate?motionSnapshot():new Map();
  next.update(game);window.OverdriveArena.load(next);
  if(animate)animateMovements(before,opening);
 };
 // Reload the same library used by the editor without discarding the current selection.
 const deckKey=d=>JSON.stringify([d?.name,d?.fighter,...['main','extra'].map(z=>Object.entries(d?.[z]||{}).sort(([a],[b])=>a.localeCompare(b)))]);
 function refreshDecks(preferred){
  if(!catalog||engine?.s)return;
  const previous=preferred||decks[Number($('playerDeck').value)];
  const candidates=[];let active;
  for(const key of ['overdrive-saved-decks-v1'])try{
   const data=JSON.parse(localStorage.getItem(key)||'null');
   if(key==='overdrive-saved-decks-v1'&&Array.isArray(data))for(const entry of data){if(entry?.deck)candidates.push(entry.deck);if(entry?.id===localStorage.getItem('overdrive-active-deck-v1'))active=entry.deck;}
   else if(key==='overdrive-collection-1-deck-v2'&&data)candidates.push(data);
  }catch{/* A malformed storage entry must not hide the remaining decks. */}
  const seen=new Set();decks=candidates.filter(d=>d&&typeof d.name==='string'&&typeof d.fighter==='string'&&d.main&&typeof d.main==='object'&&!Array.isArray(d.main)).map(d=>({...d,extra:d.extra||{}})).filter(d=>{const key=deckKey(d);if(seen.has(key))return false;seen.add(key);return true;});
  $('playerDeck').innerHTML=decks.map((deck,i)=>`<option value="${i}" data-fighter="${escape(deck.fighter)}">${escape(deck.name||'Baralho salvo')}</option>`).join('');
  const selected=decks.findIndex(d=>deckKey(d)===deckKey(previous||active));$('playerDeck').value=String(selected<0?0:selected);$('playerDeck').dispatchEvent(new Event('change'));
 }
 window.OverdriveArena.refreshDecks=refreshDecks;
 fetch('arena-core/catalog.json').then(response => { if (!response.ok) throw Error('Não foi possível carregar as cartas.'); return response.json(); }).then(data => {
  catalog = data; engine = new Engine(catalog);refreshDecks();
  $('supportedCards').textContent = catalog.filter(c => engine.supported(c.id)).map(c => c.name).join(' · ');
  $('playerDeck').onchange();
  dispatchEvent(new Event('of-arena-ready'));
 }).catch(error => { $('loadError').textContent = error.message + ' Atualize a página para tentar novamente.'; $('startGame').disabled = true; });
})();











