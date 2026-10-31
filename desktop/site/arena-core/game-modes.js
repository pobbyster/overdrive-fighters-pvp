(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.OverdriveModes=f();})(globalThis,()=>{
 'use strict';
 const modes={prime:{name:'Prime',energy:2,bestOf:3,initialSide:false},standard:{name:'Standard',energy:3,bestOf:3,initialSide:false},advanced:{name:'Advanced',energy:5,bestOf:3,initialSide:false},deathmatch:{name:'Deathmatch',energy:7,bestOf:1,initialSide:true}};
 function get(id){if(!modes[id])throw Error('Modo inválido.');return modes[id];}
 function describe(id){const m=get(id);return m.name+' · '+m.energy+' energias · melhor de '+m.bestOf+'. '+(m.initialSide?'Trocas com o side deck antes do duelo.':'Sem side deck antes do primeiro duelo; trocas entre duelos.');}
 return {modes,get,describe};
});
