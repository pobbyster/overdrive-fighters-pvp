(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.OverdriveReplayCursor=factory(root.OverdriveCore.Engine);})(globalThis,function(Engine){
 'use strict';const copy=x=>JSON.parse(JSON.stringify(x));
 return class ReplayCursor {
  constructor(catalog,replay,{interval=50,maxCheckpoints=20}={}){Engine.fromReplay(catalog,replay);this.catalog=catalog;this.replay=copy(replay);this.interval=interval;this.maxCheckpoints=maxCheckpoints;this.checkpoints=new Map();this.engine=Engine.fromReplay(catalog,replay,0);this.position=0;this.remember();}
  remember(){this.checkpoints.set(this.position,{state:copy(this.engine.s)});if(this.checkpoints.size>this.maxCheckpoints){const key=[...this.checkpoints.keys()].find(k=>k!==0);this.checkpoints.delete(key);}}
  seek(position){if(!Number.isInteger(position)||position<0||position>this.replay.commands.length)throw Error('Posição de replay inválida.');const nearest=Math.max(...[...this.checkpoints.keys()].filter(k=>k<=position));if(this.position>position||nearest>this.position){this.engine=Engine.fromReplay(this.catalog,this.replay,0);this.engine.s=copy(this.checkpoints.get(nearest).state);this.engine.commands=copy(this.replay.commands.slice(0,nearest));this.position=nearest;}
   while(this.position<position){const cmd=this.replay.commands[this.position],result=this.engine.execute(cmd.p,cmd.action);if(!result.accepted)throw Error('Replay interrompido: '+result.reason);this.position++;if(this.position%this.interval===0)this.remember();}return this.engine;
  }
 };
});
