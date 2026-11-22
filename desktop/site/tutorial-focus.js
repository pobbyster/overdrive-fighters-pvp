/* Viewport-wide Arena-style dimming, with a clear opening for the lesson target. */
(()=>{'use strict';let nodes=[],boundary,frame;
function layout(){
 const host=document.getElementById('tutorialFocus018');if(!host)return;
 const boxes=nodes.filter(n=>n?.isConnected).map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height);
 if(!boundary||!boxes.length){host.hidden=true;return;}
 const left=0,top=0,right=innerWidth,bottom=innerHeight;
 const x=Math.max(left,Math.min(...boxes.map(r=>r.left))-7),y=Math.max(top,Math.min(...boxes.map(r=>r.top))-7),r=Math.min(right,Math.max(...boxes.map(r=>r.right))+7),b=Math.min(bottom,Math.max(...boxes.map(r=>r.bottom))+7);
 if(r<=x||b<=y||right<=left||bottom<=top){host.hidden=true;return;}host.hidden=false;
 const rects=[[left,top,right-left,y-top],[left,b,right-left,bottom-b],[left,y,x-left,b-y],[r,y,right-r,b-y],[x,y,r-x,b-y]];
 [...host.children].forEach((el,i)=>{const [l,t,w,h]=rects[i];Object.assign(el.style,{left:l+'px',top:t+'px',width:Math.max(0,w)+'px',height:Math.max(0,h)+'px'});});
}
function queue(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
addEventListener('resize',queue);addEventListener('scroll',queue,{passive:true,capture:true});
window.OverdriveTutorialFocus={set(targets,area){nodes=targets;boundary=area;queue();},clear(){nodes=[];queue();},layout};
})();
