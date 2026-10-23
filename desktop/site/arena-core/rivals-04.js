/* Rivais Ascendentes 0.4. Rules only: no DOM, storage or network access. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.OverdriveRivals04=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const other=p=>1-p;
 const blueId=n=>'OF-RVAS-'+String(n-141).padStart(3,'0');
 const action=d=>d&&['Golpe','Guarda','Truque'].includes(d.type);
 function install(Engine,scripts){
  const proto=Engine.prototype,base={};
  for(const key of ['fighterStarter','newTurn','payment','activatePaid','finishCombat','runOps','apply','legalActions','view','move'])base[key]=proto[key];
  const isLady=(e,p)=>e.def(e.s.players[p].fighter).number===142;
  const choose=(e,p,kind,uids,extra={})=>{e.s.choice={kind:'rivals:'+kind,player:p,uids,...extra};e.s.priority=p;};
  const effect=(e,p,op,label,source)=>e.push({kind:'effect',p,ops:[op],context:{p,source},label});
  const extras=e=>e.s.players.flatMap(side=>side.extra.map(c=>c.uid));
  const search=(e,p,predicate,source,to='hand')=>{const uids=e.s.players[p].deck.filter(c=>predicate(e.def(c))).map(c=>c.uid);if(uids.length)choose(e,p,'search',uids,{source,to});};
  function returnExtra(e,uid,to){
   const loc=e.find(uid);if(loc?.z!=='extra')throw Error('A Zona Extra selecionada não está disponível.');
   if(loc.card.token){e.destroyToken(uid,'return');return false;}
   if(to==='deck')e.expansionReturn(uid,true);else e.move(uid,'hand');
   return true;
  }
  function inactiveEnergy(e,p){
   const side=e.s.players[p];
   if(side.stamina.length>=7)return;
   if(!side.deck.length){e.draw(p,1,false);return;}
   const card=e.move(side.deck[0].uid,'stamina');card.active=false;card.public=true;
   e.log('Uma Ação do topo entra na Estamina como energia inativa.','Rivais 0.4');
  }
  proto.move=function(uid,to){const result=base.move.call(this,uid,to);if(to!=='stamina')delete result.rivalsFrozenUntil;return result;};
  proto.fighterStarter=function(number){
   if(number!==142)return base.fighterStarter.call(this,number);
   const main={};
   // 30 blue Actions and 10 generics, leaving separate reserves available.
   for(const n of [143,144,145,146,149,150,151,152,156,157])main[blueId(n)]=3;
   for(const n of [133,134,135,136,141])main['OF-C1-'+n]=2;
   return {name:'Lady Missbigotten — baralho pronto',fighter:blueId(142),main,extra:{}};
  };
  proto.newTurn=function(){
   for(const side of this.s.players)for(const card of side.stamina)if(card.rivalsFrozenUntil<this.s.turn){delete card.rivalsFrozenUntil;}
   base.newTurn.call(this);
   for(const side of this.s.players){side.rivalsBlocks=0;side.rivalsBlockTurn=this.s.turn;}
  };
  proto.rivalsRefreshAttacks=function(){
   for(const b of this.s.combats){
    if(b.finished||b.cancelled||!isLady(this,b.p))continue;
    const def=this.def(this.find(b.uid)?.card);if(def?.type!=='Golpe'||b.fighterOverdrive)continue;
    const n=this.energies(other(b.p),false).length;
    b.attack+=n-(b.rivalsColdBonus||0);b.rivalsColdBonus=n;
    b.attackModifiers=(b.attackModifiers||[]).filter(m=>m.name!=='Lady Missbigotten · energias inativas');
    if(n)b.attackModifiers.push({name:'Lady Missbigotten · energias inativas',value:n});
   }
  };
  proto.payment=function(p,card,mode='normal',x=0,zone){
   const def=this.def(card),side=this.s.players[p];
   if(mode==='guardStrike')throw Error('O Overdrive atual de Missbigotten inativa energias; não realiza Guardas como Golpes.');
   const pay=base.payment.call(this,p,card,mode,x);
   if(def.type==='Golpe'&&!pay.life){
    const discount=def.number===147?this.energies(other(p),false).length:0;
    const key=mode==='alternative'?'opp':'own';
    pay[key]=Math.max(0,pay[key]-discount+(side.rivalsNextAttackTax||0));
   }
   return pay;
  };
  proto.activatePaid=function(p,a){
   const side=this.s.players[p],card=a.uid&&this.find(a.uid)?.card;
   const attacking=a.type==='play'&&this.def(card)?.type==='Golpe';
   if(attacking)side.rivalsNextAttackTax=0;
   const result=base.activatePaid.call(this,p,a);
   if(a.type==='block'){
    const b=this.current();
    if(side.rivalsBlockBuff?.turn===this.s.turn)for(const guard of b.blocks.filter(g=>a.uids.includes(g.uid))){guard.value+=side.rivalsBlockBuff.n;}
    if(side.rivalsNextGuardBonus){const guard=b.blocks.find(g=>a.uids.includes(g.uid)&&this.def(this.find(g.uid)?.card)?.type==='Guarda');if(guard){guard.value+=side.rivalsNextGuardBonus;side.rivalsNextGuardBonus=0;}}
   }
   this.rivalsRefreshAttacks();
   return result;
  };
  proto.finishCombat=function(b){
   this.rivalsRefreshAttacks();
   const blocks=b.blocks.filter(g=>!g.cancelled),defender=other(b.p),side=this.s.players[defender];
   const result=base.finishCombat.call(this,b);
   if(!b.cancelled&&blocks.length){
    if(side.rivalsBlockTurn!==this.s.turn){side.rivalsBlocks=0;side.rivalsBlockTurn=this.s.turn;}
    side.rivalsBlocks=(side.rivalsBlocks||0)+blocks.length;
    if(b.basicDamage+b.impetusDamage===0)side.rivalsSuccessfulTurn=this.s.turn;
   }
   return result;
  };
  proto.runOps=function(ops,ctx){
   for(const op of ops){
    if(this.s.winner!==null)return;
    const p=ctx.p,side=this.s.players[p],combat=this.s.combats.find(b=>b.id===ctx.combat);
    const source=ctx.source||combat?.uid;
    if(op.focus&&(ctx.focusPower??side.power)<op.focus||op.when==='revide'&&!ctx.revide)continue;
    if(op.op==='rivalsSpiritHeal'){
     if(combat?.blocks.filter(g=>!g.cancelled).length===1){const shown=side.deck.slice(0,3);this.log('Sorte de Espírito revela: '+shown.map(c=>this.def(c).name).join(', ')+'.','revelação');side.hp+=shown.filter(c=>this.def(c).type==='Guarda').length;}
    }else if(op.op==='rivalsNextTax')this.s.players[other(p)].rivalsNextAttackTax=(this.s.players[other(p)].rivalsNextAttackTax||0)+op.n;
    else if(op.op==='rivalsDeter'){
     if(combat){(this.s.zoneModifiers||(this.s.zoneModifiers=[])).push({zone:combat.zone,cost:this.script(this.find(source).card).deter,untilTurn:this.s.turn,sourceName:'Deter'});this.log('Deter aumenta o custo dos Golpes em '+combat.zone+' até o fim do turno.','Deter');}
    }else if(op.op==='rivalsReactivate'){
     const uids=this.energies(p,false).filter(c=>!c.r05Lock).map(c=>c.uid);if(uids.length)choose(this,p,'reactivate',uids,{source});
    }else if(op.op==='rivalsLoot'){
     this.draw(p,1,false);if(this.s.winner===null&&side.hand.length)choose(this,p,'discard',side.hand.map(c=>c.uid),{source,required:1,selected:[]});
    }else if(op.op==='rivalsOverdrive'){
     const count=side.discard.filter(c=>this.def(c).type==='Guarda').length;
     if(count)choose(this,p,'odTarget',[],{source,count});else this.log('Overdrive: nenhuma Guarda no seu Descarte para inativar energias.','Missbigotten');
    }
    else if(op.op==='rivalsCard'){
     const card=this.find(source)?.card,number=ctx.copiedNumber??this.def(card)?.number;
     const previousSuccess=side.rivalsSuccessfulTurn===this.s.turn-1;
     if(number===144&&previousSuccess&&side.extra.length<4)search(this,p,d=>d.type==='Guarda'&&d.name.startsWith('Glacius'),source,'extra');
     else if(number===145&&previousSuccess&&combat){combat.attack+=3;(combat.attackModifiers||(combat.attackModifiers=[])).push({name:'Bloqueio com sucesso no turno anterior',value:3});}
     else if(number===146){
      if(previousSuccess)inactiveEnergy(this,p);
      if(ctx.revide&&this.s.winner===null)effect(this,p,{op:'rivalsReactivate'},'Glacius Permafrost — Revide',source);
     }else if(number===147&&ctx.revide&&side.extra.length)choose(this,p,'extra',side.extra.map(c=>c.uid),{source,to:'hand',max:2,optional:true,selected:[]});
     else if(number===150)search(this,p,d=>action(d)&&d.name.startsWith('Glacius'),source);
     else if(number===151)side.rivalsNextGuardBonus=(side.rivalsNextGuardBonus||0)+1;
     else if(number===153){const uids=this.energies(other(p),true).map(c=>c.uid);if(uids.length)choose(this,p,'freeze',uids,{source});else this.draw(other(p),1,false);}
     else if(number===154&&extras(this).length)choose(this,p,'extra',extras(this),{source,to:'deck',max:Math.min(2,extras(this).length),optional:false,selected:[]});
     else if(number===155)choose(this,p,'trocaMode',[],{source});
     else if(number===156){const uids=side.deck.slice(0,3).map(c=>c.uid);if(uids.length)choose(this,p,'top',uids,{source});else this.draw(p,1,false);}
     else if(number===157&&extras(this).length)choose(this,p,'extra',extras(this),{source,to:'hand',max:2,optional:true,selected:[]});
     else if(number===158)side.rivalsBlockBuff={turn:this.s.turn+1,n:2*(side.rivalsBlocks||0)};
     else if(number===159){if(side.hand.length)choose(this,p,'discard',side.hand.map(c=>c.uid),{source,required:Math.min(3,side.hand.length),selected:[],energy:true});else inactiveEnergy(this,p);}
     else if(number===160&&side.rivalsSuccessfulTurn===this.s.turn)choose(this,p,'tax',[],{source});
     else if(number===161){const uids=extras(this);let count=0;for(const uid of uids)if(returnExtra(this,uid,'deck'))count++;this.draw(p,count,false);}
    }else base.runOps.call(this,[op],ctx);
    if(this.s.choice&&source&&!this.s.choice.source)this.s.choice.source=source;
   }
  };
  proto.legalActions=function(p){
   const s=this.s,c=s?.choice;if(!s||s.winner!==null)return [];
   if(c?.kind.startsWith('rivals:')){
    if(c.player!==p)return [];
    const kind=c.kind.slice(7);
    if(kind==='trocaMode')return [...(this.s.players[p].stamina.length?[{type:'rivalsChoose',option:'troca'}]:[]),{type:'rivalsChoose',option:'effect'}];
    if(kind==='tax'||kind==='odTarget')return [0,1].map(target=>({type:'rivalsChoose',target}));
    const actions=(c.uids||[]).map(uid=>({type:'rivalsChoose',uid}));
    if(kind==='extra'&&c.optional)actions.push({type:'rivalsChoose',option:'done'});
    return actions;
   }
   const actions=base.legalActions.call(this,p).filter(a=>!(a.type==='fighterOverdrive'&&isLady(this,p)));
   const side=s.players[p],open=!c&&s.priority===p&&['preparation','combat'].includes(s.phase)&&(p!==s.active||!s.ending&&(!s.autoEnd||this.current())&&s.preparedTurn);
   if(isLady(this,p)&&open&&side.od===3&&!side.overdriveLocked&&!side.fighterTapped)actions.push({type:'rivalsOverdrive',uid:side.fighter.uid});
   return actions;
  };
  proto.apply=function(p,a){
   const c=this.s.choice,side=this.s.players[p];
   if(c?.kind.startsWith('rivals:')){
    if(!this.legalActions(p).some(option=>JSON.stringify(option)===JSON.stringify(Object.fromEntries(Object.keys(option).map(k=>[k,a[k]])))&&Object.keys(a).every(k=>k in option)))throw Error('Escolha inválida para o efeito.');
    const kind=c.kind.slice(7);this.s.choice=null;
    if(kind==='trocaMode'){
     if(a.option==='troca')choose(this,p,'troca',side.stamina.map(c=>c.uid),{source:c.source});else this.runOps([{op:'rivalsLoot'}],{p,source:c.source});
    }else if(kind==='odTarget'){
     const uids=this.energies(a.target,true).map(c=>c.uid),required=Math.min(c.count,uids.length);
     if(required)choose(this,p,'odFreeze',uids,{source:c.source,target:a.target,required,selected:[]});
    }else if(kind==='odFreeze'){
     const loc=this.find(a.uid);if(loc?.p!==c.target||loc.z!=='stamina'||!loc.card.active)throw Error('Escolha uma energia ativa do lutador alvo.');
     loc.card.active=false;loc.card.rivalsFrozenUntil=this.s.turn;c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);
     if(c.selected.length<c.required)this.s.choice=c;
    }else if(kind==='reactivate')this.find(a.uid).card.active=true;
    else if(kind==='freeze'){this.find(a.uid).card.active=false;this.draw(other(p),1,false);}
    else if(kind==='tax')this.s.players[a.target].rivalsNextAttackTax=(this.s.players[a.target].rivalsNextAttackTax||0)+1;
    else if(kind==='search'){
     const loc=this.find(a.uid);if(loc?.p!==p||loc.z!=='deck')throw Error('Carta de busca indisponível.');
     if(c.to==='extra'){const card=this.putEffectExtra(p,a.uid,true);card.ready=this.s.turn+1;this.log('Uma Guarda Glacius foi preparada virada para baixo.','efeito de carta');}
     else{this.move(a.uid,'hand');this.log('Carta buscada: '+this.def(loc.card).name+'.','efeito de carta');}
     this.shuffle(side.deck);
    }else if(kind==='top'){
     if(this.find(a.uid)?.p!==p||this.find(a.uid)?.z!=='deck')throw Error('Carta observada indisponível.');
     const rest=c.uids.filter(uid=>uid!==a.uid);this.move(a.uid,'hand');for(const uid of rest){const card=this.find(uid).card;side.deck.splice(side.deck.indexOf(card),1);side.deck.push(card);}
    }else if(kind==='troca'){
     const target=this.find(a.uid),source=this.find(c.source);if(target?.p!==p||target.z!=='stamina'||source?.p!==p||!['arena','discard'].includes(source.z))throw Error('Troca indisponível.');
     const active=target.card.active;this.move(a.uid,'hand');this.move(c.source,'stamina').active=active;
    }else if(kind==='discard'){
     if(this.find(a.uid)?.p!==p||this.find(a.uid)?.z!=='hand')throw Error('Carta para descarte indisponível.');
     this.move(a.uid,'discard');c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);
     if(c.selected.length<c.required)this.s.choice=c;else if(c.energy)inactiveEnergy(this,p);
    }else if(kind==='extra'){
     if(a.option!=='done'){if(this.find(a.uid)?.z!=='extra')throw Error('Carta da Zona Extra indisponível.');c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);if(c.selected.length<c.max&&c.uids.length)this.s.choice=c;}
     if(!this.s.choice)for(const uid of c.selected)returnExtra(this,uid,c.to);
    }
    if(this.s.choice&&c.source&&!this.s.choice.source)this.s.choice.source=c.source;
    this.s.priority=this.s.choice?.player??this.s.active;this.s.passes=0;
    this.rivalsRefreshAttacks();return;
   }
   if(a.type==='rivalsOverdrive'){
    if(!this.legalActions(p).some(option=>option.type===a.type&&option.uid===a.uid))throw Error('Overdrive indisponível.');
    side.od=0;effect(this,p,{op:'rivalsOverdrive'},'Lady Missbigotten — Overdrive',a.uid);this.s.priority=other(p);this.s.passes=0;return;
   }
   const result=base.apply.call(this,p,a);this.rivalsRefreshAttacks();return result;
  };
  proto.view=function(p){
   const view=base.view.call(this,p);if(!view)return view;
   // The owner may inspect remaining cards, without exposing their draw order.
   view.players[p].deckContents=this.s.players[p].deck.map(c=>JSON.parse(JSON.stringify(c))).sort((a,b)=>a.id.localeCompare(b.id)||a.uid.localeCompare(b.uid));
   for(let i=0;i<2;i++){const side=this.s.players[i];Object.assign(view.players[i],{rivalsSuccessfulTurn:side.rivalsSuccessfulTurn??null,rivalsBlocks:side.rivalsBlocks||0,rivalsNextAttackTax:side.rivalsNextAttackTax||0});}
   if(view.choice&&view.choice.player===p){const c=this.s.choice;view.choice.source=c.source;view.choice.selectedCount=c.selected?.length||0;view.choice.limit=c.max??c.required;}
   return view;
  };
 }
 return {install};
});
