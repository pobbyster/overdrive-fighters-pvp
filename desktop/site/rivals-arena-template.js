(()=>{
 const body=document.body;if(!body.classList.contains('rivals-arena')||body.classList.contains('rivals-pvp'))return;
 body.classList.add('rivals-arena-template');
 const own=document.querySelector('.rivals-left>.rivals-panel');
 own.append(document.querySelector('.selected-deck-caption'));
 function fit(){const width=Math.min(innerWidth,innerHeight*2561/1441),height=width*1441/2561;
  body.style.setProperty('--template-width',width+'px');body.style.setProperty('--template-height',height+'px');
  body.style.setProperty('--template-left',(innerWidth-width)/2+'px');body.style.setProperty('--template-top',(innerHeight-height)/2+'px');
 }
 addEventListener('resize',fit);fit();
})();
