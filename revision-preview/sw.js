/* Cache the full SILE shell. Updates only replace this app’s shell caches. */
const CACHE="sile-revision-preview-shell-v28";
const ASSETS=[
 "./","./index.html","./reader.html","./offline-study.html","./styles.css?v=23","./app.js?v=28","./study-ux.js?v=23","./tools-enhancements.js?v=23",
 "./retrieval-enhancements.js?v=25","./diagnostic.html","./reset.html","./manifest.webmanifest",
 "./icon-192.png","./icon-512.png","./apple-touch-icon.png"
];
const scope=new URL(self.registration.scope);
const shellAssets=new Set(ASSETS.map(path=>new URL(path,scope).href));
const OWNED_CACHE=/^sile-revision-preview-shell-v/;
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
  [scope.pathname,new URL("index.html",scope).pathname,new URL("reader.html",scope).pathname,new URL("offline-study.html",scope).pathname].includes(url.pathname);
 if(navigation||shellAssets.has(url.href)){event.respondWith(appRequest(event.request,navigation));return;}
});

