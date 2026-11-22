/* One persistent HTML media element: lesson changes never restart the track. */
(function(){
'use strict';
const audio=document.getElementById('tutorialMusic'),toggle=document.getElementById('soundToggle'),key='overdrive-preferences-v1';
// Each new tutorial visit starts enabled, independently of a previous global mute.
let muted=false,volume=.35,blocked=false,playing=false,suspended=false;
try{const prefs=JSON.parse(localStorage.getItem(key)||'{}');if(Number.isFinite(prefs.musicVolume)&&prefs.musicVolume>0)volume=Math.min(1,prefs.musicVolume/100);}catch{}
function paint(){toggle.textContent=muted?'Som desligado':blocked||!playing?'Ativar som':'Som ligado';toggle.setAttribute('aria-pressed',String(!muted&&playing));}
async function start(){audio.volume=volume;audio.loop=true;if(muted||document.hidden||suspended){audio.pause();playing=false;paint();return;}if(!window.OverdriveAudioFocus?.claim())return;try{await audio.play();if(document.hidden||!window.OverdriveAudioFocus.owns()){audio.pause();return;}playing=true;blocked=false;}catch{blocked=true;playing=false;}paint();}
function gesture(event){if(event.target?.closest?.('#soundToggle'))return;if(!muted&&audio.paused){suspended=false;start();}}
toggle.addEventListener('click',()=>{if(muted||blocked||!playing){muted=false;suspended=false;start();}else{muted=true;audio.pause();playing=false;paint();}try{const prefs=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...prefs,muted}));}catch{}});
document.addEventListener('pointerdown',gesture,{passive:true});document.addEventListener('keydown',gesture);audio.addEventListener('error',()=>{blocked=true;playing=false;paint();});audio.addEventListener('pause',()=>{playing=false;paint();});
window.OverdriveAudioFocus?.onLost(()=>{suspended=true;audio.pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();window.OverdriveAudioFocus?.release();}else{suspended=false;if(!muted)start();}});
 addEventListener('pagehide',()=>audio.pause());addEventListener('pageshow',()=>{suspended=false;if(!muted)start();});
window.OverdriveTutorialAudio={getState:()=>({muted,blocked,playing:!audio.paused,loop:audio.loop,time:audio.currentTime,volume:audio.volume,source:audio.currentSrc})};start();
})();
