(() => {
 'use strict';
 const api=window.OverdriveArena,$=id=>document.getElementById(id),key='overdrive-saved-decks-v1';
 const controls=document.createElement('div');controls.className='pvp-deck-tools';
 controls.innerHTML='<a href="decks.html" target="_blank" rel="noopener">Criar / editar baralhos</a><button id="pvpImportDeck" type="button">Importar baralho JSON</button><input id="pvpDeckFile" type="file" accept=".json,application/json" hidden><p>Se o baralho foi criado em outro endereço ou no aplicativo, exporte o JSON no editor e importe aqui. A lista será salva neste navegador.</p><p id="pvpDeckStatus" role="status" aria-live="polite"></p>';
 $('playerDeck').closest('label').after(controls);
 $('pvpImportDeck').onclick=()=>$('pvpDeckFile').click();
 $('pvpDeckFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
   if(api.engine()?.s)throw Error('Importe o baralho antes de iniciar o duelo.');
   if(file.size>100000)throw Error('O arquivo excede 100 KB.');
   const raw=JSON.parse(await file.text());
   if(!raw||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80)throw Error('O baralho precisa ter um nome de até 80 caracteres.');
   const deck={name:raw.name,fighter:raw.fighter,main:raw.main,extra:raw.extra||{}};
   new OverdriveCore.Engine(api.catalog()).validateDeck(deck);
   let library;try{library=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(library))throw Error();}catch{throw Error('A biblioteca local não pôde ser lida. Exporte uma cópia pelo editor antes de substituir os dados.');}
   // Only a completely identical list is reused; a matching name never overwrites another deck.
   const fingerprint=d=>JSON.stringify([d.name,d.fighter,...['main','extra'].map(z=>Object.entries(d[z]||{}).sort(([a],[b])=>a.localeCompare(b)))]);
   let entry=library.find(e=>e?.deck&&fingerprint(e.deck)===fingerprint(deck));
   if(!entry){entry={id:crypto.randomUUID?.()||'pvp-'+Date.now()+'-'+crypto.getRandomValues(new Uint32Array(1))[0],updatedAt:new Date().toISOString(),deck};library.push(entry);localStorage.setItem(key,JSON.stringify(library));}
   api.refreshDecks(deck);$('pvpDeckStatus').textContent='Baralho selecionado e salvo: '+deck.name+'.';
  }catch(error){$('pvpDeckStatus').textContent='Não foi possível importar: '+error.message;}
  finally{event.target.value='';}
 };
 // Returning from the editor, or saving in another tab, immediately refreshes the selection.
 addEventListener('storage',event=>{if([key,'overdrive-collection-1-deck-v2','overdrive-active-deck-v1'].includes(event.key))api.refreshDecks?.();});
 addEventListener('focus',()=>api.refreshDecks?.());
})();
