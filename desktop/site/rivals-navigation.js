/* Só revela a composição depois de aplicar o tema e preparar suas artes. */
(()=>{
 const body=document.body,root=document.documentElement;
 if(body.classList.contains('desktop-screen')){
  body.classList.add('rivals-reading');
  const menu=document.querySelector('.screen-header>.back-button');
  if(menu){menu.classList.add('rivals-menu-hud');menu.replaceChildren(Object.assign(document.createElement('img'),{src:'assets/rivals/menu.webp',alt:'Menu'}));}
 }
 async function ready(){
  const art=[...document.querySelectorAll('.rivals-art-button img,.menu-logo,header h1 img,.rivals-menu-hud img,.poster-half img')];
  if(body.classList.contains('rivals-arena-template')){const background=new Image();background.src='assets/rivals/arena-ia-template.webp';art.push(background);}
  // CSS and layout are ready; image decoding must not hide the entire screen.
  for(const img of art)img.decoding='async';
  root.classList.remove('rivals-pending');body.classList.add('rivals-entering');
  body.addEventListener('animationend',()=>body.classList.remove('rivals-entering'),{once:true});
 }
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 let leaving=false;
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
  const url=new URL(link.href);
  if(url.origin!==location.origin||!/(home|arena|decks|settings|rules|tutorial)\.html$/.test(url.pathname)||url.href===location.href)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  event.preventDefault();if(leaving)return;leaving=true;body.classList.remove('rivals-entering');body.classList.add('rivals-leaving');
  setTimeout(()=>location.assign(url.href),80);
 });
 addEventListener('pageshow',event=>{if(event.persisted){leaving=false;body.classList.remove('rivals-leaving');root.classList.remove('rivals-pending');}});
})();
