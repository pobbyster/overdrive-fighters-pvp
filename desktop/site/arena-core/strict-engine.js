/* Overdrive Fighters: motor original, independente de DOM, baseado no livro v0.2.
 * Não contém código do EDOPro. API de comandos/eventos inspirada na separação do core.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./strict-card-scripts.js'),require('./first-drive-expansion.js'),require('./rivals-04.js'),require('./rivals-05.js'),require('./rivals-06.js'),require('./rules-version.js'),require('./game-modes.js'),require('./mahazeno.js'));else root.OverdriveCore=factory(root.OverdriveCardScripts,root.OverdriveExpansion,root.OverdriveRivals04,root.OverdriveRivals05,root.OverdriveRivals06,root.OverdriveRulesVersion,root.OverdriveModes,root.OverdriveMahaZeno);})(typeof globalThis!=='undefined'?globalThis:this,function(CardScripts,Expansion,Rivals04,Rivals05,Rivals06,RulesVersion,GameModes,MahaZeno){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),other=p=>1-p,id=n=>'OF-C1-'+String(n).padStart(3,'0');
const {SUPPORTED,scripts}=CardScripts;
const VERSION='of-core-js-0.13.0',RULESET_ID=RulesVersion.RULESET_ID;
class Engine {
 constructor(catalog){this.catalog=new Map(catalog.map(x=>[x.id,copy(x)]));this.s=null;this.commands=[];this.initial=null;}
 def(card){return card?.tokenDefinition||this.catalog.get(typeof card==='string'?card:card.id);}
 script(card){return card?.token?{}:scripts[this.def(card).number]||{};}
 psychicCosts(p,excluded=[]){return this.s.players[p].hand.filter(c=>!excluded.includes(c.uid)&&this.def(c).name.toLowerCase().includes('psychic')).map(c=>c.uid);}
 psychicAllowed(p,card){const sc=this.script(card),side=this.s.players[p],hand=side.hand.filter(c=>c.uid!==card.uid);return hand.length>0&&(side[sc.psychicFrom].some(c=>this.def(c).type==='Golpe'&&this.def(c).name.toLowerCase().includes('psychic'))||sc.psychicFrom==='discard'&&hand.some(c=>this.def(c).type==='Golpe'&&this.def(c).name.toLowerCase().includes('psychic')));}
 comboAllowed(card,previousZone){const required=this.script(card).comboZone;return !required||previousZone===required;}
 canActivatedFighterSkill(p){const side=this.s.players[p],n=this.def(side.fighter).number;
  return [70].includes(n)&&(p!==this.s.active||this.s.preparedTurn)&&this.s.priority===p&&!this.s.choice&&this.s.winner===null&&!this.s.ending&&['preparation','combat'].includes(this.s.phase)&&this.energies(p,true).length>=1&&!side.fighterTapped&&(!this.s.autoEnd||!!this.current());
 }
 consumeZoneNextAttack(zone){const list=this.s.zoneNextAttacks||[],matching=list.filter(m=>m.zone===zone&&m.untilTurn>=this.s.turn);this.s.zoneNextAttacks=list.filter(m=>m.zone!==zone&&m.untilTurn>=this.s.turn);return matching.reduce((n,m)=>n+m.n,0);}
 zoneModifier(zone,property){return (this.s.zoneModifiers||[]).filter(m=>m.zone===zone&&m.untilTurn>=this.s.turn).reduce((n,m)=>n+(m[property]||0),0);}
 fighterOverdrive(p,a,revide=false){
  const side=this.s.players[p],kind=this.script(side.fighter).fighterOverdrive;
  if(!kind||side.od!==3||side.overdriveLocked||side.fighterTapped||(!revide&&!this.canIndependent(p)))throw Error('Overdrive do lutador indisponível.');
  if(!['Inferior','Meio','Superior'].includes(a.zone))throw Error('Declare a Zona do Overdrive.');
  side.od=0;const attack=side.power*(kind==='hanma'?2:1)+this.zoneModifier(a.zone,'attack')+this.consumeZoneNextAttack(a.zone);
  const b={id:++this.s.next,p,uid:side.fighter.uid,attack,zone:a.zone,blocks:[],blocked:false,cancelled:false,flow:false,revide:false,responseRevide:revide,resume:a.suspended||null,from:'fighter',fighterOverdrive:kind};
  if(kind==='boydd')b.ignoreBelowPower=side.power;
  this.s.combats.push(b);this.push({kind:'attack',p,uid:b.uid,combat:b.id,context:{p},label:this.def(side.fighter).name+' — Overdrive'});
  this.s.priority=other(p);this.s.passes=0;
 }
 createToken(p,{name,power=0,zone=null,fugaz=false,redemption=false,onDestroy=null}){
  const side=this.s.players[p];if(side.extra.length>=4)return null;
  const slot=[0,1,2,3].find(n=>!side.extra.some(c=>c.slot===n));
  const token={uid:String(++this.s.uid),id:'TOKEN',owner:p,epoch:0,token:true,name,power,zone,fugaz,redemption,onDestroy,createdTurn:this.s.turn,slot,public:true,ready:this.s.turn,
   tokenDefinition:{id:'TOKEN',name,type:'Ficha',power,block:power,zone,cost:null,alternateCost:null}};
  side.extra.push(token);return token;
 }
 destroyToken(uid,cause){const f=this.find(uid);if(!f?.card.token)return false;
  f.card.epoch++;this.s.players[f.p][f.z].splice(f.i,1);
  if(f.card.onDestroy)this.push({kind:'effect',p:f.p,ops:f.card.onDestroy,context:{p:f.p},label:f.card.name+' — destruída'});if(f.card.redemption&&cause==='redemption-condition')this.s.players[f.p].hp+=2;
  this.log('Ficha '+f.card.name+' destruída'+(cause==='redemption-condition'?'; ganha 2 de vida.':'.'),'efeito de ficha');return true;
 }
 tokenAttackCost(card){return card?.token&&(card.balanceToken||/^Galacstrix\b/i.test(card.name||''))?1:0;}
 tokenAvailable(p,uid){const f=this.find(uid);return !!(f?.p===p&&f.z==='extra'&&f.card.token&&f.card.ready<=this.s.turn&&f.card.usedTurn!==this.s.turn&&!f.card.pendingUse);}
 beginTokenUse(p,uid,kind,zone){
  if(!this.tokenAvailable(p,uid))throw Error('Ficha indisponível ou já utilizada neste turno.');
  if(!['attack','block'].includes(kind))throw Error('Uso de ficha inválido.');
  const token=this.find(uid).card,attackZone=token.zone||zone;
  if(kind==='attack'&&!['Inferior','Meio','Superior'].includes(attackZone))throw Error('Declare a Zona de Combate da ficha.');
  token.usedTurn=this.s.turn;token.pendingUse=kind;
  return {uid,p,kind,power:token.power,zone:kind==='attack'?attackZone:null};
 }
 finishTokenUse(uid){const f=this.find(uid);if(!f?.card.token||!f.card.pendingUse)return false;
  delete f.card.pendingUse;if(f.card.fugaz)this.destroyToken(uid,'fugaz-use');return true;
 }
 resolveTokenTurnEnd(){for(const side of this.s.players)for(const token of [...side.extra]){
  if(token.token&&token.fugaz&&token.createdTurn<=this.s.turn)this.destroyToken(token.uid,'fugaz-end');
 }}
 resolveTokenTurnStart(){for(let p=0;p<2;p++)for(const c of [...this.s.players[p].extra]){
  if(c.token&&c.redemption&&c.createdTurn===this.s.turn-1&&(this.s.players[p].receivedDamage||0)>0)this.destroyToken(c.uid,'redemption-condition');
 }}
 supported(cardId){return SUPPORTED.includes(this.def(cardId)?.number);}
 validateDeck(d){
  if(!d||typeof d!=='object'||!d.main||!d.extra)throw Error('Formato de baralho inválido.');
  const fighter=this.def(d.fighter);if(fighter?.type!=='Lutador'||!this.supported(fighter.id))throw Error('Lutador inválido.');
  let n=0,g=0;const names={};
  for(const [cardId,q] of Object.entries(d.main)){
   const c=this.def(cardId);if(!c||c.type==='Lutador'||!Number.isInteger(q)||q<1||q>3)throw Error('Carta ou quantidade inválida no principal.');
   if(!this.supported(cardId))throw Error('Script ainda não homologado: '+c.name+'. Consulte a lista de cartas automatizadas.');
   if(c.color!=='Genérica'&&!fighter.colors.includes(c.color))throw Error('Cor incompatível: '+c.name);
   names[c.name]=(names[c.name]||0)+q;if(names[c.name]>3)throw Error('Mais de três cópias: '+c.name);n+=q;if(c.color==='Genérica')g+=q;
  }
  if(n!==40)throw Error('Principal incompleto: '+n+' de 40 ações. Complete o baralho no editor.');if(g>15)throw Error('Principal com '+g+' ações genéricas; o limite é 15.');
  const reserve=Object.entries(d.extra);let total=0;for(const [cardId,q] of reserve){const c=this.def(cardId);if(!c||c.type==='Lutador'||!Number.isInteger(q)||q<1||q>3)throw Error('Carta ou quantidade inválida no adicional.');if(!c.specialPermanent&&c.color!=='Genérica'&&!fighter.colors.includes(c.color))throw Error('Cor incompatível no adicional: '+c.name);if(!this.supported(cardId))throw Error('Carta do adicional sem script: '+c.name);names[c.name]=(names[c.name]||0)+q;if(names[c.name]>3)throw Error('Mais de três cópias de '+c.name+' somando principal e adicional.');total+=q;}
  if(total!==0&&total!==15)throw Error('Adicional incompleto: '+total+' de 15 cartas. Complete-o ou jogue apenas com o principal (3.2.1).');
  return true;
 }
 starter(){const main={};const own=[90,91,93,95,96,98,99,100,101,104,105,106];for(const n of own)main[id(n)]=3;main[id(1)]=2;main[id(10)]=2;return {name:'Blossom — Alfa automatizada',fighter:id(89),main,extra:{}};}
 lenYinStarter(){const main={};for(const n of [71,72,73,74,75,77,79,80,81,83,85,87])main[id(n)]=3;main[id(1)]=2;main[id(10)]=2;return {name:'Len Yin — baralho pronto',fighter:id(70),main,extra:{}};}
 fighterStarter(number){if(number===89)return this.starter();if(number===70)return this.lenYinStarter();const own=number===32?[33,34,35,40,41,42,43,46,49,50]:number===51?[52,53,54,60,61,62,63,64,66,67]:null;if(!own)throw Error('Lutador inválido.');const main={};for(const n of own)main[id(n)]=3;for(const [n,q] of [[1,3],[6,3],[9,2],[10,2]])main[id(n)]=q;return {name:this.def(id(number)).name+' — baralho pronto',fighter:id(number),main,extra:{}};}
 rng(n){let x=this.s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.s.rng=x>>>0;return this.s.rng%n;}
 shuffle(a){for(let i=a.length-1;i>0;i--){let j=this.rng(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 log(text,rule){this.s.log.push({text,rule});}
 card(cardId,p){return {uid:String(++this.s.uid),id:cardId,owner:p,epoch:0,active:true,ready:0,public:false};}
 start(a,b,first=0,seed=12345,mode='advanced'){const initialEnergy=GameModes.get(mode).energy;if(!initialEnergy)throw Error('Modo de jogo inválido.');this.validateDeck(a);this.validateDeck(b);if(![0,1].includes(first)||!Number.isInteger(seed)||seed<1||seed>4294967295)throw Error('Preparação inválida.');
  this.initial={a:copy(a),b:copy(b),first,seed,mode,ruleset:RULESET_ID};this.commands=[];
  this.s={version:VERSION,ruleset:RULESET_ID,revision:0,rng:seed,uid:0,next:0,turn:1,active:first,priority:0,mode,phase:'mulligan',passes:0,ending:false,autoEnd:false,players:[],stack:[],combats:[],completed:[],history:[],choice:null,winner:null,log:[]};
  for(const [p,d] of [a,b].entries()){
   const shuffledIds=[];for(const [cardId,q] of Object.entries(d.main))for(let i=0;i<q;i++)shuffledIds.push(cardId);this.shuffle(shuffledIds);const deck=shuffledIds.map(cardId=>this.card(cardId,p));
   this.s.players.push({name:d.name,fighter:this.card(d.fighter,p),hp:20,power:this.def(d.fighter).power,od:0,deck,hand:deck.splice(0,4),stamina:[],extra:[],arena:[],discard:[],banished:[],mulligan:false,replenished:false,prepared:false,played:[],handBlock:false,damage:0,costDown:0,onceUsed:{}});
   // Ordem atual: três energias, depois quatro cartas para a mão.
   const side=this.s.players[p];side.deck.unshift(...side.hand);side.stamina=side.deck.splice(0,initialEnergy);side.hand=side.deck.splice(0,4);side.stamina.forEach(c=>c.public=true);
  }
  this.log('Preparação ('+mode+'): '+initialEnergy+' energias, 4 cartas na mão e 20 de vida.','5.1');return this.view(0);
 }
 current(){return this.s.combats.at(-1)||null;}
 find(uid){for(let p=0;p<2;p++){const s=this.s.players[p];if(s.fighter.uid===uid)return {p,z:'fighter',i:0,card:s.fighter};for(const z of ['hand','stamina','extra','arena','deck','discard','banished']){const i=s[z].findIndex(c=>c.uid===uid);if(i>=0)return {p,z,i,card:s[z][i]};}}return null;}
 move(uid,z){const f=this.find(uid);if(!f)throw Error('Carta ausente.');f.p===undefined&&(()=>{throw Error('Carta inválida');})();if(z==='hand'&&f.card.public)f.card.knownTurn=this.s.turn;f.card.epoch++;delete f.card.bonus;if(z!=='extra')delete f.card.slot;f.card.public=!['deck','hand','extra'].includes(z);this.s.players[f.p][f.z].splice(f.i,1);this.s.players[f.p][z].push(f.card);return f.card;}
 usable(p){return [...this.s.players[p].hand,...this.s.players[p].extra.filter(c=>c.ready<=this.s.turn&&(!c.token||this.tokenAvailable(p,c.uid)&&c.power>0))];}
 energies(p,active){return this.s.players[p].stamina.filter(c=>c.active===active);}
 canPrepare(p){const s=this.s,side=s?.players[p];return !!side&&s.winner===null&&s.phase==='preparation'&&s.preparedTurn&&p===s.active&&s.priority===p&&!s.choice&&!s.stack.length&&!this.current()&&!s.ending&&!s.autoEnd&&!side.prepared&&side.extra.length<4;}
 canFighterSkill(p){const s=this.s;return p===s.active&&s.priority===p&&!s.choice&&!s.stack.length&&!this.current()&&!s.ending&&!s.autoEnd&&s.preparedTurn&&['preparation','combat'].includes(s.phase)&&this.energies(p,true).length>=1&&this.script(s.players[p].fighter).startSkill&&s.players[p].startSkill&&!s.players[p].fighterTapped;}
 canIndependent(p){return p===this.s.active&&this.s.phase==='combat'&&!this.s.ending&&!this.s.autoEnd&&!this.current()&&!this.s.stack.length;}
 paymentEnergies(p,active){return this.energies(p,active).filter(c=>!c.r05Lock);}
 guardCost(p,card,index=0){return this.def(card).cost;}
 draw(p,n,mechanical){if(this.s.winner!==null)return;if(mechanical)n=Math.min(n,Math.max(0,4-this.s.players[p].hand.length));if(!n)return;
  const side=this.s.players[p];if(side.deck.length<n){this.s.winner=other(p);this.s.phase='finished';this.log((p?'IA':'Você')+' perdeu por Deck Out.','12.3.1');return;}
  for(let i=0;i<n;i++){const c=side.deck.shift();c.epoch++;c.public=false;side.hand.push(c);}this.log((p?'IA':'Você')+' comprou '+n+' carta(s).',mechanical?'12.1.1':'12.1.2');
 }
 damage(p,n,source=other(p)){if(this.s.winner!==null)return;n=Math.max(0,Math.floor(n));this.s.players[p].hp-=n;this.s.players[p].receivedDamage=(this.s.players[p].receivedDamage||0)+n;if([0,1].includes(source))this.s.players[source].damage+=n;if(n)this.log((p?'IA':'Você')+' recebeu '+n+' de dano.','10.1');if(this.s.players[p].hp<=0){this.s.winner=other(p);this.s.phase='finished';this.log((p?'Você':'IA')+' venceu por dano.','17.2.1');}}
 push(link){link.id=++this.s.next;this.s.stack.push(link);return link;}
 payment(p,c,mode='normal',x=0){const d=this.def(c);if(this.script(c).energyFree&&mode==='normal')return {own:0,opp:0};if(mode==='banishCopy'){if(!this.script(c).discardCopy||this.find(c.uid)?.z!=='discard')throw Error('Banimento exige Frenecticale no Descarte ou na Arena.');return {own:0,opp:0};}if(mode==='life'){if(!this.script(c).fromDiscardLife||this.find(c.uid)?.z!=='discard')throw Error('Pagamento de vida exige este Redassalt no Descarte.');return {own:0,opp:0,life:d.cost};}const zoneCost=d.type==='Golpe'?this.zoneModifier(d.zone,'cost'):0;const normal=typeof d.cost==='number'?Math.max(0,d.cost-(d.type==='Golpe'?this.s.players[p].costDown:0))+zoneCost:x;
  if(!Number.isInteger(normal)||normal<0||typeof d.cost!=='number'&&normal>7)throw Error('Custo X inválido.');
  if(mode==='alternative'){if(!Number.isInteger(d.alternateCost))throw Error('Sem custo alternativo.');return {own:0,opp:d.alternateCost+zoneCost+(d.type==='Golpe'?(this.s.players[p].nextAlternateCost||0):0)};}
  if(mode!=='normal')throw Error('Método de pagamento inválido.');return {own:normal,opp:0};
 }
 beginPayment(p,intent,pay){if(!intent.galacstrixChosen){const uids=(intent.type==='block'?intent.uids:[intent.uid]).filter(Boolean).filter(uid=>this.script(this.find(uid).card).tokenCost);if(uids.length){this.s.choice={kind:'galacstrixCost',player:p,uids,index:0,intent:copy(intent),pay:copy(pay),selected:[]};this.s.priority=p;return;}}if(pay.life&&this.s.players[p].hp<pay.life)throw Error('Vida insuficiente para pagar o custo impresso.');if(this.energies(p,true).length<pay.own||this.paymentEnergies(other(p),false).length<pay.opp)throw Error('Não há energias suficientes para o custo (8.2).');
  if(intent.selectEnergy&&pay.own&&!intent.energyUids){this.s.choice={kind:'ownEnergy',player:p,payer:p,intent:copy(intent),pay:copy(pay),required:pay.own};this.s.priority=p;return;}
  if(pay.opp){this.s.choice={kind:'energy',player:other(p),payer:p,intent:copy(intent),pay,required:pay.opp};this.s.priority=other(p);return;}
  this.completePayment(p,intent,pay,[]);
 }
 completePayment(p,intent,pay,opponentUids){
  if(opponentUids.length!==pay.opp||new Set(opponentUids).size!==pay.opp||opponentUids.some(uid=>!this.paymentEnergies(other(p),false).some(c=>c.uid===uid)))throw Error('O dono deve escolher exatamente as energias inativas exigidas.');
  const own=intent.energyUids||this.energies(p,true).slice(0,pay.own).map(c=>c.uid);
  if(new Set(own).size!==pay.own||own.some(uid=>!this.energies(p,true).some(c=>c.uid===uid)))throw Error('Escolha de energias próprias inválida.');
  if(pay.life){const side=this.s.players[p];side.hp-=pay.life;this.log((p?'IA':'Você')+' pagou '+pay.life+' de vida para jogar do Descarte.','efeito de carta');if(side.hp<=0){this.s.winner=other(p);this.s.phase='finished';this.s.choice=null;this.log((p?'Você':'IA')+' venceu após o adversário pagar toda a vida.','17.2.1');return;}}own.forEach(uid=>this.find(uid).card.active=false);opponentUids.forEach(uid=>this.find(uid).card.active=true);
  if(p===this.s.active&&pay.own&&this.energies(p,true).length===0)this.s.autoEnd=true;
  // REVIDE impresso depende do pagamento, não da janela de contra-ataque.
  this.s.choice=null;this.s.passes=0;const link=this.activatePaid(p,{...intent,inactivePaid:pay.opp>0});this.s.priority=other(p);
  if(p===this.s.active&&opponentUids.length){this.draw(other(p),1,true);if(this.s.winner===null){this.s.choice={kind:'revide',player:other(p),suspended:link?.id,cause:{payer:p,energyUids:[...opponentUids]}};this.s.priority=other(p);this.log((p?'IA':'Você')+' utilizou '+opponentUids.length+' estâmina(s) inativa(s) do adversário: compra mecânica de 1 carta e oportunidade opcional de Revide.','11.1');}}
 }
 activatePaid(p,a){const side=this.s.players[p];
  if(a.type==='tokenAttack'){const use=this.beginTokenUse(p,a.uid,'attack',a.zone),token=this.find(a.uid).card,b={id:++this.s.next,p,uid:a.uid,attack:use.power,zone:use.zone,blocks:[],blocked:false,cancelled:false,flow:false,revide:false,from:'extra',token:true};this.s.combats.push(b);return this.push({kind:'attack',p,uid:a.uid,combat:b.id,context:{p},label:token.name});}
  if(a.type==='fighterSkill'){
   const boydd=this.def(side.fighter).number===32;side.fighterTapped=true;side.overdriveLocked=true;
   return this.push({kind:'effect',p,ops:[{op:boydd?'nextSocoNoGuards':'lenFocusBonus'}],context:{p},label:this.def(side.fighter).name+' — habilidade'});
  }
  if(a.type==='replenish'){side.replenished=true;return this.push({kind:'replenish',p,n:a.n});}
  if(a.type==='startSkill'){side.startSkill=false;side.fighterTapped=true;side.overdriveLocked=true;return this.push({kind:'effect',p,ops:[{op:'draw',n:1}],context:{p},label:'Blossom: virar o lutador e comprar 1; Overdrive bloqueado neste turno'});}
  if(a.type==='block'){
   const b=this.current();b.blocked=true;let last=null;for(const uid of a.galacstrixUids||[])this.push({kind:'effect',p,ops:this.script(this.find(uid).card).tokenEffect,context:{p},label:'Galacstrix — criar ficha'});
   for(const uid of Object.values(a.psychicDiscards||{}))if(uid)this.move(uid,'discard');for(const uid of (a.guardDiscards||[]))this.move(uid,'discard');for(const uid of Object.values(a.suruyaDiscards||{}))if(uid)this.move(uid,'discard');
   if(a.uids.length){b.aggregateBlockBonus=(side.nextBlockBonus||0)+(side.nextBlockTurn||0)+this.zoneModifier(b.zone,'block');side.nextBlockBonus=0;side.nextBlockTurn=0;}
   for(const uid of a.uids){const loc=this.find(uid),c=loc.card,sc=this.script(c),d=this.def(c);const bonus=sc.blockBonus?.(this,p)||0,origin=loc.z;if(c.token)this.beginTokenUse(p,uid,'block');else this.move(uid,'arena');
    const block={uid,value:d.block+bonus+(a.suruyaDiscards?.[uid]?1:0),origin,cancelled:false};b.blocks.push(block);if(origin==='hand')side.handBlock=true;
    if(d.type==='Guarda'){const flow=side.played.length>0;side.played.push({id:c.id,subtype:d.subtype});last=this.push({kind:'guard',p,uid,combat:b.id,ops:sc.onBlock||[],context:{p,flow,source:uid,combat:b.id,psychicPaid:!!a.psychicDiscards?.[uid]},label:d.name});}
   }
   return last;
  }
  for(const uid of a.galacstrixUids||[])this.push({kind:'effect',p,ops:this.script(this.find(uid).card).tokenEffect,context:{p},label:'Galacstrix — criar ficha'});if(a.copyUid)this.move(a.copyUid,'banished');if(a.psychicDiscardUid)this.move(a.psychicDiscardUid,'discard');const loc=this.find(a.uid),c=loc.card,d=this.def(c),sc=this.script(c),flow=side.played.length>0,from=loc.z;
  const lenBonus=d.type==='Golpe'&&sc.focusThreshold&&!side.focusPlayed?(side.lenFocusBonus||0):0;
  if(d.type==='Golpe'&&sc.focusThreshold){side.focusPlayed=true;side.lenFocusBonus=0;}
  const nextSocoNoGuards=d.type==='Golpe'&&d.subtype==='Soco'&&!!side.nextSocoNoGuards;
  if(d.type==='Golpe'&&d.subtype==='Soco')side.nextSocoNoGuards=false;
  const focusSoco=d.type==='Golpe'&&d.subtype==='Soco'&&!!sc.focusThreshold;const redassalt=d.type==='Golpe'&&d.name.toLowerCase().includes('redassalt');const archetypeBonus=redassalt?(side.nextRedassaltBonus||0):0;if(redassalt)side.nextRedassaltBonus=0;const pendingBonus=d.type==='Golpe'?archetypeBonus+(side.nextAttackBonus||0)+lenBonus+(focusSoco?(side.nextFocusSocoBonus||0):0):0;if(focusSoco)side.nextFocusSocoBonus=0;
  const ownCardBonus=sc.attackBonus?.(this,p)||0,revideBonus=a.inactivePaid?(sc.revideAttack||0):0,overdriveBonus=a.free?side.power:0,zoneBonus=d.type==='Golpe'?this.zoneModifier(d.zone,'attack')+this.consumeZoneNextAttack(d.zone):0;
  const bonus=ownCardBonus+revideBonus+overdriveBonus+pendingBonus+zoneBonus;
  // Consumido pela realização do próximo Golpe, inclusive se ele for cancelado.
  // Truques e mudança de turno não consomem esse bônus.
  if(d.type==='Golpe'){side.nextAttackBonus=0;side.nextAlternateCost=0;}
  this.move(c.uid,'arena');side.played.push({id:c.id,subtype:d.subtype});if(sc.oncePerTurn)side.onceUsed[d.name]=true;const ctx={p,flow,revide:!!a.inactivePaid,x:a.x||0,target:a.target,blockTarget:a.blockTarget,option:a.option,source:c.uid,psychicPaid:!!a.psychicDiscardUid};
  let link;
  if(d.type==='Golpe'){
   const combat={id:++this.s.next,p,uid:c.uid,attack:(sc.baseAttack?.(this,p)??d.power)+bonus,zone:d.zone,blocks:[],blocked:false,cancelled:false,flow,revide:!!a.inactivePaid,responseRevide:!!a.revide,resume:a.suspended||null,from,preDamage:0};
   combat.attackModifiers=[{name:d.name+' · ataque base',value:combat.attack-bonus},{name:d.name+' · efeito próprio',value:ownCardBonus},{name:d.name+' · REVIDE',value:revideBonus},{name:'Overdrive · Poder',value:overdriveBonus},{name:'Len Yin · primeiro Foco',value:lenBonus},{name:'Efeitos anteriores',value:pendingBonus-lenBonus},{name:'Efeitos da Zona',value:zoneBonus}].filter(m=>m.value);
   this.s.combats.push(combat);link=this.push({kind:'attack',p,uid:c.uid,combat:combat.id,context:ctx,label:d.name});ctx.combat=combat.id;
   combat.noGuards=nextSocoNoGuards;
   combat.impetusBase=sc.impetusValue?.(this,p)??sc.impetus??0;combat.extraImpetus=d.subtype==='Corte'?(side.nextCutImpetus||0):0;if(d.subtype==='Corte')side.nextCutImpetus=0;if(combat.impetusBase||combat.extraImpetus||(a.inactivePaid&&sc.revideImpetus)){combat.firstImpetus=!side.impetusPlayed;side.impetusPlayed=true;(this.s.impetusActions||(this.s.impetusActions=[])).push({uid:c.uid,combat:combat.id,turn:this.s.turn});}
   if(sc.onPlay?.length)this.push({kind:'effect',p,ops:sc.onPlay,context:ctx,label:d.name+' — efeito'});
   this.s.priority=other(p);
  }else{
   ctx.combat=this.current()?.id;link=this.push({kind:'trick',p,uid:c.uid,ops:sc.onPlay||[],context:ctx,label:d.name});
  }
  this.log((p?'IA':'Você')+' jogou '+d.name+(a.revide?' em Revide':'')+'.','8.1.4');return link;
 }
 execute(p,a){if(!this.s)throw Error('Inicie uma partida.');if(this.s.winner!==null)throw Error('A partida terminou.');if(![0,1].includes(p))throw Error('Jogador inválido.');const before=copy(this.s);
  try{this.apply(p,a);this.assertInvariants();this.s.revision++;this.commands.push({p,action:copy(a)});return {accepted:true,revision:this.s.revision};}catch(error){this.s=before;return {accepted:false,reason:error.message,revision:this.s.revision};}
 }
 apply(p,a){if(this.s.phase==='mulligan'){
   if(this.s.players[p].mulligan)throw Error('Mulligan já concluído.');if(a.type!=='mulligan')throw Error('Conclua o mulligan.');
   const hand=a.hand||[],energy=a.energy||[];if(hand.length!==energy.length||hand.length>2||new Set([...hand,...energy]).size!==hand.length*2)throw Error('Troque até duas cartas, em quantidades iguais.');
   hand.forEach(uid=>{if(this.find(uid)?.p!==p||this.find(uid)?.z!=='hand')throw Error('Carta da mão inválida.');});energy.forEach(uid=>{if(this.find(uid)?.p!==p||this.find(uid)?.z!=='stamina')throw Error('Energia inválida.');});
   hand.forEach((uid,i)=>{const h=this.find(uid),e=this.find(energy[i]);this.s.players[p].hand[h.i]=e.card;this.s.players[p].stamina[e.i]=h.card;e.card.public=false;h.card.public=true;h.card.active=true;h.card.epoch++;e.card.epoch++;e.card.knownTurn=this.s.turn;});
   this.s.players[p].mulligan=true;if(this.s.players.every(x=>x.mulligan))this.newTurn();return;
  }
  if(this.s.choice){const choice=this.s.choice;if(choice.player!==p)throw Error('A decisão pertence ao adversário.');
   if(choice.kind==='galacstrixCost'){if(a.type!=='chooseGalacstrix'||typeof a.use!=='boolean')throw Error('Escolha se deseja pagar pela ficha.');const uid=choice.uids[choice.index],cost=this.script(this.find(uid).card).tokenCost;if(a.use){if(this.energies(p,true).length<choice.pay.own+cost)throw Error('Energia insuficiente para criar a ficha.');choice.pay.own+=cost;choice.selected.push(uid);}choice.index++;if(choice.index<choice.uids.length)return;this.s.choice=null;this.beginPayment(p,{...choice.intent,galacstrixChosen:true,galacstrixUids:choice.selected},choice.pay);return;}if(choice.kind==='ownEnergy'){const uids=a.uids||[];if(a.type!=='chooseOwnEnergy'||uids.length!==choice.required||new Set(uids).size!==choice.required||uids.some(uid=>!this.energies(p,true).some(c=>c.uid===uid)))throw Error('Selecione exatamente as energias ativas exigidas.');this.s.choice=null;this.beginPayment(p,{...choice.intent,energyUids:uids},choice.pay);return;}if(choice.kind==='energy'){if(a.type!=='chooseEnergy')throw Error('Escolha as energias para pagar o custo anunciado.');this.completePayment(choice.payer,choice.intent,choice.pay,a.uids||[]);return;}
   if(choice.kind==='triggers'){if(a.type!=='orderTriggers')throw Error('Ordene seus gatilhos simultâneos.');const links=choice.links,ids=a.ids||[];if(ids.length!==links.length||new Set(ids).size!==links.length||ids.some(id=>!links.some(l=>l.orderId===id)))throw Error('Ordem de gatilhos inválida.');ids.forEach(id=>this.push(links.find(l=>l.orderId===id)));this.s.triggerGroups.shift();this.s.choice=null;this.advanceTriggerGroups();return;}
   if(choice.kind==='psychicCost'){const skip=a.type==='declinePsychic';if(!skip&&(a.type!=='choosePsychicCost'||!choice.uids.includes(a.uid)))throw Error('Escolha descartar uma carta Psychic ou continuar sem o efeito.');if(choice.guards){choice.discards[choice.guards.shift()]=skip?null:a.uid;choice.uids=choice.uids.filter(uid=>uid!==a.uid);if(choice.guards.length)return;this.s.choice=null;this.block(p,{...choice.intent,psychicDiscards:choice.discards});}else{this.s.choice=null;this.play(p,{...choice.intent,...(skip?{psychicEffect:false}:{psychicDiscardUid:a.uid})},choice.revide);}return;}if(choice.kind==='psychicGuess'){if(a.type!=='declarePsychicType'||!['Golpe','Truque','Guarda'].includes(a.cardType))throw Error('Declare Golpe, Truque ou Guarda.');const hand=this.s.players[other(p)].hand;this.s.choice=null;if(hand.length){const c=hand[this.rng(hand.length)],correct=this.def(c).type===a.cardType;this.log('Psychic: carta revelada do tipo '+this.def(c).type+'; declaração '+(correct?'correta.':'incorreta.'),'efeito de carta');if(correct){if(choice.reward==='heal')this.s.players[p].hp+=3;else this.damage(other(p),3);}if(this.s.winner===null)this.s.choice={kind:'psychicReveal',player:p,uids:[c.uid]};}this.s.priority=this.s.active;return;}if(choice.kind==='psychicReveal'){if(a.type!=='acknowledgePsychic')throw Error('Confirme a revelação.');this.s.choice=null;this.s.priority=this.s.active;return;}if(choice.kind==='namedSearch'){if(a.type!=='chooseNamedCard'||!choice.uids.includes(a.uid)||this.find(a.uid)?.z!==choice.from)throw Error('Escolha uma carta válida para esta busca.');const name=this.def(this.find(a.uid).card).name;this.move(a.uid,choice.to);if(choice.from==='deck')this.shuffle(this.s.players[p].deck);this.log('Carta buscada: '+name+'.','efeito de carta');this.s.choice=null;if(choice.damageAfter)this.damage(p,choice.damageAfter,p);this.s.priority=this.s.active;return;}if(choice.kind==='spiritLuck'){if(a.type!=='chooseSpiritCard'||!choice.uids.includes(a.uid)||this.find(a.uid)?.z!=='deck')throw Error('Escolha uma das cartas observadas.');const side=this.s.players[p],cards=choice.uids.map(uid=>this.find(uid).card),chosen=cards.find(c=>c.uid===a.uid),rest=cards.filter(c=>c.uid!==a.uid);side.deck=side.deck.filter(c=>!choice.uids.includes(c.uid));this.shuffle(rest);side.deck.unshift(chosen);side.deck.push(...rest);this.s.choice=null;this.draw(p,1,false);this.s.priority=this.s.active;return;}if(choice.kind==='sharvat'){if(a.type!=='chooseSharvatZone'||!['Inferior','Meio','Superior'].includes(a.zone))throw Error('Escolha uma Zona de Combate.');(this.s.zoneModifiers||(this.s.zoneModifiers=[])).push({zone:a.zone,block:2,untilTurn:this.s.turn+1});this.s.choice=null;this.s.priority=this.s.active;return;}if(['ascension','honored'].includes(choice.kind)){const honored=choice.kind==='honored';if(a.type!==(honored?'chooseHonored':'chooseAscension')||a.uid&&!choice.uids.includes(a.uid))throw Error('Escolha uma carta da Zona Extra ou recuse.');if(a.uid){const f=this.find(a.uid);if(f?.p!==p||f.z!==(honored?'discard':'extra'))throw Error('Carta indisponível.');const bonus=honored?this.def(f.card).power:(this.def(f.card).type==='Guarda'?this.def(f.card).block:0);const b=this.s.combats.find(b=>b.id===choice.combat),guard=b?.blocks.find(g=>g.uid===choice.source);if(guard)guard.value+=bonus;if(honored)this.move(a.uid,'banished');else if(f.card.token)this.destroyToken(a.uid,'other-card');else this.move(a.uid,'discard');}this.s.choice=null;this.s.priority=this.s.active;return;}if(choice.kind==='extraEffect'){if(a.type!=='selectExtraEffect'||!choice.uids.includes(a.uid)||this.find(a.uid)?.z!=='extra')throw Error('Escolha uma Zona Extra válida.');(choice.selected||(choice.selected=[])).push(a.uid);choice.uids=choice.uids.filter(uid=>uid!==a.uid);if(choice.selected.length<(choice.required||1))return;for(const uid of choice.selected){const f=this.find(uid);if(f.card.token)this.destroyToken(uid,'other-card');else this.move(uid,'discard');}this.s.choice=null;if(choice.draw)this.draw(p,choice.draw,false);this.s.priority=this.s.active;return;}if(choice.kind==='searchExtraGuard'){if(a.type!=='selectExtraGuard'||!choice.uids.includes(a.uid)||this.find(a.uid)?.z!=='deck')throw Error('Escolha uma Guarda do baralho.');const side=this.s.players[p],slot=a.slot??[0,1,2,3].find(n=>!side.extra.some(c=>c.slot===n));if(!Number.isInteger(slot)||slot<0||slot>3||side.extra.some(c=>c.slot===slot))throw Error('Escolha uma Zona Extra livre.');const c=this.move(a.uid,'extra');c.slot=slot;c.ready=this.s.turn;c.public=false;c.publicUntil=0;this.shuffle(side.deck);this.s.choice=null;this.s.priority=this.s.active;return;}if(choice.kind==='guardCost'){
if(a.type!=='chooseGuardDiscard'||!choice.uids.includes(a.uid))throw Error('Escolha uma carta para descartar.');choice.selected.push(a.uid);choice.uids=choice.uids.filter(uid=>uid!==a.uid);if(choice.selected.length<choice.required)return;this.s.choice=null;this.block(p,{...choice.intent,guardDiscards:choice.selected});return;}if(choice.kind==='suruya'){if(a.type!=='chooseSuruya'||a.uid&&(!choice.uids.includes(a.uid)||Object.values(choice.discards).includes(a.uid)))throw Error('Escolha uma carta com Ímpeto ou não descarte.');choice.discards[choice.guards.shift()]=a.uid||null;if(choice.guards.length){choice.uids=choice.uids.filter(uid=>!Object.values(choice.discards).includes(uid));return;}this.s.choice=null;this.block(p,{...choice.intent,suruyaDiscards:choice.discards});return;}if(['searchGuard','searchFlow'].includes(choice.kind)){if(a.type!==(choice.kind==='searchFlow'?'selectFlowCard':'selectSearchCard')||!choice.uids.includes(a.uid)||this.find(a.uid)?.z!=='deck')throw Error('Escolha uma Guarda do baralho.');const c=this.find(a.uid).card;this.log('Carta buscada: '+this.def(c).name+'.','efeito de carta');this.move(a.uid,'hand');this.shuffle(this.s.players[p].deck);this.s.choice=null;this.s.priority=this.s.active;return;}if(choice.kind==='discard'){if(a.type!=='discardChoice'||!choice.uids.includes(a.uid))throw Error('Escolha uma carta da mão.');this.move(a.uid,'discard');if(choice.nextCutImpetus)this.s.players[p].nextCutImpetus=(this.s.players[p].nextCutImpetus||0)+choice.nextCutImpetus;this.s.choice=null;if(choice.followSearch)this.runOps([choice.followSearch],{p});this.s.priority=this.s.active;return;}
   if(choice.kind==='revide'){
    if(a.type==='declineRevide'){this.s.choice=null;this.s.priority=this.current()&&!this.current().blocked?other(this.current().p):other(this.s.active);this.s.passes=0;return;}
    if(a.type!=='play'&&a.type!=='overdrive'&&a.type!=='fighterOverdrive')throw Error('Escolha um golpe para Revide ou recuse.');
    if(a.type==='fighterOverdrive'){this.s.choice=null;this.fighterOverdrive(p,{...a,suspended:choice.suspended},true);return;}
    a={...a,revide:true,suspended:choice.suspended};this.s.choice=null;this.play(p,a,true);return;
   }
   throw Error('Decisão desconhecida.');
  }
  if(p!==this.s.priority)throw Error('A prioridade de ação é do adversário (7.1).');
  if(a.type==='pass'){this.pass(p);return;}
  if(a.type==='prepare'){
   if(!this.canPrepare(p))throw Error('Prepare uma carta apenas no Início de Turno, após o preparo automático e sem efeitos pendentes. O limite é uma por turno e quatro Zonas Extras.');
   const f=this.find(a.uid);if(f?.p!==p||f.z!=='hand')throw Error('Prepare uma carta da mão.');
   const occupied=this.s.players[p].extra.map(c=>c.slot),slot=a.slot??[0,1,2,3].find(n=>!occupied.includes(n));
   if(!Number.isInteger(slot)||slot<0||slot>3||occupied.includes(slot))throw Error('Escolha uma Zona Extra vazia entre 1 e 4.');
   const c=this.move(a.uid,'extra');c.slot=slot;c.ready=this.s.turn+1;c.public=false;c.publicUntil=c.knownTurn===this.s.turn?this.s.turn:0;this.s.players[p].prepared=true;this.log('Carta preparada na Zona Extra '+(slot+1)+'; disponível no turno individual seguinte.','4.2.3');this.s.priority=other(p);this.s.passes=0;return;
  }
  if(a.type==='end'){
   if(!this.canIndependent(p))throw Error('Conclua os combates e respostas antes de encerrar.');this.s.ending=true;this.s.priority=other(p);this.s.passes=0;this.log('Encerramento anunciado.','6.4');return;
  }
  if(a.type==='replenish'){
   if(p!==this.s.active||this.s.players[p].replenished||this.s.ending||(!this.current()&&this.s.autoEnd))throw Error('Reposição indisponível.');
   if(!Number.isInteger(a.n)||a.n<1||a.n>4||a.n>4-this.s.players[p].hand.length)throw Error('Reposição limitada pela capacidade de quatro na mão (12.2.3).');this.beginPayment(p,a,{own:a.n,opp:0});return;
  }
  if(a.type==='startSkill'){
   if(!this.canFighterSkill(p))throw Error('A habilidade de Blossom exige um estado aberto no seu turno e o lutador desvirado.');this.beginPayment(p,a,{own:1,opp:0});return;
  }
  if(a.type==='tokenAttack'){if(!this.canIndependent(p)||!this.tokenAvailable(p,a.uid))throw Error('Ataque de ficha exige sua fase de combate livre e uma ficha disponível.');const token=this.find(a.uid).card;if(!['Inferior','Meio','Superior'].includes(token.zone||a.zone))throw Error('Zona inválida.');this.beginPayment(p,a,{own:this.tokenAttackCost(token),opp:0});return;}if(a.type==='block'){this.block(p,a);return;}
  if(a.type==='fighterSkill'){if(!this.canActivatedFighterSkill(p))throw Error('Habilidade indisponível ou custo insuficiente.');this.beginPayment(p,a,{own:1,opp:0});return;}
  if(a.type==='fighterOverdrive'){this.fighterOverdrive(p,a);return;}
  if(a.type==='finta'){this.finta(p,a);return;}
  if(a.type==='desvio'){const b=this.current(),f=this.find(a.uid),g=this.find(a.golpeUid);if(!b||b.finished||b.cancelled||f?.p!==p||f.z!=='hand'||!this.script(f.card).desvio||g?.p!==p||g.z!=='hand'||this.def(g.card).type!=='Golpe'||this.def(g.card).zone!==b.zone)throw Error('Desvio exige esta carta e um Golpe da mão da mesma Zona do alvo.');this.move(a.uid,'discard');this.move(a.golpeUid,'discard');this.push({kind:'desvio',p,combat:b.id,label:'Desvio'});this.s.priority=other(p);this.s.passes=0;return;}
  if(a.type==='play'||a.type==='overdrive'){this.play(p,a,false);return;}
  throw Error('Comando não reconhecido.');
 }
 play(p,a,revide){
  if(a.type==='overdrive'){
   if(this.s.players[p].overdriveLocked||this.s.players[p].fighterTapped)throw Error('O lutador virado não pode realizar Overdrive.');
   if(this.s.players[p].od!==3)throw Error('Complete a sequência para ativar Overdrive (13.2).');
   const f=this.find(a.uid);if(f?.p!==p||f.z!=='stamina'||!f.card.active)throw Error('Blossom exige uma ação ativa da Estâmina.');
   const d=this.def(f.card);if(!this.comboAllowed(f.card,this.s.lastComboZone))throw Error('Condição de COMBO não satisfeita.');if(d.type!=='Golpe')throw Error('Nesta alfa, Overdrive de Blossom está homologado para ações de Golpe.');
   if(!revide&&!this.canIndependent(p))throw Error('Golpe de Overdrive exige turno próprio ou Revide.');this.s.players[p].od=0;a={...a,type:'play',free:true,revide};this.beginPayment(p,a,{own:0,opp:0});return;
  }
  const f=this.find(a.uid);if(f?.p!==p||!(['hand','extra'].includes(f.z)||f.z==='discard'&&(this.script(f.card).fromDiscardLife||this.script(f.card).discardCopy))||(f.z==='extra'&&f.card.ready>this.s.turn))throw Error('A carta não está disponível nesta zona/turno (8.1.2).');
  const d=this.def(f.card),sc=this.script(f.card);if((f.z==='discard')!==(['life','banishCopy'].includes(a.mode)))throw Error('Pague vida apenas ao jogar este Redassalt do Descarte.');if(d.type==='Golpe'&&!this.comboAllowed(f.card,this.s.lastComboZone))throw Error('COMBO exige o Golpe anterior do Jogador de Ataque na Zona '+sc.comboZone+'.');
  if(sc.requiresHighCostDiscard&&[...this.s.players[p].discard,...this.s.players.flatMap(side=>side.arena)].filter(c=>typeof this.def(c).cost==='number'&&this.def(c).cost>=3).length<2)throw Error('Virada Estratégica exige duas cartas de custo 3 ou maior no Descarte.');if(sc.psychicFrom&&!this.psychicAllowed(p,f.card))throw Error('Psychic exige descarte da mão e um Golpe Psychic disponível.');if(sc.requiresOwnExtra&&!this.s.players[p].extra.length)throw Error('Esta carta exige uma carta na própria Zona Extra.');if(!this.supported(d.id))throw Error('Carta não homologada.');if(sc.oncePerTurn&&this.s.players[p].onceUsed[d.name])throw Error('Limite compartilhado de uma ativação por turno atingido.');
  if(d.type==='Golpe'){if(!revide&&!this.canIndependent(p))throw Error('Golpes exigem fase de combate do turno próprio ou Revide.');}
  else if(d.type==='Guarda')throw Error('Declare Guardas no conjunto de bloqueadores.');
  else if(d.type==='Truque'){
   if(sc.chooseBuff&&!['attack','block'].includes(a.option))throw Error('Escolha bônus ao próximo Golpe ou bloqueio.');
   if(sc.requiresBlockTarget){const b=this.current();if(!b||b.finished||!b.blocks.some(g=>g.uid===a.blockTarget&&!g.cancelled))throw Error('Escolha um bloqueador válido.');}if(sc.requiresOwnBlocked){const b=this.current();if(!b||b.finished||b.cancelled||b.p!==p||!b.blocked||!b.blocks.some(g=>!g.cancelled))throw Error('Contra-ofensiva exige um Golpe seu bloqueado em combate.');a={...a,target:b.id};}if(sc.requiresAttack){const b=this.current();if(!b||b.finished)throw Error('Este Truque exige um Golpe alvo em combate.');a={...a,target:b.id};}
   if(sc.requiresDisparo){const b=this.current();if(!b||b.finished||this.def(this.find(b.uid).card).subtype!=='Disparo')throw Error('Astúcia Boreal exige um Disparo alvo no combate.');a={...a,target:b.id};}
   if(sc.variable&&p!==this.s.active)throw Error('Este Truque encerra seu turno e só está homologado no turno próprio.');
   if(!this.current()&&this.s.autoEnd)throw Error('O turno está encerrando automaticamente.');
  }else throw Error('Tipo de carta inválido.');
  if(a.mode==='banishCopy'||sc.requiresCopyBanish){const copy=this.find(a.copyUid);if(!(sc.discardCopy||sc.requiresCopyBanish)||copy?.p!==p||copy.z!=='discard'||copy.card.uid===f.card.uid||copy.card.id!==f.card.id)throw Error('Bana outra cópia de Frenecticale do seu Descarte.');}else if(a.copyUid)throw Error('Este pagamento não utiliza banimento de cópia.');if(!sc.psychicCost&&a.psychicDiscardUid)throw Error('Este descarte adicional não pertence à carta.');a={...a,revide};const pay=this.payment(p,f.card,a.mode,a.x||0);if(sc.psychicCost&&a.psychicEffect!==false){const uids=this.psychicCosts(p,[a.uid]);if(!a.psychicDiscardUid){if(this.energies(p,true).length<pay.own||this.paymentEnergies(other(p),false).length<pay.opp)throw Error('Energia insuficiente.');this.s.choice={kind:'psychicCost',player:p,uids,intent:copy(a),revide};this.s.priority=p;return;}if(!uids.includes(a.psychicDiscardUid))throw Error('Descarte Psychic inválido.');}this.beginPayment(p,a,pay);
 }
 block(p,a){const b=this.current();if(!b||b.blocked||p!==other(b.p))throw Error('Não há declaração de bloqueio disponível.');
  const uids=a.uids||[];if(new Set(uids).size!==uids.length)throw Error('Bloqueadores repetidos.');let opp=0,guardIndex=0;
  for(const uid of uids){const f=this.find(uid);if(f?.p!==p||!this.usable(p).some(c=>c.uid===uid)||typeof this.def(f.card).block!=='number')throw Error('Bloqueador inválido.');if(this.script(f.card).extraOnly&&f.z!=='extra')throw Error('Vigília no Templo apenas bloqueia da Zona Extra.');const d=this.def(f.card);
   if(d.type==='Guarda'){if(b.noGuards||this.script(this.find(b.uid).card).noGuardsWhenFlow&&b.flow)throw Error('Este golpe com Fluir não aceita Guardas.');opp+=this.guardCost(p,f.card,guardIndex++);}}
  const psychicGuards=uids.filter(uid=>this.script(this.find(uid).card).psychicCost),psychicUsed=Object.values(a.psychicDiscards||{}).filter(Boolean);
  if(psychicGuards.length&&!a.psychicDiscards){const available=this.psychicCosts(p,uids);if(this.paymentEnergies(other(p),false).length<opp)throw Error('Energia inativa insuficiente.');this.s.choice={kind:'psychicCost',player:p,uids:available,guards:psychicGuards,intent:copy(a),discards:{}};this.s.priority=p;return;}
  if(new Set(psychicUsed).size!==psychicUsed.length||psychicGuards.some(uid=>!Object.prototype.hasOwnProperty.call(a.psychicDiscards||{},uid))||psychicUsed.some(uid=>!this.psychicCosts(p,uids).includes(uid)))throw Error('Descarte Psychic inválido.');
  const required=uids.reduce((n,uid)=>n+(this.script(this.find(uid).card).additionalDiscard||0),0),candidates=this.s.players[p].hand.filter(c=>!uids.includes(c.uid)&&!psychicUsed.includes(c.uid)).map(c=>c.uid);
  if(required&&!a.guardDiscards){if(candidates.length<required)throw Error('Faltam cartas para o descarte adicional.');this.s.choice={kind:'guardCost',player:p,uids:candidates,required,selected:[],intent:copy(a)};this.s.priority=p;return;}
  if((a.guardDiscards||[]).length!==required||new Set(a.guardDiscards||[]).size!==required||(a.guardDiscards||[]).some(uid=>!candidates.includes(uid)))throw Error('Descarte adicional inválido.');
  const suruyas=uids.filter(uid=>this.script(this.find(uid).card).suruya);
  if(suruyas.length&&!a.suruyaDiscards){this.s.choice={kind:'suruya',player:p,uids:this.s.players[p].hand.filter(c=>!uids.includes(c.uid)&&!(a.guardDiscards||[]).includes(c.uid)&&!psychicUsed.includes(c.uid)&&this.script(c).impetus).map(c=>c.uid),guards:suruyas,intent:copy(a),discards:{}};this.s.priority=p;return;}
  if(a.suruyaDiscards){const used=Object.values(a.suruyaDiscards).filter(Boolean);if(new Set(used).size!==used.length||Object.keys(a.suruyaDiscards).some(uid=>!suruyas.includes(uid))||used.some(uid=>psychicUsed.includes(uid)||uids.includes(uid)||(a.guardDiscards||[]).includes(uid)||this.find(uid)?.p!==p||this.find(uid)?.z!=='hand'||!this.script(this.find(uid).card).impetus))throw Error('Descarte de Suruya inválido.');}
  this.beginPayment(p,a,{own:0,opp});
  if(!opp){this.s.priority=b.p;this.s.passes=0;}
 }
 finta(p,a){const b=this.current(),f=this.find(a.uid),g=this.find(a.guardUid),target=b?.blocks.find(x=>x.uid===a.target&&!x.cancelled);if(!b||b.finished||f?.p!==p||f.z!=='hand'||!this.script(f.card).finta||g?.p!==p||g.z!=='hand'||this.def(g.card).type!=='Guarda'||!target||this.def(this.find(target.uid).card).type!=='Guarda')throw Error('Finta exige carta com Finta e Guarda da mão, com Guarda alvo no combate.');
  if(this.def(g.card).cost!==this.def(this.find(target.uid).card).cost)throw Error('Custos normais das Guardas devem ser iguais.');this.move(a.uid,'discard');this.move(a.guardUid,'discard');this.push({kind:'finta',p,target:a.target,combat:b.id,label:'Finta'});this.s.priority=other(p);this.s.passes=0;
 }
 pass(p){const b=this.current();this.s.passes++;this.s.priority=other(p);if(this.s.passes<2)return;this.s.passes=0;
  const top=this.s.stack.at(-1);
  if(top){if(top.kind==='attack'&&b&&!b.blocked){this.s.priority=other(b.p);return;}this.resolveTop();return;}
  if(b){if(!b.blocked){this.s.priority=other(b.p);return;}this.finishCombat(b);return;}
  if(this.s.phase==='preparation'){
   if(!this.s.preparedTurn){this.prepareTurn();return;}this.s.phase='combat';this.s.priority=this.s.active;this.log('Fase de Combates.','6.3');return;
  }
  if(this.s.phase==='combat'){this.clearArena();this.s.ending=true;this.s.phase='end';this.s.priority=this.s.active;this.log('Janela de fim de turno.','6.4.5');return;}
  if(this.s.phase==='end'){this.s.turn++;this.s.active=other(this.s.active);this.newTurn();}
 }
 clearArena(){this.resolveTokenTurnEnd();for(const side of this.s.players)for(const c of [...side.arena])this.move(c.uid,'discard');this.s.completed=[];this.log('Sequência encerrada: cartas da Arena recolhidas para o descarte.','6.4');}
 newTurn(){this.s.impetusActions=[];this.s.zoneNextAttacks=(this.s.zoneNextAttacks||[]).filter(m=>m.untilTurn>=this.s.turn);this.s.zoneModifiers=(this.s.zoneModifiers||[]).filter(m=>m.untilTurn>=this.s.turn);this.s.lastComboZone=null;this.resolveTokenTurnStart();this.s.phase='preparation';this.s.priority=this.s.active;this.s.passes=0;this.s.ending=false;this.s.autoEnd=false;this.s.preparedTurn=false;for(const side of this.s.players){side.played=[];side.redassaltDealt=false;side.nextRedassaltBonus=0;side.nextBlockTurn=0;side.focusPlayed=false;side.lenFocusBonus=0;side.golpeHit=false;side.impetusPlayed=false;side.handBlock=false;side.damage=0;side.receivedDamage=0;side.costDown=0;side.startSkill=false;side.onceUsed={};side.overdriveLocked=!!side.fighterTapped;}const p=this.s.players[this.s.active];p.replenished=false;p.prepared=false;this.log('Turno '+this.s.turn+' — '+(this.s.active?'IA':'Você')+'.','6.1.1');}
 prepareTurn(){const p=this.s.active,side=this.s.players[p];side.stamina.forEach(c=>c.active=true);side.startSkill=true;side.fighterTapped=false;side.overdriveLocked=false;
  if(this.s.turn===2)this.draw(p,Math.max(0,4-side.hand.length),true);
  if(this.s.turn>=3&&side.stamina.length<7&&side.deck.length){const c=side.deck.shift();c.epoch++;c.active=true;c.public=true;side.stamina.push(c);this.log('Uma energia adicionada à Estâmina.','6.2.5');}
  this.s.preparedTurn=true;this.s.priority=p;
 }
 resolveTop(){const link=this.s.stack.pop();if(!link)return;this.log('Resolve: '+(link.label||link.kind)+'.','7.2.2');
  if(!link.cancelled){
   if(link.kind==='replenish')this.draw(link.p,link.n,true,'replenish');
   else if(link.kind==='attack'){const b=this.current();if(b&&b.id===link.combat)this.finishCombat(b);}
   else if(link.kind==='finta'){const b=this.s.combats.find(b=>b.id===link.combat),target=b?.blocks.find(x=>x.uid===link.target);if(target){target.cancelled=true;this.s.stack.filter(x=>x.uid===link.target).forEach(x=>x.cancelled=true);}}
   else if(link.kind==='desvio'){const b=this.s.combats.find(b=>b.id===link.combat);if(b&&!b.finished)b.cancelled=true;}
   else if(link.ops)this.runOps(link.ops,link.context||{p:link.p});
  }
  if(this.s.winner!==null)return;
  if(link.kind==='trick'&&!link.context?.combat&&this.find(link.uid)?.z==='arena')this.move(link.uid,'discard');
  this.s.priority=this.s.choice?.player??this.s.active;this.s.passes=0;
  if(!this.current()&&!this.s.stack.length&&this.s.autoEnd)this.s.ending=true;
 }
 runOps(ops,ctx){for(const op of ops){if(this.s.winner!==null)break;if(op.when==='flow'&&!ctx.flow||op.when==='revide'&&!ctx.revide)continue;const side=this.s.players[ctx.p],enemy=this.s.players[other(ctx.p)];if(op.focus&&(ctx.focusPower??side.power)<op.focus)continue;
  if(op.when==='otherImpetus'&&!(this.s.impetusActions||[]).some(a=>a.turn===this.s.turn&&a.uid!==ctx.source&&[...this.s.combats,...this.s.completed].some(b=>b.id===a.combat&&!b.cancelled)))continue;if(op.when==='dealtDamage'&&!side.damage||op.preparation&&!side.extra.length||op.overdrive&&side.od<op.overdrive)continue;
  if(op.op==='createGalacstrix')this.createToken(ctx.p,{name:op.name,power:op.power,fugaz:true,onDestroy:op.onDestroy||null});else if(op.op==='attachHitToken'){const b=this.s.combats.find(b=>b.id===ctx.target);if(b&&!b.finished&&!b.cancelled)(b.hitTokenEffects||(b.hitTokenEffects=[])).push({p:ctx.p,name:op.name,power:op.power});}else if(op.op==='psychicGuess'&&enemy.hand.length){this.s.choice={kind:'psychicGuess',player:ctx.p,reward:op.reward};}else if(op.op==='namedSearch'){const from=op.from||'deck',uids=side[from].filter(c=>(op.action?['Golpe','Guarda','Truque'].includes(this.def(c).type):this.def(c).type==='Golpe')&&this.def(c).name.toLowerCase().includes(op.archetype.toLowerCase())).map(c=>c.uid);if(uids.length)this.s.choice={kind:'namedSearch',player:ctx.p,uids,from,to:op.to||'hand',damageAfter:op.damageAfter||0};else if(op.damageAfter)this.damage(ctx.p,op.damageAfter,ctx.p);}else if(op.op==='discardForSearch'){if(side.hand.length)this.s.choice={kind:'discard',player:ctx.p,uids:side.hand.map(c=>c.uid),followSearch:{op:'namedSearch',archetype:op.archetype,from:op.from,to:'hand',damageAfter:1}};}else if(op.op==='spiritLuck'){const b=this.s.combats.find(b=>b.id===ctx.combat);if(b?.blocks.length===1){const uids=side.deck.slice(0,3).map(c=>c.uid);if(uids.length)this.s.choice={kind:'spiritLuck',player:ctx.p,uids};else this.draw(ctx.p,1,false);}}else if(op.op==='sharvat'){this.s.choice={kind:'sharvat',player:ctx.p};}else if(op.op==='honored'){const uids=side.discard.filter(c=>this.def(c).type==='Golpe'&&['Soco','Chute'].includes(this.def(c).subtype)).map(c=>c.uid);if(uids.length)this.s.choice={kind:'honored',player:ctx.p,uids,source:ctx.source,combat:ctx.combat};}else if(op.op==='ascension'&&side.extra.length){this.s.choice={kind:'ascension',player:ctx.p,uids:side.extra.map(c=>c.uid),source:ctx.source,combat:ctx.combat};}else if(op.op==='nextFocusSocoBonus')side.nextFocusSocoBonus=(side.nextFocusSocoBonus||0)+op.n;else if(op.op==='destroyExtraChoice'){const target=op.enemy?enemy:side;if(target.extra.length)this.s.choice={kind:'extraEffect',player:ctx.p,uids:target.extra.map(c=>c.uid),required:op.ownExtraCount?Math.min(side.extra.length,target.extra.length):1,selected:[],draw:op.draw||0};}
  else if(op.op==='searchExtraGuard'&&side.golpeHit&&side.extra.length<4){const uids=side.deck.filter(c=>this.def(c).type==='Guarda').map(c=>c.uid);if(uids.length)this.s.choice={kind:'searchExtraGuard',player:ctx.p,uids};}
  else if(op.op==='searchFlow'){const uids=side.deck.filter(c=>this.script(c).flow).map(c=>c.uid);if(uids.length)this.s.choice={kind:'searchFlow',player:ctx.p,uids};}
  else if(op.op==='searchGuard'){
const uids=side.deck.filter(c=>this.def(c).type==='Guarda').map(c=>c.uid);if(uids.length)this.s.choice={kind:'searchGuard',player:ctx.p,uids};}
  else if(op.op==='revealPreparation'){const c=side.deck[0];if(c){this.log('Carta revelada: '+this.def(c).name+'.','efeito de carta');if(this.script(c).preparation)this.draw(ctx.p,1,false);else side.deck.push(side.deck.shift());}}
  else if(op.op==='zoneModifier'){(this.s.zoneModifiers||(this.s.zoneModifiers=[])).push({zone:op.zone,[op.property]:op.n,untilTurn:op.untilTurn});}else if(op.op==='draw')this.draw(ctx.p,op.n,false);
  else if(op.op==='createRedemption')this.createToken(ctx.p,{name:'Redenção',redemption:true});
  else if(op.op==='destroyEnemyExtra')for(const c of [...enemy.extra]){if(c.token)this.destroyToken(c.uid,'other-card');else this.move(c.uid,'discard');}
  else if(op.op==='healX')side.hp+=ctx.x;
  else if(op.op==='damageX')this.damage(other(ctx.p),ctx.x);
  else if(op.op==='end')this.s.ending=true;
  else if(op.op==='costDown')side.costDown++;
  else if(op.op==='enemyNextAlternateCost')enemy.nextAlternateCost=(enemy.nextAlternateCost||0)+op.n;else if(op.op==='zoneNextAttack'){const b=this.s.combats.find(b=>b.id===ctx.combat);if(b)(this.s.zoneNextAttacks||(this.s.zoneNextAttacks=[])).push({zone:b.zone,n:op.n,untilTurn:this.s.turn});}
  else if(op.op==='nextAttackBonus')side.nextAttackBonus=(side.nextAttackBonus||0)+op.n;
  else if(op.op==='nextBlockBonus'){const key=op.thisTurn?'nextBlockTurn':'nextBlockBonus';side[key]=(side[key]||0)+op.n;}
  else if(op.op==='chosenNextBuff'){const key=ctx.option==='attack'?'nextAttackBonus':'nextBlockBonus';side[key]=(side[key]||0)+2;}
  else if(op.op==='enemyNextAttackDown')enemy.nextAttackBonus=(enemy.nextAttackBonus||0)-(op.power?side.power:op.n);
  else if(op.op==='drawFocus'){const drawn=side.deck[0];this.draw(ctx.p,1,false);if(this.s.winner===null&&drawn&&this.script(drawn).focusThreshold)this.draw(ctx.p,1,false);}
  else if(op.op==='nextSocoNoGuards')side.nextSocoNoGuards=true;
  else if(op.op==='lenFocusBonus'&&!side.focusPlayed)side.lenFocusBonus=(side.lenFocusBonus||0)+Math.abs(side.power-enemy.power);
  else if(op.op==='extraDamage')this.damage(other(ctx.p),enemy.extra.length);
  else if(op.op==='ownPower')side.power=Math.max(0,side.power+op.n);else if(op.op==='powerDown')enemy.power=Math.max(0,enemy.power-1);
  else if(op.op==='boostBlock'){const b=this.s.combats.find(b=>b.id===ctx.combat),g=b?.blocks.find(g=>g.uid===ctx.blockTarget&&!g.cancelled);if(g)g.value+=side.power;}else if(op.op==='boostTarget'){const b=this.s.combats.find(b=>b.id===ctx.target);if(b)b.attack+=op.n;}
  else if(op.op==='cancelIfGreaterPower'){const b=this.s.combats.find(b=>b.id===ctx.target);if(b&&!b.finished&&!b.cancelled&&side.power>this.s.players[b.p].power){b.cancelled=true;this.draw(b.p,1,false);}}
  else if(op.op==='discardForCutImpetus'&&side.hand.length){this.s.choice={kind:'discard',player:ctx.p,uids:side.hand.map(c=>c.uid),nextCutImpetus:1};}
  else if(op.op==='nextRedassaltBonus')side.nextRedassaltBonus=(side.nextRedassaltBonus||0)+op.n;
  else if(op.op==='createDamageMark')enemy.golpeDamageMarks=(enemy.golpeDamageMarks||0)+1;
  else if(op.op==='powerDamage')this.damage(other(ctx.p),side.power);
  else if(op.op==='discardOwn'&&side.hand.length){this.s.choice={kind:'discard',player:ctx.p,uids:side.hand.map(c=>c.uid)};}else if(op.op==='discardOpponentIfNoExtra'&&!enemy.extra.length&&enemy.hand.length){this.s.choice={kind:'discard',player:other(ctx.p),uids:enemy.hand.map(c=>c.uid)};}
 }}
 finishCombat(b){const c=this.find(b.uid)?.card;if(!c)return;const sc=this.script(c);const blockers=b.blocks.filter(x=>!x.cancelled),block=blockers.reduce((n,x)=>n+(b.ignoreBelowPower!==undefined&&x.value<b.ignoreBelowPower?0:x.value),0)+(b.aggregateBlockBonus||0);
  const rawBasicDamage=b.cancelled?0:Math.max(0,b.attack-block),rawImpetusDamage=!b.cancelled&&blockers.some(x=>{const c=this.find(x.uid)?.card;return c&&!c.token;})?(b.revide&&sc.revideImpetus!==undefined?sc.revideImpetus:(b.impetusBase??sc.impetus??0))+(b.extraImpetus||0):0;
  const marks=b.token?0:(this.s.players[other(b.p)].golpeDamageMarks||0),basicDamage=this.adjustDamage(other(b.p),rawBasicDamage+(rawBasicDamage>0?marks:0)),impetusDamage=this.adjustDamage(other(b.p),rawImpetusDamage+(rawImpetusDamage>0?marks:0)+(this.effectDamageBonus?.(b.p,rawImpetusDamage)||0));const damage=basicDamage+impetusDamage;if(damage&&!b.token&&this.def(c).name.toLowerCase().includes('redassalt'))this.s.players[b.p].redassaltDealt=true;if(damage&&!b.token&&!b.cancelled)this.s.players[b.p].golpeHit=true;b.basicDamage=basicDamage;b.impetusDamage=impetusDamage;
  if(!b.cancelled){this.damage(other(b.p),basicDamage,b.p,true);if(this.s.winner===null&&impetusDamage)this.damage(other(b.p),impetusDamage,b.p,true);if(this.s.winner===null&&sc.selfDamageHalfAttack)this.damage(b.p,Math.ceil(Math.max(0,b.attack)/2),b.p);if(this.s.winner!==null){if(b.from==='stamina')this.move(b.uid,'discard');return;}if(sc.break&&damage){b.brokeSequence=this.s.players[other(b.p)].od>0;this.s.players[other(b.p)].od=0;this.log('Quebra: sequência adversária zerada.','14.1.1');}
   if(!b.token&&b.p===this.s.active)this.s.lastComboZone=b.zone;const side=this.s.players[b.p],seq=this.script(side.fighter).sequence;if(!b.fighterOverdrive)side.od=seq[side.od===seq.length?seq.length-1:side.od]===b.zone?Math.min(seq.length,side.od+1):(seq[0]===b.zone?1:0);
  }
  const ctx={p:b.p,flow:b.flow,revide:b.revide,combat:b.id,focusPower:this.s.players[b.p].power};const triggers=[];for(const effect of b.endEffects||[])triggers.push({p:effect.p,ops:effect.ops,context:{p:effect.p},label:effect.label});if(damage&&!b.cancelled)for(const effect of b.hitTokenEffects||[])triggers.push({p:effect.p,ops:[{op:'createGalacstrix',name:effect.name,power:effect.power}],context:{p:effect.p},label:effect.name+' — Golpe alvo bateu'});if(!b.cancelled&&b.brokeSequence&&sc.onBreak)triggers.push({p:b.p,ops:sc.onBreak,context:ctx,label:this.def(c).name+' — sequência quebrada'});
  if(damage&&['hanma','len-yin'].includes(b.fighterOverdrive))triggers.push({p:b.p,ops:[{op:'zoneModifier',zone:b.zone,property:b.fighterOverdrive==='hanma'?'attack':'cost',n:b.fighterOverdrive==='hanma'?2:1,untilTurn:this.s.turn+1}],context:{p:b.p},label:'Overdrive — efeito da Zona'});
  if(!b.cancelled&&basicDamage>0&&(b.impetusBase||b.extraImpetus||(b.revide&&sc.revideImpetus))&&this.script(this.s.players[b.p].fighter).impetusHitDraw)triggers.push({p:b.p,ops:[{op:'draw',n:1}],context:{p:b.p},label:'Hanma — Golpe com Ímpeto bateu'});
  if(damage&&sc.hit)triggers.push({p:b.p,ops:sc.hit,context:ctx,label:this.def(c).name+' — Se Bater'});
  if(!damage&&!b.cancelled)for(const guard of b.blocks.filter(x=>!x.cancelled)){const card=this.find(guard.uid)?.card;if(!card)continue;const gs=this.script(card),p=other(b.p);if(gs.deflect&&guard.origin==='extra')triggers.push({p,ops:[{op:'fixedDamage',n:guard.value}],context:{p},label:'Defletir'});if(gs.success)triggers.push({p,ops:gs.success,context:{p,combat:b.id},label:this.def(card).name+' — bloqueio com sucesso'});}
  // Cartas permanecem até gatilhos de resultado terminarem; recolhimento é decisão de ordem.
  b.finished=true;b.damage=damage;b.blockValue=block;this.push({kind:'cleanup',p:b.p,combat:b.id,label:'Concluir combate'});
  this.s.triggerGroups=[this.s.active,other(this.s.active)].map(p=>({p,links:triggers.filter(t=>t.p===p).map(t=>({kind:'effect',...t,orderId:++this.s.next}))}));this.advanceTriggerGroups();
  this.log('Combate: ataque '+b.attack+', bloqueio '+block+', dano '+damage+'.','10.1');
 }
 advanceTriggerGroups(){while(this.s.triggerGroups?.length){const group=this.s.triggerGroups[0];if(group.links.length>1){this.s.choice={kind:'triggers',player:group.p,links:group.links};this.s.priority=group.p;return;}group.links.forEach(l=>this.push(l));this.s.triggerGroups.shift();}this.s.priority=this.s.active;}
 cleanup(b,orders){for(let p=0;p<2;p++){const cards=this.s.players[p].arena.filter(c=>c.uid===b.uid||b.blocks.some(x=>x.uid===c.uid)||this.s.stack.some(l=>l.uid===c.uid&&l.context?.combat===b.id));
   // Inclui truques associados registrados na ativação.
   const uids=[...new Set([...cards.map(c=>c.uid),...(b.tricks||[])])].filter(uid=>{const f=this.find(uid);return f?.z==='arena'&&f.p===p;});
   const order=orders?.[p]||uids;if(order.length!==uids.length||new Set(order).size!==uids.length||order.some(uid=>!uids.includes(uid)))throw Error('Ordem de descarte inválida.');order.forEach(uid=>{if(b.from==='stamina'&&uid===b.uid)this.move(uid,'discard');});
  }
  this.s.history.push({id:b.id,p:b.p,idCard:this.find(b.uid)?.card.id,zone:b.zone,attack:b.attack,block:b.blockValue,damage:b.damage,revide:b.revide});this.s.completed.push(copy(b));this.s.combats.pop();for(const uid of [b.uid,...b.blocks.map(x=>x.uid)])this.finishTokenUse(uid);
 }
 assertInvariants(){const uids=[];for(const side of this.s.players){const cs=['hand','stamina','extra','arena','deck','discard','banished'].flatMap(z=>side[z]);if(cs.filter(c=>!c.token&&!this.def(c).specialPermanent).length!==40)throw Error('Invariante: conservação das 40 cartas.');if(side.stamina.length>7||side.extra.length>4)throw Error('Invariante: capacidade de zona.');uids.push(...cs.map(c=>c.uid));}if(new Set(uids).size!==uids.length)throw Error('Invariante: instância duplicada.');}
 view(p){if(!this.s)return null;const s=this.s;return {viewer:p,mode:s.mode||'advanced',version:VERSION,ruleset:RULESET_ID,revision:s.revision,turn:s.turn,active:s.active,priority:s.priority,phase:s.phase,ending:s.ending,autoEnd:s.autoEnd,winner:s.winner,log:copy(s.log),stack:s.stack.map(l=>({id:l.id,label:l.label||l.kind,kind:l.kind,p:l.p})),combats:copy(s.combats),completed:copy(s.completed),history:copy(s.history),choice:s.choice?{kind:s.choice.kind,player:s.choice.player,required:s.choice.required,remaining:s.choice.required?Math.max(0,s.choice.required-(s.choice.selected?.length||0)):undefined,cause:copy(s.choice.cause||null),uids:s.choice.player===p?s.choice.uids:undefined}:null,players:s.players.map((side,i)=>({name:side.name,hp:side.hp,power:side.power,od:side.od,fighter:copy(side.fighter),deckCount:side.deck.length,handCount:side.hand.length,hand:i===p?copy(side.hand):[],stamina:copy(side.stamina),extra:side.extra.map(c=>i===p||c.public||c.publicUntil===s.turn?copy(c):{uid:c.uid,hidden:true,ready:c.ready,slot:c.slot}),arena:copy(side.arena),discard:copy(side.discard),banished:copy(side.banished),prepared:side.prepared,replenished:side.replenished,startSkill:side.startSkill,fighterTapped:!!side.fighterTapped,overdriveLocked:!!side.overdriveLocked})),actions:this.legalActions(p)};}
 legalActions(p){if(!this.s||this.s.winner!==null)return [];const s=this.s;
  if(s.phase==='mulligan')return s.players[p].mulligan?[]:[{type:'mulligan',hand:[],energy:[]}];
  if(s.choice){if(s.choice.player!==p)return [];if(s.choice.kind==='galacstrixCost'){const cost=this.script(this.find(s.choice.uids[s.choice.index]).card).tokenCost;return [{type:'chooseGalacstrix',use:false},...(this.energies(p,true).length>=s.choice.pay.own+cost?[{type:'chooseGalacstrix',use:true}]:[])];}if(s.choice.kind==='ownEnergy')return [{type:'chooseOwnEnergy',required:s.choice.required,options:this.energies(p,true).map(c=>c.uid)}];if(s.choice.kind==='energy')return [{type:'chooseEnergy',required:s.choice.required,options:this.paymentEnergies(p,false).map(c=>c.uid)}];if(s.choice.kind==='psychicCost')return [...s.choice.uids.map(uid=>({type:'choosePsychicCost',uid})),{type:'declinePsychic'}];if(s.choice.kind==='psychicGuess')return ['Golpe','Truque','Guarda'].map(cardType=>({type:'declarePsychicType',cardType}));if(s.choice.kind==='psychicReveal')return [{type:'acknowledgePsychic'}];if(s.choice.kind==='namedSearch')return s.choice.uids.map(uid=>({type:'chooseNamedCard',uid}));if(s.choice.kind==='spiritLuck')return s.choice.uids.map(uid=>({type:'chooseSpiritCard',uid}));if(s.choice.kind==='sharvat')return ['Inferior','Meio','Superior'].map(zone=>({type:'chooseSharvatZone',zone}));if(s.choice.kind==='honored')return [{type:'chooseHonored'},...s.choice.uids.map(uid=>({type:'chooseHonored',uid}))];if(s.choice.kind==='ascension')return [{type:'chooseAscension'},...s.choice.uids.map(uid=>({type:'chooseAscension',uid}))];if(s.choice.kind==='extraEffect')return s.choice.uids.map(uid=>({type:'selectExtraEffect',uid}));if(s.choice.kind==='searchExtraGuard')return s.choice.uids.map(uid=>({type:'selectExtraGuard',uid}));if(s.choice.kind==='guardCost')return s.choice.uids.map(uid=>({type:'chooseGuardDiscard',uid}));if(s.choice.kind==='suruya')return [{type:'chooseSuruya'},...s.choice.uids.map(uid=>({type:'chooseSuruya',uid}))];if(s.choice.kind==='searchFlow')return s.choice.uids.map(uid=>({type:'selectFlowCard',uid}));if(s.choice.kind==='searchGuard')return s.choice.uids.map(uid=>({type:'selectSearchCard',uid}));if(s.choice.kind==='discard')return s.choice.uids.map(uid=>({type:'discardChoice',uid}));if(s.choice.kind==='triggers')return [{type:'orderTriggers',options:s.choice.links.map(l=>({id:l.orderId,label:l.label}))}];if(s.choice.kind==='cleanup')return [{type:'orderDiscard',options:s.choice.options}];if(s.choice.kind!=='revide')return [];}
  else if(s.priority!==p)return [];
  const acts=s.choice?.kind==='revide'?[{type:'declineRevide'}]:[{type:'pass'}],revide=s.choice?.kind==='revide';
  const own=s.players[p],b=this.current();if(!revide&&this.canPrepare(p))own.hand.forEach(c=>acts.push({type:'prepare',uid:c.uid}));
  if(!revide&&this.canIndependent(p))acts.push({type:'end'});
  if(!revide&&p===s.active&&!own.replenished&&!s.ending&&(!s.autoEnd||b))for(let n=1;n<=Math.min(4,4-own.hand.length,this.energies(p,true).length);n++)acts.push({type:'replenish',n});
  if(!revide&&this.canFighterSkill(p))acts.push({type:'startSkill',uid:own.fighter.uid});
  if(!revide&&this.canActivatedFighterSkill(p))acts.push({type:'fighterSkill',uid:own.fighter.uid});
  const attackAllowed=revide||this.canIndependent(p);
  if(attackAllowed&&own.od===3&&!own.overdriveLocked&&!own.fighterTapped&&this.script(own.fighter).fighterOverdrive)for(const zone of ['Inferior','Meio','Superior'])acts.push({type:'fighterOverdrive',uid:own.fighter.uid,zone});
  for(const c of [...this.usable(p),...own.discard.filter(c=>this.script(c).fromDiscardLife||this.script(c).discardCopy)]){
   const d=this.def(c),sc=this.script(c);if(c.token){if(!revide&&this.canIndependent(p)&&this.energies(p,true).length>=this.tokenAttackCost(c))for(const zone of c.zone?[c.zone]:['Inferior','Meio','Superior'])acts.push({type:'tokenAttack',uid:c.uid,zone});continue;}if(!this.comboAllowed(c,s.lastComboZone))continue;if(sc.oncePerTurn&&own.onceUsed[d.name])continue;if(d.type==='Guarda'||d.type==='Golpe'&&!attackAllowed||d.type==='Truque'&&(revide||!b&&s.autoEnd))continue;
   if(sc.requiresHighCostDiscard&&[...own.discard,...this.s.players.flatMap(side=>side.arena)].filter(c=>typeof this.def(c).cost==='number'&&this.def(c).cost>=3).length<2)continue;if(sc.psychicFrom&&!this.psychicAllowed(p,c))continue;if(sc.requiresOwnExtra&&!own.extra.length)continue;if(sc.requiresDisparo&&(!b||b.finished||this.def(this.find(b.uid).card).subtype!=='Disparo'))continue;
   if(sc.requiresBlockTarget&&(!b||b.finished||!b.blocks.some(g=>!g.cancelled)))continue;if(sc.requiresOwnBlocked&&(!b||b.finished||b.cancelled||b.p!==p||!b.blocked||!b.blocks.some(g=>!g.cancelled)))continue;if(sc.requiresAttack&&(!b||b.finished))continue;
   if(sc.variable&&p!==s.active)continue;
   for(const mode of (this.find(c.uid).z==='discard'?(sc.discardCopy?['banishCopy']:['life']):['normal','alternative'])){if(mode==='alternative'&&!Number.isInteger(d.alternateCost))continue;const max=sc.variable?this.energies(p,true).length:0;for(let x=0;x<=max;x++){const pay=this.payment(p,c,mode,x);if((!pay.life||own.hp>=pay.life)&&this.energies(p,true).length>=pay.own&&this.paymentEnergies(other(p),false).length>=pay.opp){if(mode==='banishCopy'||sc.requiresCopyBanish)for(const copy of own.discard.filter(other=>other.id===c.id&&other.uid!==c.uid))acts.push({type:'play',uid:c.uid,mode,x,copyUid:copy.uid});else if(sc.requiresBlockTarget)for(const g of b.blocks.filter(g=>!g.cancelled))acts.push({type:'play',uid:c.uid,mode,x,blockTarget:g.uid});else if(sc.chooseBuff)for(const option of ['attack','block'])acts.push({type:'play',uid:c.uid,mode,x,option});else acts.push({type:'play',uid:c.uid,mode,x});}}}
  }
  if(attackAllowed&&own.od===3&&!own.overdriveLocked&&!own.fighterTapped&&!this.script(own.fighter).fighterOverdrive)own.stamina.filter(c=>c.active&&this.def(c).type==='Golpe'&&this.comboAllowed(c,s.lastComboZone)).forEach(c=>acts.push({type:'overdrive',uid:c.uid}));
  if(!revide&&b&&!b.blocked&&p===other(b.p))acts.push({type:'block',uids:[],options:this.usable(p).filter(c=>(!this.script(c).additionalDiscard||own.hand.filter(h=>h.uid!==c.uid).length>=this.script(c).additionalDiscard)).filter(c=>!this.script(c).extraOnly||this.find(c.uid).z==='extra').filter(c=>this.def(c).type!=='Guarda'||!(b.noGuards||this.script(this.find(b.uid).card).noGuardsWhenFlow&&b.flow)&&this.paymentEnergies(other(p),false).length>=this.guardCost(p,c)).map(c=>c.uid)});
  if(!revide&&b&&!b.finished)for(const c of own.hand.filter(c=>this.script(c).finta))for(const g of own.hand.filter(c=>this.def(c).type==='Guarda'))for(const target of b.blocks.filter(t=>!t.cancelled&&this.def(this.find(t.uid).card).type==='Guarda'&&this.def(this.find(t.uid).card).cost===this.def(g).cost))acts.push({type:'finta',uid:c.uid,guardUid:g.uid,target:target.uid});
  if(!revide&&b&&!b.finished&&!b.cancelled)for(const c of own.hand.filter(c=>this.script(c).desvio))for(const g of own.hand.filter(c=>this.def(c).type==='Golpe'&&this.def(c).zone===b.zone))acts.push({type:'desvio',uid:c.uid,golpeUid:g.uid});
  return acts;
 }
 replay(){return {format:'overdrive-replay/1',version:VERSION,ruleset:RULESET_ID,initial:copy(this.initial),commands:copy(this.commands)};}
}
// Completa etapas que exigem protocolo de escolha e retomada direta.
const originalResolve=Engine.prototype.resolveTop,originalApply=Engine.prototype.apply;
Engine.prototype.resolveTop=function(){const top=this.s.stack.at(-1);if(top?.kind==='cleanup'){
 const b=this.current(),options={};for(let p=0;p<2;p++)options[p]=this.s.players[p].arena.filter(c=>c.uid===b.uid||b.blocks.some(x=>x.uid===c.uid)||(b.tricks||[]).includes(c.uid)).map(c=>c.uid);
 this.s.choice={kind:'cleanup',player:0,options,orders:{}};this.s.priority=0;return;
}originalResolve.call(this);};
Engine.prototype.apply=function(p,a){if(this.s.choice?.kind==='cleanup'){
 const choice=this.s.choice;if(p!==choice.player||a.type!=='orderDiscard')throw Error('Ordene suas cartas para o descarte.');const expected=choice.options[p],uids=a.uids||expected;if(uids.length!==expected.length||new Set(uids).size!==expected.length||uids.some(x=>!expected.includes(x)))throw Error('Ordem de descarte inválida.');choice.orders[p]=uids;
 if(p===0){choice.player=1;this.s.priority=1;return;}const b=this.current(),resume=b.resume;this.s.stack.pop();this.cleanup(b,choice.orders);this.s.choice=null;this.s.priority=this.s.active;this.s.passes=0;
 if(resume){const link=this.s.stack.find(l=>l.id===resume);if(link){const top=this.s.stack.at(-1);if(top.id===resume&&top.kind!=='attack')this.resolveTop();else if(top.kind==='attack'&&!this.current()?.blocked)this.s.priority=other(this.current().p);}}
 return;
}return originalApply.call(this,p,a);};
const originalPaid=Engine.prototype.activatePaid;
Engine.prototype.activatePaid=function(p,a){const result=originalPaid.call(this,p,a);if(result?.kind==='trick'&&result.context?.combat){const b=this.s.combats.find(x=>x.id===result.context.combat);(b.tricks||(b.tricks=[])).push(result.uid);}return result;};
const originalOps=Engine.prototype.runOps;
Engine.prototype.runOps=function(ops,ctx){for(const op of ops){if(this.s.winner!==null)return;if(op.op==='fixedDamage')this.damage(other(ctx.p),op.n);else originalOps.call(this,[op],ctx);}};
function chooseAI(view,catalog){const acts=view.actions;if(!acts.length)return null;const byId=new Map(catalog.map(c=>[c.id,c]));const player=view.viewer??1,own=view.players[player],find=uid=>[...own.hand,...own.extra,...own.stamina,...own.discard].find(c=>c.uid===uid),def=uid=>Rivals06.definition(find(uid),find(uid)?.tokenDefinition||byId.get(find(uid)?.id),view);
 if(view.choice?.kind==='maha:curseTarget')return acts.find(a=>a.uid===view.players[1-player].fighter.uid)||acts[0];
 if(view.choice?.kind==='rivals:06Extras'){const enemy=new Set(view.players[1-player].extra.map(c=>c.uid));return acts.find(a=>enemy.has(a.uid))||acts.find(a=>a.option==='done')||acts[0];}if(view.choice?.kind?.startsWith('rivals:'))return acts.find(a=>a.target===1-player)||acts.find(a=>a.uid)||acts[0];
 if(view.choice?.kind?.startsWith('expansion:'))return acts.find(a=>a.option==='done')&&acts.filter(a=>a.uid).length===0?acts.find(a=>a.option==='done'):acts.find(a=>a.uid)||acts[0];
 if(view.choice?.kind?.startsWith('balance'))return acts[0];if(view.choice?.kind==='ownEnergy')return {type:'chooseOwnEnergy',uids:acts[0].options.slice(0,acts[0].required)};if(view.choice?.kind==='energy')return {type:'chooseEnergy',uids:acts[0].options.slice(0,acts[0].required)};
 if(view.choice?.kind==='triggers')return {type:'orderTriggers',ids:acts[0].options.map(x=>x.id)};
 if(view.choice?.kind==='cleanup')return {type:'orderDiscard',uids:acts[0].options[player]};
 if(['psychicCost','psychicGuess','psychicReveal'].includes(view.choice?.kind))return acts[0];if(view.choice?.kind==='namedSearch')return acts[0];if(view.choice?.kind==='spiritLuck')return acts[0];if(view.choice?.kind==='sharvat')return acts[1];if(view.choice?.kind==='honored')return acts.at(-1);if(view.choice?.kind==='ascension')return acts.find(a=>a.uid&&def(a.uid)?.type==='Guarda')||acts[0];if(['extraEffect','searchExtraGuard'].includes(view.choice?.kind))return acts[0];if(view.choice?.kind==='guardCost')return acts[0];if(view.choice?.kind==='suruya')return acts.at(-1);if(view.choice?.kind==='searchFlow')return acts[0];if(view.choice?.kind==='searchGuard')return acts[0];if(view.choice?.kind==='discard')return [...acts].sort((a,b)=>(def(b.uid)?.cost||0)-(def(a.uid)?.cost||0))[0];
 const desvio=acts.find(a=>a.type==='desvio');if(desvio&&view.combats.at(-1)?.p!==player&&view.combats.at(-1)?.attack>0)return desvio;const block=acts.find(a=>a.type==='block');if(block){const combat=view.combats.at(-1),opts=block.options.map(uid=>({uid,d:def(uid)})).sort((a,b)=>b.d.block-a.d.block);const chosen=[],reserved=new Set();let value=0,cost=0,guards=0;for(const c of opts){if(reserved.has(c.uid))continue;const sc=CardScripts.scripts[c.d.number]||{},available=own.hand.filter(h=>h.uid!==c.uid&&!chosen.includes(h.uid)&&!reserved.has(h.uid));const needed=sc.psychicCost?available.find(h=>byId.get(h.id)?.name.toLowerCase().includes('psychic')):sc.additionalDiscard?available[0]:null;if(sc.additionalDiscard&&!needed)continue;const n=c.d.type==='Guarda'?Math.max(0,c.d.cost+(guards===0?(own.r05NextTax||0)-(own.r05GuardDiscount||0):0)):0;if(cost+n>view.players[1-player].stamina.filter(x=>!x.active&&!x.r05Lock).length)continue;if(value>=combat.attack)break;chosen.push(c.uid);if(c.d.type==='Guarda')guards++;if(needed)reserved.add(needed.uid);value+=c.d.block;cost+=n;}return {type:'block',uids:chosen};}
 if(acts.some(a=>a.type==='remainingChoose'))return acts.find(a=>a.target===1-player)||acts.find(a=>a.use===true)||acts[0];if(view.phase==='mulligan')return {type:'mulligan',hand:[],energy:[]};
 const finta=acts.find(a=>a.type==='finta');if(finta&&view.combats.at(-1)?.p===player)return finta;
 const boost=acts.find(a=>a.type==='play'&&def(a.uid)?.number===104);if(boost&&view.combats.at(-1)?.p===player)return boost;
 const tokenAttack=acts.find(a=>a.type==='tokenAttack');if(tokenAttack)return tokenAttack;const od=acts.find(a=>a.type==='overdrive'||a.type==='fighterOverdrive'||a.type==='mahaOverdrive');if(od)return od;const newOD=acts.find(a=>a.type==='expansionMournerOD'||a.type==='rivalsOverdrive');if(newOD)return newOD;const newSkill=acts.find(a=>a.type==='expansionReveal'||a.type==='expansionMournerSkill'||a.type==='expansionPlacideSkill');if(newSkill)return newSkill;
 const attack=acts.filter(a=>a.type==='play'&&(def(a.uid)?.type==='Golpe'||a.mode==='guardStrike')&&(a.mode!=='life'||own.hp>def(a.uid).cost)).sort((a,b)=>((b.mode==='guardStrike'?def(b.uid).block:def(b.uid).power||0)-(def(b.uid).cost||0)*.35)-((a.mode==='guardStrike'?def(a.uid).block:def(a.uid).power||0)-(def(a.uid).cost||0)*.35));if(attack.length){const chosen=attack[0];if(chosen.mode==='guardStrike'){const seq=byId.get(own.fighter.id)&&scripts[byId.get(own.fighter.id).number]?.sequence,next=seq?.[Math.min(own.od,seq.length-1)];return attack.find(a=>a.uid===chosen.uid&&a.zone===next)||chosen;}return chosen;}
 const replen=acts.filter(a=>a.type==='replenish');if(replen.length&&(own.hand.length<=1||!attack.length))return replen.at(-1);
 const skill=acts.find(a=>a.type==='startSkill');if(skill&&own.handCount<5)return skill;
 const utility=player===view.active&&!view.stack.length&&!view.combats.length&&acts.find(a=>a.type==='play'&&a.mode==='normal'&&def(a.uid)?.type==='Truque');if(utility)return utility;const prep=acts.filter(a=>a.type==='prepare').sort((a,b)=>(def(b.uid)?.block||0)-(def(a.uid)?.block||0));if(prep.length&&own.handCount>2)return prep[0];
 return acts.find(a=>a.type==='declineRevide')||acts.find(a=>a.type==='pass')||acts[0];
}
// Protocolos das dez cartas finais. As escolhas são comandos públicos; cartas observadas são privadas.
const finalScript=Engine.prototype.script,finalMove=Engine.prototype.move,finalPlay=Engine.prototype.play,finalPaid=Engine.prototype.activatePaid,finalOps=Engine.prototype.runOps,finalApply=Engine.prototype.apply,finalLegal=Engine.prototype.legalActions,finalTurn=Engine.prototype.newTurn,finalPayment=Engine.prototype.payment;
Engine.prototype.script=function(c){const base=finalScript.call(this,c);if(c?.vigorSuppressedTurn!==this.s?.turn)return base;const sc={...base};for(const key of ['flow','focusThreshold','impetus','impetusValue','revideImpetus','revideAttack','preparation','break','noGuardsWhenFlow'])delete sc[key];delete sc.attackBonus;for(const key of ['onPlay','hit','onBreak'])if(sc[key])sc[key]=sc[key].filter(op=>!op.focus&&!op.preparation&&!['flow','revide'].includes(op.when));return sc;};
Engine.prototype.isDars=function(c,type){return (!type||this.def(c).type===type)&&/^Darsmagi(?:us|um)\b/i.test(this.def(c).name);};
Engine.prototype.putEffectExtra=function(p,uid,faceDown=false,preferredSlot){const side=this.s.players[p],slot=preferredSlot??[0,1,2,3].find(n=>!side.extra.some(c=>c.slot===n));if(!Number.isInteger(slot)||slot<0||slot>3||side.extra.some(c=>c.slot===slot))throw Error('Não há Zona Extra livre.');const c=this.move(uid,'extra');c.slot=slot;c.ready=this.s.turn;c.public=!faceDown;c.publicUntil=faceDown?0:this.s.turn;return c;};
Engine.prototype.move=function(uid,z){const loc=this.find(uid),trigger=loc&&!loc.card.token&&this.script(loc.card).discardDars&&(z==='banished'||z==='discard'&&loc.z==='hand'),p=loc?.p;const c=finalMove.call(this,uid,z);if(trigger)this.push({kind:'effect',p,ops:[{op:'darsRelease'}],context:{p},label:'Heavythink — descarte/banimento'});return c;};
Engine.prototype.newTurn=function(){finalTurn.call(this);for(let p=0;p<2;p++){const side=this.s.players[p];side.darsCostDown=0;if(p===this.s.active){side.inazamiActive=(side.inazamiPending||[]).map(n=>({n,left:3,turn:this.s.turn}));side.inazamiPending=[];side.vigorTurn=side.vigorPending?this.s.turn:0;side.vigorPending=false;}}};
Engine.prototype.payment=function(p,c,mode='normal',x=0){const pay=finalPayment.call(this,p,c,mode,x);if(this.def(c).type==='Golpe'&&!pay.life&&!['banishCopy'].includes(mode)){const n=this.s.players[p].darsCostDown||0;if(mode==='alternative')pay.opp=Math.max(0,pay.opp-n);else pay.own=Math.max(0,pay.own-n);}return pay;};
Engine.prototype.play=function(p,a,revide=false){const loc=this.find(a.uid),sc=loc&&this.script(loc.card);if(sc?.playDiscard){const uids=this.s.players[p].hand.filter(c=>c.uid!==a.uid).map(c=>c.uid);if(!uids.length)throw Error('Florescer Sinistro exige descartar outra carta.');if(!a.playDiscardUid){this.s.choice={kind:'bloomCost',player:p,uids,intent:copy(a),revide};this.s.priority=p;return;}if(!uids.includes(a.playDiscardUid))throw Error('Descarte adicional inválido.');}return finalPlay.call(this,p,a,revide);};
Engine.prototype.activatePaid=function(p,a){const side=this.s.players[p];if(a.playDiscardUid)this.move(a.playDiscardUid,'discard');let penalty=0,suppressed=false;if(a.uid&&this.def(this.find(a.uid)?.card)?.type==='Golpe'){const c=this.find(a.uid).card;if(side.vigorTurn===this.s.turn){side.vigorTurn=0;c.vigorSuppressedTurn=this.s.turn;suppressed=true;}for(const mark of side.inazamiActive||[])if(mark.turn===this.s.turn&&mark.left>0){penalty+=mark.n;mark.left--;}}const result=finalPaid.call(this,p,a),b=this.current();if(b&&a.uid&&b.uid===a.uid){if(suppressed){const sc=finalScript.call(this,this.find(a.uid).card);const written=sc.attackBonus?.(this,p)||0;b.attack=(sc.baseAttack?.(this,p)??this.def(this.find(a.uid).card).power??0)+Math.min(0,written)+Math.min(0,this.zoneModifier(b.zone,'attack'));b.impetusBase=0;b.extraImpetus=0;b.noGuards=false;b.firstImpetus=false;}b.attack=Math.max(0,b.attack-penalty);}return result;};
Engine.prototype.runOps=function(ops,ctx){for(const op of ops){if(this.s.winner!==null)return;const side=this.s.players[ctx.p],enemy=this.s.players[other(ctx.p)];if(op.focus&&(ctx.focusPower??side.power)<op.focus)continue;
 if(op.op==='watchFervor'){const b=this.s.combats.find(b=>b.id===ctx.target);if(b&&!b.finished)(b.endEffects||(b.endEffects=[])).push({p:ctx.p,ops:[{op:'fervorReveal'}],label:'Fervor Protetor — fim do combate'});}
 else if(op.op==='fervorReveal'){if(side.hp<10&&side.extra.length<4){const revealed=side.deck.slice(0,side.receivedDamage||0);this.log('Fervor Protetor revela: '+revealed.map(c=>this.def(c).name).join(', ')+'.','efeito de carta');const uids=revealed.filter(c=>this.def(c).type==='Guarda').map(c=>c.uid);if(uids.length)this.s.choice={kind:'fervorPick',player:ctx.p,uids};else this.shuffle(side.deck);}}
 else if(op.op==='cancelVigor'){if(side.damage>=5)enemy.vigorPending=true;}
 else if(op.op==='inazami'){(enemy.inazamiPending||(enemy.inazamiPending=[])).push(1);}
 else if(op.op==='mapvta'){this.s.choice={kind:'mapvtaDeclare',player:ctx.p};}
 else if(op.op==='ghostDance'){const strikes=[...this.s.completed,...this.s.combats].filter(b=>b.p===ctx.p&&!b.token&&!b.cancelled);if(strikes.length>=2){const uids=side.deck.slice(0,5).filter(c=>this.script(c).flow).map(c=>c.uid);if(uids.length)this.s.choice={kind:'ghostPick',player:ctx.p,uids};else this.shuffle(side.deck);}}
 else if(op.op==='sinisterBloom'){const uids=side.deck.filter(c=>['Golpe','Guarda','Truque'].includes(this.def(c).type)).map(c=>c.uid);if(uids.length&&side.stamina.length)this.s.choice={kind:'bloomPick',player:ctx.p,uids,old:side.stamina.map(c=>c.uid)};}
 else if(op.op==='darsSearch'){const uids=side.deck.filter(c=>this.isDars(c,'Golpe')).map(c=>c.uid);if(uids.length)this.s.choice={kind:'namedSearch',player:ctx.p,uids,from:'deck',to:'hand'};}
 else if(op.op==='darsRelease'){const n=this.s.players.reduce((n,p)=>n+(p.darsCounters||0),0);this.s.players.forEach(p=>p.darsCounters=0);side.darsCostDown=(side.darsCostDown||0)+n;this.log('Heavythink remove '+n+' contador(es); custo dos seus Golpes −'+n+' neste turno.','efeito de carta');}
 else if(op.op==='darsHit'){const zones=op.kind==='banish'?['discard','arena']:op.kind==='discard'?['hand']:['deck'],uids=zones.flatMap(z=>side[z]).filter(c=>this.isDars(c,'Truque')).map(c=>c.uid);if(uids.length&&this.energies(ctx.p,true).length)this.s.choice={kind:'darsPay',player:ctx.p,uids,action:op.kind};}
 else finalOps.call(this,[op],ctx);
}};
Engine.prototype.remainingActions=function(p){const c=this.s.choice;if(!c||c.player!==p)return null;switch(c.kind){
 case 'bloomCost':case 'fervorPick':case 'bloomPick':case 'bloomReturn':case 'mapvtaPick':case 'darsPick':return c.uids.map(uid=>({type:'remainingChoose',uid}));
 case 'darsPay':return [{type:'remainingChoose',use:false},{type:'remainingChoose',use:true}];
 case 'darsTarget':return [0,1].map(target=>({type:'remainingChoose',target}));
 case 'mapvtaDeclare':return [...new Set([...this.catalog.values()].filter(c=>c.type==='Golpe').map(c=>c.subtype))].flatMap(value=>['Inferior','Meio','Superior'].map(zone=>({type:'remainingChoose',declare:'subtype',value,zone})));
 case 'ghostPick':return c.uids.flatMap(uid=>[{type:'remainingChoose',uid,mode:'buy'},...this.energies(p,true).map(e=>({type:'remainingChoose',uid,mode:'swap',energyUid:e.uid}))]);
 default:return null;
}};
Engine.prototype.legalActions=function(p){const actions=this.remainingActions(p);if(actions)return actions;return finalLegal.call(this,p).filter(a=>!(a.type==='play'&&this.script(this.find(a.uid)?.card).playDiscard&&!this.s.players[p].hand.some(c=>c.uid!==a.uid)));};
Engine.prototype.apply=function(p,a){const c=this.s.choice;if(!c||!this.remainingActions(p))return finalApply.call(this,p,a);if(p!==c.player||!this.remainingActions(p).some(x=>Object.keys(x).every(k=>x[k]===a[k])&&Object.keys(a).every(k=>k in x||k==='slot'&&c.kind==='fervorPick')))throw Error('Escolha inválida para este efeito.');const side=this.s.players[p];this.s.choice=null;
 if(c.kind==='bloomCost'){this.play(p,{...c.intent,playDiscardUid:a.uid},c.revide);return;}
 if(c.kind==='fervorPick'){this.putEffectExtra(p,a.uid,true,a.slot);this.shuffle(side.deck);}
 else if(c.kind==='mapvtaDeclare'){const card=side.deck[0];if(card){this.log('Entre Olhares revela '+this.def(card).name+'.','efeito de carta');if(this.def(card).type==='Golpe'&&this.def(card).subtype===a.value&&this.def(card).zone===a.zone&&side.extra.length<4)this.putEffectExtra(p,card.uid,true);}}
 else if(c.kind==='ghostPick'){if(a.mode==='swap'){this.move(a.energyUid,'hand');const card=this.move(a.uid,'stamina');card.active=false;}else this.move(a.uid,'hand');this.shuffle(side.deck);}
 else if(c.kind==='bloomPick'){this.s.choice={kind:'bloomReturn',player:p,uids:c.old,chosen:a.uid};}
 else if(c.kind==='bloomReturn'){this.move(a.uid,'hand');const card=this.move(c.chosen,'stamina');card.active=false;this.shuffle(side.deck);}
 else if(c.kind==='darsPay'){if(a.use){const energy=this.energies(p,true)[0];if(!energy)throw Error('Energia ativa insuficiente.');energy.active=false;if(p===this.s.active&&!this.energies(p,true).length)this.s.autoEnd=true;this.s.choice={kind:'darsPick',player:p,uids:c.uids,action:c.action};}}
 else if(c.kind==='darsPick'){const loc=this.find(a.uid);if(!loc||loc.p!==p)throw Error('Carta Darsmagius indisponível.');if(c.action==='search'){this.move(a.uid,'hand');this.shuffle(side.deck);}else{this.move(a.uid,c.action==='banish'?'banished':'discard');this.s.choice={kind:'darsTarget',player:p};}}
 else if(c.kind==='darsTarget'){const target=this.s.players[a.target];target.darsCounters=(target.darsCounters||0)+1;}
 this.s.priority=this.s.choice?.player??this.s.active;
};

const finalFighterOverdrive=Engine.prototype.fighterOverdrive;
Engine.prototype.fighterOverdrive=function(p,a,revide){finalFighterOverdrive.call(this,p,a,revide);const side=this.s.players[p],b=this.current();for(const m of side.inazamiActive||[])if(m.turn===this.s.turn&&m.left>0){b.attack=Math.max(0,b.attack-m.n);m.left--;}if(side.vigorTurn===this.s.turn){side.vigorTurn=0;b.attack-=Math.max(0,this.zoneModifier(b.zone,'attack'));}};
if(typeof module==='object'&&module.exports)require('./strict-features.js')(Engine);
// Balanceamento First Drive 0.1: camada de regras, sem DOM.
const balanceOps=Engine.prototype.runOps,balanceApply=Engine.prototype.apply,balanceLegal=Engine.prototype.legalActions,balancePaid=Engine.prototype.activatePaid,balanceMove=Engine.prototype.move,balanceScript=Engine.prototype.script,balancePrepare=Engine.prototype.prepareTurn;
const balanceName=s=>s.toLowerCase().replace(/darsmagius/g,'darsmagium');
Engine.prototype.script=function(card){if(card?.token&&card.balanceToken){const ops={owl:[{op:'balanceSearch',name:'Galacstrix',types:['Golpe','Guarda','Truque'],from:'deck'}],dragon:[{op:'draw',n:1}],raven:[{op:'balanceSearch',name:'Galacstrix',types:['Golpe','Guarda','Truque'],from:'discard'}],tiger:[{op:'nextAttackBonus',n:2}]};return card.balanceToken==='raven'?{success:ops.raven}:{hit:ops[card.balanceToken]};}return balanceScript.call(this,card);};
Engine.prototype.finishTokenUse=function(uid){const f=this.find(uid);if(!f?.card.token||!f.card.pendingUse)return false;delete f.card.pendingUse;if(f.card.fugaz&&!f.card.balanceToken)this.destroyToken(uid,'fugaz-use');return true;};
Engine.prototype.energies=function(p,active){return this.s.players[p].stamina.filter(c=>c.active===active&&!(c.lockedUntil>=this.s.turn));};
Engine.prototype.prepareTurn=function(){const locked=this.s.players[this.s.active].stamina.filter(c=>c.lockedUntil>=this.s.turn);balancePrepare.call(this);locked.forEach(c=>c.active=false);};
Engine.prototype.move=function(uid,z){const loc=this.find(uid),sc=loc&&this.script(loc.card),p=loc?.p,ops=z==='banished'&&loc?[...(loc.z==='discard'?sc.banishedFromDiscard||[]:[]),...(sc.banished||[])]:[];const card=balanceMove.call(this,uid,z);if(ops.length)this.push({kind:'effect',p,ops,context:{p,source:uid},label:this.def(card).name+' — banida'});return card;};
Engine.prototype.runOps=function(ops,ctx){for(const op of ops){if(this.s.winner!==null)return;const p=ctx.p,side=this.s.players[p];if(op.op==='balanceSearch'){const from=op.from,uids=side[from].filter(c=>op.types.includes(this.def(c).type)&&balanceName(this.def(c).name).includes(balanceName(op.name))).map(c=>c.uid);if(uids.length)this.s.choice={kind:'namedSearch',player:p,uids,from,to:'hand'};}
else if(op.op==='balancePsychic'&&ctx.psychicPaid!==false)this.s.choice={kind:'balancePsychic',player:p,reward:op.reward};
else if(op.op==='balanceLock'){if(!op.requiresDamage||side.damage>=op.requiresDamage)this.s.choice={kind:'balanceTarget',player:p,locked:true};}
else if(op.op==='balanceToken'){const power=op.power+(op.effect==='owl'&&ctx.revide?2:0),token=this.createToken(p,{name:op.name,power,fugaz:true});if(token)token.balanceToken=op.effect;}
else if(op.op==='balanceAttachTiger'){const b=this.s.combats.find(b=>b.id===ctx.target);if(b&&!b.finished)(b.hitTokenEffects||(b.hitTokenEffects=[])).push({p,name:'Galacstrix Tigre',power:2});}
else if(op.op==='heal')side.hp+=op.n;
else balanceOps.call(this,[op],ctx);}};
const balanceCreate=Engine.prototype.createToken;
Engine.prototype.createToken=function(p,options){const token=balanceCreate.call(this,p,options);if(token&&options.name==='Galacstrix Tigre')token.balanceToken='tiger';return token;};
Engine.prototype.legalActions=function(p){const c=this.s?.choice;if(c&&c.player===p){if(c.kind==='balancePsychic')return ['Golpe','Truque','Guarda'].map(cardType=>({type:'balanceDeclare',cardType}));if(c.kind==='balanceTarget')return [0,1].filter(target=>this.energies(target,true).length).map(target=>({type:'balanceTarget',target}));if(c.kind==='balanceEnergy')return c.uids.map(uid=>({type:'balanceChoose',uid}));}const acts=balanceLegal.call(this,p);if(!this.s||this.s.choice||this.s.winner!==null||this.s.priority!==p||!['combat','preparation','end'].includes(this.s.phase))return acts;
if(this.energies(p,true).length)for(const card of this.s.players[p].discard){const kind=this.script(card).balanceDiscard;if(kind==='psychic'||kind==='auraborea'&&this.s.players[p].discard.some(c=>this.def(c).type==='Golpe'&&balanceName(this.def(c).name).includes('darsmagium')))acts.push({type:'balanceDiscard',uid:card.uid});}return acts;};
Engine.prototype.apply=function(p,a){const c=this.s.choice;
if(c&&c.player===p&&c.kind==='balancePsychic'){if(a.type!=='balanceDeclare'||!['Golpe','Truque','Guarda'].includes(a.cardType))throw Error('Declare um tipo de Ação.');const side=this.s.players[p],top=side.deck[0];this.s.choice=null;if(!top){this.draw(p,1,false);return;}const d=this.def(top),correct=d.type===a.cardType;this.log('Psychic revela '+d.name+'; declaração '+(correct?'correta.':'incorreta.'),'balanceamento 0.1');if(correct){this.draw(p,1,false);if(c.reward==='heal')side.hp+=typeof d.cost==='number'?d.cost:0;if(c.reward==='damage')this.damage(other(p),3,p);if(c.reward==='lock'){this.s.choice={kind:'balanceTarget',player:p};return;}}else this.shuffle(side.deck);if(this.s.winner===null)this.s.choice={kind:'psychicReveal',player:p,uids:[top.uid]};return;}
if(c&&c.player===p&&c.kind==='balanceTarget'){if(!this.legalActions(p).some(x=>x.type===a.type&&x.target===a.target))throw Error('Lutador alvo inválido.');this.s.choice={kind:'balanceEnergy',player:p,target:a.target,locked:!!c.locked,uids:this.energies(a.target,true).map(c=>c.uid)};return;}
if(c&&c.player===p&&c.kind==='balanceEnergy'){if(a.type!=='balanceChoose'||!c.uids.includes(a.uid))throw Error('Energia alvo inválida.');const card=this.find(a.uid).card;card.active=false;if(c.locked)card.lockedUntil=this.s.turn+1;this.s.choice=null;this.s.priority=this.s.active;if(c.target===this.s.active&&!this.energies(c.target,true).length)this.s.autoEnd=true;this.log(c.locked?'Energia inativada e impedida de reativar até o fim do próximo turno.':'Energia inativada por Psychic.','balanceamento 0.1');return;}
if(a.type==='balanceDiscard'){if(!this.legalActions(p).some(x=>x.type===a.type&&x.uid===a.uid))throw Error('Efeito do Descarte indisponível.');this.beginPayment(p,a,{own:1,opp:0});return;}
return balanceApply.call(this,p,a);};
Engine.prototype.activatePaid=function(p,a){if(a.type!=='balanceDiscard')return balancePaid.call(this,p,a);const kind=this.script(this.find(a.uid).card).balanceDiscard;if(kind==='psychic'){this.move(a.uid,'banished');return this.push({kind:'effect',p,ops:[{op:'draw',n:1}],context:{p},label:'Psychic — banir do Descarte e comprar'});}this.move(a.uid,'deck');this.shuffle(this.s.players[p].deck);const uids=this.s.players[p].discard.filter(c=>this.def(c).type==='Golpe'&&balanceName(this.def(c).name).includes('darsmagium')).map(c=>c.uid);return this.push({kind:'effect',p,ops:[{op:'balanceAuraborea',uids}],context:{p},label:'Auraborea — banir Darsmagium'});};
const balanceOps2=Engine.prototype.runOps;
Engine.prototype.runOps=function(ops,ctx){for(const op of ops){if(op.op==='balanceAuraborea'&&op.uids.length)this.s.choice={kind:'balanceBanish',player:ctx.p,uids:op.uids};else balanceOps2.call(this,[op],ctx);}};
const balanceLegal2=Engine.prototype.legalActions,balanceApply2=Engine.prototype.apply;
Engine.prototype.legalActions=function(p){if(this.s?.choice?.kind==='balanceBanish')return this.s.choice.player===p?this.s.choice.uids.map(uid=>({type:'balanceChoose',uid})):[];const acts=balanceLegal2.call(this,p);if(this.s?.choice?.kind==='balanceTarget'&&this.s.choice.player===p&&!acts.length)return [{type:'balanceSkip'}];return acts;};
Engine.prototype.apply=function(p,a){const c=this.s.choice;if(c?.kind==='balanceTarget'&&c.player===p&&a.type==='balanceSkip'&&!this.energies(0,true).length&&!this.energies(1,true).length){this.s.choice=null;return;}if(c?.kind==='balanceBanish'&&c.player===p){if(a.type!=='balanceChoose'||!c.uids.includes(a.uid))throw Error('Escolha uma Ação Darsmagium do Descarte.');this.s.choice=null;this.move(a.uid,'banished');this.s.priority=this.s.active;return;}return balanceApply2.call(this,p,a);};


const balanceTurn=Engine.prototype.newTurn;
Engine.prototype.resolveTokenTurnEnd=function(){for(const side of this.s.players)for(const token of [...side.extra])if(token.token&&token.fugaz&&token.createdTurn<=this.s.turn&&(!token.balanceToken||this.s.phase==='end'))this.destroyToken(token.uid,'fugaz-end');};
Engine.prototype.newTurn=function(){if(this.s.phase==='end')this.resolveTokenTurnEnd();return balanceTurn.call(this);};

Expansion.install(Engine,scripts);
Rivals04.install(Engine,scripts);
Rivals05.install(Engine,scripts);
Rivals06.install(Engine,scripts,GameModes);
// Atualização de cartas 0.9: regras compartilhadas por IA, Arcade e servidor PvP.
const u09={};for(const k of ['script','runOps','apply','legalActions','activatePaid','beginPayment','completePayment','view','finishCombat','move','createToken','destroyToken'])u09[k]=Engine.prototype[k];
const psychicAction=(e,c)=>['Golpe','Guarda','Truque'].includes(e.def(c).type)&&e.def(c).name.toLowerCase().includes('psychic');
Engine.prototype.refreshBoydd=function(){if(!this.s)return;const count=this.s.players.reduce((n,s)=>n+s.extra.length,0);for(const b of this.s.combats){if(b.boyddExtraBonus===undefined)continue;b.attack+=count-b.boyddExtraBonus;b.boyddExtraBonus=count;const m=b.attackModifiers?.find(m=>m.name==='Boydd · primeiro Golpe · Zonas Extras');if(m)m.value=count;}};
for(const k of ['move','createToken','destroyToken'])Engine.prototype[k]=function(...args){const result=u09[k].apply(this,args);this.refreshBoydd();return result;};
Engine.prototype.script=function(card){if(card?.token&&card.balanceToken){const sc=u09.script.call(this,card),ops=sc.hit||sc.success;return card.balanceToken==='raven'?{onBlock:ops}:{onAttack:ops};}return u09.script.call(this,card);};
Engine.prototype.activatePaid=function(p,a){
 if(a.type==='balanceDiscard'&&this.script(this.find(a.uid).card).balanceDiscard==='psychic'){
  const from=this.script(this.find(a.uid).card).discardSearchFrom;
  this.move(a.uid,'banished');return this.push({kind:'effect',p,ops:[{op:'balanceSearch',name:'Psychic',types:['Golpe','Guarda'],from}],context:{p},label:'Psychic — banir e '+(from==='deck'?'buscar':'reciclar')});
 }
 const result=u09.activatePaid.call(this,p,a),b=this.current();
 if(a.type==='tokenAttack'){const token=this.find(a.uid)?.card,ops=token&&this.script(token).onAttack;if(ops)this.push({kind:'effect',p,ops,context:{p,source:a.uid,combat:this.current().id},label:token.name+' — ao golpear'});}
 if(a.type==='play'&&b?.uid===a.uid&&!b.token&&this.script(this.s.players[p].fighter).firstStrikeExtraAura){const side=this.s.players[p],first=side.boyddFirstStrikeTurn!==this.s.turn;side.boyddFirstStrikeTurn=this.s.turn;if(first){b.boyddExtraBonus=0;(b.attackModifiers||(b.attackModifiers=[])).push({name:'Boydd · primeiro Golpe · Zonas Extras',value:0});this.refreshBoydd();}}
 if(a.type==='block')for(const uid of a.uids){const c=this.find(uid)?.card,ops=c?.token&&this.script(c).onBlock;if(ops)this.push({kind:'effect',p,ops,context:{p,source:uid,combat:b.id},label:c.name+' — ao bloquear'});}
 return result;
};
Engine.prototype.runOps=function(ops,ctx){for(const op of ops){
 if(this.s.winner!==null)return;if(op.when==='revide'&&!ctx.revide)continue;
 if(op.op==='update09Scry'){const uids=this.s.players[ctx.p].deck.slice(0,3).map(c=>c.uid);if(uids.length)this.s.choice={kind:'balanceScry',player:ctx.p,uids,selected:[],source:ctx.source};}
 else if(op.op==='update09Psychic')this.s.choice={kind:'balancePsychic09',player:ctx.p,reward:op.reward,source:ctx.source,combat:ctx.combat};
 else u09.runOps.call(this,[op],ctx);
}};
Engine.prototype.beginPayment=function(p,intent,pay){if(intent.type==='balanceDiscard'){
 const color=this.script(this.find(intent.uid).card).discardColor,options=this.energies(p,true).filter(c=>this.def(c).color===color);
 if(!options.length)throw Error('Este efeito exige 1 energia '+color.toLowerCase()+' ativa.');pay={...pay,ownColor:color};
 if(!intent.selectEnergy&&!intent.energyUids)intent={...intent,energyUids:[options[0].uid]};
}return u09.beginPayment.call(this,p,intent,pay);};
Engine.prototype.completePayment=function(p,intent,pay,uids){if(pay.ownColor&&(intent.energyUids||[]).some(uid=>this.def(this.find(uid)?.card)?.color!==pay.ownColor))throw Error('Cor de energia inválida.');return u09.completePayment.call(this,p,intent,pay,uids);};
Engine.prototype.legalActions=function(p){const c=this.s?.choice;
 if(c?.player===p&&c.kind==='balanceScry')return c.uids.map(uid=>({type:'balanceChoose',uid}));
 if(c?.player===p&&c.kind==='balancePsychic09')return ['Golpe','Truque','Guarda'].map(cardType=>({type:'balanceDeclare',cardType}));
 return u09.legalActions.call(this,p).map(a=>a.type==='chooseOwnEnergy'&&c?.pay?.ownColor?{...a,options:a.options.filter(uid=>this.def(this.find(uid).card).color===c.pay.ownColor)}:a).filter(a=>a.type!=='balanceDiscard'||this.energies(p,true).some(e=>this.def(e).color===this.script(this.find(a.uid).card).discardColor));
};
Engine.prototype.apply=function(p,a){const c=this.s.choice,side=this.s.players[p];
 if(c?.player===p&&c.kind==='balanceScry'){
  if(a.type!=='balanceChoose'||!c.uids.includes(a.uid))throw Error('Escolha uma das cartas observadas.');
  c.selected.push(a.uid);c.uids=c.uids.filter(uid=>uid!==a.uid);
  if(!c.uids.length){const chosen=c.selected.map(uid=>this.find(uid).card);side.deck=[...chosen,...side.deck.filter(card=>!c.selected.includes(card.uid))];this.s.choice=null;this.s.priority=this.s.active;}return;
 }
 if(c?.player===p&&c.kind==='balancePsychic09'){
  if(a.type!=='balanceDeclare'||!['Golpe','Truque','Guarda'].includes(a.cardType))throw Error('Declare um tipo de Ação.');
  const top=side.deck[0];this.s.choice=null;if(!top)return;
  const correct=this.def(top).type===a.cardType,b=this.s.combats.find(b=>b.id===c.combat);
  this.log('Psychic revela '+this.def(top).name+'; declaração '+(correct?'correta.':'incorreta.'),'atualização 0.9');
  if(correct&&b){if(c.reward==='block'){const guard=b.blocks.find(g=>g.uid===c.source);if(guard)guard.value+=2;}else{const n=c.reward==='banishedAttack'?2*side.banished.filter(card=>psychicAction(this,card)).length:2;b.attack+=n;(b.attackModifiers||(b.attackModifiers=[])).push({name:'Psychic · declaração correta',value:n});}}
  this.s.choice={kind:'psychicReveal',player:p,uids:[top.uid],update09Reveal:true};return;
 }
 const result=u09.apply.call(this,p,a);

 return result;
};
Engine.prototype.finishCombat=function(b){this.refreshBoydd();return u09.finishCombat.call(this,b);};
Engine.prototype.view=function(p){const v=u09.view.call(this,p);if(v&&this.s.choice?.update09Reveal)v.revealedCards=this.s.choice.uids.map(uid=>copy(this.find(uid).card));return v;};
MahaZeno.install(Engine,scripts,SUPPORTED);
Engine.RULESET_ID=RULESET_ID;
return {Engine,chooseAI,SUPPORTED,VERSION,RULESET_ID};
});

















