/* Printed text presentation; never used as an executable rules source. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OverdriveCardReadout=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
// Transcriptions checked against the installed card art (not OCR ordering).
const printed={
 'OF-C1-036':{effects:['PREPARO - Se este Golpe bater, destrua 1 carta na Zona Extra do seu oponente. (Preparo - Se você tiver 1 ou mais cartas nas Zonas Extras do seu Lutador.)','REVIDE - Este Golpe ganha +2 ATQ.']},
 'OF-C1-052':{effects:['ÍMPETO 1.','O próximo Golpe ganha +1 ATQ.'],lore:'"Às vezes é preciso tomar a iniciativa" - Hanma'},
 'OF-C1-053':{effects:['ÍMPETO 1.','Se você causou dano neste turno, este Golpe ganha +2 ATQ.'],lore:'"Lembre-se do dia em que foi derrotado pela estrela flamejante de Roudge" - Hanma'},
 'OF-C1-034':{effects:['PREPARO - Este Golpe ganha +1 ATQ. (Preparo - Se você tiver 1 ou mais cartas nas Zonas Extras do seu Lutador.)','REVIDE - Este Golpe ganha +1 ATQ.']},
 'OF-C1-090':{effects:[],lore:'"As rosas nem sempre são indefesas" - Assassina Aprendiz'},
 'OF-C1-091':{effects:['Se Petalle Fatalle bater, reduza em 1 o PODER do Lutador alvo.'],lore:'"Algumas técnicas de assassinato são mais sutis que outras. O importante é uma única coisa: abater o alvo." - Enala, a Mestra'},
 'OF-C1-093':{effects:['Se alguma Ação com FLUIR bateu neste turno, ganhe 1 de PODER.'],lore:'"Nada como um alvo extremamente previsível e suscetível a qualquer ataque sorrateiro" - Blossom'},
 'OF-C1-098':{effects:['CONTINUAÇÃO - Este Golpe ganha QUEBRA.'],lore:'"É como ver a morte sutilmente avançando em sua direção..." - Soldado de Kaerg'},
 'OF-C1-092':{effects:['FLUIR - Compre 1 carta. (Se você jogou uma Ação antes desta.)','REVIDE - Compre mais 1 carta.']},
 'OF-C1-095':{effects:['FLUIR - Compre 1 carta. (Se você jogou uma Ação antes desta.)','REVIDE - Se bater, compre 1 carta.']},
 'OF-C1-105':{effects:['[DEFLETIR - Se esta Guarda bloquear com sucesso a partir da sua Zona Extra, cause dano igual ao meu valor.]','FLUIR - Esta Guarda ganha +1 de bloqueio. (Se você jogou uma Ação antes desta.)']}
};
const colors={'GATILHO':'#ef2030','CONTINUAÇÃO':'#9000df','FINALIZADOR':'#109ee8','FINALIZAÇÃO':'#109ee8','PREPARO':'#8100eb','FLUIR':'#ec2080','FLUXO':'#ec2080','FOCO':'#699e00','FÚRIA':'#ef4c20','ÍMPETO':'#ef4c20','RECARGA':'#8100eb','REVIDE':'#8100eb','SUPER':'#b75400','DETER':'#009bde','FIXAR':'#009bde','QUEBRA':'#ee0030','DEFLETIR':'#bd7800','REVERSO':'#bd7800','DESVIO':'#009a6b','FINTA':'#009a6b','FUGAZ':'#666','DESAFIAR':'#ef4c20','TROCA':'#009a6b','PASSIVA':'#661aa0','OVERDRIVE':'#8100df','PODER':'#666'};
function baseText(def,script={}){
 if(printed[def.id])return [...printed[def.id].effects,...(printed[def.id].lore?['('+printed[def.id].lore+')']:[])].join('\n\n');
 let raw=String(def.searchText||def.text||def.effect||'').normalize('NFC').trim();
 if(def.number===70&&def.type==='Lutador')raw='O seu primeiro Golpe no turno com Foco ganha ATQ igual à diferença de Poder. Se bater, ganhe 1 de Poder. OVERDRIVE: Nomeie uma Zona e golpeie com o meu Poder atual. Se bater, até o final do próximo turno, todos os Golpes na respectiva Zona custam 1 energia a mais.';
 if(def.type==='Lutador'){const parts=raw.split(/\bOVER\s*DRIVE\s*:\s*/i);raw='Passiva: '+parts[0].replace(/^Passiva:\s*/i,'').trim()+'\n\nOverdrive: '+(parts.slice(1).join(' ').trim()||'Consulte a sequência e o texto na carta.');}
 return raw;
}

const general={DEFLETIR:'Se esta Guarda bloquear com sucesso a partir da sua Zona Extra, cause dano igual ao meu valor.',QUEBRA:'Se este Golpe bater, interrompa a sequência de Overdrive do Lutador adversário.',REVERSO:'Se esta Guarda bloquear com sucesso a partir da sua Zona Extra, quebre a sequência de Overdrive do Lutador adversário.',FINTA:'Descarte esta Ação e outra carta da mão e devolva 1 energia ao fundo do Baralho para cancelar a Guarda alvo.',DESVIO:'Descarte esta Ação e outra carta da mão e devolva 1 energia ao fundo do Baralho para cancelar o Golpe alvo.',FUGAZ:'Me destrua ao final deste turno.',DESAFIAR:'O adversário é obrigado a bloquear este Golpe se tiver um bloqueador que possa pagar.'};
const reminder=(word,n)=>word==='ÍMPETO'?'Ímpeto - Se este Golpe for bloqueado, cause '+n+' de dano.':word==='FÚRIA'?'Fúria - Se este Golpe for bloqueado, seus próximos Golpes na mesma Zona ganham +'+n+' ATQ.':word==='DETER'?'Deter - Se esta Guarda bloquear, os próximos Golpes na Zona bloqueada custam '+n+' energia(s) a mais até o final do turno.':null;
function blocks(def,script={}){
 let raw=baseText(def,script).replace(/\bI carta\b/g,'1 carta'),lore='';const result=[],keywords=[];
 const quote=raw.match(/(?:^|\s)(\(?["“][\s\S]*?["”]\s*[-—][^\n]+\)?)$/);if(quote){lore=quote[1];raw=raw.slice(0,quote.index).trim();}
 if(def.type==='Lutador')return raw.split(/\n\n/).map(text=>({kind:'effect',text}));
 if(def.type==='Super'){
  const owner=raw.match(/^SUPER de ([^.]+)\./i)?.[1]||def.group||def.name.split(',')[0];
  raw=raw.replace(/^SUPER de [^.]+\.\s*Apenas uma cópia no Baralho Adicional\.\s*/i,'');
  keywords.push({kind:'keyword',name:owner,text:owner+' (Esta Ação é um Super de '+owner+'. Você deve ter '+owner+' como seu Lutador para ter esta carta no Baralho Adicional, e apenas uma cópia dela.)'});
 }else{
  for(const [word,description]of Object.entries(general)){
   const re=new RegExp('(?:^|[\\s\\[])'+word+'(?=[\\s.:\\](-]|$)','i');const match=raw.match(re);if(!match)continue;
   const before=raw.slice(0,match.index).trim();if(/(?:ganha|ganham|com|conceda|possui|tenham)\s*$/i.test(before))continue;
   // Labels embedded in a printed reminder are intrinsic; labels granted inside an effect stay there.
   if(before&&!before.endsWith('(')&&!before.endsWith('.')&&!before.endsWith('[')&&word!=='DEFLETIR')continue;
   keywords.push({kind:'keyword',text:word+' ('+description+')'});
   raw=raw.replace(new RegExp('\\[?'+word+'\\s*[-:]?\\s*\\([^)]*\\)\\]?','i'),'');
   raw=raw.replace(new RegExp('\\['+word+'\\s*-[^\\]]*\\]','i'),'');
   if(word==='DEFLETIR')raw=raw.replace(/\(Se esta Guarda bloquear[^)]*\)/gi,'');
   if(word==='REVERSO')raw=raw.replace(/REVERSO\s*:\s*se esta Guarda bloquear[^.]*\./i,'');
   raw=raw.replace(new RegExp('\\b'+word+'\\b[.:]?','i'),'').trim();
  }
  raw=raw.replace(/(?:^|(?<=[.\n]))\s*(ÍMPETO|FÚRIA|DETER)\s+(\d+)\s*[.:]?(?:\s*\((?:Ímpeto|Fúria|Deter)[^)]*\))?/giu,(all,word,n)=>{word=word.toLocaleUpperCase('pt-BR');keywords.push({kind:'keyword',text:word+' '+n+' ('+reminder(word,n)+')'});return '\n';});
  if(keywords.some(k=>k.text.startsWith('DETER ')))raw=raw.replace(/Deter:\s*se esta Guarda bloquear[^.]*final do turno\./i,'');
  if(keywords.some(k=>k.text.startsWith('FÚRIA ')))raw=raw.replace(/se este Golpe for bloqueado, seus próximos Golpes na mesma Zona ganham \+\d+ ATQ\./gi,'');
 }
 const conditionReminders={GATILHO:'Se este Golpe iniciar uma sequência.',CONTINUAÇÃO:'Se este Golpe continuar uma sequência.',FINALIZAÇÃO:'Se este Golpe encerrar uma sequência.',FINALIZADOR:'Se este Golpe encerrar uma sequência.'};
 raw=raw.replace(/\b(GATILHO|CONTINUAÇÃO|FINALIZAÇÃO|FINALIZADOR)(\s+e\s+FLUXO\s+\d+)?\s*[-:]\s*([^.!?]+[.!?]?)/giu,(all,word,extra,effect)=>'Se este Golpe for '+word.toLocaleUpperCase('pt-BR')+(extra?' e atender a '+extra.trim().replace(/^e\s+/i,''):'')+', '+effect.charAt(0).toLocaleLowerCase('pt-BR')+effect.slice(1)+' ('+conditionReminders[word.toLocaleUpperCase('pt-BR')]+')\n\n');
 // Recover labels whose printed reminder survived but whose label was interleaved by the old transcription.
 for(const word of ['PREPARO','FLUIR','FLUXO','FOCO','RECARGA','REVIDE','FIXAR','DETER']){
  const reminderPattern=new RegExp('\\(('+word+'\\s*[-:]\\s*[^)]*)\\)','i'),note=raw.match(reminderPattern),label=new RegExp('\\b'+word+'\\b');
  if(!note||!label.test(raw)||new RegExp('^\\s*'+word+'\\b').test(raw))continue;
  const index=raw.search(label),before=raw.slice(0,index);if(/(?:com|ganha|ganham|de|da|do)\s*$/i.test(before))continue;
  keywords.push({kind:'keyword',text:word+' ('+note[1].replace(/\bI\b/g,'1')+')'});raw=raw.replace(reminderPattern,'').replace(label,'').trim();
 }
 // Keyword-associated effects precede independent effects, without moving words merely mentioned in a condition.
 const pieces=raw.split(/\n\s*\n|(?<=[.)])\s+(?=(?:FLUIR|FLUXO|FOCO|PREPARO|REVIDE|RECARGA|FIXAR|DETER|TROCA)\b)/g).map(text=>text.trim()).filter(Boolean);
 for(const text of pieces){const match=text.match(/^(FLUIR|FLUXO|FOCO|PREPARO|REVIDE|RECARGA|FIXAR|DETER|TROCA)\b/i);(match?keywords:result).push({kind:match?'keyword':'effect',text});}
 return [...keywords,...result,...(lore?[{kind:'lore',text:lore}]:[])];
}
function text(def,script={}){return blocks(def,script).map(b=>b.text).join('\n\n');}
function metadata(d){const items=[d.type,d.subtype,d.color];if(d.type==='Lutador')items.push('Poder: '+d.power,'Super: 5');else if(['Golpe','Guarda','Truque'].includes(d.type)){items.push('Custo: '+(d.cost??'—'));if(d.alternateCost!==null&&d.alternateCost!==undefined)items.push('Alternativo: '+d.alternateCost);items.push('Zona: '+(d.zone||'não se aplica'));if(typeof d.power==='number')items.push('ATQ: '+d.power);if(typeof d.block==='number')items.push('BLQ: '+d.block);}else if(d.type==='Super')items.push('Transformação · Adicional');return items.filter(Boolean).join(' · ');}
function inlineFragment(raw,def){
 const result=document.createDocumentFragment();
 const slug=word=>word.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll(' ','-');
 const keys=['DESAFIAR','TROCA','PASSIVA','OVERDRIVE','ATQ','BLQ','ATAQUE','BLOQUEIO','PODER','CONTINUAÇÃO','DEFLETIR','DESVIO','DETER','FINALIZADOR','FINALIZAÇÃO','FINTA','FIXAR','FLUIR','FLUXO','FOCO','FUGAZ','FÚRIA','GATILHO','ÍMPETO','PREPARO','QUEBRA','RECARGA','REVERSO','REVIDE','SUPER',
  ...['AZUL','GENÉRICA','LARANJA','ROSA','ROXA','VERDE'].map(color=>'ENERGIA '+color),
  ...['AZUL','LARANJA','ROSA','ROXO','VERDE'].map(color=>'VIRAR '+color)];
 const pattern=new RegExp('(?<![\\p{L}])('+keys.sort((a,b)=>b.length-a.length).map(k=>['ÍMPETO','FÚRIA','FLUXO','FOCO','RECARGA','DETER'].includes(k)?k+'(?:\\s+\\d+)?':k).join('|')+')(?![\\p{L}])','giu');

 let previous=0,depth=0;
 for(const match of raw.matchAll(pattern)){
  const preceding=raw.slice(previous,match.index);
  for(const char of preceding){if(char==='(')depth++;else if(char===')')depth=Math.max(0,depth-1);}
  result.append(document.createTextNode(preceding));
  const word=match[0].toLocaleUpperCase('pt-BR').replace(/\s+\d+$/,'');
  if(((raw.slice(0,match.index).match(/["“”]/g)||[]).length%2)===1){result.append(document.createTextNode(match[0]));previous=match.index+match[0].length;continue;}
  if(colors[word]){const bold=document.createElement('strong');bold.className='readout-keyword021';bold.style.color=word==='REVIDE'?({Roxo:'#8100eb',Rosa:'#ec2080',Verde:'#699e00',Azul:'#009bde',Laranja:'#ef4c20'}[def.color]||colors[word]):colors[word];bold.textContent=match[0];result.append(bold);previous=match.index+match[0].length;continue;}
  let name=slug(word);
  if(word==='ATAQUE')name='atq';
  if(word==='BLOQUEIO')name='blq';
  if(word==='FINALIZAÇÃO')name='finalizador';
  if(word==='REVIDE')name='revide-'+({Roxo:'roxo',Rosa:'rosa',Verde:'verde',Azul:'azul',Laranja:'laranja'}[def.color]||'laranja');
  const img=document.createElement('img');
  img.className='effect-icon018'+(['atq','blq','poder'].includes(name)?' symbol018':'');
  img.src='assets/hud018/icons/'+name+'.png';
  img.alt=match[0];img.title=match[0];
  result.append(img);previous=match.index+match[0].length;
 }
 result.append(document.createTextNode(raw.slice(previous)));
 return result;
}
function fragment(def,script={}){const result=document.createDocumentFragment();for(const block of blocks(def,script)){const el=document.createElement('span');el.className='readout-block021 readout-group-'+block.kind+'021';if(block.name){const label=document.createElement('strong');label.className='readout-keyword021';label.style.color=({Roxo:'#8100eb',Rosa:'#ec2080',Verde:'#699e00',Azul:'#009bde',Laranja:'#ef4c20'}[def.color]||'#8100eb');label.textContent=block.name;el.append(label,document.createTextNode(block.text.slice(block.name.length)));}else el.append(inlineFragment(block.text,def));result.append(el);}return result;}
return {text,fragment,metadata,blocks};
});
