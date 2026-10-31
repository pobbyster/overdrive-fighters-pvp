'use strict';
const {randomBytes,randomInt} = require('node:crypto');
const {Engine} = require('../work/strict-engine.js');
require('../work/strict-features.js')(Engine);
const catalog = require('../work/catalog.json');
const Modes=require('../work/game-modes.js');
const {command,project} = require('./protocol.cjs');
const token = () => randomBytes(32).toString('hex');
const fail = message => { throw Error(message); };
class Rooms {
  constructor({graceMs=120000,idleMs=3600000,maxRooms=100,now=Date.now,store=null,lobbyIdleMs=1800000,decisionMs=0}={}) {
    Object.assign(this,{graceMs,idleMs,maxRooms,now,store,lobbyIdleMs,decisionMs}); this.rooms = new Map();this.dirty=false;this.queue=null;this.storageFailed=false;if(store){const saved=store.load();if(saved)this.restore(saved);}
  }
  send(socket,data) {if(this.queue){this.queue.push([socket,data]);return;}if(socket?.readyState===1)socket.send(JSON.stringify({protocol:1,...data}));}
  snapshot(){return {format:'ofs-rooms/1',ruleset:Engine.RULESET_ID,rooms:[...this.rooms.values()].map(room=>({...room,seats:room.seats.map(s=>s?{name:s.name,token:s.token,deck:s.deck,sequence:s.sequence,baseDeck:s.baseDeck,sideReady:s.sideReady,offlineAt:s.offlineAt}:null),engine:room.engine?{initial:room.engine.initial,commands:room.engine.commands,state:room.engine.s}:null}))};}
  restore(saved){if(saved.format!=='ofs-rooms/1'||saved.ruleset!==Engine.RULESET_ID||!Array.isArray(saved.rooms))fail('Salas salvas incompatíveis. Preserve o arquivo e execute a revisão original para recuperar.');for(const value of saved.rooms){if(!/^[A-F0-9]{10}$/.test(value.code)||!Array.isArray(value.seats)||value.seats.length!==2)fail('Sala salva inválida.');const room={...value,seats:value.seats.map(s=>s?{...s,socket:null,offlineAt:this.now()}:null)};if(value.engine){const e=new Engine(catalog);e.start(value.engine.initial.a,value.engine.initial.b,value.engine.initial.first,value.engine.initial.seed,value.engine.initial.mode);if(value.engine.state.ruleset!==Engine.RULESET_ID)fail('Checkpoint de outra revisão.');e.s=value.engine.state;e.initial=value.engine.initial;e.commands=value.engine.commands;e.assertInvariants();room.engine=e;}room.touched=this.now();room.activityAt=this.now();room.decisionAt=this.now();this.rooms.set(room.code,room);}}
  transaction(fn){if(this.storageFailed)fail('Servidor pausado por falha ao salvar. Reconecte após a recuperação do serviço.');this.queue=[];let result,error;try{result=fn();}catch(e){error=e;}const outgoing=this.queue;this.queue=null;try{if(this.dirty&&this.store)this.store.save(this.snapshot());this.dirty=false;}catch(e){this.storageFailed=true;throw Error('Falha ao persistir a partida. O servidor foi pausado para proteger o último registro salvo.');}for(const [socket,data] of outgoing)this.send(socket,data);if(error)throw error;return result;}
  handle(socket,msg){return this.transaction(()=>this.dispatch(socket,msg));}
  seat(socket) { const room = this.rooms.get(socket.roomCode);const index = room?.seats.findIndex(s=>s?.socket===socket);if (!room || index < 0) fail('Entre em uma sala.');return {room,index,seat:room.seats[index]}; }
  publicRoom(room) { return {code:room.code,mode:room.mode,match:room.match?{...room.match}:null,started:!!room.engine,opening:room.opening?{...room.opening}:null,paused:!!room.engine&&room.engine.s.winner===null&&room.seats.some(s=>!s?.socket),graceMs:this.graceMs,serverTime:this.now(),decisionMs:this.decisionMs,deadline:this.decisionMs&&room.engine&&room.engine.s.winner===null&&!room.seats.some(s=>!s?.socket)?room.decisionAt+this.decisionMs:null,seats:room.seats.map(s=>s?{name:s.name,ready:room.match?.stage==='side'?!!s.sideReady:!!s.deck,connected:!!s.socket}:null)}; }
  broadcast(room) {
    this.recordRound(room);room.touched=this.now();this.dirty=true;
    room.seats.forEach((s,i)=>{if(s?.socket)this.send(s.socket,{type:'state',room:this.publicRoom(room),ack:s.sequence,...(room.engine?{game:project(room.engine,i,room.seats.map(s=>s.name))}:{})});});
  }
  dispatch(socket,msg) {
    if (!msg || msg.protocol!==1) fail('Versão de rede incompatível. Atualize os dois jogos.');
    if(msg.type==='listRooms') {
      const rooms=[...this.rooms.values()].filter(r=>!r.engine&&r.seats.filter(Boolean).length===1&&r.seats.some(s=>s?.socket?.readyState===1)).map(r=>({code:r.code,mode:r.mode,host:r.seats.find(Boolean).name}));
      this.send(socket,{type:'roomList',rooms,ruleset:Engine.RULESET_ID});return;
    }
    if (msg.type==='create' || msg.type==='join' || msg.type==='resume') {
      if (socket.roomCode) fail('Você já está em uma sala.');
      let room, index, seat;
      if (msg.type==='resume') {
        room=this.rooms.get(msg.code);if(!room)fail('Sala expirada. Crie outra sala.');
        index=room.seats.findIndex(s=>s?.token===msg.token);if(index<0)fail('Credencial de reconexão inválida.');seat=room.seats[index];
        if(seat.offlineAt!==null&&this.now()-seat.offlineAt>this.graceMs&&room.engine?.s.winner===null)fail('Prazo de reconexão encerrado.');
        // A browser reload can reconnect before the previous TCP socket closes.
        // Possession of the private token authorizes reclaiming this same seat.
        if(seat.socket){const previous=seat.socket;previous.roomCode=null;previous.close(4001,'Sessão retomada em outra conexão');}
      } else {
        const name=String(msg.name||'Jogador').trim().slice(0,24).replace(/[\x00-\x1f]/g,'')||'Jogador';
        if(msg.type==='create') {
          if(this.rooms.size>=this.maxRooms)fail('Servidor cheio. Tente novamente mais tarde.');
          if(!Object.hasOwn(Modes.modes,msg.mode))fail('Modo inválido.');
          let code; do {code=randomBytes(5).toString('hex').toUpperCase();}while(this.rooms.has(code));
          room={code,mode:msg.mode,match:{score:[0,0],round:1,stage:'opening',lastWinner:null,first:null},seats:[null,null],engine:null,touched:this.now(),activityAt:this.now(),decisionAt:this.now()};this.rooms.set(code,room);index=0;
        } else {
          room=this.rooms.get(String(msg.code||'').trim().toUpperCase());if(!room)fail('Sala não encontrada.');
          if(room.engine)fail('Esta partida já começou.');index=room.seats.findIndex(s=>!s);if(index<0)fail('Sala cheia.');
        }
        seat={name,token:token(),socket:null,deck:null,sequence:0,baseDeck:null,sideReady:false};room.seats[index]=seat;
      }
      seat.socket=socket;seat.offlineAt=null;socket.roomCode=room.code;room.activityAt=this.now();if(room.seats.every(s=>s?.socket))room.decisionAt=this.now();
      this.send(socket,{type:'welcome',code:room.code,token:seat.token,seat:index,sequence:seat.sequence});this.broadcast(room);return;
    }
    const {room,index,seat}=this.seat(socket);
    if(msg.type==='ready') {
      if(room.engine)fail('A partida já começou.');
      if(room.opening)fail('O sorteio já começou. Aguarde a escolha da ordem de jogo.');
      if(msg.ruleset!==Engine.RULESET_ID)fail('Regras ou catálogo incompatíveis. Atualize os dois jogos e o servidor antes de confirmar os decks.');
      new Engine(catalog).validateDeck(msg.deck);
      if(msg.originalDeck){this.validateSwap(msg.originalDeck,msg.deck);if(!Modes.get(room.mode).initialSide&&JSON.stringify(Object.entries(msg.originalDeck.main).sort())!==JSON.stringify(Object.entries(msg.deck.main).sort()))fail('Este modo não permite trocas antes do primeiro duelo.');}
      // Freeze a normalized deck, not arbitrary client properties or executable code.
      room.activityAt=this.now();seat.deck={name:seat.name,fighter:msg.deck.fighter,main:structuredClone(msg.deck.main),extra:structuredClone(msg.deck.extra||{})};
      const base=msg.originalDeck||seat.deck;seat.baseDeck={name:seat.name,fighter:base.fighter,main:structuredClone(base.main),extra:structuredClone(base.extra||{})};
      if(room.seats.every(s=>s?.deck&&s.socket))room.opening={phase:'call',caller:0};
      this.broadcast(room);return;
    }
    if(msg.type==='coinCall'||msg.type==='coinChoose'){
      if(room.engine||!room.opening)fail('Nenhum sorteio aguardando esta escolha.');
      if(room.seats.some(s=>!s?.socket))fail('Aguarde a reconexão dos dois jogadores.');
      if(msg.type==='coinCall'){
        if(room.opening.phase!=='call'||index!==room.opening.caller||!['heads','tails'].includes(msg.call))fail('Escolha de moeda inválida.');
        const face=randomInt(2)?'heads':'tails';room.opening={...room.opening,phase:'choose',call:msg.call,face,winner:face===msg.call?index:1-index};
      }else{
        if(room.opening.phase!=='choose'||index!==room.opening.winner||![0,1].includes(msg.first))fail('Somente o vencedor escolhe primeiro ou segundo jogador.');
        const first=msg.first===0?index:1-index;room.opening={...room.opening,phase:'done',first};
        this.startRound(room,first);
      }
      room.activityAt=room.decisionAt=this.now();this.broadcast(room);return;
    }
    if(msg.type==='sideReady'){
      if(room.match?.stage!=='side'||!room.engine||room.engine.s.winner===null)fail('Nenhuma troca disponível.');if(seat.sideReady)fail('Seu baralho já foi confirmado.');if(msg.ruleset!==Engine.RULESET_ID)fail('Regras incompatíveis.');this.validateSwap(seat.baseDeck,msg.deck);
      if(index===1-room.match.lastWinner&&[0,1].includes(room.match.lastWinner)){if(![0,1].includes(msg.first))fail('O perdedor deve escolher quem começa.');room.match.first=msg.first===0?index:1-index;}
      seat.deck={name:seat.name,fighter:msg.deck.fighter,main:structuredClone(msg.deck.main),extra:structuredClone(msg.deck.extra||{})};seat.sideReady=true;
      if(room.seats.every(s=>s?.sideReady&&s.socket)){room.match.round++;this.startRound(room,room.match.first);}room.activityAt=room.decisionAt=this.now();this.broadcast(room);return;
    }
    if(msg.type==='leave') {
      if(room.match)room.match.abandoned=true;
      if(room.engine&&room.engine.s.winner===null)this.finish(room,1-index,'desistência');
      seat.socket=null;seat.token=token();socket.roomCode=null;if(!room.engine){room.seats[index]=null;room.opening=null;}
      this.send(socket,{type:'left'});this.broadcast(room);return;
    }
    if(!room.engine)fail('Aguarde os dois jogadores confirmarem seus decks.');
    if(msg.type==='preview') {
      if(!Array.isArray(msg.uids)||msg.uids.length>40)fail('Prévia inválida.');
      this.send(socket,{type:'preview',revision:room.engine.s.revision,uids:msg.uids,summary:room.engine.describeCombat(index,msg.uids)});return;
    }
    if(msg.type!=='action')fail('Mensagem desconhecida.');
    if(msg.round!==undefined&&msg.round!==room.match.round)fail('Este duelo já terminou. Atualize o campo.');
    if(!Number.isSafeInteger(msg.sequence)||msg.sequence<1)fail('Sequência inválida.');
    if(msg.sequence<=seat.sequence){this.broadcast(room);return;} // Idempotent retry after reconnection.
    if(msg.sequence!==seat.sequence+1)fail('Sequência fora de ordem. Reconecte à sala.');
    if(room.seats.some(s=>!s?.socket))fail('Partida pausada até a reconexão do adversário.');
    if(msg.revision!==room.engine.s.revision){this.broadcast(room);fail('O campo mudou. Escolha novamente.');}
    const action=command(room.engine,index,msg.action),result=room.engine.execute(index,action);
    if(!result.accepted)fail(result.reason);
    seat.sequence=msg.sequence;room.activityAt=room.decisionAt=this.now();this.broadcast(room);
  }
  validateSwap(base,next){new Engine(catalog).validateDeck(base);new Engine(catalog).validateDeck(next);const pool=d=>{const map={};for(const zone of ['main','extra'])for(const [id,q] of Object.entries(d[zone]||{}))map[id]=(map[id]||0)+q;return JSON.stringify(Object.entries(map).sort());};if(base.fighter!==next.fighter||pool(base)!==pool(next))fail('As trocas devem preservar o lutador e todas as cartas do deck original.');}
  startRound(room,first){room.engine=new Engine(catalog);room.engine.start(room.seats[0].deck,room.seats[1].deck,first,randomInt(1,4294967296),room.mode);room.match={...room.match,stage:'playing',first};room.seats.forEach(s=>s.sideReady=false);}
  recordRound(room){const match=room.match;if(!match||match.stage!=='playing'||!room.engine||room.engine.s.winner===null)return;const winner=room.engine.s.winner;if([0,1].includes(winner))match.score[winner]++;match.lastWinner=winner;match.stage=match.abandoned||Modes.get(room.mode).bestOf===1||match.score.some(n=>n>=2)?'complete':'side';room.seats.forEach(s=>{if(s)s.sideReady=false;});}
  finish(room,winner,reason) {room.engine.s.winner=winner;room.engine.s.phase='finished';room.engine.s.choice=null;room.engine.s.revision++;room.engine.log('Vitória por '+reason+'.','PvP');}
  disconnect(socket) {if(this.storageFailed)return;return this.transaction(()=>this.drop(socket));}
  drop(socket) {
    if(!socket.roomCode)return;const {room,seat}=this.seat(socket);seat.socket=null;seat.offlineAt=this.now();socket.roomCode=null;this.broadcast(room);
  }
  sweep() {if(this.storageFailed)return;return this.transaction(()=>this.cleanup());}
  cleanup() {
    for(const [code,room] of this.rooms) {
      if(!room.engine&&this.now()-(room.activityAt??room.touched)>=this.lobbyIdleMs){for(const seat of room.seats)if(seat?.socket){seat.socket.roomCode=null;this.send(seat.socket,{type:'roomExpired',message:'Sala encerrada por inatividade. Crie outra sala.'});}this.rooms.delete(code);this.dirty=true;continue;}
      if(this.decisionMs&&room.engine&&room.engine.s.winner===null&&room.seats.every(s=>s?.socket)&&this.now()-room.decisionAt>=this.decisionMs){const e=room.engine,player=e.s.phase==='mulligan'?(e.s.players[0].mulligan?1:0):(e.s.choice?.player??e.s.priority);this.finish(room,1-player,'tempo de decisão esgotado');this.broadcast(room);}

      const lost=room.seats.map((s,i)=>s&&!s.socket&&s.offlineAt!==null&&this.now()-s.offlineAt>=this.graceMs?i:-1).filter(i=>i>=0);
      if(room.engine&&room.engine.s.winner===null&&lost.length){if(lost.length===2){room.engine.s.winner='draw';room.engine.s.phase='finished';room.engine.s.revision++;}else this.finish(room,1-lost[0],'desconexão');this.broadcast(room);}
      if(!room.engine)for(const i of lost){room.seats[i]=null;room.opening=null;this.dirty=true;}
      if((room.seats.every(s=>!s?.socket)||(room.engine&&room.engine.s.winner!==null))&&this.now()-room.touched>this.idleMs){for(const seat of room.seats)if(seat?.socket)seat.socket.roomCode=null;this.rooms.delete(code);this.dirty=true;}
    }
  }
}
module.exports={Rooms};
