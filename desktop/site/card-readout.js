/* Printed text presentation; never used as an executable rules source. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OverdriveCardReadout=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
// Transcriptions checked against the installed card art (not OCR ordering).
const printed={
 'OF-C1-090':{effects:[],lore:'"As rosas nem sempre são indefesas" - Assassina Aprendiz'},
 'OF-C1-091':{effects:[],lore:'"Algumas técnicas de assassinato são mais sutis que outras. O importante é uma única coisa: abater o alvo." - Enala, a Mestra'},
 'OF-C1-093':{effects:[],lore:'"Nada como um alvo extremamente previsível e suscetível a qualquer ataque sorrateiro" - Blossom'},
 'OF-C1-098':{effects:['[QUEBRA - Se este Golpe bater, interrompa a sequência do lutador adversário.]'],lore:'"É como ver a morte sutilmente avançando em sua direção..." - Soldado de Kaerg'},
 'OF-C1-092':{effects:['FLUIR - Compre 1 carta. (Se você jogou uma Ação antes desta.)','REVIDE - Compre mais 1 carta.']},
 'OF-C1-095':{effects:['FLUIR - Compre 1 carta. (Se você jogou uma Ação antes desta.)','REVIDE - Se bater, compre 1 carta.']},
 'OF-C1-105':{effects:['[DEFLETIR - Se esta Guarda bloquear com sucesso a partir da sua Zona Extra, cause dano igual ao meu valor.]','FLUIR - Esta Guarda ganha +1 de bloqueio. (Se você jogou uma Ação antes desta.)']}
};
const general={QUEBRA:'Se este Golpe bater, interrompa a sequência do lutador adversário.',DEFLETIR:'Se esta Guarda bloquear com sucesso a partir da sua Zona Extra, cause dano igual ao seu valor.',FINTA:'Descarte esta carta da mão e uma Guarda de mesmo custo para cancelar a Guarda alvo em uma janela de combate.',DESVIO:'Descarte esta carta da mão e um Golpe da mesma Zona para cancelar o Golpe alvo em uma janela de combate.',FUGAZ:'Destrua esta carta ao final deste turno.'};
function text(def,script={}){
 if(printed[def.id])return [...printed[def.id].effects,...(printed[def.id].lore?['('+printed[def.id].lore+')']:[])].join('\n\n');
 let raw=String(def.searchText||def.text||def.effect||'').trim(),lore='',lines=[];
 // Quotes that start a text-only card are lore; quoted card names in effects stay intact.
 if(/^["“]/.test(raw)){lore=raw;raw='';if(!/["”]/.test(lore.slice(1)))lore+='"';}
 else{const match=raw.match(/(?:^|\.\s+)(["“][^"”]+["”](?:\s*[-—]\s*[^.]+)?)[.\s]*$/);if(match){lore=match[1];raw=raw.slice(0,match.index).trim();}}
 for(const [word,description]of Object.entries(general)){
  const active={QUEBRA:script.break,DEFLETIR:script.deflect,FINTA:script.finta,DESVIO:script.elusive,FUGAZ:script.fleeting}[word];
  if(!active&&!new RegExp('^\\s*'+word+'(?:[ .:]|$)').test(raw))continue;
  // Remove the printed reminder even when the legacy OCR placed its label mid-sentence.
  if(word==='QUEBRA')raw=raw.replace(/\(Se este Golpe bater[^)]*\)/gi,'');
  if(word==='DEFLETIR')raw=raw.replace(/\(Se esta Guarda bloquear[^)]*\)/gi,'');
  raw=raw.replace(new RegExp('^\\s*'+word+'\\b[.:]?\\s*'),'').trim();lines.push('['+word+' - '+description+']');
 }
 raw=raw.replace(/\b(FLUXO(?:\s+\d+)?|FÚRIA(?:\s+\d+)?|FLUIR|REVIDE|FOCO(?:\s+\d+)?|PREPARO|COMBO|FINTA|DESVIO|ÍMPETO(?:\s+\d+)?)\b\s*[:.-]?\s*/g,'\n$1 - ').replace(/\n+/g,'\n\n').trim();
 if(raw)lines.push(raw);if(lore)lines.push('('+lore+')');return lines.join('\n\n');
}
return {text};
});
