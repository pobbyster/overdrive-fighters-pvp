(()=>{'use strict';
const api=OverdriveArena,$=id=>document.getElementById(id);
const dialog=document.createElement('dialog');dialog.id='actionPreview';dialog.setAttribute('aria-labelledby','actionPreviewTitle');
dialog.innerHTML='<h2 id="actionPreviewTitle">Confirmar jogada</h2><div class="preview-content"><img id="previewActionArt" alt=""><div><h3 id="previewActionName"></h3><p id="previewActionCost"></p><p id="previewActionZone"></p><p id="previewActionEffect"></p><p class="preview-note">Custos adicionais e escolhas serão solicitados em seguida. O adversário poderá responder; o resultado ainda pode mudar.</p></div></div><div class="preview-buttons"><button id="cancelAction">✕</button><button id="confirmAction" class="primary">✓</button></div>';
document.body.append(dialog);let pending=null;
dialog.addEventListener('close',()=>{if(!dialog.open){pending=null;api.schedule();}});$('cancelAction').onclick=()=>{pending=null;dialog.close();};
$('confirmAction').onclick=()=>{const job=pending,e=api.engine();dialog.close();if(job&&e===job.engine&&e.s.revision===job.revision)job.commit();};
window.OverdriveConfirmAction=(action,commit)=>{
 if(!['play','overdrive','fighterOverdrive','fighterSkill','startSkill','balanceDiscard','prepare','replenish','block','expansionReveal','expansionMournerSkill','expansionPlacideSkill','expansionMournerOD','expansionExcalium','rivalsOverdrive'].includes(action.type))return false;
 $('cancelAction').setAttribute('aria-label','Não confirmar');$('confirmAction').setAttribute('aria-label','Confirmar jogada');
 const e=api.engine(),card=action.uid?e.find(action.uid)?.card:null,def=card&&e.def(card);let own=0,opp=0,life=0;
 try{if(action.type==='play'){const pay=e.payment(0,card,action.mode,action.x??0,action.zone);own=pay.own||0;opp=pay.opp||0;life=pay.life||0;}else if(['fighterSkill','startSkill','balanceDiscard','expansionPlacideSkill'].includes(action.type))own=1;else if(action.type==='replenish')own=action.n;else if(action.type==='block')opp=(action.uids||[]).reduce((n,uid)=>n+(e.def(e.find(uid).card).type==='Guarda'?e.guardCost(0,e.find(uid).card,(action.uids||[]).slice(0,(action.uids||[]).indexOf(uid)).filter(id=>e.def(e.find(id).card).type==='Guarda').length):0),0);}catch{return false;}
 $('previewActionName').textContent=def?.name||({block:'Confirmar bloqueio',replenish:'Repor '+action.n+' carta(s)',startSkill:'Habilidade de Blossom',fighterSkill:'Habilidade do lutador'}[action.type]||'Preparar carta');
 const img=$('previewActionArt');img.hidden=!card;if(card){img.src=card.token?'assets/FICHA.png':'assets/'+card.id+'.webp';img.alt=def.name;}
 $('previewActionCost').textContent='Custo: '+own+' energia(s) própria(s) ativa(s) · '+opp+' energia(s) adversária(s) inativa(s)'+(life?' · '+life+' de vida':'')+(['fighterSkill','startSkill','expansionPlacideSkill'].includes(action.type)?' · virar o lutador':'');
 $('previewActionZone').textContent=action.zone||def?.zone?'Zona: '+(action.zone||def.zone):action.type==='prepare'?'Destino: Zona Extra '+(action.slot+1):action.type==='block'?'Bloqueadores: '+(action.uids||[]).map(uid=>e.def(e.find(uid).card).name).join(', '):'Escolha suas energias no campo após confirmar.';
 $('previewActionEffect').textContent=def?.searchText||def?.text||def?.effect||(['overdrive','fighterOverdrive'].includes(action.type)?'Ativar Overdrive. O ataque será anunciado na Arena.':action.type==='prepare'?'A carta ficará preparada conforme as regras da Zona Extra.':'A jogada será anunciada na janela atual.');
 pending={engine:e,revision:e.s.revision,commit};api.pause();dialog.showModal();return true;
};
const feed=document.createElement('aside');feed.id='combatFeedback';feed.setAttribute('role','status');feed.setAttribute('aria-live','polite');document.body.append(feed);let baseline=null,engineRef=null,expiry;
function notice(message,kind=''){const row=document.createElement('p');row.className=kind;row.textContent=message;feed.append(row);while(feed.children.length>4)feed.firstElementChild.remove();clearTimeout(expiry);expiry=setTimeout(()=>feed.replaceChildren(),5500);}
addEventListener('of-game-render',()=>{const e=api.engine();if(!e?.s)return;const now={hp:e.s.players.map(p=>p.hp),completed:e.s.completed.map(c=>({id:c.id,p:c.p,cancelled:c.cancelled,basic:c.basicDamage||0,impetus:c.impetusDamage||0})),revide:e.s.choice?.kind==='revide'?e.s.choice.cause:null};
 if(e!==engineRef||OverdriveSession.isReplay){engineRef=e;baseline=now;feed.replaceChildren();return;}
 if(baseline){now.hp.forEach((hp,p)=>{const delta=hp-baseline.hp[p];if(delta)notice((p?'IA':'Você')+' · '+(delta>0?'+':'')+delta+' Vida',delta>0?'heal':'damage');});for(const c of now.completed.filter(c=>!baseline.completed.some(old=>old.id===c.id)))notice((c.p?'IA':'Você')+' · '+(c.cancelled?'Golpe cancelado':!c.basic&&!c.impetus?'Golpe bloqueado':c.basic+' dano básico'+(c.impetus?' + '+c.impetus+' Ímpeto':'')),'result');if(now.revide&&!baseline.revide)notice('REVIDE · escolha responder ou continuar','revide');}baseline=now;
});
addEventListener('of-game-render',event=>{
 const e=api.engine(),view=event.detail;if(!e?.s||!view)return;
 const response=$('responseHud');let context=$('responseContext');if(!context){context=document.createElement('p');context.id='responseContext';response.insertBefore(context,response.querySelector('.response-options'));}
 const combat=view.combats.at(-1),pendingEffect=view.stack.at(-1);
 const source=combat&&e.find(combat.uid)?.card;
 context.textContent=combat?'Ataque pendente: '+(source?e.def(source).name:'Ficha')+' · Zona '+combat.zone+' · '+combat.attack+' de ataque.':pendingEffect?'Efeito pendente: '+pendingEffect.label+'.':'Janela de resposta antes de continuar o turno.';
 const options=new Set(view.actions.filter(a=>['play','overdrive','fighterOverdrive','fighterSkill','startSkill','expansionReveal','expansionMournerSkill','expansionPlacideSkill','expansionMournerOD','expansionExcalium','rivalsOverdrive'].includes(a.type)).map(a=>a.uid||view.players[0].fighter.uid));
 const blocking=view.actions.find(a=>a.type==='block');for(const uid of blocking?.options||[])options.add(uid);
 if(options.size)context.textContent+=' '+options.size+' carta(s) com resposta disponível, destacadas no campo.';
 const hint=$('decisionHint'),choice=view.choice;
 if(choice?.player===0){
  if(['ownEnergy','energy'].includes(choice.kind)){const selected=document.querySelectorAll('#ownEnergy .card.selected').length;hint.textContent='Pagamento · '+selected+' de '+choice.required+' energia(s) selecionada(s). '+(choice.kind==='ownEnergy'?'Escolha energias ativas para virar.':'Escolha energias inativas para reativar.');}
  else if(choice.kind==='maha:curseTarget')hint.textContent='Zeno-O-Oni · escolha um Lutador para receber 1 marcador Amaldiçoado. O dano por marcadores será resolvido em seguida.';
  else if(choice.kind==='maha:overdrive')hint.textContent='Overdrive · escolha uma Única do Adicional. Passe o mouse para ampliar a carta.';
  else if(choice.kind==='maha:protection')hint.textContent='Proteção de MahaZeno · escolha 1 energia ativa ou inativa para devolver ao fundo do Baralho. Uma vez por partida.';
  else if(choice.kind==='extraEffect')hint.textContent='Alvos · faltam '+(choice.remaining||1)+' carta(s). Escolha uma das Zonas Extras destacadas.';
  else if(choice.kind==='balanceScry')hint.textContent='Olhe as três cartas observadas. Escolha a próxima carta do topo; depois ordene as restantes. Já escolhidas: '+(choice.selectedCount||0)+'.';
  else if(!choice.kind.startsWith('expansion:')&&!choice.kind.startsWith('rivals:')&&$('actionButtons').classList.contains('search-card-grid'))hint.textContent='Busca · escolha 1 carta entre as opções ilustradas. Apenas cartas válidas para este efeito estão disponíveis.';
  else if(choice.kind==='revide')context.textContent='REVIDE: o adversário usou suas energias inativas. Você pode anunciar um Golpe ou continuar sem revidar.';
 }else if(blocking){const n=api.selectedBlocks().length;hint.textContent='Bloqueio · '+n+' carta(s) selecionada(s). Clique nos bloqueadores destacados; confira o cálculo antes de confirmar.';}
 for(const el of document.querySelectorAll('#ownHand [data-card],#ownExtra [data-card]')){
  const uid=el.dataset.card,loc=e.find(uid);if(!loc||loc.p!==0)continue;
  const allowed=view.actions.some(a=>a.type!=='prepare'&&(a.uid===uid||Array.isArray(a.options)&&a.options.includes(uid)));
  const reasons=allowed||OverdriveSession.isReplay?[]:e.explainCard?.(0,uid)||[];
  if(reasons.length){el.dataset.unavailableReason=reasons.join(' ');el.classList.add('card-unavailable');el.title=reasons.join(' ');el.setAttribute('aria-label',el.getAttribute('aria-label')+' · '+reasons.join(' '));}
  else{delete el.dataset.unavailableReason;el.classList.remove('card-unavailable');el.removeAttribute('title');}
 }
});

const positionsKey='of-hud-positions-v1';let positions={};try{positions=JSON.parse(localStorage.getItem(positionsKey)||'{}');}catch{}
function savePositions(){try{localStorage.setItem(positionsKey,JSON.stringify(positions));}catch{}}
function positionHud(el,x,y){el.dataset.manualPosition='true';const r=el.getBoundingClientRect();x=Math.max(8,Math.min(x,innerWidth-r.width-8));y=Math.max(8,Math.min(y,innerHeight-Math.min(r.height,innerHeight-16)-8));el.style.position='fixed';el.style.left=x+'px';el.style.top=y+'px';el.style.right='auto';el.style.bottom='auto';el.style.transform='none';positions[el.id]={x,y};}
function bindHud(el){if(!el||el.querySelector(':scope > .hud-drag-handle'))return;const h=document.createElement('button');h.type='button';h.className='hud-drag-handle';h.textContent='⠿ Mover painel';h.title='Arraste para mover. Setas movem pelo teclado. Duplo clique restaura.';h.setAttribute('aria-label','Mover painel; use as setas ou arraste');el.prepend(h);if(positions[el.id]&&!el.hidden)positionHud(el,positions[el.id].x,positions[el.id].y);let drag=null;
 h.onpointerdown=event=>{if(event.button!==0)return;const r=el.getBoundingClientRect();drag={x:event.clientX-r.left,y:event.clientY-r.top};h.setPointerCapture(event.pointerId);event.preventDefault();};h.onpointermove=event=>{if(drag)positionHud(el,event.clientX-drag.x,event.clientY-drag.y);};h.onpointerup=()=>{drag=null;savePositions();};h.onpointercancel=()=>{drag=null;savePositions();};
 h.ondblclick=()=>{delete positions[el.id];delete el.dataset.manualPosition;savePositions();for(const key of ['position','left','top','right','bottom','transform'])el.style[key]='';dispatchEvent(new Event('of-arena-interaction'));};h.onkeydown=event=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(d){event.preventDefault();const r=el.getBoundingClientRect();positionHud(el,r.left+d[0],r.top+d[1]);savePositions();}};
}
function bindHuds(){for(const id of ['responseHud','decisionHud','combatSummary','arenaSideDock'])bindHud($(id));}
addEventListener('of-game-render',()=>{bindHuds();for(const id of Object.keys(positions)){const el=$(id);if(el&&!el.hidden)positionHud(el,positions[id].x,positions[id].y);}});new MutationObserver(bindHuds).observe(document.body,{childList:true,subtree:true});bindHuds();addEventListener('resize',()=>{for(const id of Object.keys(positions)){const el=$(id);if(el&&!el.hidden)positionHud(el,positions[id].x,positions[id].y);}});
})();
