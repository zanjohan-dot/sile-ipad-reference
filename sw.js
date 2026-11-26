/* Cache the full SILE shell. Updates only replace this app’s shell caches. */
const CACHE="sile-study-v22";
const ASSETS=[
 "./","./index.html","./styles.css?v=22","./app.js?v=22","./study-ux.js?v=22","./tools-enhancements.js?v=22",
 "./retrieval-enhancements.js?v=22","./diagnostic.html","./reset.html","./manifest.webmanifest",
 "./icon-192.png","./icon-512.png","./apple-touch-icon.png"
];
const scope=new URL(self.registration.scope);
const shellAssets=new Set(ASSETS.map(path=>new URL(path,scope).href));
const OWNED_CACHE=/^(?:sile-study-v|sile-stage3-v|sile-shell-v)/;
self.addEventListener("install",event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,scope),{cache:"reload"}))))
  .then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>OWNED_CACHE.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
async function appRequest(request,navigation){
 const cache=await caches.open(CACHE);
 const cached=await cache.match(navigation?new URL("index.html",scope):request);
 return cached||fetch(request);
}
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 const navigation=event.request.mode==="navigate"&&url.origin===scope.origin&&
  [scope.pathname,new URL("index.html",scope).pathname].includes(url.pathname);
 if(navigation||shellAssets.has(url.href)){event.respondWith(appRequest(event.request,navigation));return;}
});
