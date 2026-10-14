'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {once}=require('node:events'),{WebSocket}=require('ws');
const {spawn}=require('node:child_process');
const {Engine,chooseAI}=require('../work/strict-engine.js');require('../work/strict-features.js')(Engine);
const catalog=require('../work/catalog.json'),{Rooms}=require('./rooms.cjs'),{project,command,mapAction}=require('./protocol.cjs'),{createServer}=require('./server.cjs');
const deck=new Engine(catalog).starter();
const socket=()=>({readyState:1,messages:[],send(text){this.messages.push(JSON.parse(text));},close(code){this.closeCode=code;this.readyState=3;}});
function lobby(options={},mode='advanced') {const rooms=new Rooms(options),a=socket(),b=socket();rooms.handle(a,{protocol:1,type:'create',name:'A',mode});rooms.handle(b,{protocol:1,type:'join',name:'B',code:a.roomCode});for(const s of [a,b])rooms.handle(s,{protocol:1,type:'ready',deck});return {rooms,a,b,room:rooms.rooms.get(a.roomCode)};}
function act(rooms,s,action,sequence,revision){rooms.handle(s,{protocol:1,type:'action',sequence,revision,action});}
test('Each mode starts both seats with the correct energy count and hidden hands/decks',()=>{
 for(const [mode,count] of Object.entries({standard:2,advanced:3,deathmatch:7})){
  const {room}=lobby({},mode);
  for(const seat of [0,1]){
   const {view:v}=project(room.engine,seat,['A','B']);assert.equal(v.players[0].stamina.length,count);assert.equal(v.players[1].stamina.length,count);
   assert.equal(v.players[0].hand.length,4);assert.equal(v.players[1].handCount,4);
   assert(v.players[1].hand.every(c=>!c.id));assert(v.players.every(p=>p.deck.every(c=>!c.id)));assert.equal(v.rng,undefined);assert.equal(v.history,undefined);
   const enemy=room.engine.s.players[1-seat];assert(v.players[1].hand.every(c=>!enemy.hand.some(hidden=>hidden.uid===c.uid)));
  }
 }
});
test('Internal payment flags, forged actions, out-of-turn commands and stale revisions are rejected',()=>{
 const {rooms,a,b,room}=lobby();const e=room.engine;
 assert.throws(()=>command(e,0,{type:'mulligan',hand:[],energy:[],galacstrixChosen:true}),/indisponível/);
 assert.throws(()=>command(e,0,{type:'play',uid:e.s.players[1].hand[0].uid,mode:'normal',x:0}),/indisponível/);
 act(rooms,a,{type:'mulligan',hand:[],energy:[]},1,0);
 assert.throws(()=>act(rooms,a,{type:'pass'},2,e.s.revision),/indisponível/);
 const before=e.s.revision;assert.throws(()=>act(rooms,b,{type:'mulligan',hand:[],energy:[]},1,0),/campo mudou/);assert.equal(e.s.revision,before);
 act(rooms,b,{type:'mulligan',hand:[],energy:[]},1,before);
 const after=e.s.revision;act(rooms,b,{type:'mulligan',hand:[],energy:[]},1,before);assert.equal(e.s.revision,after);
 assert.throws(()=>act(rooms,b,{type:'pass'},3,after),/Sequência fora/);
});
test('Seat 2 sees self at zero and player targets round-trip without changing combat targets',()=>{
 const {room}=lobby();room.engine.s.choice={kind:'balanceTarget',player:1};room.engine.s.phase='combat';
 const v=project(room.engine,1,['A','B']).view;
 assert.equal(v.choice.player,0);assert.equal(v.players[0].name,'B');
 assert.deepEqual(mapAction({type:'balanceTarget',target:0},1),{type:'balanceTarget',target:1});
 assert.deepEqual(mapAction({type:'finta',target:17},1),{type:'finta',target:17});
 assert.equal(command(room.engine,1,{type:'balanceTarget',target:0}).target,1);
});
test('Only the owner of a search choice receives its candidate cards; prepared cards remain hidden',()=>{
 const {room}=lobby(),e=room.engine,c=e.s.players[0].deck[0];
 e.s.choice={kind:'namedSearch',player:0,uids:[c.uid],from:'deck',to:'hand'};
 assert.equal(project(e,0,['A','B']).candidates[0].card.id,c.id);assert.deepEqual(project(e,1,['A','B']).candidates,[]);
 const prepared=e.move(e.s.players[0].hand[0].uid,'extra');prepared.slot=0;prepared.ready=2;
 const concealed=project(e,1,['A','B']).view.players[1].extra[0];assert.equal(concealed.id,undefined);assert.equal(concealed.hidden,true);
});
test('Reconnect restores a seat, pauses actions while disconnected and expires to a forfeit',()=>{
 let now=1000;const {rooms,a,b,room}=lobby({graceMs:100,now:()=>now});const auth=b.messages.find(m=>m.type==='welcome');
 rooms.disconnect(b);assert.equal(rooms.publicRoom(room).paused,true);
 assert.throws(()=>act(rooms,a,{type:'mulligan',hand:[],energy:[]},1,0),/pausada/);
 const impostor=socket();assert.throws(()=>rooms.handle(impostor,{protocol:1,type:'resume',code:room.code,token:'bad'}),/Credencial/);
 const back=socket();rooms.handle(back,{protocol:1,type:'resume',code:room.code,token:auth.token});assert.equal(rooms.publicRoom(room).paused,false);
 rooms.disconnect(back);now+=101;rooms.sweep();assert.equal(room.engine.s.winner,0);assert.equal(room.engine.s.phase,'finished');
});
test('Rooms isolate games, reject a third player and validate decks',()=>{
 const {rooms,a,room}=lobby();const c=socket();assert.throws(()=>rooms.handle(c,{protocol:1,type:'join',code:room.code,name:'C'}),/começou/);
 rooms.handle(c,{protocol:1,type:'create',name:'C',mode:'standard'});assert.notEqual(a.roomCode,c.roomCode);
 assert.throws(()=>rooms.handle(c,{protocol:1,type:'ready',deck:{...deck,main:{}}}));assert.equal(rooms.rooms.get(c.roomCode).engine,null);
});
test('A reconnect can reclaim its seat before the old socket closes, without losing the new connection',()=>{
 const {rooms,a,b,room}=lobby(),auth=b.messages.find(m=>m.type==='welcome'),next=socket();
 rooms.handle(next,{protocol:1,type:'resume',code:room.code,token:auth.token});
 assert.equal(b.closeCode,4001);assert.equal(b.roomCode,null);assert.equal(room.seats[1].socket,next);
 rooms.disconnect(b);assert.equal(room.seats[1].socket,next);assert.equal(rooms.publicRoom(room).paused,false);
 act(rooms,a,{type:'mulligan',hand:[],energy:[]},1,0);act(rooms,next,{type:'mulligan',hand:[],energy:[]},1,room.engine.s.revision);
 assert.equal(room.seats[1].sequence,1);assert.equal(room.engine.s.players[1].mulligan,true);
});
test('Projected commands complete duels for every starter and both seat orientations',()=>{
 for(const fighter of [32,51,70,89]){
  const {rooms,a,b,room}=lobby();room.engine.start(new Engine(catalog).fighterStarter(fighter),deck,fighter%2,1700+fighter,'advanced');
  let steps=0;while(room.engine.s.winner===null&&steps++<5000){const e=room.engine,p=e.s.phase==='mulligan'?(e.s.players[0].mulligan?1:0):(e.s.choice?.player??e.s.priority),view=project(e,p,['A','B']).view;
   const action=chooseAI(view,catalog);assert(action,'A legal projected action exists');const s=p?b:a;act(rooms,s,action,room.seats[p].sequence+1,e.s.revision);
  }
  assert.notEqual(room.engine.s.winner,null,'Duelo terminou: '+fighter);room.engine.assertInvariants();
 }
});
test('Real WebSocket transport supports two browsers and refuses unrelated origins',async t=>{
 const {server}=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 const a=new WebSocket(`ws://127.0.0.1:${port}/pvp`,{origin:`http://127.0.0.1:${port}`});await once(a,'open');
 const b=new WebSocket(`ws://127.0.0.1:${port}/pvp`,{origin:`http://127.0.0.1:${port}`});await once(b,'open');
 t.after(async()=>{a.terminate();b.terminate();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const next=(s,predicate)=>new Promise(resolve=>{const fn=d=>{const m=JSON.parse(d);if(predicate(m)){s.off('message',fn);resolve(m);}};s.on('message',fn);});
 let receive=next(a,m=>m.type==='welcome');a.send(JSON.stringify({protocol:1,type:'create',name:'A',mode:'standard'}));const auth=await receive;
 receive=next(b,m=>m.type==='welcome');b.send(JSON.stringify({protocol:1,type:'join',name:'B',code:auth.code}));await receive;
 receive=next(a,m=>m.game);for(const s of [a,b])s.send(JSON.stringify({protocol:1,type:'ready',deck}));const state=await receive;assert.equal(state.game.view.players[0].stamina.length,2);
 const bad=new WebSocket(`ws://127.0.0.1:${port}/pvp`,{origin:'https://unrelated.example'});await once(bad,'error');
 const health=await fetch(`http://127.0.0.1:${port}/pvp-health`);assert.equal((await health.json()).protocol,1);
 const malformed=await fetch(`http://127.0.0.1:${port}/%00`);assert.equal(malformed.status,400);
 const afterMalformed=await fetch(`http://127.0.0.1:${port}/pvp-health`);assert.equal(afterMalformed.status,200);
});
test('Standalone hosting honors PORT and the configured external HTTPS origin',{timeout:15000},async t=>{
 const child=spawn(process.execPath,[require.resolve('./server.cjs')],{env:{...process.env,PORT:'0',OFS_PVP_PORT:'',OFS_PVP_HOST:'',RENDER_EXTERNAL_URL:'https://ofs-host-test.example'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 t.after(()=>child.kill());
 const port=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/0\.0\.0\.0:(\d+)/);if(match)resolve(Number(match[1]));});child.on('error',reject);child.on('exit',code=>reject(Error('Host ended: '+code)));});
 const health=await fetch(`http://127.0.0.1:${port}/pvp-health`);assert.equal(health.status,200);
 const ws=new WebSocket(`ws://127.0.0.1:${port}/pvp`,{origin:'https://ofs-host-test.example'});t.after(()=>ws.terminate());await once(ws,'open');
 const message=once(ws,'message');ws.send(JSON.stringify({protocol:1,type:'create',name:'Hosted',mode:'advanced'}));assert.equal(JSON.parse((await message)[0]).type,'welcome');
});
