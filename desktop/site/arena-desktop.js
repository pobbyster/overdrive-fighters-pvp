window.OverdriveFighterPortrait=id=>'assets/fighters/'+({'OF-C1-032':'Boydd','OF-C1-051':'Hanma','OF-C1-070':'Len-Yin','OF-C1-089':'Blossom','OF-C1-114':'Arcturus','OF-C1-120':'Mourner','OF-C1-126':'Placide','OF-C1-132':'Rynhard','OF-RVAS-001':'Missbigotten','OF-RVAS-029':'Duke','OF-MZ-001':'MahaZeno'}[id]||'Blossom')+'.jpg';
window.OverdriveOpponentDeck=(engine,preset)=>{
 const [raw,style]=String(preset).split(':'),number=[32,51,70,89,114,120,126,132,142,170,200].includes(Number(raw))?Number(raw):89,deck=engine.fighterStarter(number);
 if(style==='pressure'||style==='defense'){
  const fighter=engine.def(deck.fighter),wanted=style==='pressure'?'Golpe':'Guarda',remove=Object.keys(deck.main).filter(id=>engine.def(id).color!=='Genérica'&&engine.def(id).type!==wanted).sort((a,b)=>(engine.def(b).cost||0)-(engine.def(a).cost||0))[0];
  const candidate=[...engine.catalog.values()].filter(c=>c.type===wanted&&c.color!=='Genérica'&&fighter.colors.includes(c.color)&&!deck.main[c.id]&&!engine.script(c.id).comboZone).sort((a,b)=>style==='pressure'?(a.cost||0)-(b.cost||0):(b.block||0)-(a.block||0))[0];
  if(remove&&candidate){deck.main[remove]-=2;if(!deck.main[remove])delete deck.main[remove];deck.main[candidate.id]=2;}
 }
 deck.name=engine.def(deck.fighter).name+' · '+({pressure:'Pressão',defense:'Defesa',balanced:'Equilibrada'}[style]||'Equilibrada');engine.validateDeck(deck);return deck;
};
window.OverdriveDesktopAI=(view,catalog,difficulty='normal',style='balanced')=>{
 const baseline=OverdriveCore.chooseAI(view,catalog);if(!baseline||view.choice||view.phase==='mulligan')return baseline;
 const p=view.viewer??1,own=view.players[p],enemy=view.players[1-p],defs=new Map(catalog.map(c=>[c.id,c])),cards=new Map([own.fighter,...own.hand,...own.extra,...own.stamina,...own.discard,...own.arena,...enemy.arena].map(c=>[c.uid,c]));
 const def=a=>OverdriveRivals06.definition(cards.get(a.uid),cards.get(a.uid)?.tokenDefinition||defs.get(cards.get(a.uid)?.id),view),script=a=>OverdriveCardScripts.scripts[def(a)?.number]||{};
 if(difficulty==='easy'){
  if(baseline.type==='block'&&view.combats.at(-1)?.attack<own.hp*.5)return {type:'block',uids:[]};
  if(baseline.type==='play'&&def(baseline)?.type==='Golpe')return view.actions.filter(a=>a.type==='play'&&def(a)?.type==='Golpe'&&(a.mode!=='life'||own.hp>def(a).cost)).sort((a,b)=>(def(a).power||0)-(def(b).power||0))[0]||baseline;return baseline;
 }
 if(baseline.type==='block'){
  const combat=view.combats.at(-1),pool=baseline.uids.length?view.actions.find(a=>a.type==='block').options.map(uid=>({uid,type:'block'})).filter(a=>!script(a).psychicCost&&!script(a).additionalDiscard).slice(0,12):[];
  let best={type:'block',uids:[]},score=combat.attack;for(let mask=1;mask<2**pool.length;mask++){let value=0,cost=0,guards=0,spent=0,actions=false;const uids=[];for(let i=0;i<pool.length;i++)if(mask&(1<<i)){const a=pool[i],d=def(a),card=cards.get(a.uid),block=d.block||0;uids.push(a.uid);if(d.type==='Guarda'){cost+=Math.max(0,d.cost+(guards===0?(own.r05NextTax||0)-(own.r05GuardDiscount||0):0));guards++;}value+=combat.ignoreBelowPower!==undefined&&block<combat.ignoreBelowPower?0:block;spent+=(d.power||0)*.07+.1;actions||=!card.token;}if(cost>enemy.stamina.filter(c=>!c.active&&!c.r05Lock).length)continue;
   const damage=Math.max(0,combat.attack-value)+(actions?(combat.impetusBase||0)+(combat.extraImpetus||0):0),candidate=damage+cost*(style==='pressure'?.6:.25)+spent;if(candidate<score){score=candidate;best={type:'block',uids};}}
  if(!pool.length)return baseline;return best;
 }
 const fighter=defs.get(own.fighter.id),sequence=OverdriveCardScripts.scripts[fighter.number]?.sequence||[],next=sequence[Math.min(own.od,sequence.length-1)],skill=view.actions.find(a=>a.type==='fighterSkill');
 const attacks=view.actions.filter(a=>a.type==='play'&&def(a)?.type==='Golpe'&&(a.mode!=='life'||own.hp>def(a).cost));
 if(skill&&own.od<2&&own.stamina.filter(c=>c.active).length>=2){if(fighter.number===70&&Math.abs(own.power-enemy.power)>0&&attacks.some(a=>script(a).focusThreshold&&(a.mode==='alternative'||Number(def(a).cost)+1<=own.stamina.filter(c=>c.active).length))&&![...view.completed,...view.combats].some(b=>b.p===p&&script({uid:b.uid}).focusThreshold))return skill;if(fighter.number===32&&style!=='defense'&&attacks.some(a=>def(a).subtype==='Soco'&&def(a).cost<=1))return skill;}
 const draw=view.actions.find(a=>a.type==='startSkill');if(draw&&own.od<2&&own.handCount<=2)return draw;
 if(baseline.type==='fighterOverdrive')return {...baseline,zone:enemy.od>0?'Meio':next||'Meio'};
 if(!attacks.length||baseline.type!=='play'||def(baseline)?.type!=='Golpe')return baseline;
 const score=a=>{const c=def(a),sc=script(a),attack=typeof c.power==='number'?c.power:0;return attack-(Number(c.cost)||0)*(style==='defense'?.9:.3)+(c.zone===next?(difficulty==='hard'?5:3):0)+(attack>=enemy.hp?20:0)+(sc.break&&enemy.od>0?4:0)+(sc.focusThreshold&&own.power>=sc.focusThreshold?2:0)+(style==='pressure'&&sc.impetus?2:0)-(a.mode==='life'&&own.hp<8?4:0);};
 return attacks.sort((a,b)=>score(b)-score(a))[0];
};
(() => {
 // Focal points refer to the face in each original portrait, rather than its full-body center.
 const faces={'OF-C1-032':[.38,.19],'OF-C1-051':[.48,.33],'OF-C1-070':[.47,.245],'OF-C1-089':[.51,.255],'OF-C1-114':[.50,.22],'OF-C1-120':[.56,.20],'OF-C1-126':[.59,.15],'OF-C1-132':[.50,.22],'OF-RVAS-001':[.50,.25]};
 const framePortrait=image=>{
  if(!image.naturalWidth)return;
  const half=image.parentElement,w=half.clientWidth,h=half.clientHeight;
  const [x,y]=faces[image.dataset.fighter]||faces['OF-C1-089'];
  const own=half.classList.contains('poster-own'),anchor=own?.33:.67;
  const width=Math.max(w*1.4,w*anchor/x,h*image.naturalWidth/image.naturalHeight),height=width*image.naturalHeight/image.naturalWidth;
  image.style.width=width+'px';image.style.height=height+'px';
  image.style.left=Math.max(w-width,Math.min(0,w*anchor-width*x))+'px';
  image.style.top=Math.max(h-height,Math.min(0,h*anchor-height*y))+'px';
 };
 const portraits=[...document.querySelectorAll('.poster-half img')];
 portraits.forEach(image=>image.addEventListener('load',()=>framePortrait(image)));
 const enemy=document.querySelector('.poster-enemy img');
 const updateEnemy=()=>{const n=Number(document.getElementById('opponent').value.split(':')[0])||89;enemy.dataset.fighter=n===142?'OF-RVAS-001':n===170?'OF-RVAS-029':n===200?'OF-MZ-001':'OF-C1-'+String(n).padStart(3,'0');enemy.src=OverdriveFighterPortrait(enemy.dataset.fighter);enemy.alt='Adversário: '+({'32':'Boydd','51':'Hanma','70':'Len Yin','89':'Blossom','114':'Arcturus','120':'Mourner','126':'Placide','132':'Rynhard','142':'Lady Missbigotten','170':'Duke','200':'MahaZeno'}[n]);document.querySelector('.poster-enemy strong').textContent=({'32':'BOYDD','51':'HANMA','70':'LEN YIN','89':'BLOSSOM','114':'ARCTURUS','120':'MOURNER','126':'PLACIDE','132':'RYNHARD','142':'MISSBIGOTTEN','170':'DUKE','200':'MAHAZENO'}[n]);framePortrait(enemy);};document.getElementById('opponent').addEventListener('change',updateEnemy);updateEnemy();
 const resize=new ResizeObserver(()=>portraits.forEach(framePortrait));
 portraits.forEach(image=>resize.observe(image.parentElement));
 const deck=document.getElementById('playerDeck'),label=document.getElementById('selectedDeckName');
 const update=()=>{
  label.textContent=deck.selectedOptions[0]?.textContent||'Selecione seu baralho';
  const image=document.querySelector('.poster-own img'),id=deck.selectedOptions[0]?.dataset.fighter||'OF-C1-089';
  image.dataset.fighter=id;
  image.src=OverdriveFighterPortrait(id);
  framePortrait(image);
  image.alt='Seu lutador: '+({'OF-C1-032':'Boydd','OF-C1-051':'Hanma','OF-C1-070':'Len Yin','OF-C1-089':'Blossom','OF-C1-114':'Arcturus','OF-C1-120':'Mourner','OF-C1-126':'Placide','OF-C1-132':'Rynhard','OF-RVAS-001':'Lady Missbigotten','OF-RVAS-029':'Duke','OF-MZ-001':'MahaZeno'}[id]||'Blossom');
 };
 deck.addEventListener('change',update);new MutationObserver(update).observe(deck,{childList:true});
 document.getElementById('aiDifficulty').addEventListener('change',e=>document.getElementById('difficultyHint').textContent={easy:'Ataques simples e defesa reduzida para aprender os fundamentos.',normal:'Equilibra ataque, defesa e uso das cartas.',hard:'Prioriza a sequência de Overdrive, Quebra e oportunidades de finalizar.'}[e.target.value]);
})();
