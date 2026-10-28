(()=>{
 'use strict';const $=id=>document.getElementById(id),api=window.OverdriveArena;
 const effect=$('editorCardText');if(effect){effect.tabIndex=0;effect.setAttribute('aria-label','Efeito completo da carta. Use a rolagem para ler.');}
 if(!$('setup'))return;
 const pvp=document.body.classList.contains('rivals-pvp'),select=$('playerDeck'),caption=document.querySelector('.selected-deck-caption');
 if(caption&&select){
  const dialog=document.createElement('dialog');dialog.id='arenaDeckPicker';dialog.className='arena-deck-picker';
  dialog.innerHTML='<h2>Escolha seu baralho</h2><p>Apenas os baralhos que você criou e salvou neste navegador.</p><div id="arenaDeckChoices"></div><div class="deck-picker-tools"></div><button type="button" id="closeArenaDeckPicker">Fechar</button>';
  document.body.append(dialog);const close=()=>dialog.close();$('closeArenaDeckPicker').onclick=close;
  caption.setAttribute('role','button');caption.tabIndex=0;caption.setAttribute('aria-haspopup','dialog');caption.setAttribute('aria-controls',dialog.id);
  caption.setAttribute('aria-label','Escolher baralho');
  function open(){
   if(!api.catalog())return;api.refreshDecks?.();const choices=$('arenaDeckChoices');choices.replaceChildren();
   for(const option of select.options){const button=document.createElement('button');button.type='button';button.className='arena-deck-choice';button.setAttribute('aria-pressed',String(option.selected));
    const fighter=api.catalog().find(c=>c.id===option.dataset.fighter),img=document.createElement('img');img.src=OverdriveFighterPortrait(option.dataset.fighter);img.alt='';
    const text=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=option.textContent;detail.textContent=fighter?.name||'Lutador indisponível';text.append(name,detail);button.append(img,text);
    button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();};choices.append(button);
   }
   if(!select.options.length){const empty=document.createElement('p');empty.textContent='Você ainda não salvou um baralho. Crie seu primeiro deck no editor.';choices.append(empty);const link=document.createElement('a');link.href='decks.html';link.textContent='Criar meu baralho';choices.append(link);}
   dialog.showModal();
  }
  caption.onclick=open;caption.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
  if(pvp){
   const originalLabel=select.closest('label');originalLabel.hidden=true;dialog.append(originalLabel);
   for(const el of document.querySelectorAll('.rivals-left>.rivals-panel .rivals-deck-links,.rivals-left>.rivals-panel .rivals-deck-import'))dialog.querySelector('.deck-picker-tools').append(el);
   const compatibility=$('deckCompatibility');if(compatibility)caption.after(compatibility);
  }
 }
 if(!pvp){
  const opponent=$('opponent');opponent.prepend(new Option('Lutador aleatório','random'));
  function previewRandom(){const random=opponent.value==='random',poster=document.querySelector('.poster-enemy');poster.classList.toggle('random-opponent',random);if(random)poster.querySelector('strong').textContent='ALEATÓRIO';}
  opponent.addEventListener('change',previewRandom);
  // Resolve before the existing Round/Match handler creates its persistent opponent.
  // Both the sidedeck reveal and the actual duel then use the same concrete preset.
  $('startGame').addEventListener('click',()=>{if(opponent.value!=='random')return;const choices=[...opponent.options].filter(o=>o.value.endsWith(':balanced'));const range=4294967296,limit=range-range%choices.length;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);opponent.value=choices[n%choices.length].value;opponent.dispatchEvent(new Event('change',{bubbles:true}));},true);
  return;
 }
 const panel=document.querySelector('.rivals-left>.rivals-panel');panel.id='availableRoomsPanel';panel.replaceChildren();
 const heading=document.createElement('h2');heading.innerHTML='<small>ARENA PVP</small><span>SALAS DISPONÍVEIS</span>';
 const refresh=document.createElement('button');refresh.id='refreshAvailableRooms';refresh.type='button';refresh.textContent='Atualizar salas';
 const status=document.createElement('p');status.id='availableRoomsStatus';status.setAttribute('role','status');
 const list=document.createElement('div');list.id='availableRooms';panel.append(heading,refresh,status,list);
 $('pvpLobby').querySelector('.eyebrow').textContent='ARENA PVP · SALAS DE JOGO';
 $('pvpLobby').querySelector('h2+p').textContent='Escolha seu baralho abaixo da logo. Entre em uma sala disponível ou crie uma sala para receber outro jogador.';
 let directory,generation=0,deadline,initialRefresh,lastList='';
 function loadRooms(){
  const seq=++generation;clearTimeout(initialRefresh);clearTimeout(deadline);directory?.close();
  let url;try{url=new URL($('pvpServer').value);if(!['ws:','wss:'].includes(url.protocol)||url.pathname!=='/pvp'||url.username||url.password)throw Error();}catch{status.textContent='Informe um servidor ws:// ou wss:// terminado em /pvp.';return;}
  if(!$('pvpLeave').hidden){lastList='';list.replaceChildren();status.textContent='Você já está em uma sala. Saia dela para entrar em outra.';return;}
  status.textContent='Consultando salas…';
  let ws;try{ws=new WebSocket(url.href);directory=ws;}catch{status.textContent='Não foi possível consultar este servidor.';return;}
  let received=false;deadline=setTimeout(()=>{if(seq===generation&&!received){status.textContent='Servidor indisponível ou sem suporte à lista de salas.';ws.close();}},12000);
  ws.onopen=()=>ws.send(JSON.stringify({protocol:1,type:'listRooms'}));
  ws.onmessage=event=>{if(seq!==generation)return;let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.type==='error'){status.textContent='Este servidor ainda não oferece a lista de salas. Você pode entrar pelo código.';received=true;clearTimeout(deadline);ws.close();return;}if(msg.type!=='roomList'||!Array.isArray(msg.rooms))return;
   received=true;clearTimeout(deadline);const compatible=msg.ruleset===OverdriveCore.RULESET_ID;
   status.textContent=!compatible?'A versão deste servidor é diferente. Atualize o servidor para jogar com esta prévia.':msg.rooms.length?'Salas aguardando um segundo jogador.':'Nenhuma sala aberta no momento. Crie uma sala para jogar.';
   const signature=JSON.stringify([msg.ruleset,msg.rooms]);if(lastList===signature){ws.close();return;}lastList=signature;list.replaceChildren();
   for(const room of msg.rooms){if(!/^[A-F0-9]{10}$/.test(room.code))continue;const row=document.createElement('div');row.className='available-room';
    const info=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=room.host;detail.textContent=OverdriveModes.describe(room.mode)+' · '+room.code;info.append(name,detail);
    const join=document.createElement('button');join.type='button';join.textContent='Entrar';join.disabled=!compatible;join.setAttribute('aria-label','Entrar na sala de '+room.host);join.onclick=()=>{$('pvpCode').value=room.code;$('pvpJoin').click();};row.append(info,join);list.append(row);
   }ws.close();
  };
  ws.onerror=()=>{if(seq===generation)status.textContent='Servidor indisponível. Confira o endereço e tente atualizar.';};
  ws.onclose=()=>{if(seq===generation&&!received){clearTimeout(deadline);status.textContent='Não foi possível listar salas. Confira o servidor ou entre pelo código.';}};
 }
 refresh.onclick=loadRooms;$('pvpServer').addEventListener('change',loadRooms);
 new MutationObserver(()=>{if(!$('pvpLeave').hidden){generation++;clearTimeout(deadline);directory?.close();lastList='';list.replaceChildren();status.textContent='Você já está em uma sala. Saia dela para entrar em outra.';}}).observe($('pvpLeave'),{attributes:true,attributeFilter:['hidden']});
 // Wait for the existing health discovery, which identifies a local PvP server.
 initialRefresh=setTimeout(loadRooms,700);const interval=setInterval(()=>{if(!document.hidden&&!$('setup').hidden&&$('pvpLeave').hidden)loadRooms();},15000);
 addEventListener('pagehide',()=>{clearInterval(interval);clearTimeout(initialRefresh);clearTimeout(deadline);generation++;directory?.close();},{once:true});
})();
