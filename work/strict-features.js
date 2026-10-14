(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else factory(root.OverdriveCore.Engine);})(typeof globalThis!=='undefined'?globalThis:this,function(Engine){
 'use strict';if(Engine.prototype.explainCard)return;
 const copy=x=>JSON.parse(JSON.stringify(x));
 Engine.fromReplay=function(catalog,replay,limit){
  if(!replay||replay.format!=='overdrive-replay/1'||!replay.initial||!Array.isArray(replay.commands)||replay.commands.length>10000)throw Error('Formato de replay inválido.');
  const e=new Engine(catalog);e.start(replay.initial.a,replay.initial.b,replay.initial.first,replay.initial.seed,replay.initial.mode||'advanced');
  if(![e.s.version,'of-core-js-0.4.0','of-core-js-0.4.1'].includes(replay.version))throw Error('Replay de outra versão. Abra-o na versão '+replay.version+'.');
  const count=limit===undefined?replay.commands.length:limit;if(!Number.isInteger(count)||count<0||count>replay.commands.length)throw Error('Posição de replay inválida.');
  for(const cmd of replay.commands.slice(0,count)){if(!cmd||![0,1].includes(cmd.p)||!cmd.action||typeof cmd.action!=='object')throw Error('Comando de replay inválido.');const result=e.execute(cmd.p,cmd.action);if(!result.accepted)throw Error('Replay interrompido: '+result.reason);}
  e.assertInvariants();return e;
 };
 Engine.prototype.explainCard=function(p,uid){
  const f=this.find(uid),s=this.s;if(!f)return ['Carta ausente.'];if(f.p!==p)return ['Esta carta é controlada pelo adversário.'];if(s.winner!==null)return ['A partida terminou.'];
  const actions=this.legalActions(p);if(actions.some(a=>a.uid===uid&&a.type!=='prepare'||a.type==='block'&&a.options.includes(uid)||['chooseOwnEnergy','chooseEnergy'].includes(a.type)&&a.options.includes(uid)))return [];
  if(s.phase==='mulligan')return ['Conclua a escolha da mão inicial.'];if(s.choice)return ['Resolva primeiro a escolha indicada na tela.'];if(s.priority!==p)return ['A prioridade está com o adversário.'];
  const own=s.players[p],d=this.def(f.card),sc=this.script(f.card),messages=[];
  if(f.z==='fighter'){if(d.number===89&&actions.some(a=>a.type==='overdrive'))return [];if(own.fighterTapped)return ['Lutador virado: habilidade e Overdrive indisponíveis até desvirar no seu preparo.'];if(own.od<3)messages.push('Overdrive exige completar as 3 etapas da sequência.');if([32,70].includes(d.number)&&this.energies(p,true).length<1)messages.push('A habilidade exige 1 energia ativa.');return messages.length?messages:['A habilidade não está disponível nesta janela.'];}
  if(f.z==='extra'&&f.card.ready>s.turn)return ['Carta preparada: disponível a partir do turno '+f.card.ready+'.'];
  if(f.card.token)return [f.card.usedTurn===s.turn?'Esta ficha já atacou ou bloqueou neste turno.':'A ficha não pode ser usada nesta janela.'];
  if(f.z==='stamina'&&f.card.lockedUntil>=s.turn)return ['Energia bloqueada: não pode reativar nem pagar custo até o fim do turno '+f.card.lockedUntil+'.'];if(f.z==='stamina')return ['Esta carta está na Estamina. Se for um Golpe ativo, pode ser usada pelo Overdrive de Blossom com a sequência completa.'];
  if(sc.comboZone&&s.lastComboZone!==sc.comboZone)messages.push('COMBO exige que o último Golpe válido do Jogador de Ataque tenha sido na Zona '+sc.comboZone+'.');
  if(d.type==='Golpe'&&!this.canIndependent(p))messages.push('Golpes exigem sua fase de Combates livre ou uma janela de Revide.');
  if(d.type==='Guarda'&&!this.current())return ['Guardas são declaradas para bloquear um Golpe adversário.'];
  const modes=f.z==='discard'?(sc.fromDiscardLife?['life']:sc.discardCopy?['banishCopy']:[]):d.type==='Guarda'?['guard']:['normal',...(Number.isInteger(d.alternateCost)?['alternative']:[])];
  if(!modes.length)return ['Esta carta não possui um efeito que permita realizá-la do Descarte.'];
  for(const mode of modes){let pay;try{pay=mode==='guard'?{own:0,opp:d.cost}:this.payment(p,f.card,mode,0);}catch(error){messages.push(error.message);continue;}
   if(pay.own>this.energies(p,true).length)messages.push('Custo normal: faltam '+(pay.own-this.energies(p,true).length)+' energia(s) ativa(s).');
   else if(pay.opp>this.energies(1-p,false).length)messages.push('Custo '+(mode==='guard'?'da Guarda':'alternativo')+': faltam '+(pay.opp-this.energies(1-p,false).length)+' energia(s) inativa(s) do adversário.');
   else if(pay.life>own.hp)messages.push('Vida insuficiente para pagar o custo impresso.');
   else {const clone=new Engine([...this.catalog.values()]);clone.s=copy(s);clone.initial=copy(this.initial);const b=this.current(),a=mode==='guard'?{type:'block',uids:[uid]}:{type:'play',uid,mode,x:0,...(sc.chooseBuff?{option:'attack'}:{}),...(sc.requiresBlockTarget?{blockTarget:b?.blocks.find(g=>!g.cancelled)?.uid}:{})};const result=clone.execute(p,a);if(!result.accepted)messages.push(result.reason);}
  }
  return [...new Set(messages)].length?[...new Set(messages)]:['A carta não pode ser realizada nesta janela.'];
 };
 Engine.prototype.describeCombat=function(p,selected=[]){
  const b=this.current()||this.s.completed.at(-1);if(!b)return null;const c=this.find(b.uid)?.card;if(!c)return null;const sc=this.script(c),def=this.def(c),items=b.blocks.map(g=>({...g}));
  if(!b.blocked&&p!==b.p){const legal=this.legalActions(p).find(a=>a.type==='block');for(const uid of new Set(selected)){if(!legal?.options.includes(uid))continue;const card=this.find(uid).card;items.push({uid,value:this.def(card).block+(this.script(card).blockBonus?.(this,p)||0),selected:true});}}
  const rows=items.map(g=>{const card=this.find(g.uid)?.card,definition=card&&this.def(card),ignored=g.cancelled||b.ignoreBelowPower!==undefined&&g.value<b.ignoreBelowPower;return {uid:g.uid,name:definition?.name||'Bloqueador',base:definition?.block??g.value,value:g.value,ignored,token:!!card?.token,selected:!!g.selected,cancelled:!!g.cancelled};});
  const aggregate=b.aggregateBlockBonus??(items.some(g=>g.selected)?(this.s.players[p].nextBlockBonus||0)+(this.s.players[p].nextBlockTurn||0)+this.zoneModifier(b.zone,'block'):0);
  const block=b.finished?b.blockValue:rows.reduce((sum,g)=>sum+(g.ignored?0:g.value),0)+aggregate,marks=b.token?0:(this.s.players[1-b.p].golpeDamageMarks||0);
  const raw=b.cancelled?0:Math.max(0,b.attack-block),rawImpetus=!b.cancelled&&rows.some(g=>!g.cancelled&&!g.token)?(b.revide&&sc.revideImpetus!==undefined?sc.revideImpetus:(b.impetusBase??sc.impetus??0))+(b.extraImpetus||0):0;
  const basic=b.finished?b.basicDamage:raw+(raw>0?marks:0),impetus=b.finished?b.impetusDamage:rawImpetus+(rawImpetus>0?marks:0);
  const modifiers=(b.attackModifiers||[]).map(m=>({...m})),accounted=modifiers.reduce((n,m)=>n+m.value,0);if(accounted!==b.attack)modifiers.push({name:'Ajustes posteriores de efeitos',value:b.attack-accounted});
  return {attackName:def.name,zone:b.zone,attack:b.attack,modifiers,block,blockers:rows,aggregate,basic,impetus,total:(basic||0)+(impetus||0),cancelled:b.cancelled,finished:!!b.finished,provisional:!b.finished,marks,selfDamage:sc.selfDamageHalfAttack&&!b.cancelled?Math.ceil(Math.max(0,b.attack)/2):0};
 };
 const originalOps=Engine.prototype.runOps,keys=['nextAttackBonus','nextFocusSocoBonus','nextRedassaltBonus','nextBlockBonus','nextBlockTurn'];
 Engine.prototype.runOps=function(ops,ctx){const before=new Map(this.s.combats.map(b=>[b.id,b.attack])),previous=this.s.players.map(side=>Object.fromEntries(keys.map(k=>[k,side[k]||0]))),zoneCount=this.s.zoneModifiers?.length||0,nextZoneCount=this.s.zoneNextAttacks?.length||0;this.explainDepth=(this.explainDepth||0)+1;
  try{return originalOps.call(this,ops,ctx);}finally{this.explainDepth--;if(!this.explainDepth){const source=ctx.source||this.s.combats.find(b=>b.id===ctx.combat)?.uid,card=source&&this.find(source)?.card,name=card?this.def(card).name:ops.some(o=>o.op==='zoneModifier')?this.def(this.s.players[ctx.p].fighter).name+' · Overdrive':'Efeito resolvido';for(const b of this.s.combats){const delta=b.attack-(before.get(b.id)??b.attack);if(delta)(b.attackModifiers||(b.attackModifiers=[])).push({name,value:delta});}
   this.s.players.forEach((side,p)=>{side.bonusSources||={};for(const key of keys){const delta=(side[key]||0)-previous[p][key];if(delta){if(!previous[p][key])side.bonusSources[key]=[];(side.bonusSources[key]||(side.bonusSources[key]=[])).push({name,value:delta});}}});for(const m of (this.s.zoneModifiers||[]).slice(zoneCount))m.sourceName=name;for(const m of (this.s.zoneNextAttacks||[]).slice(nextZoneCount))m.sourceName=name;
  }}
 };
 const paid=Engine.prototype.activatePaid;
 Engine.prototype.activatePaid=function(p,a){const side=this.s.players[p],card=a.uid&&this.find(a.uid)?.card,def=card&&this.def(card),sc=card&&this.script(card),pending=keys.flatMap(key=>{if(key==='nextBlockBonus'||key==='nextBlockTurn')return [];if(key==='nextRedassaltBonus'&&!def?.name.toLowerCase().includes('redassalt'))return [];if(key==='nextFocusSocoBonus'&&!(def?.subtype==='Soco'&&sc.focusThreshold))return [];return (side.bonusSources?.[key]||[]).map(m=>({...m}));}),zones=[...(this.s.zoneModifiers||[]).filter(m=>m.zone===def?.zone&&m.untilTurn>=this.s.turn&&m.attack).map(m=>({name:m.sourceName||'Efeito da Zona',value:m.attack})),...(this.s.zoneNextAttacks||[]).filter(m=>m.zone===def?.zone&&m.untilTurn>=this.s.turn).map(m=>({name:m.sourceName||'Efeito ao próximo Golpe da Zona',value:m.n}))];const result=paid.call(this,p,a),b=this.current();
  if(b?.uid===a.uid&&def?.type==='Golpe'&&b.attackModifiers){for(const [label,rows] of [['Efeitos anteriores',pending],['Efeitos da Zona',zones]]){const index=b.attackModifiers.findIndex(m=>m.name===label);if(index>=0&&rows.reduce((n,m)=>n+m.value,0)===b.attackModifiers[index].value)b.attackModifiers.splice(index,1,...rows);}const sum=b.attackModifiers.reduce((n,m)=>n+m.value,0);if(sum!==b.attack)b.attackModifiers.push({name:'Cancelar Vigor / Fervor de Inazami',value:b.attack-sum});}return result;
 };
});
