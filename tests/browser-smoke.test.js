/* Headless Chromium acceptance smoke. Synthetic dataset ONLY.
 * Requires 'playwright' package and an installed Chrome/Chromium executable.
 * This test does not import, transmit, or write real SILE course materials.
 */
"use strict";
const fs=require("node:fs"),http=require("node:http"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
const ROOT=path.resolve(__dirname,"..");
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const dataset={meta:{built:"synthetic-browser-smoke"},subjects:Array.from({length:8},(_,i)=>{
 const code=["BF","CG","ICR","ADM","IP","MA","COMP","TAX"][i],topic=code+"-T01";
 const n=i===0?41:i===7?36:41; // 41*7 + 36 = 323
 return {code,paper:i<4?1:2,subject:"Synthetic "+code,topics:[{id:topic,name:"Fiduciary duties and corporate procedure"}],
  teach:{topics:{[topic]:{big_picture:"This is a synthetic explanation for testing navigation.",basic_rule:"Never treat this as a real legal rule."}}},
  rules:[{id:code+"-RULE",topic,title:"Fiduciary duties and corporate procedure",rule:"An officer should act loyally in this fictional example.",source:"Synthetic test material"}],
  deadlines:[],procedures:[],traps:[],
  questions:Array.from({length:n},(_,j)=>({
    id:code+"-Q"+(j+1),topic,stem:"Which fictional officer followed the synthetic fiduciary rule? "+(j+1),
    options:{A:"Option Alpha",B:"Option Beta",C:"Option Gamma",D:"Option Delta"},
    answer_status:j===0?"OFFICIAL":"UNRESOLVED",answer:j===0?"A":"",
    option_expl:{A:"Test option only"},explanation:"Synthetic explanation for browser test."
  }))};
})};
assert.equal(dataset.subjects.reduce((n,s)=>n+s.questions.length,0),323);
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent((req.url||"/").split("?")[0]);
 if(!url.startsWith("/sile-ipad-reference/")){res.writeHead(404);res.end();return}
 let rel=url.slice("/sile-ipad-reference/".length)||"index.html";
 const file=path.resolve(ROOT,rel);
 if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{"Content-Type":TYPES[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});
 fs.createReadStream(file).pipe(res);
});
function check(condition,message){assert.ok(condition,message)}
async function run(){
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 const executable=process.env.CHROME_BIN||"/usr/bin/google-chrome";
 const browser=await chromium.launch({headless:true,executablePath:executable,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1024,height:768}});
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
 await step("Actual Chromium offline PWA relaunch",async()=>{
  await page.waitForFunction(()=>'serviceWorker' in navigator && navigator.serviceWorker.controller!==null,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded",timeout:18000});
  await page.waitForFunction(()=>document.getElementById("statusBtn")?.textContent.includes("323 questions"),null,{timeout:10000});
  await page.locator("#searchBtn").click();
  await page.locator("#findQuery").fill("fiduciary duties");
  await page.locator("#findNow").click();
  check(await page.locator('[data-question-index]').count()>0,"Offline question search failed");
  await context.setOffline(false);
 });
 assert.equal(exceptions.length,0,"Uncaught browser JavaScript errors: "+exceptions.join("; "));
 console.log(JSON.stringify({verdict:"PASS",environment:"GitHub Actions headless Chrome, synthetic dataset",questions:323,steps,exceptions},null,2));
 } finally {await context.setOffline(false);await context.close();await browser.close();server.close()}
}
run().catch(e=>{console.error("BROWSER_SMOKE_FAILED:",e.stack||e);process.exitCode=1;server.close()});
