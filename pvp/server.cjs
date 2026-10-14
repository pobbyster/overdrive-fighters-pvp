'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('ws');
const {Rooms}=require('./rooms.cjs');
const root=path.resolve(__dirname,'../desktop/site');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.ico':'image/x-icon','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
function createServer(options={}) {
  const rooms=new Rooms(options),origins=new Set(options.origins||[]);
  const server=http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let file;
    try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/pvp-health'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({protocol:1,status:'ok'}));return;}const pathname=decodeURIComponent(url.pathname==='/'?'/home.html':url.pathname);if(pathname.includes('\0'))throw Error('Invalid path');file=path.resolve(root,'.'+pathname);}catch{res.writeHead(400);res.end();return;}
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);});
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
  // Browsers must originate from this server, an explicitly configured origin, or the local desktop.
  server.on('upgrade',(req,socket,head)=>{
    const origin=req.headers.origin,same=origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;
    const local=origin&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
    if(req.url!=='/pvp'||(!same&&!local&&!origins.has(origin))||wss.clients.size>=200){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',socket=>{
    socket.alive=true;socket.count=0;socket.window=Date.now();
    socket.on('pong',()=>{socket.alive=true;});
    socket.on('message',data=>{
      if(Date.now()-socket.window>=10000){socket.window=Date.now();socket.count=0;}
      if(++socket.count>300){socket.close(1008,'Muitas mensagens');return;}
      try{rooms.handle(socket,JSON.parse(data.toString()));}catch(error){rooms.send(socket,{type:'error',message:error.message});}
    });
    socket.on('close',()=>rooms.disconnect(socket));socket.on('error',()=>{});
  });
  const interval=setInterval(()=>{rooms.sweep();for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}},10000);interval.unref();
  server.on('close',()=>{clearInterval(interval);for(const socket of wss.clients)socket.terminate();wss.close();});
  return {server,rooms,wss};
}
if(require.main===module){
  // Managed hosts supply PORT and route HTTPS/WSS to this single HTTP listener.
  const port=Number(process.env.OFS_PVP_PORT||process.env.PORT||4310),host=process.env.OFS_PVP_HOST||(process.env.PORT?'0.0.0.0':'127.0.0.1');
  const origins=(process.env.OFS_PVP_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(process.env.RENDER_EXTERNAL_URL)origins.push(new URL(process.env.RENDER_EXTERNAL_URL).origin);
  const {server,wss}=createServer({origins});
  server.listen(port,host,()=>console.log('PvP: http://'+host+':'+server.address().port));
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;for(const socket of wss.clients)socket.close(1012,'Servidor reiniciando');server.close();setTimeout(()=>{for(const socket of wss.clients)socket.terminate();server.closeAllConnections();},5000).unref();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
module.exports={createServer};
