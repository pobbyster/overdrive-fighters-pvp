/* Rivais Ascendentes 0.5: serializable choices and rules, shared by IA and PvP. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OverdriveRivals05=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';const other=p=>1-p,action=d=>['Golpe','Guarda','Truque'].includes(d?.type);
 function install(Engine,scripts){
  const proto=Engine.prototype,base={};for(const key of ['newTurn','prepareTurn','draw','payment','guardCost','activatePaid','runOps','apply','legalActions','view','move','rivalsRefreshAttacks','fighterStarter'])base[key]=proto[key];
  const choose=(e,p,kind,uids,extra={})=>{e.s.choice={kind:'rivals:05'+kind,player:p,uids,...extra};e.s.priority=p;};
  const refresh=e=>{for(const side of e.s.players)for(const card of side.stamina)if(card.r05Lock&&card.r05Lock.until>e.s.turn)card.active=false;};
  const context=(p,c)=>({...c.ctx,p,source:c.source});
  function reactivate(e,p,source){const uids=e.energies(p,false).filter(c=>!c.r05Lock).map(c=>c.uid);if(uids.length)choose(e,p,'Reactivate',uids,{source});}
  function target(e,p,kind,ctx){choose(e,p,kind,[],{source:ctx.source,ctx});}
  function afterEnergy(e,p,c){if(c.next==='draw')e.draw(p,2,false);else target(e,p,'ExtraTarget',context(p,c));}
  function finishPrison(e,p,c){if(c.ctx?.revide)reactivate(e,p,c.source);}
  function copied(e,p,c){
   const sc=scripts[c.number]||{},side=e.s.players[p],b=e.current(),ctx={...context(p,c),copiedNumber:c.number,flow:side.played.length>1,revide:!!c.ctx?.revide};
   if(sc.requiresAttack||sc.requiresDisparo||sc.requiresBlockTarget||sc.requiresOwnBlocked){
    if(!b||b.finished||sc.requiresDisparo&&e.def(e.find(b.uid).card).subtype!=='Disparo'||sc.requiresOwnBlocked&&(b.p!==p||!b.blocked))return e.log('Simulacro: a condição do efeito copiado não foi cumprida.','Simulacro');
    ctx.combat=b.id;ctx.target=b.id;
    if(sc.requiresBlockTarget){const uids=b.blocks.filter(g=>!g.cancelled).map(g=>g.uid);if(uids.length){choose(e,p,'CopyBlock',uids,{source:c.source,number:c.number,cardId:c.cardId,ctx});return;}return;}
   }
   if(sc.chooseBuff&&!c.option){choose(e,p,'CopyBuff',[],{source:c.source,number:c.number,cardId:c.cardId,ctx});return;}
   ctx.option=c.option;const previous=side.played.at(-2),previousDef=previous&&e.def(previous.id);
   ctx.expansion={revealed:!!e.find(c.source)?.card.expansionRevealed,reload:side.expansionReturned||0,fluxo:!!(sc.fluxo&&previousDef&&typeof previousDef.cost==='number'&&previousDef.cost<=sc.fluxo)};
   const ops=sc.onPlay||(e.catalog.get(c.cardId)?.type==='Guarda'?sc.onBlock:[])||[];
   e.log('Simulacro resolve o texto de '+e.catalog.get(c.cardId).name+' como Truque; condições dos efeitos continuam necessárias.','Simulacro');
   if(ops.length)e.runOps(ops,ctx);
  }
  proto.fighterStarter=function(n){const deck=base.fighterStarter.call(this,n);if(n===142){const id=num=>'OF-RVAS-'+String(num-141).padStart(3,'0');for(const [old,num]of [[143,169],[156,162],[157,163],[144,168]]){const quantity=deck.main[id(old)];delete deck.main[id(old)];deck.main[id(num)]=quantity;}}return deck;};
  proto.move=function(uid,to){const card=base.move.call(this,uid,to);if(to!=='stamina')delete card.r05Lock;return card;};
  proto.newTurn=function(){
   for(const side of this.s.players)for(const card of side.stamina)if(card.r05Lock&&card.r05Lock.until<=this.s.turn){delete card.r05Lock;}
   base.newTurn.call(this);for(const side of this.s.players)side.r05Draws=0;refresh(this);
  };
  proto.prepareTurn=function(){const result=base.prepareTurn.call(this);refresh(this);return result;};
  proto.draw=function(p,n,mechanical,cause){const before=this.s.players[p].hand.length,result=base.draw.call(this,p,n,mechanical,cause),count=this.s.players[p].hand.length-before;if(cause!=='replenish'&&count>0)this.s.players[p].r05Draws=(this.s.players[p].r05Draws||0)+count;this.rivalsRefreshAttacks();return result;};
  proto.rivalsRefreshAttacks=function(){base.rivalsRefreshAttacks.call(this);for(const b of this.s.combats){if(b.finished||b.cancelled||this.def(this.find(b.uid)?.card)?.number!==169)continue;const n=this.s.players[b.p].r05Draws||0;b.attack+=n-(b.r05DrawBonus||0);b.r05DrawBonus=n;b.attackModifiers=(b.attackModifiers||[]).filter(m=>m.name!=='Hiperborea · cartas compradas');if(n)b.attackModifiers.push({name:'Hiperborea · cartas compradas',value:n});}};
  proto.payment=function(p,card,mode='normal',x=0,zone){const pay=base.payment.call(this,p,card,mode,x,zone),tax=this.s.players[p].r05NextTax||0;if(tax)pay[pay.life?'life':mode==='alternative'?'opp':'own']+=tax;return pay;};
  proto.guardCost=function(p,card,index=0){const side=this.s.players[p];return Math.max(0,base.guardCost.call(this,p,card,index)+(index===0?(side.r05NextTax||0)-(side.r05GuardDiscount||0):0));};
  proto.activatePaid=function(p,a){const side=this.s.players[p],performed=a.type==='play',guard=a.type==='block'&&a.uids.some(uid=>this.def(this.find(uid).card).type==='Guarda');if(performed||guard)side.r05NextTax=0;if(guard)side.r05GuardDiscount=0;const result=base.activatePaid.call(this,p,a);refresh(this);return result;};
  proto.runOps=function(ops,ctx){
   for(const op of ops){if(this.s.winner!==null)return;const p=ctx.p,side=this.s.players[p],source=ctx.source||this.s.combats.find(b=>b.id===ctx.combat)?.uid;
    const ownEffect=op.op==='rivals05Card';if(!ownEffect){base.runOps.call(this,[op],ctx);refresh(this);continue;}
    const n=ctx.copiedNumber??this.def(this.find(source)?.card)?.number;
    if(n===162){this.draw(p,1,false);if(this.s.winner!==null)return;if(side.hand.length)choose(this,p,'Discard',side.hand.map(c=>c.uid),{source,required:Math.min(2,side.hand.length),selected:[],ctx});else reactivate(this,p,source);}
    else if(n===163||n===164){if(side.stamina.length)choose(this,p,'Energy',side.stamina.map(c=>c.uid),{source,next:n===163?'draw':'extra',ctx});else afterEnergy(this,p,{source,next:n===163?'draw':'extra',ctx});}
    else if(n===165&&side.receivedDamage>0)side.r05GuardDiscount=(side.r05GuardDiscount||0)+1;
    else if(n===166){const uids=side.discard.filter(c=>c.uid!==source&&action(this.def(c))).map(c=>c.uid);if(uids.length)choose(this,p,'Copy',uids,{source,ctx});}
    else if(n===167)target(this,p,'AuraTarget',{...ctx,source});
    else if(n===168)choose(this,p,'Declare',[],{source,ctx});
   }
   refresh(this);this.rivalsRefreshAttacks();
  };
  proto.legalActions=function(p){const c=this.s?.choice;if(!c?.kind.startsWith('rivals:05'))return base.legalActions.call(this,p);if(this.s.winner!==null||c.player!==p)return [];const kind=c.kind.slice(9);
   if(['ExtraTarget','AuraTarget','PrisonTarget'].includes(kind))return [0,1].map(target=>({type:'rivalsChoose',target}));
   if(kind==='Declare')return ['Golpe','Guarda','Truque'].map(option=>({type:'rivalsChoose',option}));
   if(kind==='CopyBuff')return ['attack','block'].map(option=>({type:'rivalsChoose',option}));
   const actions=(c.uids||[]).map(uid=>({type:'rivalsChoose',uid}));if(kind==='Extras')actions.push({type:'rivalsChoose',option:'done'});return actions;
  };
  proto.apply=function(p,a){const c=this.s.choice;if(!c?.kind.startsWith('rivals:05')){const result=base.apply.call(this,p,a);refresh(this);this.rivalsRefreshAttacks();return result;}
   if(!this.legalActions(p).some(option=>Object.keys(option).every(k=>option[k]===a[k])&&Object.keys(a).every(k=>k in option)))throw Error('Escolha inválida para o efeito 0.5.');
   const side=this.s.players[p],kind=c.kind.slice(9);this.s.choice=null;
   if(kind==='Discard'){this.move(a.uid,'discard');c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);if(c.selected.length<c.required)this.s.choice=c;else reactivate(this,p,c.source);}
   else if(kind==='Reactivate')this.find(a.uid).card.active=true;
   else if(kind==='Energy'){this.move(a.uid,'hand');afterEnergy(this,p,c);}
   else if(kind==='ExtraTarget'){const uids=this.s.players[a.target].extra.map(c=>c.uid);if(uids.length)choose(this,p,'Extras',uids,{source:c.source,target:a.target,selected:[],required:Math.min(3,uids.length)});}
   else if(kind==='Extras'){if(a.option!=='done'){c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);if(c.selected.length<c.required&&c.uids.length)this.s.choice=c;}if(!this.s.choice){for(const uid of c.selected){if(this.find(uid).card.token)this.destroyToken(uid,'return');else this.expansionReturn(uid);}if(c.selected.length)this.shuffle(this.s.players[c.target].deck);}}
   else if(kind==='AuraTarget'){const count=this.energies(a.target,false).length,before=side.hand.length;this.draw(p,count,false);if(this.s.winner===null)side.r05NextTax=(side.r05NextTax||0)+side.hand.length-before;}
   else if(kind==='Copy'){const card=this.find(a.uid).card,def=this.def(card);this.move(a.uid,'banished');copied(this,p,{...c,number:def.number,cardId:card.id});}
   else if(kind==='CopyBuff')copied(this,p,{...c,option:a.option});
   else if(kind==='CopyBlock'){const sc=scripts[c.number]||{};this.runOps(sc.onPlay||[],{...context(p,c),copiedNumber:c.number,blockTarget:a.uid,target:a.uid});}
   else if(kind==='Declare'){const top=side.deck[0],def=top&&this.def(top);this.log('Prisão Gélida: declaração '+a.option+'; '+(def?'topo revelado: '+def.name+' ('+def.type+').':'não há carta no topo.'),'revelação');if(def?.type===a.option)target(this,p,'PrisonTarget',context(p,c));else finishPrison(this,p,c);}
   else if(kind==='PrisonTarget'){const uids=this.s.players[a.target].stamina.map(c=>c.uid);if(uids.length)choose(this,p,'PrisonEnergy',uids,{source:c.source,ctx:c.ctx,target:a.target});else finishPrison(this,p,c);}
   else if(kind==='PrisonEnergy'){const card=this.find(a.uid).card,until=this.s.turn+(this.s.active===p?2:1);card.r05Lock={until:Math.max(until,card.r05Lock?.until||0),restore:card.r05Lock?.restore??!!card.active};card.active=false;finishPrison(this,p,c);}
   this.s.priority=this.s.choice?.player??this.s.active;this.s.passes=0;refresh(this);this.rivalsRefreshAttacks();
  };
  proto.view=function(p){const view=base.view.call(this,p);if(!view)return view;for(let i=0;i<2;i++){const side=this.s.players[i];Object.assign(view.players[i],{r05Draws:side.r05Draws||0,r05NextTax:side.r05NextTax||0,r05GuardDiscount:side.r05GuardDiscount||0});}return view;};
 }
 return {install};
});
