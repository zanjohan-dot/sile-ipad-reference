/* Local evidence retrieval. No network calls, generated answers, or persistent question storage. */
(function(){
"use strict";
const STOP=new Set("the a an and or but on at in is are was were this that which what with from by to for as of it if can may should would then when where how why have has had be been into does do you your their they we such not only under section act rule persons more less question correct following statement statements".split(" "));
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ALIASES={directors:"director",duties:"duty",companies:"company",appeals:"appeal",trademarks:"trademark",questions:"question",acquisitions:"acquisition",shares:"share",remedies:"remedy",transactions:"transaction"};
const tokens=s=>(String(s||"").toLowerCase().replace(/trade[ -]+marks/g,"trademark").match(/[a-z0-9]+(?:\.[0-9]+)?/g)||[])
 .map(w=>ALIASES[w]||((w.length>4&&w.endsWith("ies"))?w.slice(0,-3)+"y":(w.length>4&&w.endsWith("s")&&!w.endsWith("ss")&&!w.endsWith("us")?w.slice(0,-1):w)))
 .filter(w=>w.length>1&&!STOP.has(w));
let lastText="",lastMatches=[],lastSubjectScope=false,lastAll=true;
let cachedFlat=null,cachedDocs=[];
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
 // Pre-tokenise each record once per imported dataset, including the FULL
 // question explanation rather than silently discarding words past token 320.
 if(cachedFlat!==flat){
  cachedFlat=flat;
  cachedDocs=flat.map(it=>({it,ti:new Set(tokens(it.title)),tx:new Set(tokens(it.text))}));
 }
 const allowed=new Set(all);
 const docs=cachedDocs.filter(row=>allowed.has(row.it));
 const df=new Map();for(const x of docs)for(const t of new Set([...x.ti,...x.tx]))df.set(t,(df.get(t)||0)+1);
 const n=docs.length,out=[];
 for(const x of docs){
  // Question records must be searchable in Rapid and Learn alike.
  let score=0,matched=[];
  for(const t of qq){if(!x.ti.has(t)&&!x.tx.has(t))continue;const idf=Math.log(1+(n+1)/(1+(df.get(t)||0)));score+=(x.ti.has(t)?6:2)*idf;matched.push(t)}
  if(!matched.length)continue;
  if(x.it.type==="RULE")score*=1.3;
  if(["DEADLINE","PROCEDURE"].includes(x.it.type))score*=1.12;
  if(String(x.it.title).toLowerCase().includes(lastText.toLowerCase()))score+=6;
  score*=1+.06*Math.max(0,matched.length-1);
  out.push({...x.it,score,matched});
 }
 return out.sort((a,b)=>b.score-a.score);
}
function sourceLabel(it){
 const o=it?.obj||{};
 return o.source||o.authority||o.course_material||o.example?.source||"Exact source not recorded; consult original materials";
}
function sourceExtract(it){
 if(!it)return '<div class="dataNote">No suitable source explanation was found. Related questions, if any, are listed below. The app has not inferred an answer.</div>';
 const x=it.obj||{},bits=[];
 function part(label,value){
  if(typeof value!=="string"||!value.trim())return;
  bits.push('<p><strong>'+E(label)+':</strong> '+E(value).slice(0,1200)+'</p>');
 }
 if(it.type==="RULE"){
  part("Recorded rule",x.rule);part("When it applies",x.when);
  part("Exceptions",x.exception);part("Deadline",x.deadline);
 }else if(it.type==="DEADLINE"){
  part("Action",x.action);part("Recorded deadline",x.deadline);
  part("Starting point",x.start);part("Exception",x.exception);part("Consequence",x.consequence);
 }else if(it.type==="LESSON"){
  part("Plain-English explanation",x.big_picture);part("Basic rule",x.basic_rule);
  part("Exam application",x.exam_application);
 }else if(it.type==="PROCEDURE"){
  for(const [i,st] of (Array.isArray(x.steps)?x.steps:[]).slice(0,5).entries()){
   part("Step "+(i+1),st.step);part("Deadline for step "+(i+1),st.deadline);
  }
 }else if(it.type==="TRAP"){part("Exam trap",x.trap);part("Recorded rule",x.rule)}
 return '<section class="readSection"><div class="eyebrow">Source-based extract — NOT generative AI</div>'+
  '<h2>Relevant explanation from your local materials</h2><p class="readerMeta">'+E(it.subject)+' · '+E(it.title)+'</p>'+
  (bits.join("")||'<p>No directly extractable rule is recorded. Open the matching material to review it.</p>')+
  '<p class="sourceMeta"><strong>Recorded source:</strong> '+E(sourceLabel(it))+'</p>'+
  '<button id="openBestSource" type="button" class="secondaryButton">Open full source record</button>'+
  '<p class="dataNote">This is a source excerpt, not a conclusion on your facts. Verify exceptions, the underlying authority and the latest audited answer status. The imported November 8 dataset has not been cleared for final release.</p></section>';
}
function show(){
 const box=document.getElementById("findResults");if(!box)return;
 if(!lastText.trim()){
  lastMatches=[];box.innerHTML='<div class="emptyHint">Enter a legal issue, statutory provision or a question in everyday English.</div>';return;
 }
 const scored=evidence();
 const sources=scored.filter(it=>it.type!=="QUESTION").slice(0,12);
 const questions=scored.filter(it=>it.type==="QUESTION").slice(0,12);
 // Related questions may use different words from the rule. Resolve them using
 // the explicit subject/topic mapping in the imported verified JSON.
 const related=new Set(sources.slice(0,6).map(it=>it.code+":"+(it.obj?.topic||it.topicId||"")));
 const used=new Set(questions.map(it=>it.obj?.id));
 for(const it of flat){
  if(questions.length>=12)break;
  if(it.type!=="QUESTION"||used.has(it.obj?.id))continue;
  if(!lastAll&&it.paper!==paper)continue;
  if(lastSubjectScope&&subject&&it.code!==subject)continue;
  if(!it.obj?.topic||!related.has(it.code+":"+it.obj.topic))continue;
  questions.push({...it,score:0,matched:[],topicLinked:true});
  used.add(it.obj.id);
 }
 const questionIntent=/\b(question|questions|exam|practice|mcq|option|options|which answer|why is [a-d])\b/i.test(lastText);
 // The local AI receives the first seven evidence items. A request about
 // examination options must include question records, not just rule cards.
 lastMatches=questionIntent?[...questions.slice(0,4),...sources.slice(0,8),...questions.slice(4)]:
    [...sources.slice(0,4),...questions.slice(0,4),...sources.slice(4),...questions.slice(4)];
 if(!sources.length&&!questions.length){
  box.innerHTML='<div class="emptyHint">No relevant local record was found. Try shorter terms, another subject or a statute number. No answer has been invented.</div>';return;
 }
 const best=sources.find(it=>["RULE","DEADLINE","LESSON","PROCEDURE","TRAP"].includes(it.type));
 const sourceRows=sources.map((it,i)=>'<button type="button" class="contentRow" data-source-index="'+i+'">'+
   '<div class="rowTop"><span class="rowType">'+E(it.type)+'</span><span class="rowMeta">'+E(it.subject)+'</span></div>'+
   '<div class="rowTitle">'+E(it.title)+'</div><div class="rowExcerpt">'+E(it.text).slice(0,260)+'</div>'+
   '<div class="sourceMeta">Recorded source: '+E(sourceLabel(it))+'</div></button>').join("");
 const qRows=questions.map((it,i)=>{
   const st=String(it.obj?.answer_status||"").toUpperCase();
   const label=st==="OFFICIAL"?"OFFICIAL key, verify audit":st==="DERIVED"?"DERIVED, not official":
      st==="UNRESOLVED"?"UNRESOLVED, not scored":st==="EXCLUDED"?"EXCLUDED, not scored":"Status uncertain, not scored";
   return '<button type="button" class="contentRow" data-question-index="'+i+'">'+
    '<div class="rowTop"><span class="rowType">QUESTION · '+E(it.obj?.id||it.title)+'</span><span class="rowMeta">'+E(it.subject)+'</span></div>'+
    '<div class="rowTitle">'+E(it.obj?.stem||it.title).slice(0,220)+'</div>'+
    '<div class="readerMeta">'+E(label)+(it.topicLinked?" · Related by topic":" · Matches your terms")+'</div></button>';
 }).join("");
 const qSection='<section class="readSection"><h2>Related examination questions ('+questions.length+')</h2>'+
   (qRows||'<p>No matching examination question was found. Check the subject or alter the query.</p>')+'</section>';
 const srcSection='<section class="readSection"><h2>Supporting source records ('+sources.length+')</h2>'+
   (sourceRows||'<p>No source record was retrieved for this query.</p>')+'</section>';
 box.innerHTML=sourceExtract(best)+(questionIntent?qSection+srcSection:srcSection+qSection)+
 '<p class="dataNote">Source retrieval is not AI reasoning. A matching phrase is not proof that a rule applies. No answers have been generated or graded by this search.</p>';
 const openBest=box.querySelector("#openBestSource");
 if(openBest&&best)openBest.onclick=()=>open(best);
 box.querySelectorAll("[data-source-index]").forEach(b=>b.onclick=()=>open(sources[Number(b.dataset.sourceIndex)]));
 box.querySelectorAll("[data-question-index]").forEach(b=>b.onclick=()=>open(questions[Number(b.dataset.questionIndex)]));
}
function render(preserve=false){
 if(!DATA)return;
 document.body.classList.remove("focusMode");
 if(!preserve){lastText="";lastAll=true;lastSubjectScope=false}
 const rev=mode==="learn";
 setScreen('<div class="findPage"><div class="eyebrow">Local reference finder · '+(rev?"REVISION":"RAPID REFERENCE")+'</div><h1 class="pageTitle">Search</h1><p class="pageLead">'+(rev?"Ask a question in everyday English. Search finds local source material first, then can explain it with the downloaded on-device model — no internet required after successful installation and caching.":"Find recorded source explanations and related examination questions. Source extraction works offline; it is not an AI-generated answer.")+'</p><div class="searchPanel"><label class="findLabel" for="findQuery">Legal issue or key facts</label><textarea id="findQuery" rows="3" placeholder="e.g. 50 people private placement prospectus exemption"></textarea><div class="findControls"><label><input id="findSubjectOnly" type="checkbox" '+(lastSubjectScope?"checked":"")+'> This subject only</label><label><input id="findAllPapers" type="checkbox" '+(lastAll?"checked":"")+'> Search both papers</label><button id="findNow" class="secondaryButton">Find sources and questions</button>'+(rev?'<button id="findExplainNow" class="primaryButton">Find & explain</button>':'')+'</div></div><div id="findResults" class="searchResults"></div>'+(rev?'<div id="modelPanel" class="localSearchSetup"></div>':'')+'</div>');
 document.getElementById("findQuery").value=lastText;
 document.getElementById("findQuery").oninput=e=>{lastText=e.target.value};
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