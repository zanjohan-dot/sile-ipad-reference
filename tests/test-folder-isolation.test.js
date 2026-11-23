/* Same-origin, different-folder SILE test isolation acceptance.
 * No real course materials. Run with node tests/test-folder-isolation.test.js.
 */
"use strict";
const fs=require("node:fs"),http=require("node:http"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
const ROOT=path.resolve(__dirname,"..");
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json",".json":"application/json",".md":"text/plain"};
const server=http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||"/").split("?")[0]);
 if(!url.startsWith("/sile-ipad-reference/")){res.writeHead(404);res.end();return}
 const relative=url.slice("/sile-ipad-reference/".length)||"index.html";
 const file=path.resolve(ROOT,relative.endsWith("/")?relative+"index.html":relative);
 if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{"Content-Type":TYPES[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 let browser,context;
 const steps=[];
 const step=async(name,fn)=>{await fn();steps.push("PASS "+name)};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||"/usr/bin/google-chrome",args:["--no-sandbox"]});
  context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  const base="http://127.0.0.1:"+server.address().port+"/sile-ipad-reference/";
  await step("preseed production data and cache",async()=>{
   await page.goto(base);
   await page.evaluate(async()=>{
    const db=await new Promise((ok,no)=>{const r=indexedDB.open("sile-ipad-stage3",1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("kv"))r.result.createObjectStore("kv")};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
    await new Promise((ok,no)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put({sentinel:"NEVER_TOUCH_PRODUCTION"},"dataset");tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
    db.close();
    const c=await caches.open("sile-study-v19");await c.put("./production-sentinel",new Response("PRODUCTION_SENTINEL"));
   });
  });
  await step("test gate and test shell open",async()=>{
   await page.goto(base+"test/staging-check.html");
   assert.match(await page.locator("#status").innerText(),/TEST folder detected/);
   await page.locator("#openApp").click();
   await page.waitForURL(/\/sile-ipad-reference\/test\/?$/);
   await page.locator("#importNow").waitFor();
   const scripts=await page.locator("script[src]").evaluateAll(xs=>xs.map(x=>x.src));
   assert(!scripts.some(x=>/local-model|tools-enhancements/.test(x)),"Private-model script loaded in test");
   const manifest=await page.evaluate(async()=>{let ref=document.querySelector('link[rel="manifest"]');return (await fetch(ref.href)).json()});
   assert.equal(manifest.start_url,"./");
   assert.equal(manifest.scope,"./");
  });
  await step("reject non-synthetic private-like import",async()=>{
   page.once("dialog",dialog=>dialog.accept());
   await page.locator("#fileInput").setInputFiles({name:"not_a_test.json",mimeType:"application/json",buffer:Buffer.from('{"subjects":[]}')});
   await page.waitForTimeout(250);
   assert.match(await page.locator("#statusBtn").innerText(),/No local data/);
  });
  await step("import all 323 synthetic questions",async()=>{
   await page.locator("#fileInput").setInputFiles({name:"SILE_Synthetic_323_Questions.json",mimeType:"application/json",buffer:fs.readFileSync(path.join(ROOT,"test/SILE_Synthetic_323_Questions.json"))});
   await page.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"));
   await page.locator("#searchBtn").click();
   await page.locator("#findQuery").fill("fiduciary duties");
   await page.locator("#findNow").click();
   assert((await page.locator("[data-question-index]").count())>0,"No related synthetic questions");
   await page.locator("#showAllRelated").click();
   assert.equal(await page.locator("[data-question-index]").count(),323);
  });
  await step("test worker uses test folder scope and preserves production cache",async()=>{
   await page.waitForFunction(()=>navigator.serviceWorker?.controller?.scriptURL.includes("/test/sw.js"),null,{timeout:20000});
   const status=await page.evaluate(async()=>({scope:(await navigator.serviceWorker.getRegistration()).scope,keys:await caches.keys()}));
   assert.match(status.scope,/\/sile-ipad-reference\/test\/$/);
   assert(status.keys.includes("sile-study-v19"),"Production cache deleted");
   assert(status.keys.includes("sile-test-shell-v1"),"Test cache missing");
  });
  await step("same-origin production database remains intact",async()=>{
   const result=await page.evaluate(async()=>{
     const db=await new Promise((ok,no)=>{const r=indexedDB.open("sile-ipad-stage3",1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
     const val=await new Promise((ok,no)=>{const q=db.transaction("kv").objectStore("kv").get("dataset");q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});db.close();
     return val?.sentinel;
   });
   assert.equal(result,"NEVER_TOUCH_PRODUCTION");
  });
  await step("offline reload and synthetic retrieval",async()=>{
   await context.setOffline(true);
   try{
     await page.reload({waitUntil:"domcontentloaded",timeout:20000});
     await page.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"),null,{timeout:10000});
     await page.locator("#searchBtn").click();
     await page.locator("#findQuery").fill("fiduciary duties");
     await page.locator("#findNow").click();
     assert((await page.locator("[data-question-index]").count())>0);
   }finally{await context.setOffline(false)}
  });
  assert.equal(errors.length,0,"Uncaught browser exceptions: "+errors.join("; "));
  console.log(JSON.stringify({verdict:"PASS",environment:"Synthetic Chromium, SAME origin /test folder with isolated DB/cache",steps,errors},null,2));
 }finally{if(context)await context.close();if(browser)await browser.close();server.close()}
})().catch(e=>{console.error("TEST_FOLDER_FAILURE",e.stack||e);process.exitCode=1;server.close()});
