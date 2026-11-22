/* SILE private tool runner. No course-derived engine or model is bundled in GitHub. */
(function(){
"use strict";
const EXPECTED_SHA="17a0f825f5ac7c8a735def842d28b07d969a7104b6383dc82f0eb1321d83204b";
const STORE_KEY="sile_private_tools_2026_11_08";
let loaded=false, testResult=null, current=null, answers={};
const E=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const items=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]);
function mark(){return loaded?"<span class='badge official'>LOCAL ENGINE READY</span>":"<span class='badge unresolved'>ENGINE NOT INSTALLED</span>"}
function notify(s){if(typeof toast==="function")toast(s)}
async function digest(s){const data=new TextEncoder().encode(s);const a=new Uint8Array(await crypto.subtle.digest("SHA-256",data));return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("")}
function inject(src){return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([src],{type:"text/javascript"}));const el=document.createElement("script");
  el.onload=()=>{URL.revokeObjectURL(url);el.remove();resolve()};
  el.onerror=()=>{URL.revokeObjectURL(url);el.remove();reject(new Error("iPad blocked the local JavaScript package"))};
  el.src=url;document.head.appendChild(el);
})}
function runTests(){
 let count=0,errors=[];
 for(const c of window.CALCS||[])for(const t of c.tests||[]){
   count++;const r=window.CK.run(c,t.in||{});
   for(const [key,expected] of Object.entries(t.expect||{})){
     const ok=key==="error"?Boolean(r.error)===Boolean(expected):JSON.stringify(r[key])===JSON.stringify(expected);
     if(!ok){errors.push(c.id+" / "+t.name+" / "+key);break}
   }
 }
 return {count,errors};
}
async function loadCode(code){
 if(await digest(code)!==EXPECTED_SHA)throw new Error("This is not the approved private tools package (SHA-256 mismatch). Nothing was executed.");
 await inject(code);
 if(!window.CALCS||window.CALCS.length!==53||!window.DTOOLS||window.DTOOLS.length!==16||!window.CK||!window.DT)throw new Error("Tools package did not initialise correctly");
 testResult=runTests();
 if(testResult.count!==488||testResult.errors.length)throw new Error("Calculator self-tests failed: "+testResult.errors.slice(0,3).join("; "));
 loaded=true;
}
async function restore(){
 try{const code=await dbGet(STORE_KEY);if(code)await loadCode(code)}
 catch(err){loaded=false;console.error("SILE local tools",err)}
}
async function importFile(f){
 const code=await f.text();
 await loadCode(code);
 await dbPut(STORE_KEY,code);
 notify("53 calculators and 16 decision tools installed locally; 488 tests passed");
 showCatalog();
}
function showCatalog(){
 if(typeof currentSubject==="function"&&currentSubject()){activeTab="tools";renderSubjectDashboard();return}
 if(typeof renderTools==="function")renderTools();
}
function picker(){
 const f=document.createElement("input");f.type="file";f.accept=".js,text/javascript";
 f.style.position="absolute";f.style.left="-9999px";document.body.appendChild(f);
 f.onchange=async()=>{const v=f.files&&f.files[0];try{if(v)await importFile(v)}catch(e){alert("Private tools import failed: "+e.message)}finally{f.remove()}};
 f.click();
}
function catalog(code){
 const a=loaded?window.CALCS.filter(x=>x.code===code):[];
 const d=loaded?window.DTOOLS.filter(x=>x.code===code):[];
 const install='<div class="privateInstall"><p><strong>Private tools package:</strong> '+mark()+'</p>'+
  (loaded?'<p>53 calculators / 16 legal decision tools · '+testResult.count+' passing tests · locally stored on this iPad.</p>':
  '<p>Import the private SILE tools file from Files once. The GitHub app contains no private formulas, source materials or legal decision rules.</p>')+
  '<button class="primaryButton" id="privateEngineImport">'+(loaded?"Replace private tools package":"Import private tools package")+'</button></div>';
 if(!loaded){
   return install+'<p class="dataNote">The old Tools screen listed descriptions without running calculations. Importing the verified private package enables real inputs, validation, workings and decision trees. No information is uploaded.</p>';
 }
 const calc=a.map(x=>'<button class="toolLaunch" data-calc="'+E(x.id)+'"><span class="rowType">CALCULATOR · '+E(x.id)+'</span><strong>'+E(x.title)+'</strong><small>'+E(x.what||x.formula||"")+'</small></button>').join("");
 const dec=d.map(x=>'<button class="toolLaunch" data-decision="'+E(x.id)+'"><span class="rowType">LEGAL DECISION TOOL · '+E(x.id)+'</span><strong>'+E(x.short||x.head)+'</strong><small>'+E(x.desc||"")+'</small></button>').join("");
 return install+'<h2 class="sectionTitle">Calculators ('+a.length+')</h2><div class="toolLaunchGrid">'+(calc||"<p>None for this subject.</p>")+'</div>'+
 '<h2 class="sectionTitle">Guided legal tests ('+d.length+')</h2><div class="toolLaunchGrid">'+(dec||"<p>None for this subject.</p>")+'</div>';
}
function bind(){
 const b=document.getElementById("privateEngineImport");if(b)b.onclick=picker;
 document.querySelectorAll("[data-calc]").forEach(x=>x.onclick=()=>openCalc(x.dataset.calc));
 document.querySelectorAll("[data-decision]").forEach(x=>x.onclick=()=>openDecision(x.dataset.decision));
}
function focus(){
 document.body.classList.add("focusMode");
}
function header(title,sub){
 return '<div class="focusHeader"><button class="backButton" id="toolBack">← Back to tools</button></div>'+
 '<div class="readerMeta">'+E(sub||"Private offline tool")+'</div><h1 class="pageTitle">'+E(title)+'</h1>';
}
function backBind(){const b=document.getElementById("toolBack");if(b)b.onclick=()=>{document.body.classList.remove("focusMode");showCatalog()}}
function set(html){
 if(typeof setScreen==="function")setScreen('<div class="reader">'+html+'</div>');
 else document.getElementById("screen").innerHTML=html;
 backBind();
}
function inputField(f){
 const id="calc_"+f.k,label=E(f.label),unit=E(f.unit||"");
 let field="";
 if(f.unit==="choice"){
   field='<select id="'+E(id)+'" name="'+E(f.k)+'"><option value="">Choose…</option>'+
     items(f.options).map(o=>'<option value="'+E(o[0])+'">'+E(o[1])+'</option>').join("")+'</select>';
 } else {
   field='<input id="'+E(id)+'" name="'+E(f.k)+'" type="text" autocomplete="off"'+
     (f.unit==="date"?' placeholder="DD/MM/YYYY"':f.unit==="text"?'':' inputmode="decimal"')+
     (f.optional?' placeholder="Optional"':'')+'>';
 }
 return '<label class="calcField" for="'+E(id)+'"><span>'+label+'</span>'+field+'<small>'+unit+(f.optional?" · Optional":"")+'</small></label>';
}
function lines(v){
 if(!v&&v!==0)return "";
 return Array.isArray(v)?'<ol class="numberedList">'+v.map(x=>'<li>'+E(x)+'</li>').join("")+'</ol>':'<p>'+E(v)+'</p>';
}
function panel(title,value,cls){
 if(value==null||value===""||(Array.isArray(value)&&!value.length))return "";
 return '<section class="readSection '+(cls||"")+'"><h2>'+E(title)+'</h2>'+lines(value)+'</section>';
}
function openCalc(id){
 if(!loaded)return showCatalog();
 const c=window.CALCS.find(x=>x.id===id);if(!c)return;
 current={kind:"calculator",id};focus();
 let fields=items(c.inputs).map(inputField).join("");
 let fixed=items(c.fixed).map(f=>'<li>'+E(f.label)+': <strong>'+E(f.value)+'</strong> '+E(f.unit||"")+
   (f.verify?' <span class="badge derived">VERIFY THRESHOLD</span>':'')+
   (f.source?'<div class="readerMeta">'+E(f.source)+'</div>':'')+'</li>').join("");
 set(header(c.title,c.code+' · '+c.id)+
   '<p class="pageLead">'+E(c.what||"")+'</p>'+
   '<div class="provenanceStrip"><span class="badge official">DETERMINISTIC LOCAL CALCULATOR</span><span class="badge derived">COURSE MATERIALS — VERIFY CURRENT LAW</span></div>'+
   '<form id="calcForm" class="calcForm">'+fields+'<div class="dataActions"><button type="submit" class="primaryButton">Calculate</button><button type="reset" class="secondaryButton">Clear</button></div></form>'+
   '<div id="calcOutput" aria-live="polite"></div>'+
   panel("Formula",c.formula)+panel("Exam trap",c.trap,"trap")+
   (fixed?'<details class="readSection"><summary><strong>Fixed figures and verification flags</strong></summary><ul class="bulletList">'+fixed+'</ul></details>':"")+
   panel("Source",c.source)+panel("Legal rule",c.rule)+panel("Rounding",c.rounding));
 document.getElementById("calcForm").onsubmit=e=>{
   e.preventDefault();const raw={};
   for(const f of c.inputs||[]){const el=document.getElementById("calc_"+f.k);raw[f.k]=el?el.value:""}
   const r=window.CK.run(c,raw);const out=document.getElementById("calcOutput");
   if(r.error){out.innerHTML=panel("Input correction needed",r.error,"trap");return}
   out.innerHTML=panel("Calculated result",r.answer,"answer")+panel("Working steps",r.working,"rule")+panel("Important notes",r.notes,"trap");
   out.scrollIntoView({behavior:"smooth",block:"nearest"});
 };
 document.getElementById("calcForm").onreset=()=>{document.getElementById("calcOutput").innerHTML=""};
}
function choiceStep(step){
 if(step.type==="yesno"){
  return [["yes","Yes"],["no","No"],["unknown","Not stated / unknown"]]
 }
 return step.options||[];
}
function openDecision(id){
 if(!loaded)return showCatalog();
 const t=window.DTOOLS.find(x=>x.id===id);if(!t)return;
 current={kind:"decision",id};answers={};focus();stepView(t);
}
function stepView(t){
 const v=Object.assign({},answers),state=window.DT.evaluate(t,v);
 let html=header(t.head||t.short,t.code+" · "+t.id)+
   '<p class="pageLead">'+E(t.desc||"")+'</p><div class="provenanceStrip"><span class="badge derived">GUIDED LEGAL TEST — VERIFY FACTS</span><span class="badge neutral">'+E(t.confidence||"")+" CONFIDENCE</span></div>";
 const recorded=Object.entries(answers).map(([k,val])=>'<li>'+E(k)+': '+E(val)+'</li>').join("");
 if(recorded)html+='<details class="readSection"><summary>Facts supplied ('+Object.keys(answers).length+')</summary><ul class="bulletList">'+recorded+'</ul></details>';
 if(state.error)html+=panel("Tool could not complete",state.error,"trap");
 else if(state.result){
   const r=state.result;
   html+=panel("Conclusion",r.conclusion||r.answer||"No conclusion recorded","answer")+
     panel("Decision route",r.route,"rule")+panel("Why",r.why)+panel("Missing facts",r.missing,"trap")+
     panel("Facts",r.facts)+panel("Notes",r.notes,"trap");
 }else if(state.next){
   const st=state.next;
   html+='<section class="readSection"><h2>Next fact needed</h2><p>'+E(st.q||st.label||"Provide the fact")+'</p>'+
     (st.help?'<p class="readerMeta">'+E(st.help)+'</p>':"")+
     '<form id="decisionForm" class="calcForm">'+
     (st.type==="choice"||st.type==="yesno"?
       '<label class="calcField"><span>Select the fact</span><select id="decisionAnswer" required><option value="">Choose…</option>'+
       choiceStep(st).map(x=>'<option value="'+E(x[0])+'">'+E(x[1])+'</option>').join("")+'</select></label>':
       '<label class="calcField"><span>Your answer</span><input id="decisionAnswer" autocomplete="off" type="text"'+
       (st.type==="number"?' inputmode="decimal"':'')+' required></label>')+
     '<button type="submit" class="primaryButton">Continue</button></form></section>';
 }
 html+='<div class="dataActions"><button id="decisionRestart" class="secondaryButton">Start over</button></div>'+
   panel("Source",t.source||"");
 set(html);
 const form=document.getElementById("decisionForm");
 if(form&&state.next)form.onsubmit=e=>{
   e.preventDefault();const val=document.getElementById("decisionAnswer").value.trim();if(!val)return;
   answers[state.next.k]=val;stepView(t)
 };
 const restart=document.getElementById("decisionRestart");if(restart)restart.onclick=()=>{answers={};stepView(t)};
}
window.SILETOOLS={restore,importFile,picker,catalog,bind,openCalc,openDecision,get ready(){return loaded},get tests(){return testResult}};
})();