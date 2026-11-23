/* Diagnostic control: does Linux Playwright WebKit relaunch ANY minimal cached PWA offline?
 * This synthetic test never accesses SILE data and cannot certify iPadOS behavior.
 */
"use strict";
const http=require("node:http"),{webkit}=require("playwright");
const html='<!doctype html><title>Offline control</title><h1 id="ok">Offline control page</h1><script>navigator.serviceWorker.register("/sw.js")</script>';
const sw='self.addEventListener("install",e=>e.waitUntil(caches.open("minimal-offline-v1").then(c=>c.addAll(["/"])).then(()=>self.skipWaiting())));'+
'self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));'+
'self.addEventListener("fetch",e=>{if(new URL(e.request.url).origin===self.location.origin)e.respondWith(fetch(e.request).catch(()=>caches.match("/")))})';
const server=http.createServer((req,res)=>{const isSw=req.url==="/sw.js";res.writeHead(200,{"Content-Type":isSw?"text/javascript":"text/html","Cache-Control":"no-cache"});res.end(isSw?sw:html)});
async function main(){
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser,context;
 try{
  const base="http://127.0.0.1:"+server.address().port+"/";
  browser=await webkit.launch({headless:true});
  context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base);
  await page.waitForFunction(()=>'serviceWorker' in navigator && navigator.serviceWorker.controller!==null,null,{timeout:15000});
  await context.setOffline(true);
  try{
   await page.reload({waitUntil:"domcontentloaded",timeout:15000});
   if(!await page.locator("#ok").count())throw Error("Offline control HTML missing");
   console.log("CONTROL_PASS: Linux WebKit successfully reloaded a minimal cached PWA offline");
  }catch(e){console.log("CONTROL_BLOCKED: Minimal WebKit offline PWA reload also failed:",String(e).slice(0,500))}
 }finally{if(context)await context.close();if(browser)await browser.close();server.close()}
}
main().catch(e=>{console.error("CONTROL_SETUP_ERROR:",e.message||e);process.exitCode=1;server.close()});
