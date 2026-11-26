/* SILE app shell. Preserve unrelated caches, including private WebLLM model weights. */
const CACHE="sile-study-v19";
const RUNTIME_CACHE="sile-local-runtime-v1";
const ASSETS=[
 "./","./index.html","./styles.css?v=19","./app.js?v=19","./study-ux.js?v=19","./tools-enhancements.js?v=19",
 "./retrieval-enhancements.js?v=19","./local-model.js?v=19","./diagnostic.html","./manifest.webmanifest",
 "./icon-192.png","./icon-512.png","./apple-touch-icon.png"
];
const scope=new URL(self.registration.scope);
const shellAssets=new Set(ASSETS.map(path=>new URL(path,scope).href));
const OWNED_CACHE=/^(?:sile-study-v|sile-stage3-v|sile-shell-v)/;
self.addEventListener("install",event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,scope),{cache:"reload"}))))
));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>OWNED_CACHE.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
async function appRequest(request,navigation){
 const cache=await caches.open(CACHE);
 const cached=await cache.match(navigation?new URL("index.html",scope):request);
 return cached||fetch(request);
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
 const navigation=event.request.mode==="navigate"&&url.origin===scope.origin&&
  [scope.pathname,new URL("index.html",scope).pathname].includes(url.pathname);
 if(navigation||shellAssets.has(url.href)){event.respondWith(appRequest(event.request,navigation));return;}
 if(RUNTIME_HOSTS.has(url.hostname)&&event.request.destination==="script"){event.respondWith(runtimeRequest(event.request));}
});
