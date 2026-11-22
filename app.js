const DBNAME="sile-ipad-stage3",STORE="kv";
let db,DATA=null,flat=[],paper=1,subject="",mode="rapid",typeFilter="",lastResults=[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const asList=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]);

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DBNAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function get(k){return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(k,v){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(v,k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function toast(t){const x=$("#toast");x.textContent=t;x.style.display="block";setTimeout(()=>x.style.display="none",1800)}
function qCount(){return DATA?DATA.subjects.reduce((n,s)=>n+asList(s.questions).length,0):0}
function status(){$("#statusBtn").textContent=DATA?`Offline • ${qCount()} questions`:"No data"}

function flatten(){
 flat=[];
 for(const s of DATA.subjects){
  const base={paper:s.paper,code:s.code,subject:s.subject};
  const add=(arr,type,title,text)=>{for(const x of asList(arr))flat.push({...base,type,title:title(x),text:text(x),obj:x})};
  add(s.rules,"RULE",x=>x.title||x.id||"Rule",x=>[x.rule,x.when,x.triggers,x.exception,x.deadline,x.procedure,x.trap,x.source,x.detail,x.verify].join(" "));
  add(s.deadlines,"DEADLINE",x=>x.title||x.what||x.id||"Deadline",x=>JSON.stringify(x));
  add(s.procedures,"PROCEDURE",x=>x.title||x.name||x.id||"Procedure",x=>JSON.stringify(x));
  add(s.questions,"QUESTION",x=>`${x.label||"Question"}${x.qno?" • Q"+x.qno:""}`,x=>[x.stem,Object.values(x.options||{}).join(" "),x.explanation,x.tested_rule,x.trap,x.authority,x.course_material,x.answer_basis].join(" "));
  add(s.traps,"TRAP",x=>x.title||x.trap||x.id||"Exam trap",x=>JSON.stringify(x));
  add(s.open_issues,"OPEN ISSUE",x=>x.title||x.id||"Open issue",x=>JSON.stringify(x));
  for(const t of asList(s.teach?.topics))flat.push({...base,type:"LESSON",title:t.name||t.title||"Lesson",text:JSON.stringify(t),obj:t});
 }
}

function stats(s){return{questions:asList(s.questions).length,rules:asList(s.rules).length,deadlines:asList(s.deadlines).length,lessons:asList(s.teach?.topics).length}}

function renderSubjects(){
 const n=$("#subjects");n.innerHTML="";
 if(!DATA)return;
 const all=document.createElement("button");all.textContent=`All Paper ${paper}`;all.className="allSubjects"+(subject===""?" active":"");
 all.onclick=()=>{subject="";$("#search").value="";renderSubjects();renderOverview()};
 n.appendChild(all);
 for(const s of DATA.subjects.filter(x=>x.paper===paper)){
  const b=document.createElement("button");b.textContent=s.subject;b.classList.toggle("active",s.code===subject);
  b.onclick=()=>{subject=s.code;$("#search").value="";renderSubjects();renderSubject(s)};
  n.appendChild(b);
 }
 $("#contextLabel").textContent=`Paper ${paper} • ${mode==="rapid"?"Rapid Reference":"Learning Mode"}`;
}

function setScreen(html){$("#screen").innerHTML=html;$("#workspaceBody").scrollTop=0}

function renderOverview(){
 if(!DATA){
  setScreen(`<div class="dataPanel"><div class="eyebrow">Setup</div><h1>Import verified SILE data</h1><p>Import the verified JSON once. It will then be stored locally on this iPad.</p><div class="row"><button class="primaryBtn" id="importNow">Choose JSON file</button></div></div>`);
  $("#importNow").onclick=()=>$("#fileInput").click();return;
 }
 const subs=DATA.subjects.filter(s=>s.paper===paper),tq=subs.reduce((n,s)=>n+asList(s.questions).length,0),tr=subs.reduce((n,s)=>n+asList(s.rules).length,0),td=subs.reduce((n,s)=>n+asList(s.deadlines).length,0);
 setScreen(`<div class="paperHero"><div class="eyebrow">Paper ${paper}</div><h1>${mode==="rapid"?"Rapid Reference":"Learning Mode"}</h1><p>Choose a subject below, or search across this paper using the search bar above.</p><div class="quickStats"><div class="stat"><b>${tq}</b>questions</div><div class="stat"><b>${tr}</b>rules</div><div class="stat"><b>${td}</b>deadlines</div></div><div class="subjectGrid">${subs.map(s=>{const st=stats(s);return `<button class="subjectCard" data-code="${esc(s.code)}"><b>${esc(s.subject)}</b><span>${st.questions} questions • ${st.rules} rules • ${st.deadlines} deadlines</span></button>`}).join("")}</div></div>`);
 $$(".subjectCard").forEach(b=>b.onclick=()=>{subject=b.dataset.code;renderSubjects();renderSubject(DATA.subjects.find(x=>x.code===subject))});
}

function renderSubject(s){
 const st=stats(s);
 setScreen(`<div class="subjectHero"><div class="eyebrow">Paper ${paper}</div><h1>${esc(s.subject)}</h1><p>Choose a category below or search within this subject.</p><div class="quickStats"><button class="stat" data-quick="QUESTION"><b>${st.questions}</b>questions</button><button class="stat" data-quick="RULE"><b>${st.rules}</b>rules</button><button class="stat" data-quick="DEADLINE"><b>${st.deadlines}</b>deadlines</button><button class="stat" data-quick="LESSON"><b>${st.lessons}</b>lessons</button></div></div>`);
 $$("[data-quick]").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.quick;syncFilterChips();runSearch(true)});
}

function norm(s){return String(s||"").toLowerCase().normalize("NFKD")}
function rank(it,q){if(!q)return 1;let sc=0;for(const t of norm(q).split(/\s+/).filter(Boolean)){if(norm(it.title).includes(t))sc+=8;if(norm(it.text).includes(t))sc+=2}return sc}

function runSearch(force=false){
 if(!DATA)return;
 const q=$("#search").value.trim();
 if(!q&&!force){subject?renderSubject(DATA.subjects.find(x=>x.code===subject)):renderOverview();return}
 let a=flat.filter(x=>x.paper===paper&&(!subject||x.code===subject)&&(!typeFilter||x.type===typeFilter));
 if(mode==="learn")a=a.filter(x=>["LESSON","QUESTION","RULE"].includes(x.type));
 if(q)a=a.map(x=>[rank(x,q),x]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
 else{const p={RULE:1,QUESTION:2,DEADLINE:3,TRAP:4,PROCEDURE:5,LESSON:6,"OPEN ISSUE":7};a.sort((x,y)=>(p[x.type]||9)-(p[y.type]||9))}
 lastResults=a.slice(0,200);renderResults(lastResults,q);
}

function renderResults(a,q){
 setScreen(`<div class="resultsHeader"><div><div class="eyebrow">${subject?esc(DATA.subjects.find(s=>s.code===subject)?.subject||"Subject"):`Paper ${paper}`}</div><h1>${typeFilter?esc(typeFilter[0]+typeFilter.slice(1).toLowerCase()):"Results"}</h1></div><div class="resultsCount">${a.length}${a.length===200?"+":""} results</div></div><div class="resultsList">${a.length?a.map((it,i)=>`<button class="result" data-i="${i}"><div class="rhead"><span class="rtype">${esc(it.type)}</span><span class="rsub">${esc(it.subject)}</span></div><h3>${esc(it.title)}</h3><p>${esc(it.text).slice(0,260)}</p></button>`).join(""):`<div class="emptyHint">No matching material found.</div>`}</div>`);
 $$(".result").forEach(b=>b.onclick=()=>show(lastResults[+b.dataset.i]));
}

function card(t,v,cls=""){if(v==null||v===""||(Array.isArray(v)&&!v.length))return"";return `<section class="card ${cls}">${t?`<h2>${esc(t)}</h2>`:""}<p>${esc(typeof v==="string"?v:JSON.stringify(v,null,2))}</p></section>`}
function badges(q){const s=(q.answer_status||"").toUpperCase();let h=s==="OFFICIAL"?'<span class="badge official">OFFICIAL SILE ANSWER</span>':s==="DERIVED"?'<span class="badge derived">DERIVED — NOT OFFICIAL</span>':s.includes("UNRESOLVED")?'<span class="badge unresolved">UNRESOLVED</span>':"";if((q.answer_basis||"").includes("SOURCE CONFLICT")||(q.notes||"").includes("SOURCE CONFLICT"))h+='<span class="badge sourceconflict">SOURCE CONFLICT</span>';return h}

function show(it){
 const o=it.obj;let h=`<button class="backBtn" id="backBtn">← Back to results</button><div class="crumb">Paper ${it.paper} / ${esc(it.subject)} / ${esc(it.type)}</div><h1>${esc(it.title)}</h1>`;
 if(it.type==="QUESTION"){h+=badges(o)+card("Question",o.stem,"rule");if(o.options)h+=`<section class="card"><h2>Options</h2><div class="options">${Object.entries(o.options).map(([k,v])=>`<div class="option"><b>${esc(k)}.</b> ${esc(v)}</div>`).join("")}</div></section>`;h+=card("Answer",o.answer?`${o.answer} — ${o.answer_status||""}`:"No settled answer")+card("Why",o.explanation||o.official_explanation)+card("Answer basis",o.answer_basis,"source")+card("Tested rule",o.tested_rule,"rule")+card("Trap",o.trap,"trap")+card("Course material",o.course_material,"source")+card("Authority",o.authority,"source")+card("Contact Session guidance",o.cs_guidance,"source")+card("Notes",o.notes)}
 else if(it.type==="RULE"){h+=card("Rule",o.rule,"rule")+card("When it applies",o.when)+card("Triggers",o.triggers)+card("Exception",o.exception,"exception")+card("Deadline",o.deadline)+card("Procedure",o.procedure)+card("Exam trap",o.trap,"trap")+card("Source",o.source,"source")+card("Verify",o.verify,"trap")+card("Detail",o.detail)}
 else if(it.type==="LESSON"){for(const [k,v] of Object.entries(o))if(!["id","name","title"].includes(k)&&v!=null&&v!=="")h+=`<details class="lessonBlock"><summary>${esc(k.replaceAll("_"," "))}</summary><div>${card("",v)}</div></details>`}
 else{for(const [k,v] of Object.entries(o))if(k!=="id"&&v!=null&&v!=="")h+=card(k.replaceAll("_"," "),v,k.includes("trap")?"trap":k.includes("source")?"source":"")}
 setScreen(h);$("#backBtn").onclick=()=>renderResults(lastResults,$("#search").value.trim());
}

function syncFilterChips(){$$(".filterChip").forEach(x=>x.classList.toggle("active",x.dataset.filter===typeFilter))}
function tools(){if(!DATA)return;let h='<div class="eyebrow">Reference tools</div><h1>Tools & calculators</h1><div class="toolsGrid">';for(const s of DATA.subjects.filter(x=>x.paper===paper))for(const [id,x] of Object.entries(s.teach?.calculators||{}))h+=`<div class="toolCard"><div class="rtype">${esc(s.code)} • ${esc(id)}</div><h3>${esc(x.title||id)}</h3><p>${esc(x.why||x.interpret||"Calculator or decision aid from the verified dataset.")}</p></div>`;h+="</div>";setScreen(h)}
function dataPanel(){setScreen(`<div class="dataPanel"><div class="eyebrow">Local data</div><h1>Data & offline status</h1><p><b>${qCount()} questions</b> are stored locally on this iPad.</p><div class="row"><button class="primaryBtn" id="replaceData">Replace verified JSON</button><button class="secondaryBtn" id="backupData">Export backup</button></div><div class="dataNote">The GitHub site contains only the app shell. Your imported SILE dataset remains local to this iPad.</div></div>`);$("#replaceData").onclick=()=>$("#fileInput").click();$("#backupData").onclick=backup}

async function importFile(f){const o=JSON.parse(await f.text());if(!Array.isArray(o.subjects)||o.subjects.length!==8)throw Error("Expected 8-subject SILE dataset");const q=o.subjects.reduce((n,s)=>n+asList(s.questions).length,0);if(q!==323)throw Error(`Dataset question count mismatch: expected 323, found ${q}`);await put("dataset",o);DATA=o;flatten();subject="";typeFilter="";status();renderSubjects();syncFilterChips();renderOverview();toast("Verified dataset stored locally")}
async function backup(){if(!DATA)return toast("No data to export");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(DATA)],{type:"application/json"}));a.download="SILE_iPad_dataset_backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

async function init(){
 await openDB();DATA=await get("dataset");if(DATA)flatten();status();renderSubjects();syncFilterChips();renderOverview();
 $$("[data-paper]").forEach(b=>b.onclick=()=>{paper=+b.dataset.paper;subject="";typeFilter="";$("#search").value="";$$("[data-paper]").forEach(x=>x.classList.toggle("active",x===b));renderSubjects();syncFilterChips();renderOverview()});
 $$("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));renderSubjects();subject?renderSubject(DATA.subjects.find(x=>x.code===subject)):renderOverview()});
 $$(".filterChip").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.filter;syncFilterChips();runSearch(true)});
 $("#search").oninput=()=>runSearch(false);
 $("#toolsBtn").onclick=tools;$("#dataBtn").onclick=dataPanel;$("#statusBtn").onclick=dataPanel;
 $("#fileInput").onchange=async e=>{const f=e.target.files&&e.target.files[0];try{if(f)await importFile(f)}catch(err){alert("Import failed: "+err.message)}finally{e.target.value=""}};
 if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
}
init();