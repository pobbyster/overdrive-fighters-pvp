/* A visible page owns the music until another page claims it. */
(()=>{
 'use strict';
 if(window.OverdriveAudioFocus)return;
 const key='overdrive-music-owner',id=crypto.randomUUID();
 let active=false,onLost=()=>{};
 function release(){
  active=false;
  try{if(localStorage.getItem(key)===id)localStorage.removeItem(key);}catch{}
 }
 window.OverdriveAudioFocus={
  claim(){
   if(document.hidden)return false;
   active=true;
   try{localStorage.setItem(key,id);}catch{}
   return true;
  },
  owns:()=>active&&!document.hidden,
  release,
  onLost:callback=>{onLost=callback;}
 };
 addEventListener('storage',event=>{
  if(event.key===key&&event.newValue&&event.newValue!==id&&active){
   active=false;onLost();
  }
 });
 addEventListener('pagehide',release);
})();
