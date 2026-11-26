/* Local evidence retrieval. No network calls, generated answers, or persistent question storage. */
(function(){
"use strict";
const STOP=new Set("the a an and or but on at in is are was were this that which what with from by to for as of it if can may should would then when where how why have has had be been into does do you your their they we such not only under section act rule company singapore person persons more less question correct following statement statements".split(" "));
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tokens=s=>String(s||"").toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g)?.filter(w=>w.length>1&&!STOP.has(w))||[];
let lastText="",lastMatches=[],lastSubjectScope=false,lastAll=true;
function open(it){
 subject=it.code;paper=it.paper;document.querySelectorAll("[data-paper]").forEach(b=>b.classList.toggle("active",Number(b.dataset.paper)===paper));renderSubjects();updateContext();
 if(it.type==="RULE")openRule(it.obj);
 else if(it.type==="DEADLINE")openDeadline(it.obj);
 else if(it.type==="TRAP")openTrap(it.obj);
 else if(it.type==="PROCEDURE")openProcedure(it.obj);
 else if(it.type==="LESSON")openLesson(it.topicId);
 else if(it.type==="QUESTION")openQuestion(it.obj);
 const back=document.getElementById("backBtn");if(back)back.onclick=()=>render(true);
}
function evidence(){
 if(!DATA)return [];
 const all=flat.filter(x=>(lastAll||x.paper===paper)&&(!lastSubjectScope||!subject||x.code===subject));
 const qq=new Set(tokens(lastText));if(!qq.size)return [];
 const docs=all.map(it=>({it,ti:new Set(tokens(it.title)),tx:new Set(tokens([it.text,it.title,it.subject,it.code,it.obj?.id,it.obj?.qno,it.obj?.sitting,it.obj?.category,it.obj?.topic,it.obj?.source,JSON.stringify(it.obj?.options||{})].join(" ")))}));
 const df=new Map();for(const x of docs)for(const t of new Set([...x.ti,...x.tx]))df.set(t,(df.get(t)||0)+1);
 const n=docs.length,out=[];
 for(const x of docs){

  let score=0,matched=[];
  for(const t of qq){if(!x.ti.has(t)&&!x.tx.has(t))continue;const idf=Math.log(1+(n+1)/(1+(df.get(t)||0)));score+=(x.ti.has(t)?6:2)*idf;matched.push(t)}
  if(!matched.length)continue;
  if(x.it.type==="QUESTION"){score+=12;const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();const stem=norm(x.it.obj?.stem),q=norm(lastText);if(stem&&(q===stem||q.includes(stem)))score+=100000;else if(q&&stem.includes(q))score+=100;}
  if(["DEADLINE","PROCEDURE"].includes(x.it.type))score*=1.12;
  if(String(x.it.title).toLowerCase().includes(lastText.toLowerCase()))score+=6;
  score*=1+.06*Math.max(0,matched.length-1);
  out.push({...x.it,score,matched});
 }
 return out.sort((a,b)=>b.score-a.score);
}
function show(){
 const box=document.getElementById("findResults");if(!box)return;
 lastMatches=evidence();
 if(!lastText.trim()){box.innerHTML='<div class="emptyHint">Enter key facts, a legal term, or a statutory reference to find verified material.</div>';return}
 if(!lastMatches.length){box.innerHTML='<div class="emptyHint">No local references matched. Try fewer terms, or disable the subject-only filter. No answer has been inferred.</div>';return}
 const hits=lastMatches;
 let tools="";
 if(window.SILETOOLS?.ready&&window.CALCS){
  const a=window.CALCS.filter(c=>{
   if(!lastAll&&DATA.subjects.find(s=>s.code===c.code)?.paper!==paper)return false;
   if(lastSubjectScope&&subject&&c.code!==subject)return false;
   try{return c.detect&&new RegExp(c.detect,"i").test(lastText)}catch(e){return false}
  }).slice(0,5);
  if(a.length)tools='<h2 class="sectionTitle">Matching calculators</h2><div class="toolLaunchGrid">'+a.map(c=>'<button class="toolLaunch" data-find-calc="'+E(c.id)+'"><strong>'+E(c.title)+'</strong><small>'+E(c.what).slice(0,180)+'</small></button>').join("")+'</div>';
 }
 const category=x=>x.type==="QUESTION"?(/sample/i.test([x.obj?.category,x.obj?.sitting,x.obj?.label,x.obj?.source].join(" "))?"SILE Sample Questions":"Past-Year Questions"):x.type==="LESSON"?"Learning Materials":"Legal References";
 box.innerHTML='<div class="listHeader"><h2>Search results</h2><div class="listCount">'+hits.length+' matches</div></div>'+["Past-Year Questions","SILE Sample Questions","Learning Materials","Legal References"].map(g=>{
 const rows=hits.map((x,i)=>({x,i})).filter(({x})=>category(x)===g);
 return '<section class="readSection"><h2>'+E(g)+' ('+rows.length+')</h2>'+rows.map(({x,i})=>'<button class="contentRow" data-find-index="'+i+'"><div class="rowTop"><span class="rowType">'+E(x.type)+'</span><span class="rowMeta">'+E(x.subject)+'</span></div><div class="rowTitle">'+E(x.title)+'</div><div class="rowExcerpt">'+E(x.type==="QUESTION"?x.obj.stem:x.text).slice(0,350)+'</div><div class="sourceMeta">'+E(x.obj?.sitting||"")+' '+E(x.obj?.answer_status||"")+'</div></button>').join("")+'</section>';
 }).join("")+tools+'<div class="dataNote">Similar wording does not mean identical facts or answers. Check original facts and provenance.</div>';
 document.querySelectorAll("[data-find-index]").forEach(el=>el.onclick=()=>open(hits[Number(el.dataset.findIndex)]));
 document.querySelectorAll("[data-find-calc]").forEach(el=>el.onclick=()=>window.SILETOOLS.openCalc(el.dataset.findCalc));
}
function render(preserve=false){
 if(!DATA)return;
 document.body.classList.remove("focusMode");
 if(!preserve){lastText="";lastAll=true;lastSubjectScope=false}
 const rev=mode==="learn";
 setScreen('<div class="findPage"><div class="eyebrow">Local reference finder · '+(rev?"REVISION":"RAPID REFERENCE")+'</div><h1 class="pageTitle">Search</h1><p class="pageLead">'+(rev?"Ask a question in everyday English. Search finds local source material first, then can explain it with the downloaded on-device model — no internet required after successful installation and caching.":"Look up rules, deadlines, procedures and source references quickly. This mode does not generate answers.")+'</p><div class="searchPanel"><label class="findLabel" for="findQuery">Legal issue or key facts</label><textarea id="findQuery" rows="3" placeholder="e.g. 50 people private placement prospectus exemption"></textarea><div class="findControls"><label><input id="findSubjectOnly" type="checkbox" '+(lastSubjectScope?"checked":"")+'> This subject only</label><label><input id="findAllPapers" type="checkbox" '+(lastAll?"checked":"")+'> Include other paper</label><button id="findNow" class="secondaryButton">Find sources</button>'+(rev?'<button id="findExplainNow" class="primaryButton">Find & explain</button>':'')+'</div></div><div id="findResults" class="searchResults"></div>'+(rev?'<div id="modelPanel" class="localSearchSetup"></div>':'')+'</div>');
 document.getElementById("findQuery").value=lastText;
 document.getElementById("findQuery").oninput=e=>{lastText=e.target.value;show()};
 document.getElementById("findNow").onclick=show;
 if(rev&&document.getElementById("findExplainNow")){
   document.getElementById("findExplainNow").onclick=()=>{
     show();
     const ai=window.SILELOCALMODEL;
     const details=document.getElementById("modelSection");
     if(details)details.open=true;
     if(!lastMatches.length)return;
     if(ai?.ready)ai.explain();
     else{
       const status=document.getElementById("modelStatus");
       if(status)status.textContent="A local model is not yet installed. Choose the compact model and tap Download / load model. Search sources are available below.";
       details?.scrollIntoView({block:"nearest",behavior:"smooth"});
     }
   };
 }
 document.getElementById("findSubjectOnly").onchange=e=>{lastSubjectScope=e.target.checked;show()};
 document.getElementById("findAllPapers").onchange=e=>{lastAll=e.target.checked;show()};
 if(rev&&window.SILELOCALMODEL)window.SILELOCALMODEL.panel();
 if(lastText)show();
}
async function aiStatus(){
 document.body.classList.remove("focusMode");
 setScreen('<div class="dataPanel"><div class="eyebrow">Revision prototype · no model installed</div><h1 class="pageTitle">Offline AI readiness</h1><p>Safari 26 can support WebGPU, but this SILE app does not yet contain an installed or tested on-device language model. Verified calculators and the local reference finder do work without AI.</p><div class="dataActions"><button id="checkGpu" class="primaryButton">Check iPad capability</button><button id="findInstead" class="secondaryButton">Open reference finder</button></div><div id="gpuResult" class="readSection" aria-live="polite">Not checked</div><div class="dataNote">AI answer generation is disabled for examination use. A future revision-only model needs a downloaded model, grounded retrieval, privacy checks and a successful airplane-mode test.</div></div>');
 document.getElementById("findInstead").onclick=()=>render();
 document.getElementById("checkGpu").onclick=async()=>{
  const box=document.getElementById("gpuResult");box.textContent="Checking WebGPU and local storage…";
  try{
   const gpu=!!navigator.gpu,adapter=gpu?await navigator.gpu.requestAdapter():null;
   const store=await(navigator.storage?.estimate?navigator.storage.estimate():Promise.resolve({}));
   const free=store.quota!=null&&store.usage!=null?((store.quota-store.usage)/1e9).toFixed(2)+" GB estimated free quota":"Unknown";
   box.innerHTML="<h2>Device capability</h2><p>WebGPU API: "+(gpu?"Available":"Not available")+"<br>GPU adapter: "+(adapter?"Available":"Unavailable")+"<br>Estimated remaining storage quota: "+free+"<br>Local language model: <strong>NOT INSTALLED</strong><br>Offline AI generation: <strong>NOT VERIFIED</strong></p>";
  }catch(e){box.textContent="Capability test failed: "+String(e)}
 };
}
window.SILEFIND={render,aiStatus,refreshEvidence:(q)=>{if(typeof q==="string"){lastText=q;const el=document.getElementById("findQuery");if(el)el.value=q;}else{lastText=document.getElementById("findQuery")?.value?.trim()||lastText;}show();return lastMatches;},get lastMatches(){return lastMatches}};
})();