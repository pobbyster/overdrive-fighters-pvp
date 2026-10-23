(()=>{
 'use strict';
 const api=OverdriveArena,$=id=>document.getElementById(id);
 const layer=document.createElement('div');layer.id='rivalsCombatParticles';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 let engineRef=null;
 const motion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?0:(window.OverdriveSettings?.get().motion??100)/100;
 function animate(node,frames,options){const animation=node.animate(frames,options);animation.onfinish=()=>node.remove();animation.oncancel=()=>node.remove();}
 addEventListener('of-combat-visual',event=>{
  const {kind,p}=event.detail,strength=motion();if(!strength)return;
  const target=document.querySelector('.fight-status[data-player="'+p+'"]')||document.querySelector(p?'.enemy-rail':'.own-rail');if(!target)return;
  const rect=target.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height*.48;
  const color=kind==='heal'?'#3debac':['block','success'].includes(kind)?'#55d7ff':kind==='effect'?'#f34fbe':kind==='marker'?'#b866ff':'#ffae38';
  const ring=document.createElement('div');ring.className='rivals-impact-ring';ring.style.cssText='left:'+x+'px;top:'+y+'px;--particle-color:'+color;layer.append(ring);
  animate(ring,[{opacity:.9,scale:.25},{opacity:0,scale:kind==='heal'?2.3:1.7}],{duration:500+220*strength,easing:'ease-out'});
  for(let i=0;i<Math.ceil(8+8*strength);i++){
   const particle=document.createElement('i');particle.className='rivals-particle'+(kind==='heal'?' heal':'');particle.style.cssText='left:'+x+'px;top:'+y+'px;--particle-color:'+color;
   const angle=2*Math.PI*i/16,distance=30+(i%4)*16;
   layer.append(particle);animate(particle,[{opacity:1,transform:'translate(0,0) scale(1.2)'},{opacity:0,transform:'translate('+Math.cos(angle)*distance+'px,'+(kind==='heal'?-distance:Math.sin(angle)*distance)+'px) scale(.2)'}],{duration:480+300*strength+(i%3)*60,easing:'ease-out'});
  }
  if(['damage','effect','block','success'].includes(kind)){
   const cue=document.createElement('div');cue.className='rivals-combat-cue '+kind;cue.style.cssText='left:'+x+'px;top:'+y+'px;--particle-color:'+color;cue.textContent=kind==='success'?'BLOQUEIO!':kind==='block'?'DEFESA':kind==='effect'?'EFEITO!':'IMPACTO!';layer.append(cue);
   animate(cue,[{opacity:0,transform:'translate(-50%,-50%) scale(.3) rotate(-12deg)'},{opacity:1,transform:'translate(-50%,-65%) scale(1.05) rotate(-8deg)',offset:.25},{opacity:0,transform:'translate(-50%,-110%) scale(1.2) rotate(-8deg)'}],{duration:650*strength+150,easing:'ease-out'});
  }
  if(['damage','effect'].includes(kind)){
   const from=document.querySelector(p?'.own-rail':'.enemy-rail')?.getBoundingClientRect();
   if(from){const sx=from.left+from.width/2,sy=from.top+from.height*.48,dx=x-sx,dy=y-sy,trail=document.createElement('div');trail.className='rivals-hit-trail '+kind;trail.style.cssText='left:'+sx+'px;top:'+sy+'px;width:'+Math.hypot(dx,dy)+'px;--particle-color:'+color+';rotate:'+Math.atan2(dy,dx)+'rad';layer.append(trail);animate(trail,[{opacity:0,scale:'0 1'},{opacity:.8,scale:'1 1',offset:.35},{opacity:0,scale:'1 .1'}],{duration:280*strength+100,easing:'ease-out'});}
  }
  if(kind==='damage'){
   const attacker=document.querySelector(p?'.own-rail':'.enemy-rail');
   attacker?.animate([{translate:'0 0'},{translate:(p?'10px':'-10px')+' 0',offset:.3},{translate:'0 0'}],{duration:320*strength+100,easing:'ease-out'});
  }
  target.animate([{boxShadow:'0 0 0 transparent'},{boxShadow:'0 0 38px '+color,offset:.3},{boxShadow:'0 0 0 transparent'}],{duration:500*strength+180});
  while(layer.children.length>70)layer.firstElementChild.remove();
 });
 function availability(view){
  const e=api.engine(),active=!window.OverdriveSession?.paused&&!window.OverdriveSession?.isReplay&&!e?.networkPaused;
  if(!e||!view)return;
  if(e!==engineRef){engineRef=e;layer.replaceChildren();}
  const actions=active?view.actions:[],choice=view.choice?.player===0&&view.choice.kind!=='revide';
  const ready=new Set(),targets=new Set();
  for(const action of actions){
   if(action.uid&&action.type!=='prepare')ready.add(action.uid);
   if(action.type==='block'||action.type==='chooseOwnEnergy'||action.type==='chooseEnergy')for(const uid of action.options||[])ready.add(uid);
   if(choice&&action.uid)targets.add(action.uid);
  }
  document.querySelectorAll('#game [data-card]').forEach(node=>{
   const loc=e.find(node.dataset.card),own=loc?.p===0;
   node.classList.toggle('rivals-activatable',own&&ready.has(node.dataset.card));
   node.classList.toggle('rivals-choice-target',targets.has(node.dataset.card));
  });
  const discardReady=actions.some(action=>action.uid&&['discard','banished'].includes(e.find(action.uid)?.z)&&e.find(action.uid)?.p===0);
  $('ownDiscard')?.classList.toggle('rivals-ready-pile',discardReady);
  if($('ownDiscard'))$('ownDiscard').title=discardReady?'Há efeitos ativáveis no Descarte. Clique para escolher.':'Consultar Descarte e cartas banidas';
  const fighter=view.players[0].fighter.uid;
  $('playerStats')?.classList.toggle('rivals-skill-ready',ready.has(fighter));
 }
 addEventListener('of-game-render',event=>availability(event.detail));
 addEventListener('of-remote-resync',()=>layer.replaceChildren());
 new MutationObserver(()=>{if($('game').hidden)layer.replaceChildren();}).observe($('game'),{attributes:true,attributeFilter:['hidden']});
})();
