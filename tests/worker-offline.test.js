/* Run with: node tests/worker-offline.test.js */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
const listeners={};
const js={kind:"javascript"},html={kind:"html"},missing={kind:"network-error"};
const cache={match:async key=>{
 const k=typeof key==="string"?key:key.url;
 if(k==="/sile-ipad-reference/app.js")return js;
 if(k==="./index.html")return html;
 return undefined;
},put:async()=>{}};
const context={
 self:{location:{origin:"https://zanjohan-dot.github.io"},addEventListener:(name,fn)=>listeners[name]=fn},
 caches:{open:async()=>cache,match:async()=>undefined,keys:async()=>[]},
 fetch:async()=>{throw new Error("Simulated offline")},
 Response:{error:()=>missing},
 URL
};
vm.runInNewContext(source,context,{filename:"sw.js"});
function request(url,mode,destination){
 return new Promise((resolve,reject)=>listeners.fetch({
  request:{url,method:"GET",mode,destination},
  respondWith:r=>Promise.resolve(r).then(resolve,reject)
 }));
}
(async()=>{
 assert.equal(await request("https://zanjohan-dot.github.io/sile-ipad-reference/app.js?build=20261123b","no-cors","script"),js,
  "Versioned JavaScript must resolve to precached unversioned JS offline");
 assert.equal(await request("https://zanjohan-dot.github.io/sile-ipad-reference/missing.js","no-cors","script"),missing,
  "A missing script must never return HTML");
 assert.equal(await request("https://zanjohan-dot.github.io/sile-ipad-reference/missing-page","navigate","document"),html,
  "A navigation may use offline HTML fallback");
 console.log("PASS worker-offline: versioned JS fallback, missing script failure, navigation fallback.");
})().catch(e=>{console.error(e);process.exitCode=1});
