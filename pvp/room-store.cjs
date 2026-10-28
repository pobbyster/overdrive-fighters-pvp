'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Private authoritative state. This path must be outside the directory served by HTTP.
class RoomStore {
 constructor(file){this.file=path.resolve(file);}
 load(){if(!fs.existsSync(this.file))return null;const envelope=JSON.parse(fs.readFileSync(this.file,'utf8'));if(envelope.format!=='ofs-room-store/1'||typeof envelope.data!=='string'||crypto.createHash('sha256').update(envelope.data).digest('hex')!==envelope.checksum)throw Error('Arquivo de salas corrompido. O original foi preservado; revise a cópia .bak antes de recuperar.');return JSON.parse(envelope.data);}
 save(snapshot){fs.mkdirSync(path.dirname(this.file),{recursive:true});const data=JSON.stringify(snapshot),body=JSON.stringify({format:'ofs-room-store/1',checksum:crypto.createHash('sha256').update(data).digest('hex'),data}),temp=this.file+'.tmp';let fd;try{fd=fs.openSync(temp,'w',0o600);fs.writeFileSync(fd,body);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.bak');fs.renameSync(temp,this.file);}finally{if(fd!==undefined)fs.closeSync(fd);}}
}
module.exports={RoomStore};
