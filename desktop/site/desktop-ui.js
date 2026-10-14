(() => {
 const $=id=>document.getElementById(id);
 if($('exitGame')) {
  $('exitGame').onclick=()=>$('exitDialog').showModal();
  $('cancelExit').onclick=()=>$('exitDialog').close();
  $('confirmExit').onclick=async()=>{
   try {const response=await fetch('/__exit',{method:'POST'});if(!response.ok)throw Error();$('exitStatus').textContent='Jogo encerrado. Você pode fechar esta janela.';window.close();}
   catch {$('exitStatus').textContent='Feche esta janela para sair do simulador.';}
  };
 }
 if($('togglePdf')) $('togglePdf').onclick=()=>{
  const frame=$('rulesPdf');frame.hidden=!frame.hidden;if(!frame.hidden)frame.src=frame.dataset.src;
  $('togglePdf').setAttribute('aria-expanded',String(!frame.hidden));$('togglePdf').textContent=frame.hidden?'Mostrar PDF nesta tela':'Ocultar PDF';
 };
 if($('ruleSearch')) $('ruleSearch').oninput=()=>{
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const q=normalize($('ruleSearch').value.trim());let count=0;
  document.querySelectorAll('.rule-chapter').forEach(ch=>{ch.hidden=!normalize(ch.textContent).includes(q);if(!ch.hidden)count++;if(q&&!ch.hidden)ch.open=true;});
  $('ruleResults').textContent=count+' capítulos encontrados';
 };
 const checks=[...document.querySelectorAll('[data-lesson]')];
 if(checks.length) {
  let saved=[];try{saved=JSON.parse(localStorage.getItem('of-tutorial-v02')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
  checks.forEach(c=>c.checked=saved.includes(c.dataset.lesson));
  const update=()=>{const done=checks.filter(c=>c.checked).map(c=>c.dataset.lesson);$('lessonProgress').value=done.length;$('lessonCount').textContent=done.length+' / '+checks.length+' concluídas';try{localStorage.setItem('of-tutorial-v02',JSON.stringify(done));}catch{}};
  checks.forEach(c=>c.onchange=update);update();
 }
})();
