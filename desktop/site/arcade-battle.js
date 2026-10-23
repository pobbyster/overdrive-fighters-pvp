(()=>{
 'use strict';if(!new URLSearchParams(location.search).has('arcadeBattle'))return;const api=OverdriveArena,token=new URLSearchParams(location.search).get('token'),Core=OverdriveArcade;let booted=false,engine=null;
 document.body.classList.add('arcade-battle');const css=document.createElement('style');css.textContent='body.arcade-battle .arena-header,body.arcade-battle #setup,body.arcade-battle .session-launch,body.arcade-battle #duelBadge,body.arcade-battle #sessionTools,body.arcade-battle #sessionStatus,body.arcade-battle .audio-toggle,body.arcade-battle #tutorialOpen,body.arcade-battle #logToggle{display:none!important}body.arcade-battle:not(.rivals-playing){visibility:hidden}body.arcade-battle #game{margin-top:0!important}';document.head.append(css);
 const post=data=>parent.postMessage({...data,token},location.origin);
 function update(){if(!engine?.s)return;const s=engine.s;post({type:'ofs-arcade:update',revision:s.revision,replay:engine.replay(),hp:s.players.map(p=>p.hp),turn:s.turn,winner:s.winner});}
 addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.token!==token)return;const m=event.data;
  if(m.type==='ofs-arcade:start'&&!booted){try{const catalog=api.catalog(),a=Core.deck(OverdriveCore.Engine,catalog,m.fighter),b=Core.deck(OverdriveCore.Engine,catalog,m.opponent);if(m.replay){const expected={...Core.create(OverdriveCore.Engine,catalog,m.fighter,1),route:[m.opponent,...Core.fighters.filter(n=>n!==m.fighter&&n!==m.opponent).slice(0,4)],stage:0,phase:'playing',seed:m.seed};engine=Core.restoreEngine(OverdriveCore.Engine,catalog,expected,m.replay);}else{engine=new OverdriveCore.Engine(catalog);engine.start(a,b,m.first,m.seed,'advanced');}
    booted=true;OverdriveSession.beginNormal();OverdriveSession.mode='arcade';window.OverdriveDuel?.restoreMeta(null);document.getElementById('aiDifficulty').value=m.difficulty==='hard'?'hard':'normal';document.getElementById('opponent').value=m.opponent+':balanced';api.load(engine);window.OverdriveFightHud?.setArcade({stage:m.stage,score:m.score});update();
   }catch(e){post({type:'ofs-arcade:error',message:e.message});}}
  if(m.type==='ofs-arcade:pause'&&booted){OverdriveSession.paused=!!m.paused;api.pause();api.render();if(!m.paused)api.schedule();update();}
 });
 addEventListener('of-game-render',()=>{if(booted)update();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))post({type:'ofs-arcade:pause-request'});});
 function ready(){if(api.catalog())post({type:'ofs-arcade:ready'});}addEventListener('of-arena-ready',ready);if(api.catalog())queueMicrotask(ready);
})();
