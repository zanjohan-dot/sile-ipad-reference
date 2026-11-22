/* SILE app shell. Preserve unrelated caches, including private WebLLM model weights. */
const CACHE="sile-study-v18";
const RUNTIME_CACHE="sile-local-runtime-v1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./study-ux.js","./tools-enhancements.js","./retrieval-enhancements.js","./local-model.js","./diagnostic.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./apple-touch-icon.png"];
const OWNED_CACHE=/^(?:sile-study-v|sile-stage3-v|sile-shell-v)/;
self.addEventListener("install",event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>OWNED_CACHE.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
function appRequest(request){
 return fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
  return response;
 }).catch(async()=>{
   const cache=await caches.open(CACHE);
   const hit=await cache.match(request) || await cache.match(new URL(request.url).pathname);
   if(hit)return hit;
   // Never serve HTML to an unavailable JavaScript/CSS request.
   if(request.mode==="navigate")return await cache.match("./index.html")||Response.error();
   return Response.error();
 });
}
const RUNTIME_HOSTS=new Set(["esm.run","esm.sh","cdn.jsdelivr.net"]);
function runtimeRequest(request){
 return caches.open(RUNTIME_CACHE).then(cache=>
  fetch(request).then(response=>{
   if(response.ok&&response.type!=="opaque"){
    const copy=response.clone();
    const len=Number(response.headers.get("content-length")||0);
    if(!len||len<10000000)cache.put(request,copy).catch(()=>{});
   }
   return response;
  }).catch(async()=>await cache.match(request)||Response.error())
 );
}
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin===self.location.origin){event.respondWith(appRequest(event.request));return;}
 if(RUNTIME_HOSTS.has(url.hostname)&&event.request.destination==="script"){event.respondWith(runtimeRequest(event.request));}
});
