(()=>{'use strict';const api=OverdriveArena,$=id=>document.getElementById(id);let signature='',responseSignature='';
function enter(el){el.classList.remove('hud03-enter');void el.offsetWidth;el.classList.add('hud03-enter');}
function update(event){const v=event.detail,e=api.engine();if(!v||!e)return;const hud=$('decisionHud'),response=$('responseHud');hud.classList.toggle('modern-effect-hud',!!v.choice&&v.choice.player===0);response.classList.add('modern-effect-hud');
 let art=$('effectSourceArt');if(!art){art=document.createElement('img');art.id='effectSourceArt';art.className='effect-card-art';hud.querySelector('h2').before(art);}
 const source=v.choice?.source||v.combats.at(-1)?.uid,card=source&&e.find(source)?.card;art.hidden=!card||!v.choice||v.choice.player!==0;if(!art.hidden){art.src='assets/'+card.id+'.webp';art.alt=e.def(card).name;}
 let progress=$('effectSelectionProgress');if(!progress){progress=document.createElement('p');progress.id='effectSelectionProgress';progress.className='effect-progress';$('actionButtons').before(progress);}const count=v.choice?.selectedCount||0;
 progress.hidden=!['expansion:deliciasBanish','expansion:quadraPick','expansion:flowReturn','expansion:revealMany','expansion:placideOD','rivals:extra','rivals:discard','rivals:odFreeze','rivals:05Discard','rivals:05Extras'].includes(v.choice?.kind);progress.textContent='Selecionadas: '+count+(v.choice?.limit!==undefined?' / '+v.choice.limit:'');
 const next=v.choice?.kind+':'+(v.choice?.source||'')+':'+!!hud.hidden;if(next!==signature){signature=next;if(!hud.hidden)enter(hud);}
 const rnext=!!response.hidden+':'+(v.stack.at(-1)?.id||v.combats.at(-1)?.id||'');if(rnext!==responseSignature){responseSignature=rnext;if(!response.hidden)enter(response);}
}
addEventListener('of-game-render',update);
for(const id of ['actionPreview','cardDialog','sideDeckDialog']){const dialog=$(id);if(dialog)new MutationObserver(()=>{if(dialog.open)enter(dialog);}).observe(dialog,{attributes:true,attributeFilter:['open']});}
for(const image of document.querySelectorAll('.duel-poster .poster-half img')){let previous=image.dataset.fighter;new MutationObserver(()=>{const current=image.dataset.fighter;if(!current||current===previous)return;previous=current;const half=image.closest('.poster-half');half.dataset.selectedName=api.catalog()?.find(c=>c.id===current)?.name||'';half.classList.remove('fighter03-selected');void half.offsetWidth;half.classList.add('fighter03-selected');}).observe(image,{attributes:true,attributeFilter:['data-fighter']});}
})();
