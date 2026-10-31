(() => {
 'use strict';
 // A read-only facade lets the existing Arena render a filtered server view.
 // No game simulation, shuffled deck, or opponent hand is present on this client.
 class RemoteEngine {
  constructor(catalog,send){this.catalog=new Map(catalog.map(c=>[c.id,c]));this.remote=true;this.send=send;}
  update(game){this.s=game.view;this.candidates=game.candidates;this.costs=game.costs;this.guardCosts=game.guardCosts||{};this.reasons=game.reasons;this.summary=this.baseSummary=game.summary;this.previewKey=null;}
  view(){return this.s;}
  legalActions(p){return p===0?this.s.actions:[];}
  def(card){const base=card?.tokenDefinition||this.catalog.get(typeof card==='string'?card:card?.id)||{name:'Carta oculta',number:0};return OverdriveRivals06.definition(card,base,this.s);}
  script(card){return card?.token?{}:window.OverdriveCardScripts.scripts[this.def(card).number]||{};}
  current(){return this.s.combats.at(-1)||null;}
  find(uid){for(let p=0;p<2;p++){const s=this.s.players[p];if(s.fighter.uid===uid)return {p,z:'fighter',card:s.fighter};for(const z of ['hand','stamina','extra','arena','discard','banished','reserve']){const i=(s[z]||[]).findIndex(c=>c.uid===uid);if(i>=0)return {p,z,i,card:s[z][i]};}}return this.candidates.find(f=>f.card.uid===uid)||null;}
  energies(p,active){return this.s.players[p].stamina.filter(c=>c.active===active);}
  payment(p,c,mode='normal',x=0,zone){return this.costs[[c.uid,mode,x,...(mode==='guardStrike'?[zone]:[])].join(':')]||{own:0,opp:0};}
  guardCost(p,c,index=0){return index===0?(this.guardCosts[c.uid]??this.def(c).cost):this.def(c).cost;}
  explainCard(p,uid){return this.reasons[uid]||[];}
  describeCombat(p,selected=[]){const key=JSON.stringify([this.s.revision,selected]);if(key!==this.previewKey){this.previewKey=key;if(selected.length)this.send({type:'preview',uids:selected});else this.summary=this.baseSummary;}return this.summary;}
  validateDeck(deck){return new OverdriveCore.Engine([...this.catalog.values()]).validateDeck(deck);}
 }
 const $=id=>document.getElementById(id),api=window.OverdriveArena;
 const lobby=document.createElement('section');lobby.id='pvpLobby';lobby.className='panel pvp-lobby';
 lobby.innerHTML='<span class="eyebrow">ARENA PVP · SALA PRIVADA</span><h2>Desafie outro jogador</h2><p>Escolha seu deck acima. Compartilhe o endereço do servidor e o código da sala. O duelo começa quando ambos confirmarem seus decks.</p><div class="pvp-fields"><label>Servidor<input id="pvpServer" spellcheck="false" placeholder="ws://127.0.0.1:4310/pvp"></label><label>Seu nome<input id="pvpName" maxlength="24" value="Jogador"></label><label>Código da sala<input id="pvpCode" maxlength="10" autocomplete="off" spellcheck="false"></label></div><div class="pvp-buttons"><button id="pvpCreate" class="primary">Criar sala</button><button id="pvpJoin">Entrar na sala</button><button id="pvpResume" hidden>Reconectar à sala</button><button id="pvpReady" hidden>Confirmar meu deck</button><button id="pvpLeave" hidden>Sair da sala</button></div><p id="pvpRoomInfo"></p><p id="pvpStatus" role="status" aria-live="polite">Requer um servidor PvP em execução.</p>';
 $('setup').after(lobby);
 const nameKey='of-pvp-player-name';
 try{const saved=localStorage.getItem(nameKey);if(saved!==null)$('pvpName').value=saved.slice(0,24);}catch{}
 $('pvpName').addEventListener('input',()=>{try{localStorage.setItem(nameKey,$('pvpName').value.slice(0,24));}catch{}});
 const clock=document.createElement('p');clock.id='pvpDecisionClock';clock.setAttribute('role','timer');clock.hidden=true;document.body.append(clock);
 const banner=document.createElement('aside');banner.id='pvpBanner';banner.hidden=true;banner.setAttribute('role','status');banner.innerHTML='<span></span><button id="pvpReconnect">Reconectar</button><button id="pvpResign">Desistir / sair</button>';document.body.append(banner);
 const sideButton=document.createElement('button');sideButton.id='pvpSideDeck';sideButton.textContent='Trocas / próximo duelo';sideButton.hidden=true;banner.append(sideButton);
 let socket,credential,remote,pending=null,sequence=0,room,attempt=0,retry,manual=false,resync=false,selfSeat=0,clockOffset=0,remoteRound=0,sideOpened='';
 try{credential=JSON.parse(sessionStorage.getItem('of-pvp-session')||'null');}catch{}
 const defaultServer='wss://overdrive-fighters-pvp.onrender.com/pvp';
 if(credential?.url!==defaultServer)credential=null;
 $('pvpServer').value=defaultServer;
 if(credential){$('pvpResume').hidden=false;$('pvpCode').value=credential.code;}
 function status(text){$('pvpStatus').textContent=text;if(!banner.hidden)banner.querySelector('span').textContent=text;}
 function send(data){if(socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify({protocol:1,...data}));return true;}
 function persist(){if(credential)sessionStorage.setItem('of-pvp-session',JSON.stringify(credential));else sessionStorage.removeItem('of-pvp-session');}
 function transmit(action){if(pending||!room||room.paused||socket?.readyState!==1){status('Aguarde a conexão e a confirmação da última jogada.');return;}pending={type:'action',round:room.match?.round,sequence:sequence+1,revision:remote.s.revision,action};send(pending);}
 function connect(type){
  if(socket&&[0,1].includes(socket.readyState))return;
  let url;try{url=new URL($('pvpServer').value);if(!['ws:','wss:'].includes(url.protocol)||url.pathname!=='/pvp'||url.username||url.password)throw Error();}catch{status('Informe um endereço ws:// ou wss:// terminado em /pvp.');return;}
  manual=false;resync=type==='resume';clearTimeout(retry);status('Conectando ao servidor…');try{socket=new WebSocket(url.href);}catch{status('Não foi possível abrir a conexão. Em páginas HTTPS, utilize um servidor wss://.');return;}
  socket.onopen=()=>{attempt=0;const msg=type==='resume'?{type,code:credential?.code,token:credential?.token}:{type,name:$('pvpName').value,code:$('pvpCode').value.trim().toUpperCase(),mode:$('gameMode')?.value||'standard'};send(msg);};
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.protocol!==1)return;
   if(msg.type==='welcome'){selfSeat=msg.seat;credential={url:url.href,code:msg.code,token:msg.token};sequence=msg.sequence;persist();$('pvpCode').value=msg.code;$('pvpResume').hidden=true;return;}
   if(msg.type==='error'){pending=null;status(msg.message);if(!socket.roomAccepted){manual=true;socket.close();$('pvpCreate').disabled=$('pvpJoin').disabled=false;$('pvpResume').hidden=!credential;}else api.schedule();return;}
   if(msg.type==='roomExpired'){manual=true;credential=null;pending=null;room=null;persist();socket.close();$('pvpCreate').disabled=$('pvpJoin').disabled=false;$('pvpReady').hidden=$('pvpLeave').hidden=$('pvpResume').hidden=true;status(msg.message);return;}
   if(msg.type==='left'){manual=true;credential=null;pending=null;persist();socket.close();location.href='arena.html?pvp';return;}
   if(msg.type==='preview'){if(remote&&msg.revision===remote.s.revision&&JSON.stringify([msg.revision,msg.uids])===remote.previewKey){remote.summary=msg.summary;api.render();}return;}
   if(msg.type!=='state')return;
   socket.roomAccepted=true;room=msg.room;$('gameMode').value=room.mode;$('gameMode').dispatchEvent(new Event('change'));if(!confirmedDeck)try{const saved=JSON.parse(sessionStorage.getItem('of-pvp-deck'));if(saved?.code===room.code)confirmedDeck=saved.deck;}catch{}clockOffset=Number.isFinite(room.serverTime)?room.serverTime-Date.now():0;sequence=msg.ack;
   $('pvpReconnect').hidden=true;$('startGame').disabled=true;
   if(pending&&sequence>=pending.sequence)pending=null;
   $('pvpCreate').disabled=$('pvpJoin').disabled=true;$('pvpReady').hidden=room.started;$('pvpReady').disabled=!!room.opening;$('pvpLeave').hidden=false;
   if(room.match?.round!==remoteRound){remote=null;remoteRound=room.match?.round||1;sideOpened='';}
   sideButton.hidden=room.match?.stage!=='side';
   window.OverdriveCoin?.network(room,send,()=>{$('pvpLeave').click();},selfSeat);
   $('pvpRoomInfo').textContent=`Sala ${room.code} · ${room.mode} · `+room.seats.map(s=>s?`${s.name}: ${s.connected?s.ready?'pronto':'escolhendo deck':'desconectado'}`:'aguardando jogador').join(' / ');
   if(msg.game){
    if(msg.game.view.version!==OverdriveCore.VERSION||msg.game.view.ruleset!==OverdriveCore.RULESET_ID){status('As versões do jogo são incompatíveis. Atualize seu jogo para a versão do servidor.');manual=true;socket.close();return;}
    if(pending&&pending.revision!==msg.game.view.revision)pending=null;
    if(!resync&&remote&&remote.s?.revision!==msg.game.view.revision)dispatchEvent(new CustomEvent('of-game-sounds',{detail:msg.game.sounds||[]}));
    const opening=!remote&&!resync&&msg.game.view.phase==='mulligan';
    remote||=new RemoteEngine(api.catalog(),send);
    window.OverdriveSession?.beginNormal();if(window.OverdriveSession)window.OverdriveSession.mode='online';
    remote.matchScore=room.match?.score;remote.networkPaused=room.paused;remote.sendAction=transmit;
    lobby.hidden=true;banner.hidden=false;
    api.receiveRemote(remote,msg.game,{animate:!resync,opening});resync=false;
    status(room.paused?'Adversário desconectado. Duelo pausado; prazo de reconexão: '+Math.round(room.graceMs/1000)+' s.':remote.s.winner!==null?(remote.s.winner==='draw'?'Empate por desconexão.':remote.s.winner===0?'Você venceu o duelo PvP.':'O adversário venceu o duelo PvP.'):`Sala ${room.code} · conectado · ${room.seats.map(s=>s.name).join(' × ')}`);
    if(room.match){$('pvpRoomInfo').textContent+=' · MATCH '+room.match.score.join(' × ')+' · duelo '+room.match.round;if(remote.s.winner!==null)status(room.match.stage==='complete'?'Confronto encerrado · '+room.match.score.join(' × '):'Duelo encerrado · '+room.match.score.join(' × ')+'. Prepare as trocas para o próximo duelo.');}
    if(room.match?.stage==='side'&&!room.seats[selfSeat].ready&&sideOpened!==room.code+':'+room.match.round){sideOpened=room.code+':'+room.match.round;openSide();}
    if(pending&&!room.paused)send(pending);
   }else status(room.opening?'Decidam a ordem de jogo pelo sorteio de moeda.':'Sala conectada. Os dois jogadores devem confirmar seus decks.');
  };
  socket.onclose=event=>{if(manual)return;$('pvpReconnect').hidden=false;if(remote){remote.networkPaused=true;api.pause();}if(event.code===4001){manual=true;clearTimeout(retry);status('Sua sessão foi retomada em outra aba. Use Reconectar para voltar a jogar aqui.');return;}status('Conexão perdida. Tentando reconectar…');if(credential)retry=setTimeout(()=>connect('resume'),Math.min(1000*2**attempt++,10000));else status('Não foi possível conectar. Verifique o endereço e se o servidor está aberto.');};
  socket.onerror=()=>status('Servidor indisponível. Verifique o endereço e a conexão.');
 }
 $('pvpCreate').onclick=()=>connect('create');$('pvpJoin').onclick=()=>connect('join');
 $('pvpResume').onclick=$('pvpReconnect').onclick=()=>connect('resume');
 let confirmedDeck;
 function openSide(){if(!confirmedDeck){status('Reconecte o baralho desta sala para realizar as trocas.');return;}OverdriveSideDeck.choose(confirmedDeck,{title:'Side deck · próximo duelo',chooseFirst:room.match.lastWinner===1-selfSeat,onConfirm:(deck,first)=>{confirmedDeck=deck;saveRoomDeck();send({type:'sideReady',deck,first,ruleset:OverdriveCore.RULESET_ID});}});}
 function saveRoomDeck(){try{sessionStorage.setItem('of-pvp-deck',JSON.stringify({code:room.code,deck:confirmedDeck}));}catch{}}
 sideButton.onclick=openSide;
 $('pvpReady').onclick=()=>{try{const deck=api.selectedDeck();api.engine().validateDeck(deck);const ready=chosen=>{confirmedDeck=chosen;saveRoomDeck();send({type:'ready',originalDeck:deck,deck:chosen,ruleset:OverdriveCore.RULESET_ID});};if(OverdriveModes.get(room.mode).initialSide)OverdriveSideDeck.choose(deck,{onConfirm:ready});else ready(deck);}catch(e){status(e.message);}};
 function leave(){if(remote?.s.winner===null){if(!confirm('Desistir deste duelo? O adversário será declarado vencedor.'))return;}if(!send({type:'leave'})){manual=true;clearTimeout(retry);credential=null;persist();location.href='arena.html?pvp';}}
 $('pvpLeave').onclick=$('pvpResign').onclick=leave;
 addEventListener('of-game-render',()=>{if(!api.engine()?.remote){lobby.hidden=!$('game').hidden;return;}
  $('sessionStatus')&&($('sessionStatus').textContent='PvP · partida mantida no servidor');
  if($('sessionTools'))$('sessionTools').hidden=true;
  if($('gameStatus'))$('gameStatus').textContent=remote.s.winner!==null?(remote.s.winner==='draw'?'Duelo empatado.':remote.s.winner===0?'Você venceu o duelo PvP.':'O adversário venceu o duelo PvP.'):room?.paused?'Aguardando reconexão do adversário.':remote.legalActions(0).length?'Sua decisão. Clique nas cartas para escolher.':'Aguardando o adversário…';
  for(const selector of ['#enemyStats','#enemyHud','#combatInfo','#decisionHint','#turnLabel','#phaseHelp','#sharedArena','#combatFeedback','.opponent-hand-area>span']){const root=document.querySelector(selector);if(root){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())walker.currentNode.textContent=walker.currentNode.textContent.replace(/\bIA\b/g,'adversário');}}
 });
 if(new URLSearchParams(location.search).has('pvp')){
  lobby.classList.add('pvp-focus');document.body.classList.add('pvp-entry');$('setup').querySelector('h1')?.replaceChildren(document.createTextNode('Arena PvP'));
  for(const id of ['opponent','aiDifficulty','startingPlayer','showTutorial'])$(id)?.closest('label')?.setAttribute('hidden','');
  $('difficultyHint')?.setAttribute('hidden','');
  const format=$('duelFormat')?.closest('label');if(format){format.hidden=true;if(format.nextElementSibling?.tagName==='P')format.nextElementSibling.textContent=OverdriveModes.describe($('gameMode').value);}
 }
 const clockTimer=setInterval(()=>{clock.hidden=!room?.deadline||remote?.s.winner!==null;if(!clock.hidden){const seconds=Math.max(0,Math.ceil((room.deadline-Date.now()-clockOffset)/1000));clock.textContent='Tempo para decisão: '+seconds+' s'+(seconds<=30?' · atenção ao limite':'');}},1000);addEventListener('pagehide',()=>clearInterval(clockTimer));
 window.OverdrivePvP={connect,RemoteEngine};
})();
