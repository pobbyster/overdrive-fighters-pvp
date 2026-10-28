(()=>{
 'use strict';const zones={Inferior:'inferior',Meio:'meio',Superior:'superior'},colors={Azul:'azul',Verde:'verde',Rosa:'rosa',Roxo:'roxo',Laranja:'laranja'};
 window.OverdriveZoneIcon=(zone,color)=>'assets/zones/'+(colors[color]?colors[color]+'-':'')+zones[zone]+'.png';
 const first=document.getElementById('startingPlayer');if(first){first.closest('label').hidden=true;const note=document.createElement('p');note.className='coin-start-note';note.textContent='Quem começa: o vencedor da moeda escolhe primeiro ou segundo jogador.';first.closest('label').after(note);if(new URLSearchParams(location.search).has('pvp'))note.hidden=true;}
 // The verified reference remains in the project; its explanatory HUD is hidden.
})();
