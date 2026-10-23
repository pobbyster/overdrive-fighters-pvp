(()=>{
 'use strict';const api=OverdriveArena,$=id=>document.getElementById(id);
 const layer=document.createElement('div');layer.id='combatVisualLayer';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const live=document.createElement('div');live.className='combat-fx-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);
 let prior=null,engineRef=null,reset=false,layoutFrame;
 const rail=p=>document.querySelector('.fight-status[data-player="'+p+'"]')||document.querySelector(p?'.enemy-rail':'.own-rail');
 function emit(kind,p,label,value){
  dispatchEvent(new CustomEvent('of-combat-visual',{detail:{kind,p,label,value}}));
  const target=rail(p),r=target?.getBoundingClientRect();if(!r?.width)return;
  const item=document.createElement('div');item.className='combat-fx';item.dataset.kind=kind;item.dataset.player=String(p);
  const number=document.createElement('b');number.textContent=value??'';const text=document.createElement('small');text.textContent=label;item.append(number,text);
  const lane=[...layer.children].filter(n=>n.dataset.player===String(p)).length%3;
  item.style.left=Math.max(110,Math.min(innerWidth-110,r.left+r.width/2))+'px';item.style.top=Math.max(100,r.top+r.height*.45-lane*45)+'px';layer.append(item);
  while(layer.children.length>12)layer.firstElementChild.remove();
  live.textContent=(p?'Adversário':'Você')+': '+label+' '+(value??'');
  const strength=(window.OverdriveSettings?.get().motion??100)/100,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||!strength;
  const duration=reduced?1100:1500+400*strength;
  if(!reduced){
   item.animate([{opacity:0,transform:'translate(-50%,-20%) scale(.65)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.1)',offset:.16},{opacity:1,transform:'translate(-50%,-80%) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-150%) scale(.95)'}],{duration,easing:'ease-out'});
   const panel=target.querySelector('.fight-readout,.fighter-panel');if(panel)panel.animate(kind==='damage'||kind==='effect'?[{filter:'brightness(1)'},{filter:'brightness(1.6)',transform:'translateX(-4px)',offset:.25},{transform:'translateX(4px)',offset:.5},{filter:'brightness(1)',transform:'translateX(0)'}]:[{filter:'brightness(1)'},{filter:'brightness(1.5)',offset:.4},{filter:'brightness(1)'}],{duration:400*strength+120});
  }
  setTimeout(()=>item.remove(),duration);
 }
 function newLogs(previous,current){let overlap=Math.min(previous.length,current.length);for(;overlap>0;overlap--)if(previous.slice(-overlap).every((s,i)=>s===current[i]))break;return current.slice(overlap);}
 function snapshot(view){return {revision:view.revision,hp:view.players.map(p=>p.hp),od:view.players.map(p=>p.od),power:view.players.map(p=>p.power),damageMarks:view.players.map(p=>p.golpeDamageMarks||0),fury:view.players.map(p=>({...p.expansionFury})),log:(view.log||[]).map(l=>l.text),combats:new Map([...view.completed,...view.combats].map(c=>[c.id,{...c,blocks:c.blocks.map(b=>({...b}))}]))};}
 function markers(view){view.players.forEach((side,p)=>{let readout=rail(p)?.querySelector('.combat-marker-readout');if(!readout){readout=document.createElement('div');readout.className='combat-marker-readout';rail(p)?.append(readout);}readout.replaceChildren();for(const [zone,n]of Object.entries(side.expansionFury||{}))if(n){const badge=document.createElement('span');badge.textContent='Fúria '+n+' · '+zone;readout.append(badge);}if(side.golpeDamageMarks){const badge=document.createElement('span');badge.textContent='Marcadores de dano: '+side.golpeDamageMarks;readout.append(badge);}readout.hidden=!readout.childElementCount;});}
 function place(node,hand,ownRail){if(!node||node.hidden||node.dataset.manualPosition)return;const r=node.getBoundingClientRect(),header=document.querySelector('.arena-header').getBoundingClientRect();const left=Math.max(10,Math.min(innerWidth-r.width-10,ownRail.left-r.width-16));const top=Math.max(header.bottom+14,Math.min(innerHeight-r.height-12,hand.bottom-r.height));Object.assign(node.style,{position:'fixed',left:left+'px',top:top+'px',right:'auto',bottom:'auto',transform:'none'});}
 function layout(){if($('game').hidden)return;const hand=$('handArea').getBoundingClientRect(),ownRail=rail(0).getBoundingClientRect();place($('responseHud'),hand,ownRail);
  const choice=api.engine()?.s?.choice,fromDiscard=choice?.uids?.some(uid=>['discard','banished'].includes(api.engine().find(uid)?.z));if(fromDiscard)place($('decisionHud'),hand,ownRail);
  const tools=$('turnTools');if(tools&&!tools.hidden){
   const deck=$('ownDeck').getBoundingClientRect(),hud=$('fightHud')?.getBoundingClientRect();
   const room=innerWidth-deck.right-24,width=Math.min(220,Math.max(130,room));
   Object.assign(tools.style,{position:'fixed',display:'flex',flexDirection:'column',maxWidth:width+'px',width:width+'px',right:'auto',bottom:'auto',transform:'none'});
   const left=room>=130?deck.right+12:Math.max(12,innerWidth-width-12);
   const top=Math.max((hud?.bottom||0)+12,Math.min(innerHeight-tools.offsetHeight-12,deck.top));
   Object.assign(tools.style,{left:left+'px',top:top+'px'});
  }
 }
 function queueLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout);}
 document.addEventListener('pointerdown',e=>{const handle=e.target.closest('.hud-drag-handle');if(handle)handle.parentElement.dataset.manualPosition='true';},true);
 addEventListener('resize',queueLayout);addEventListener('of-arena-interaction',queueLayout);addEventListener('of-remote-resync',()=>{reset=true;layer.replaceChildren();});
 addEventListener('of-game-render',event=>{
  const view=event.detail,e=api.engine();if(!view)return;queueLayout();markers(view);const now=snapshot(view);
  if(engineRef!==e||reset||window.OverdriveSession?.isReplay){engineRef=e;prior=now;reset=false;layer.replaceChildren();return;}
  if(!prior||prior.revision===now.revision)return;
  const basic=[0,0],damage=[0,0],paid=[0,0];let ambiguousDamage=0,ambiguousPaid=0;
  for(const c of now.combats.values()){
   const old=prior.combats.get(c.id),blocks=c.blocks.filter(b=>!b.cancelled),oldBlocks=new Set((old?.blocks||[]).filter(b=>!b.cancelled).map(b=>b.uid));
   const added=blocks.filter(b=>!oldBlocks.has(b.uid));if(added.length)emit('block',1-c.p,'BLOQUEIO',added.reduce((sum,b)=>sum+(b.value||0),0));
   if(c.basicDamage!==undefined&&old?.basicDamage===undefined&&!c.cancelled){basic[1-c.p]+=c.basicDamage||0;if(blocks.length&&!c.basicDamage&&!c.impetusDamage)emit('success',1-c.p,'BLOQUEIO COM SUCESSO','✓');}
  }
  for(const text of newLogs(prior.log,now.log)){
   const hit=text.match(/^(.*?) recebeu (\d+) de dano\.$/),cost=text.match(/^(.*?) pagou (\d+) de vida para jogar do Descarte\.$/),m=hit||cost;if(!m)continue;
   let p=e.remote?view.players.findIndex(s=>s.name===m[1]):m[1]==='Você'?0:m[1]==='IA'?1:-1;
   if(e.remote&&view.players[0].name===view.players[1].name){if(hit)ambiguousDamage+=Number(m[2]);else ambiguousPaid+=Number(m[2]);continue;}
   if(p>=0)(hit?damage:paid)[p]+=Number(m[2]);
  }
  // Nomes iguais no PvP não identificam o destinatário. Primeiro atribui os
  // danos dos combates públicos, depois usa as perdas efetivas de vida.
  for(let p=0;p<2&&ambiguousDamage;p++){const n=Math.min(ambiguousDamage,basic[p]);damage[p]+=n;ambiguousDamage-=n;}
  for(let p=0;p<2;p++){const loss=Math.max(0,prior.hp[p]-now.hp[p]-damage[p]);const n=Math.min(ambiguousDamage,loss);damage[p]+=n;ambiguousDamage-=n;const cost=Math.min(ambiguousPaid,Math.max(0,loss-n));paid[p]+=cost;ambiguousPaid-=cost;}
  for(let p=0;p<2;p++){
   const normal=Math.min(damage[p],basic[p]),effect=Math.max(0,damage[p]-normal),healed=now.hp[p]-prior.hp[p]+damage[p]+paid[p];
   if(normal)emit('damage',p,'DANO','−'+normal);if(effect)emit('effect',p,'DANO DE EFEITO','−'+effect);if(healed>0)emit('heal',p,'VIDA','+'+healed);
   if(now.od[p]!==prior.od[p])emit('marker',p,'OVERDRIVE',(now.od[p]>prior.od[p]?'+':'')+(now.od[p]-prior.od[p]));
   if(now.power[p]!==prior.power[p])emit('marker',p,'PODER',(now.power[p]>prior.power[p]?'+':'')+(now.power[p]-prior.power[p]));
   if(now.damageMarks[p]!==prior.damageMarks[p])emit('marker',p,'MARCADOR DE DANO',(now.damageMarks[p]>prior.damageMarks[p]?'+':'')+(now.damageMarks[p]-prior.damageMarks[p]));
   for(const [zone,n]of Object.entries(now.fury[p])){const diff=n-(prior.fury[p][zone]||0);if(diff)emit('marker',p,'FÚRIA · '+zone.toLocaleUpperCase('pt-BR'),(diff>0?'+':'')+diff);}
  }
  prior=now;
 });
 new MutationObserver(()=>{if($('game').hidden){prior=null;engineRef=null;layer.replaceChildren();}}).observe($('game'),{attributes:true,attributeFilter:['hidden']});
})();
