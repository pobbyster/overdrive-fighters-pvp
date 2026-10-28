// Browser diagnostics remain available even on static hosting or without a server.
(function(root){
 'use strict';
 root.OverdriveDiagnostics={async collect(details={}){
  let server=null;
  try{const response=await fetch('/__diagnostics',{signal:AbortSignal.timeout(2000),cache:'no-store'});if(response.ok&&response.headers.get('content-type')?.includes('application/json'))server=await response.json();}catch{}
  return {format:'overdrive-diagnostics/1',generated:new Date().toISOString(),version:document.querySelector('meta[name="overdrive-version"]')?.content,browser:navigator.userAgent,storage:typeof indexedDB!=='undefined',server,serverAvailable:!!server,...details};
 }};
})(globalThis);
