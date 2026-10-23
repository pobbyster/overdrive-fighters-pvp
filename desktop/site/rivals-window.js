/* Uma janela de composição, com rolagem limitada às listas de cartas.
 * Os HUDs usam os mesmos nós de análise/curva para manter seus eventos. */
(()=>{
 'use strict';
 const body=document.body,$=id=>document.getElementById(id);
 function popup(node,title,buttonParent,buttonClass='rivals-hud-link'){
  if(!node||!buttonParent)return;
  const dialog=document.createElement('dialog');dialog.className='rivals-info-dialog';
  const top=document.createElement('div');top.className='rivals-dialog-heading';
  const heading=document.createElement('h2');heading.textContent=title;
  const close=document.createElement('button');close.textContent='Fechar ×';close.type='button';close.onclick=()=>dialog.close();top.append(heading,close);dialog.append(top,node);body.append(dialog);
  if(node.tagName==='DETAILS'){node.open=true;node.querySelector(':scope>summary').hidden=true;}
  const button=document.createElement('button');button.type='button';button.className=buttonClass;button.textContent=title;button.onclick=()=>dialog.showModal();buttonParent.append(button);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  return dialog;
 }
 if(body.classList.contains('rivals-editor')){
  const title=document.querySelector('header h1');title.replaceChildren(Object.assign(document.createElement('img'),{src:'assets/rivals/editor-logo.webp',alt:'Editor de Decks'}));
  const menu=document.querySelector('header>.back-button');menu.classList.add('rivals-menu-hud');menu.setAttribute('aria-label','Menu principal');menu.replaceChildren(Object.assign(document.createElement('img'),{src:'assets/rivals/menu.webp',alt:'Menu'}));
  const aside=$('deckPanel'),insights=document.createElement('div');insights.className='rivals-insights';aside.append(insights);
  popup($('deckAnalysis'),'Análise do deck',insights);
  popup(document.querySelector('.curve-panel'),'Curva de custos',insights);
  // Contadores de cada área continuam nos cabeçalhos; suprime o HUD redundante.
  aside.querySelector('.counts').hidden=true;
 }
 if(body.classList.contains('rivals-arena')){
  const own=document.querySelector('.rivals-left>.rivals-panel'),game=document.querySelector('#setup>.selection-settings');
  popup(document.querySelector('.rivals-deck-import'),'Importar / editar baralhos',own);
  popup(document.querySelector('.rivals-more'),'Cartas e compatibilidade',game);
 }
 function fit(){
  const arena=body.classList.contains('rivals-arena'),editor=body.classList.contains('rivals-editor');if(!arena&&!editor)return;
  const playing=arena&&body.classList.contains('rivals-playing');
  const width=Math.max(innerWidth,1180),scale=Math.min(1,innerWidth/1180),header=editor?80:0;
  body.style.setProperty('--rivals-scale',String(scale));body.style.setProperty('--rivals-stage-width',width+'px');body.style.setProperty('--rivals-stage-height',(innerHeight/scale-header)+'px');
  for(const node of [document.querySelector('body>main'),...(editor?[document.querySelector('body>header')]:[])]){
   if(!node)continue;node.classList.toggle('rivals-fit-stage',!playing);node.style.zoom=playing?'':String(scale);
  }
 }
 addEventListener('resize',fit);if($('game'))new MutationObserver(fit).observe($('game'),{attributes:true,attributeFilter:['hidden']});fit();
})();
