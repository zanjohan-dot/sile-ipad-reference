/* Browser acceptance smoke (Chromium or WebKit). Synthetic dataset ONLY.
 * Requires 'playwright' package and an installed Chrome/Chromium executable.
 * This test does not import, transmit, or write real SILE course materials.
 */
"use strict";
const fs=require("node:fs"),http=require("node:http"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const ROOT=path.resolve(__dirname,"..");
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const dataset=require("./synthetic-fixture.js");
assert.equal(dataset.subjects.reduce((n,s)=>n+s.questions.length,0),323);
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent((req.url||"/").split("?")[0]);
 // Test both the GitHub project path and a distinct staging origin at root.
 const stageHost=(req.headers.host||"").split(":")[0]==="localhost";
 if(!url.startsWith("/sile-ipad-reference/")&&!stageHost){res.writeHead(404);res.end();return}
 let rel=url.startsWith("/sile-ipad-reference/")?url.slice("/sile-ipad-reference/".length):
   (stageHost?url.slice(1):"");
 rel=rel||"index.html";
 const file=path.resolve(ROOT,rel);
 if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{"Content-Type":TYPES[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});
 fs.createReadStream(file).pipe(res);
});
function check(condition,message){assert.ok(condition,message)}
async function run(){
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 const isWebKit=process.env.BROWSER_ENGINE==="webkit";
 const executable=process.env.CHROME_BIN||"/usr/bin/google-chrome";
 const browser=isWebKit?await webkit.launch({headless:true}):
   await chromium.launch({headless:true,executablePath:executable,args:["--no-sandbox","--disable-dev-shm-usage"]});
 // Approximate iPad portrait touch interaction in Linux WebKit. This is NOT iPadOS Safari.
 const context=await browser.newContext(isWebKit?
   {viewport:{width:820,height:1180},isMobile:true,hasTouch:true,deviceScaleFactor:2}:
   {viewport:{width:1024,height:768}});
 const page=await context.newPage(),exceptions=[];
 page.on("pageerror",e=>exceptions.push(String(e)));
 const steps=[];
 async function step(name,work){try{const r=await work();steps.push({name,status:"PASS",detail:r||""})}catch(e){steps.push({name,status:"FAIL",detail:String(e)});throw e}}
 const base="http://127.0.0.1:"+port+"/sile-ipad-reference/";
 try{
 await step("Initial browser startup",async()=>{
  await page.goto(base,{waitUntil:"load"});
  await page.locator("#importNow").waitFor({timeout:12000});
  return "No data shown; import available";
 });
 await step("User imports 323 synthetic question records",async()=>{
  await page.locator("#fileInput").setInputFiles({name:"synthetic_323.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(dataset))});
  await page.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"),null,{timeout:12000});
  check(await page.locator(".rapidHome").count()>0,"Rapid home not shown");
 });
 await step("Paper and mode navigation",async()=>{
  await page.locator('[data-mode="learn"]').click();
  await page.locator(".learnHome").waitFor();
  await page.locator('[data-paper="2"]').click();
  check((await page.locator("#contextLabel").innerText()).includes("Paper 2"),"Paper 2 not selected");
  await page.locator('[data-paper="1"]').click();
  await page.locator('[data-mode="rapid"]').click();
  await page.locator(".rapidHome").waitFor();
 });
 await step("Ask and source-grounded question search",async()=>{
  await page.locator("#searchBtn").click();
  await page.locator("#findQuery").fill("fiduciary duties");
  await page.locator("#findNow").click();
  const a=await page.locator("#findResults").innerText();
  check(a.includes("source")||a.includes("Source")||a.includes("recorded"),"Source explanation missing");
  check(await page.locator('[data-question-index]').count()>0,"Related questions absent");
  return (await page.locator('[data-question-index]').count())+" question results";
 });
 await step("All related questions and opening Rapid reference",async()=>{
  await page.locator("#showAllRelated").click();
  check((await page.locator('[data-question-index]').count())===323,"All 323 synthetic questions must be visible");
  await page.locator('[data-question-index]').first().click();
  await page.locator(".reader").waitFor();
  check((await page.locator(".reader").innerText()).includes("Recorded answer choices"),"Rapid question not opened");
  await page.locator("#backBtn").click();
  await page.locator("#findQuery").waitFor();
 });
 await step("Learn practice answer, revision flag and local persistence",async()=>{
  await page.locator('[data-mode="learn"]').click();
  await page.locator("#searchBtn").click();
  await page.locator("#findQuery").fill("fiduciary duties");
  await page.locator("#findNow").click();
  await page.locator('[data-question-index]').first().click();
  await page.locator('input[name="practiceChoice"]').first().check();
  await page.locator("#submitPractice").click();
  await page.waitForFunction(()=>document.getElementById("practiceFeedback")?.textContent.includes("saved locally"),null,{timeout:10000});
  await page.locator("#toggleQuestionReview").click();
  await page.waitForFunction(()=>document.getElementById("questionReviewStatus")?.textContent.includes("Saved to revision list"),null,{timeout:10000});
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"));
  await page.locator("#progressBtn").click();
  check((await page.locator("#screen").innerText()).includes("questions marked for revision"),"Revision progress not persisted");
 });
 await step("Offline browser PWA relaunch",async()=>{
  await page.waitForFunction(()=>'serviceWorker' in navigator && navigator.serviceWorker.controller!==null,null,{timeout:20000});
  await context.setOffline(true);
  // A fresh WebKit tab probes a separate navigation from the reload API.
  // Chrome retains the established reload regression for comparability.
  const offlineTab=isWebKit?await context.newPage():page;
  try{
   if(isWebKit)await offlineTab.goto(base,{waitUntil:"domcontentloaded",timeout:18000});
   else await offlineTab.reload({waitUntil:"domcontentloaded",timeout:18000});
   await offlineTab.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"),null,{timeout:10000});
   await offlineTab.locator("#searchBtn").click();
   await offlineTab.locator("#findQuery").fill("fiduciary duties");
   await offlineTab.locator("#findNow").click();
   check(await offlineTab.locator('[data-question-index]').count()>0,"Offline question search failed");
  }finally{
   await context.setOffline(false);
   if(isWebKit)await offlineTab.close();
  }
 });
 await step("Isolated staging origin and relative PWA manifest",async()=>{
  const stage=await context.newPage();
  try{
   await stage.goto("http://localhost:"+port+"/staging-check.html",{waitUntil:"load"});
   check(await stage.locator("#openApp").isEnabled(),"Staging gate incorrectly blocks a distinct local test origin");
   await stage.locator("#openApp").click();
   await stage.locator("#importNow").waitFor({timeout:12000});
   check(await stage.locator("#statusBtn").innerText()==="No local data","Staging unexpectedly sees first origin's study dataset");
   const manifest=await stage.evaluate(async()=>{
    const link=document.querySelector('link[rel="manifest"]');
    const url=new URL(link.getAttribute("href"),location.href);
    return {url:url.href,manifest:await (await fetch(url)).json()};
   });
   check(new URL(manifest.url).origin==="http://localhost:"+port,"Manifest resolved on wrong origin");
   check(manifest.manifest.start_url==="./"&&manifest.manifest.scope==="./","Manifest has hard-coded production path");
   const stageData=JSON.parse(JSON.stringify(dataset));
   stageData.subjects[0].questions[0].stem="STAGING_ONLY_SYNTHETIC_RECORD";
   await stage.locator("#fileInput").setInputFiles({name:"staging_synthetic.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(stageData))});
   await stage.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"),null,{timeout:12000});
   await page.reload({waitUntil:"load"});
   const productionData=await page.evaluate(async()=>{
    const db=await new Promise((ok,no)=>{const rq=indexedDB.open("sile-ipad-stage3",1);rq.onsuccess=()=>ok(rq.result);rq.onerror=()=>no(rq.error)});
    return await new Promise((ok,no)=>{const rq=db.transaction("kv").objectStore("kv").get("dataset");
      rq.onsuccess=()=>{db.close();ok(rq.result?.subjects?.[0]?.questions?.[0]?.stem)};
      rq.onerror=()=>{db.close();no(rq.error)}});
   });
   check(!productionData.includes("STAGING_ONLY_SYNTHETIC_RECORD"),"Staging import contaminated original-origin local data");
   return "Distinct localhost and 127.0.0.1 browser origins retain different IndexedDB data";
  } finally {await stage.close()}
 });
 assert.equal(exceptions.length,0,"Uncaught browser JavaScript errors: "+exceptions.join("; "));
 console.log(JSON.stringify({verdict:"PASS",environment:isWebKit?"Linux WebKit touch emulation, synthetic dataset (NOT iPadOS)":"GitHub Actions headless Chrome, synthetic dataset",questions:323,steps,exceptions},null,2));
 } finally {await context.setOffline(false);await context.close();await browser.close();server.close()}
}
run().catch(e=>{console.error("BROWSER_SMOKE_FAILED:",e.stack||e);process.exitCode=1;server.close()});
