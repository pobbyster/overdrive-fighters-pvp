/* First Drive: regras das cartas 109–137. Sem DOM ou dependência de rede.
 * Escolhas são comandos pequenos, validados novamente pelo motor; o cliente
 * nunca fornece cartas compradas, resultados aleatórios ou custos já pagos.
 */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.OverdriveExpansion=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function install(Engine,scripts){
  const proto=Engine.prototype,previous={};
  for(const key of ['validateDeck','fighterStarter','move','newTurn','play','beginPayment','activatePaid','runOps','finishCombat','legalActions','apply','view','fighterOverdrive','payment'])previous[key]=proto[key];
  const id=n=>'OF-C1-'+String(n).padStart(3,'0'),other=p=>1-p,clone=x=>JSON.parse(JSON.stringify(x));
  const fighters=[114,120,126,132],zones=['Inferior','Meio','Superior'];
  const puppy=c=>c?.name.startsWith('PuppyPunch'),flow=c=>Number.isInteger(scripts[c?.number]?.fluxo);
  const playableExtra=e=>e.filter(c=>!c.token);
  const furyAttack=(side,zone)=>(side.expansionFury?.[zone]||0)+(side.expansionFuryTemporary?.[zone]||0);
  const setChoice=(e,p,kind,uids,extra={})=>{e.s.choice={kind:'expansion:'+kind,player:p,uids,...extra};e.s.priority=p;};
  const addAttack=(b,n,name)=>{if(!b||!n)return;b.attack+=n;(b.attackModifiers||(b.attackModifiers=[])).push({name,value:n});};
  const pushEffect=(e,p,op,label)=>e.push({kind:'effect',p,ops:[op],context:{p},label});
  const search=(e,p,predicate,from='deck',to='hand',extra={})=>{
   const uids=e.s.players[p][from].filter(c=>predicate(e.def(c))).map(c=>c.uid);
   if(uids.length)setChoice(e,p,'search',uids,{from,to,...extra});
  };
  proto.validateDeck=function(deck){
   const fighter=this.def(deck?.fighter);
   if(!fighters.includes(fighter?.number))return previous.validateDeck.call(this,deck);
   // Reutiliza integralmente limites de cor, cópias, principal e adicional.
   const equivalent={Verde:70,Rosa:89,Roxo:32,Laranja:51}[fighter.color];
   return previous.validateDeck.call(this,{...deck,fighter:id(equivalent)});
  };
  proto.fighterStarter=function(n){
   if(!fighters.includes(n))return previous.fighterStarter.call(this,n);
   const pools={114:[109,110,111,112,113,71,72,74,79,85],120:[115,116,117,118,119,90,91,95,100,101],126:[121,122,123,124,125,33,34,35,40,43],132:[127,128,129,130,131,52,54,61,62,64]};
   const main={};pools[n].forEach(x=>main[id(x)]=3);[[133,2],[134,2],[135,2],[136,2],[141,2]].forEach(([x,q])=>main[id(x)]=q);
   return {name:this.def(id(n)).name+' — baralho pronto',fighter:id(n),main,extra:{}};
  };
  proto.move=function(uid,to){
   const before=this.find(uid),from=before?.z,p=before?.p,number=before&&this.def(before.card).number;
   const card=previous.move.call(this,uid,to);
   if(to!=='hand'){delete card.expansionRevealed;delete card.expansionRevealedTurn;}
   if(from==='extra'&&to==='deck'){
    if(this.expansionBottomReturn)this.s.players[p].expansionReturned=(this.s.players[p].expansionReturned||0)+1;
   }
   if(to==='deck'&&from!=='deck'&&puppy(this.def(card)))this.s.players[p].puppyReturned=(this.s.players[p].puppyReturned||0)+1;
   if(from==='discard'&&to==='deck'&&number>=133&&number<=136){
    const op=number===133?{op:'expansionPuppyMill'}:number===134?{op:'nextAttackBonus',n:1}:number===135?{op:'nextAttackBonus',n:2}:{op:'draw',n:1};
    pushEffect(this,p,op,this.def(card).name+' — retornou ao baralho');
   }
   return card;
  };
  proto.expansionReturn=function(uid,bottom=false){
   // A flag existe somente durante esta operação síncrona, nunca vem do cliente.
   this.expansionBottomReturn=bottom;
   try{return this.move(uid,'deck');}finally{this.expansionBottomReturn=false;}
  };
  proto.newTurn=function(){
   previous.newTurn.call(this);
   for(const side of this.s.players){side.expansionReturned=0;side.expansionFury=side.expansionFury||{};side.expansionFuryTemporary={};side.expansionFirstFury=false;side.expansionMourner=false;side.expansionRevealUsed=false;side.expansionExcaliumRevealed=[];side.expansionReloadHit=false;}
  };
  proto.expansionAllowed=function(p,card){
   const side=this.s.players[p],sc=this.script(card),d=this.def(card),loc=this.find(card.uid);
   if(sc.revealedOnly&&!card.expansionRevealed)return false;
   if(d.number===125&&(side.extra.length>=4||!side.deck.length||!side.hand.some(c=>c.uid!==card.uid&&['Golpe','Guarda','Truque'].includes(this.def(c).type))))return false;
   if(sc.extraReturn&&playableExtra(side.extra).length<sc.extraReturn)return false;
   
   if(sc.reloadDiscard&&loc.z==='discard'&&(side.expansionReturned||0)<sc.reloadDiscard)return false;
   return !!d;
  };
  proto.payment=function(p,c,mode='normal',x=0){
   if(mode==='puppy'){if(!this.script(c).puppyCost)throw Error('Esta carta não possui custo PuppyPunch.');return {own:0,opp:0};}
   const pay=previous.payment.call(this,p,c,mode,x);
   if(this.def(c).number===140&&mode==='normal')pay.own=Math.max(0,pay.own-(this.s.players[p].puppyReturned||0));
   return pay;
  };
  proto.play=function(p,a,revide){
   const loc=this.find(a.uid),sc=loc&&this.script(loc.card);
   if(a.mode==='puppy'&&(!sc?.puppyCost||!this.s.players[p].discard.some(c=>puppy(this.def(c)))))throw Error('Retorne uma Ação PuppyPunch do Descarte para pagar este custo alternativo.');
   if(loc&&!this.expansionAllowed(p,loc.card))throw Error('Condição da carta não satisfeita: revelação, Recarga ou custo adicional indisponível.');
   if(loc?.z==='discard'&&sc.reloadDiscard){
    if(a.mode!=='normal'||!revide&&!this.canIndependent(p))throw Error('Recarga exige combate livre no turno próprio ou Revide.');
    if(!this.supported(loc.card.id))throw Error('Carta sem script.');
    return this.beginPayment(p,{...a,revide},this.payment(p,loc.card,'normal'));
   }
   return previous.play.call(this,p,a,revide);
  };
  proto.beginPayment=function(p,intent,pay){
   const loc=intent.type==='play'&&this.find(intent.uid),sc=loc&&this.script(loc.card),side=this.s.players[p];
   if(loc&&!intent.expansionSnapshot){
    const last=side.played.at(-1),lastDef=last&&this.def(last.id);
    intent={...intent,expansionSnapshot:{revealed:!!loc.card.expansionRevealed,reload:side.expansionReturned||0,fluxo:!!(sc.fluxo&&lastDef&&typeof lastDef.cost==='number'&&lastDef.cost<=sc.fluxo)}};
   }
   if(loc&&(sc.extraReturn||sc.puppyCost&&intent.mode==='puppy')&&!intent.expansionCostPaid){
    if(!this.expansionAllowed(p,loc.card)||this.energies(p,true).length<pay.own||this.energies(other(p),false).length<pay.opp)throw Error('Custos adicionais ou energia indisponíveis.');
    if(sc.extraReturn)setChoice(this,p,'extraCost',playableExtra(side.extra).map(c=>c.uid),{required:sc.extraReturn,selected:[],intent:clone(intent),pay:clone(pay)});
    else setChoice(this,p,'puppyCost',side.discard.filter(c=>puppy(this.def(c))).map(c=>c.uid),{intent:clone(intent),pay:clone(pay)});
    return;
   }
   return previous.beginPayment.call(this,p,intent,pay);
  };
  proto.activatePaid=function(p,a){
   const side=this.s.players[p];
   if(a.type==='expansionReveal'){
    side.fighterTapped=true;side.overdriveLocked=true;side.expansionRevealUsed=true;
    return pushEffect(this,p,{op:'updateReveal'},'Arcturus — revelar Golpes');
   }
   if(a.type==='expansionPlacideSkill'){side.fighterTapped=true;side.overdriveLocked=true;return pushEffect(this,p,{op:'expansionPlacideTop'},'Placide — preparar o topo');}
   if(a.type==='expansionMournerSkill'){
    side.fighterTapped=true;side.overdriveLocked=true;
    return pushEffect(this,p,{op:'expansionFlowSearch',golpe:true},'Mourner — buscar Golpe com Fluxo');
   }
   if(a.type==='expansionExcalium'){
    this.move(a.uid,'banished');return pushEffect(this,p,{op:'expansionRevealOne'},'Excalium — revelar carta da mão');
   }
   const result=previous.activatePaid.call(this,p,a),loc=a.uid&&this.find(a.uid),sc=loc&&this.script(loc.card);
   if(a.type==='play'&&loc&&this.def(loc.card).type==='Golpe'){
    const b=this.current(),snapshot=a.expansionSnapshot||{};
    for(const link of this.s.stack)if(link.uid===a.uid||link.context?.source===a.uid)if(link.context)link.context.expansion=clone(snapshot);
    if(this.def(loc.card).number===140)addAttack(b,side.puppyReturned||0,'PuppyPunch retornados neste jogo');
    if(sc.revealBonus&&snapshot.revealed)addAttack(b,sc.revealBonus,'Excalium · revelado');
    if(sc.reloadBonus&&snapshot.reload>=sc.reload)addAttack(b,sc.reloadBonus,'Recarga · cartas anteriores ao custo');
    addAttack(b,side.expansionNextAttack||0,'Arcturus · Golpes revelados');side.expansionNextAttack=0;
    addAttack(b,furyAttack(side,b.zone),'Fúria · '+b.zone);
    if(sc.fluxo&&side.expansionMourner)b.expansionUnblockable=true;
    if(sc.fury&&p===this.s.active){b.expansionFirstFury=!side.expansionFirstFury;side.expansionFirstFury=true;}
   }
   for(const link of a.expansionCostTriggers||[])this.push(link);
   return result;
  };
  proto.runOps=function(ops,ctx){
   for(const op of ops){
    if(this.s.winner!==null)return;
    const p=ctx.p,side=this.s.players[p];
    if(op.op==='expansionPlacideTop'){if(side.deck.length&&side.extra.length<4){const card=this.putEffectExtra(p,side.deck[0].uid,true);card.ready=this.s.turn+1;this.log('Placide colocou o topo do baralho virado para baixo na Zona Extra.','Placide');}}else if(op.op==='updateReveal'){if(side.hand.some(c=>this.def(c).type==='Golpe'))setChoice(this,p,'revealMany',side.hand.filter(c=>this.def(c).type==='Golpe').map(c=>c.uid),{selected:[]});}
    else if(op.op==='expansionPuppyMill')search(this,p,puppy,'deck','discard');
    else if(op.op==='expansionFlowSearch')search(this,p,d=>flow(d)&&(!op.golpe||d.type==='Golpe'));
    else if(op.op==='expansionRevealOne'){
     if(side.hand.length)setChoice(this,p,'revealOne',side.hand.map(c=>c.uid));
    }else if(op.op==='expansionCard'){
     const card=this.find(ctx.source)?.card;if(!card)continue;
     const sc=this.script(card),snapshot=ctx.expansion||{},n=ctx.copiedNumber??this.def(card).number;
     if(n===109&&snapshot.revealed)this.draw(p,1,false);
     else if(n===111&&snapshot.revealed)search(this,p,d=>d.type==='Golpe'&&d.name.startsWith('Excalium'));
     else if(n===112&&snapshot.revealed)search(this,p,d=>d.name.startsWith('Excalium'),'discard','hand');
     else if(n===115&&snapshot.fluxo)search(this,p,flow);
     else if((n===116||n===117)&&snapshot.fluxo)side.nextAttackBonus=(side.nextAttackBonus||0)+(n===116?1:2);
     else if(n===118&&snapshot.fluxo)this.draw(p,2,false);
     else if(n===119&&snapshot.fluxo&&side.discard.some(c=>flow(this.def(c))))setChoice(this,p,'flowReturn',side.discard.filter(c=>flow(this.def(c))).map(c=>c.uid),{selected:[],combat:ctx.combat});
     else if(n===121&&snapshot.reload>=1){const enemy=this.s.players[other(p)];if(enemy.discard.length)setChoice(this,p,'enemyReturn',enemy.discard.map(c=>c.uid),{required:1});}
     else if(n===122&&snapshot.reload>=1)this.draw(p,1,false);
     else if(n===125&&side.extra.length<4){const uids=side.hand.filter(c=>['Golpe','Guarda','Truque'].includes(this.def(c).type)).map(c=>c.uid);if(uids.length)setChoice(this,p,'quadraDiscard',uids);}
     else if(n===128)this.draw(p,1,false);
     else if(n===129)search(this,p,()=>true,'discard','hand');
     else if(n===138&&side.stamina.length)setChoice(this,p,'troca',side.stamina.map(c=>c.uid),{source:card.uid});
     else if(n===139){const enemy=this.s.players[other(p)];setChoice(this,p,'deliciasBanish',side.discard.map(c=>c.uid),{selected:[],limit:Math.min(side.discard.length,enemy.discard.length)});}
     else if(n===141){const options=[];if(side.discard.some(c=>puppy(this.def(c))))options.push('recover');if(side.deck.some(c=>puppy(this.def(c))))options.push('send');if(options.length)setChoice(this,p,'mission',[],{options});}
    }else if(op.op==='expansionReactivate'){
     const uids=this.energies(p,false).filter(c=>!c.r05Lock).map(c=>c.uid);if(uids.length)setChoice(this,p,'reactivate',uids);
    }else previous.runOps.call(this,[op],ctx);
   }
  };
  proto.finishCombat=function(b){
   const sc=this.script(this.find(b.uid)?.card),side=this.s.players[b.p];
   previous.finishCombat.call(this,b);
   if(b.cancelled)return;
   if(sc.fury&&b.blocks.some(g=>!g.cancelled)){
    const markers=side.expansionFury||(side.expansionFury={});markers[b.zone]=(markers[b.zone]||0)+sc.fury;
    this.log('Fúria '+sc.fury+': próximos Golpes de '+(b.p?'IA':'Você')+' em '+b.zone+' ganham +'+markers[b.zone]+' ATQ cumulativo.','Fúria');
   }
   if(b.fighterOverdrive==='rynhard'&&b.blocks.some(g=>!g.cancelled)){const permanent=side.expansionFury||(side.expansionFury={}),temporary=side.expansionFuryTemporary||(side.expansionFuryTemporary={});permanent[b.zone]=(permanent[b.zone]||0)*2;temporary[b.zone]=(temporary[b.zone]||0)*2;}
   if(b.basicDamage+b.impetusDamage>0){
    if(sc.reload||sc.reloadDiscard)side.expansionReloadHit=true;
    if(this.def(this.find(b.uid)?.card)?.number===140){for(const card of [...side.discard].filter(c=>puppy(this.def(c))))this.expansionReturn(card.uid);this.shuffle(side.deck);}
    if(b.expansionFirstFury&&this.def(side.fighter).number===132&&this.s.winner===null)pushEffect(this,b.p,{op:'expansionReactivate'},'Rynhard — primeiro Golpe com Fúria bateu');

   }
  };
  proto.fighterOverdrive=function(p,a,revide=false){
   const side=this.s.players[p],n=this.def(side.fighter).number;
   if(!fighters.includes(n))return previous.fighterOverdrive.call(this,p,a,revide);
   if(n===120)throw Error('O Overdrive de Mourner não realiza um Golpe.');
   if(n===126&&!a.expansionSelected){
    if(side.od!==3||side.overdriveLocked||side.fighterTapped||!revide&&!this.canIndependent(p)||!zones.includes(a.zone))throw Error('Overdrive indisponível.');
    setChoice(this,p,'placideOD',playableExtra(side.extra).map(c=>c.uid),{selected:[],intent:clone(a),revide});return;
   }
   // Os três Overdrives realizam ataques normais do lutador e respeitam Revide.
   previous.fighterOverdrive.call(this,p,a,revide);
   const b=this.current();
   if(n===114)addAttack(b,(side.expansionExcaliumRevealed||[]).length,'Arcturus · Excalium revelados');
   if(n===126)addAttack(b,a.expansionSelected.length,'Placide · cartas retornadas');
   addAttack(b,side.expansionNextAttack||0,'Arcturus · Golpes revelados');side.expansionNextAttack=0;
   addAttack(b,furyAttack(side,b.zone),'Fúria · '+b.zone);
  };
  proto.legalActions=function(p){
   if(!this.s||this.s.winner!==null)return [];
   const s=this.s,c=s.choice,side=s.players[p];
   if(c?.kind.startsWith('expansion:')){
    if(c.player!==p)return [];
    const kind=c.kind.slice(10),acts=c.uids.map(uid=>({type:'expansionChoose',uid}));
    if(kind==='mission')return c.options.map(option=>({type:'expansionChoose',option}));
    if(kind==='deliciasBanish'&&c.selected.length>=c.limit)return [{type:'expansionChoose',option:'done'}];
    if(['revealMany','flowReturn','placideOD','quadraPick','deliciasBanish'].includes(kind))acts.push({type:'expansionChoose',option:'done'});
    return acts;
   }
   let acts=previous.legalActions.call(this,p).filter(a=>(a.type!=='play'||this.expansionAllowed(p,this.find(a.uid).card))&&!(a.type==='fighterOverdrive'&&this.def(side.fighter).number===120));
   const attackWindow=this.canIndependent(p)||c?.kind==='revide'&&c.player===p;
   if(attackWindow)for(const card of side.discard.filter(c=>this.script(c).reloadDiscard&&this.expansionAllowed(p,c))){const pay=this.payment(p,card,'normal');if(this.energies(p,true).length>=pay.own)acts.push({type:'play',uid:card.uid,mode:'normal',x:0});}
   if(attackWindow)for(const card of [...side.hand,...side.extra.filter(c=>c.ready<=s.turn)].filter(c=>this.script(c).puppyCost)){
    if(side.discard.some(c=>puppy(this.def(c)))&&this.expansionAllowed(p,card)){
     // Reuse all normal play restrictions, without requiring active energy.
     const original=this.payment;this.payment=function(player,target,mode,x){return target.uid===card.uid&&mode==='normal'?original.call(this,player,target,'puppy',x):original.call(this,player,target,mode,x);};
     try{const legal=previous.legalActions.call(this,p).find(a=>a.type==='play'&&a.uid===card.uid&&a.mode==='normal');if(legal)acts.push({...legal,mode:'puppy'});}finally{this.payment=original;}
    }
   }
   if(c||s.priority!==p||s.phase==='mulligan')return acts;
   const n=this.def(side.fighter).number,open=!s.ending&&['combat','preparation'].includes(s.phase)&&(!s.autoEnd||!!this.current());
   if(open&&!(p===s.active&&!s.preparedTurn)){
    if(n===114&&this.energies(p,true).some(c=>this.def(c).color==='Verde')&&!side.fighterTapped&&!side.expansionRevealUsed&&side.hand.some(c=>this.def(c).type==='Golpe'))acts.push({type:'expansionReveal',uid:side.fighter.uid});
    if(n===126&&!side.fighterTapped&&side.deck.length&&side.extra.length<4&&this.energies(p,true).length>=1)acts.push({type:'expansionPlacideSkill',uid:side.fighter.uid});
    if(n===120&&!side.fighterTapped&&side.deck.some(c=>flow(this.def(c))&&this.def(c).type==='Golpe'))acts.push({type:'expansionMournerSkill',uid:side.fighter.uid});
    if(side.hand.length)for(const card of side.discard.filter(c=>this.script(c).excaliumDiscard))acts.push({type:'expansionExcalium',uid:card.uid});
    if(n===120&&side.od===3&&!side.fighterTapped&&!side.overdriveLocked)acts.push({type:'expansionMournerOD',uid:side.fighter.uid});
   }
   const b=this.current(),unblockable=b&&(b.expansionUnblockable||this.s.players[b.p].expansionMourner&&this.script(this.find(b.uid)?.card).fluxo);
   if(unblockable&&p!==b.p)acts=acts.map(a=>a.type==='block'?{...a,options:[]}:a);
   return acts;
  };
  proto.apply=function(p,a){
   const s=this.s,c=s.choice,side=s.players[p];
   if(c?.kind.startsWith('expansion:')){
    if(!this.legalActions(p).some(x=>Object.keys(x).every(k=>x[k]===a[k])&&Object.keys(a).every(k=>k in x)))throw Error('Escolha inválida para a habilidade.');
    const kind=c.kind.slice(10);s.choice=null;
    if(kind==='extraCost'){
     c.selected.push(a.uid);c.uids=c.uids.filter(x=>x!==a.uid);
     if(c.selected.length<c.required){s.choice=c;return;}
     const before=s.stack.length;for(const uid of c.selected)this.expansionReturn(uid,true);
     return this.beginPayment(p,{...c.intent,expansionCostPaid:true,expansionCostTriggers:s.stack.splice(before)},c.pay);
    }else if(kind==='puppyCost'){
     const before=s.stack.length;this.expansionReturn(a.uid);this.shuffle(side.deck);
     return this.beginPayment(p,{...c.intent,expansionCostPaid:true,expansionCostTriggers:s.stack.splice(before)},c.pay);
    }else if(kind==='revealMany'){
     if(a.option==='done'){side.expansionNextAttack=(side.expansionNextAttack||0)+c.selected.length;}
     else{const card=this.find(a.uid).card;card.expansionRevealed=true;card.expansionRevealedTurn=s.turn;if(this.def(card).type==='Golpe'&&this.def(card).name.startsWith('Excalium')){side.expansionExcaliumRevealed||=[];if(!side.expansionExcaliumRevealed.includes(card.uid))side.expansionExcaliumRevealed.push(card.uid);}c.selected.push(a.uid);c.uids=c.uids.filter(x=>x!==a.uid);s.choice=c;this.log('Arcturus revela '+this.def(card).name+'.','revelação');}
    }else if(kind==='revealOne'){
     const card=this.find(a.uid).card;card.expansionRevealed=true;card.expansionRevealedTurn=s.turn;if(this.def(card).type==='Golpe'&&this.def(card).name.startsWith('Excalium')){side.expansionExcaliumRevealed||=[];if(!side.expansionExcaliumRevealed.includes(card.uid))side.expansionExcaliumRevealed.push(card.uid);}this.log('Excalium revela '+this.def(card).name+'.','revelação');
    }else if(kind==='flowReturn'){
     if(a.option==='done'){
      for(const uid of c.selected)this.expansionReturn(uid);this.shuffle(side.deck);addAttack(s.combats.find(b=>b.id===c.combat),c.selected.length,'Explendor · cartas retornadas');
     }else{c.selected.push(a.uid);c.uids=c.uids.filter(x=>x!==a.uid);s.choice=c;}
    }else if(kind==='placideOD'){
     if(a.option==='done'){
      const before=s.stack.length;
      for(const uid of c.selected)this.expansionReturn(uid);if(c.selected.length)this.shuffle(side.deck);
      const triggers=s.stack.splice(before);
      this.fighterOverdrive(p,{...c.intent,expansionSelected:c.selected},c.revide);
      for(const link of triggers)this.push(link);
     }else{c.selected.push(a.uid);c.uids=c.uids.filter(x=>x!==a.uid);s.choice=c;}
    }else if(kind==='quadraDiscard'){
     if(this.find(a.uid)?.z!=='hand')throw Error('Escolha uma Ação da sua mão.');
     this.move(a.uid,'discard');setChoice(this,p,'quadraPick',side.deck.filter(c=>['Golpe','Guarda','Truque'].includes(this.def(c).type)).map(c=>c.uid),{selected:[]});
    }else if(kind==='quadraPick'){
     if(a.option!=='done'){const card=this.putEffectExtra(p,a.uid,true);card.ready=s.turn+1;this.log('Uma Ação foi colocada virada para baixo na Zona Extra.','efeito de carta');c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);if(c.selected.length<2&&side.extra.length<4&&c.uids.length)s.choice=c;}
     if(!s.choice)this.shuffle(side.deck);
    }else if(kind==='mission')search(this,p,puppy,a.option==='recover'?'discard':'deck',a.option==='recover'?'hand':'discard');
    else if(kind==='deliciasBanish'){
     if(a.option==='done'){for(const uid of c.selected)this.move(uid,'banished');if(c.selected.length)setChoice(this,p,'enemyReturn',this.s.players[other(p)].discard.map(c=>c.uid),{required:c.selected.length,selected:[]});}
     else{c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);s.choice=c;}
    }else if(kind==='enemyReturn'){
     const loc=this.find(a.uid);if(loc?.p!==other(p)||loc.z!=='discard')throw Error('Escolha uma carta do Descarte adversário.');
     (c.selected||(c.selected=[])).push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);if(c.selected.length<c.required)s.choice=c;else{for(const uid of c.selected)this.expansionReturn(uid);this.shuffle(this.s.players[other(p)].deck);}
    }else if(kind==='troca'){
     const loc=this.find(a.uid),source=this.find(c.source);if(loc?.p!==p||loc.z!=='stamina'||source?.p!==p||!['arena','discard'].includes(source.z))throw Error('Alvo de Troca indisponível.');
     const active=loc.card.active;this.move(a.uid,'hand');const replacement=this.move(c.source,'stamina');replacement.active=active;this.log('Troca: Escapatória substitui uma Ação na Estamina, devolvida à mão.','Troca');
    }else if(kind==='greenCost'){
     const energy=this.find(a.uid);if(energy?.p!==p||energy.z!=='stamina'||!energy.card.active||this.def(energy.card).color!=='Verde')throw Error('Escolha 1 energia verde ativa.');
     return previous.beginPayment.call(this,p,{type:'expansionReveal',uid:side.fighter.uid,energyUids:[a.uid]},{own:1,opp:0});
    }else if(kind==='reactivate')this.find(a.uid).card.active=true;
    else if(kind==='search'){
     const loc=this.find(a.uid);if(loc?.p!==p||loc.z!==c.from)throw Error('Alvo de busca indisponível.');
     if(c.to==='extra'){const card=this.putEffectExtra(p,a.uid,!!c.faceDown);card.ready=s.turn+1;}else this.move(a.uid,c.to);
     if(c.from==='deck')this.shuffle(side.deck);
     this.log(c.faceDown?'Uma Ação foi colocada virada para baixo na Zona Extra.':'Escolhida: '+this.def(loc.card).name+'.','efeito de carta');
    }
    if(s.choice&&c.source&&!s.choice.source)s.choice.source=c.source;
    s.priority=s.choice?.player??s.active;s.passes=0;return;
   }
   if(a.type.startsWith('expansion')){
    if(!this.legalActions(p).some(x=>x.type===a.type&&x.uid===a.uid))throw Error('Habilidade indisponível nesta janela.');
    if(a.type==='expansionReveal'){
     setChoice(this,p,'greenCost',this.energies(p,true).filter(c=>this.def(c).color==='Verde').map(c=>c.uid));return;
    }
    if(a.type==='expansionMournerOD'){side.od=0;this.push({kind:'effect',p,ops:[{op:'expansionMournerOD'}],context:{p},label:'Mourner — Overdrive'});s.priority=other(p);s.passes=0;return;}
    if(a.type==='expansionPlacideSkill'){this.beginPayment(p,a,{own:1,opp:0});return;}
    if(['expansionMournerSkill','expansionExcalium'].includes(a.type)){this.beginPayment(p,a,{own:0,opp:0});return;}
   }
   const b=this.current();
   if(a.type==='block'&&b&&(b.expansionUnblockable||s.players[b.p].expansionMourner&&this.script(this.find(b.uid)?.card).fluxo)&&(a.uids||[]).length)throw Error('Overdrive de Mourner: Ações com Fluxo não podem ser bloqueadas até o final deste turno.');
   const result=previous.apply.call(this,p,a);
   if(a.type==='tokenAttack'){addAttack(this.current(),side.expansionNextAttack||0,'Arcturus · Golpes revelados');side.expansionNextAttack=0;}
   return result;
  };
  const cardOps=proto.runOps;
  proto.runOps=function(ops,ctx){for(const op of ops)if(op.op==='expansionMournerOD')this.s.players[ctx.p].expansionMourner=true;else{cardOps.call(this,[op],ctx);if(this.s.choice&&ctx.source)this.s.choice.source=ctx.source;}};
  proto.view=function(p){
   const v=previous.view.call(this,p);if(!v)return v;
   for(let i=0;i<2;i++){
    const side=this.s.players[i];v.players[i].expansionReturned=side.expansionReturned||0;v.players[i].expansionFury=clone(side.expansionFury||{});v.players[i].expansionMourner=!!side.expansionMourner;v.players[i].golpeDamageMarks=side.golpeDamageMarks||0;
    // Somente as cartas deliberadamente reveladas atravessam a visão adversária.
    v.players[i].revealedHand=side.hand.filter(c=>c.expansionRevealed).map(clone);
   }
   if(v.choice&&v.choice.player===p){v.choice.source=this.s.choice.source||this.s.choice.intent?.uid;v.choice.selectedCount=this.s.choice.selected?.length||0;v.choice.limit=this.s.choice.limit;}
   for(let i=0;i<2;i++)v.players[i].puppyReturned=this.s.players[i].puppyReturned||0;
   return v;
  };
 }
 return {install};
});
