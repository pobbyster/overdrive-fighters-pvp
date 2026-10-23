'use strict';
const {randomBytes,randomInt} = require('node:crypto');
const {Engine} = require('../work/strict-engine.js');
require('../work/strict-features.js')(Engine);
const catalog = require('../work/catalog.json');
const {command,project} = require('./protocol.cjs');
const token = () => randomBytes(32).toString('hex');
const fail = message => { throw Error(message); };
class Rooms {
  constructor({graceMs=120000,idleMs=3600000,maxRooms=100,now=Date.now}={}) {
    Object.assign(this,{graceMs,idleMs,maxRooms,now}); this.rooms = new Map();
  }
  send(socket,data) { if (socket?.readyState === 1) socket.send(JSON.stringify({protocol:1,...data})); }
  seat(socket) { const room = this.rooms.get(socket.roomCode);const index = room?.seats.findIndex(s=>s?.socket===socket);if (!room || index < 0) fail('Entre em uma sala.');return {room,index,seat:room.seats[index]}; }
  publicRoom(room) { return {code:room.code,mode:room.mode,started:!!room.engine,paused:!!room.engine&&room.engine.s.winner===null&&room.seats.some(s=>!s?.socket),graceMs:this.graceMs,seats:room.seats.map(s=>s?{name:s.name,ready:!!s.deck,connected:!!s.socket}:null)}; }
  broadcast(room) {
    room.touched=this.now();
    room.seats.forEach((s,i)=>{if(s?.socket)this.send(s.socket,{type:'state',room:this.publicRoom(room),ack:s.sequence,...(room.engine?{game:project(room.engine,i,room.seats.map(s=>s.name))}:{})});});
  }
  handle(socket,msg) {
    if (!msg || msg.protocol!==1) fail('Versão de rede incompatível. Atualize os dois jogos.');
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
          if(!['standard','advanced','deathmatch'].includes(msg.mode))fail('Modo inválido.');
          let code; do {code=randomBytes(5).toString('hex').toUpperCase();}while(this.rooms.has(code));
          room={code,mode:msg.mode,seats:[null,null],engine:null,touched:this.now()};this.rooms.set(code,room);index=0;
        } else {
          room=this.rooms.get(String(msg.code||'').trim().toUpperCase());if(!room)fail('Sala não encontrada.');
          if(room.engine)fail('Esta partida já começou.');index=room.seats.findIndex(s=>!s);if(index<0)fail('Sala cheia.');
        }
        seat={name,token:token(),socket:null,deck:null,sequence:0};room.seats[index]=seat;
      }
      seat.socket=socket;seat.offlineAt=null;socket.roomCode=room.code;
      this.send(socket,{type:'welcome',code:room.code,token:seat.token,seat:index,sequence:seat.sequence});this.broadcast(room);return;
    }
    const {room,index,seat}=this.seat(socket);
    if(msg.type==='ready') {
      if(room.engine)fail('A partida já começou.');
      if(msg.ruleset!==Engine.RULESET_ID)fail('Regras ou catálogo incompatíveis. Atualize os dois jogos e o servidor antes de confirmar os decks.');
      new Engine(catalog).validateDeck(msg.deck);
      // Freeze a normalized deck, not arbitrary client properties or executable code.
      seat.deck={name:seat.name,fighter:msg.deck.fighter,main:structuredClone(msg.deck.main),extra:structuredClone(msg.deck.extra||{})};
      if(room.seats.every(s=>s?.deck&&s.socket)) {room.engine=new Engine(catalog);room.engine.start(room.seats[0].deck,room.seats[1].deck,randomInt(2),randomInt(1,4294967296),room.mode);}
      this.broadcast(room);return;
    }
    if(msg.type==='leave') {
      if(room.engine&&room.engine.s.winner===null)this.finish(room,1-index,'desistência');
      seat.socket=null;seat.token=token();socket.roomCode=null;if(!room.engine)room.seats[index]=null;
      this.send(socket,{type:'left'});this.broadcast(room);return;
    }
    if(!room.engine)fail('Aguarde os dois jogadores confirmarem seus decks.');
    if(msg.type==='preview') {
      if(!Array.isArray(msg.uids)||msg.uids.length>40)fail('Prévia inválida.');
      this.send(socket,{type:'preview',revision:room.engine.s.revision,uids:msg.uids,summary:room.engine.describeCombat(index,msg.uids)});return;
    }
    if(msg.type!=='action')fail('Mensagem desconhecida.');
    if(!Number.isSafeInteger(msg.sequence)||msg.sequence<1)fail('Sequência inválida.');
    if(msg.sequence<=seat.sequence){this.broadcast(room);return;} // Idempotent retry after reconnection.
    if(msg.sequence!==seat.sequence+1)fail('Sequência fora de ordem. Reconecte à sala.');
    if(room.seats.some(s=>!s?.socket))fail('Partida pausada até a reconexão do adversário.');
    if(msg.revision!==room.engine.s.revision){this.broadcast(room);fail('O campo mudou. Escolha novamente.');}
    const action=command(room.engine,index,msg.action),result=room.engine.execute(index,action);
    if(!result.accepted)fail(result.reason);
    seat.sequence=msg.sequence;this.broadcast(room);
  }
  finish(room,winner,reason) {room.engine.s.winner=winner;room.engine.s.phase='finished';room.engine.s.choice=null;room.engine.s.revision++;room.engine.log('Vitória por '+reason+'.','PvP');}
  disconnect(socket) {
    if(!socket.roomCode)return;const {room,seat}=this.seat(socket);seat.socket=null;seat.offlineAt=this.now();socket.roomCode=null;this.broadcast(room);
  }
  sweep() {
    for(const [code,room] of this.rooms) {
      const lost=room.seats.map((s,i)=>s&&!s.socket&&s.offlineAt!==null&&this.now()-s.offlineAt>=this.graceMs?i:-1).filter(i=>i>=0);
      if(room.engine&&room.engine.s.winner===null&&lost.length){if(lost.length===2){room.engine.s.winner='draw';room.engine.s.phase='finished';room.engine.s.revision++;}else this.finish(room,1-lost[0],'desconexão');this.broadcast(room);}
      if(!room.engine)for(const i of lost)room.seats[i]=null;
      if(room.seats.every(s=>!s?.socket)&&this.now()-room.touched>this.idleMs)this.rooms.delete(code);
    }
  }
}
module.exports={Rooms};
