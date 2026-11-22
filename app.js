const DBNAME='sile-ipad-stage3';
const STORE='kv';
let db=null;
let DATA=null;
let flat=[];
let paper=1;
let subject='';
let mode='rapid';
let activeTab='overview';
let searchType='';
let lastList=[];
let previousView=null;
let studyProgress={version:1,topics:{},questions:{}};
let currentQuestion=null;
let referenceCategory='RULE';

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const asList=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DBNAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function dbGet(k){return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbPut(k,v){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
function toast(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',1800)}
function setScreen(html){$('#screen').innerHTML='<div class="screenInner">'+html+'</div>';$('#screen').scrollTop=0}
function currentSubject(){return DATA?DATA.subjects.find(s=>s.code===subject):null}
function topicMeta(s,id){return asList(s&&s.topics).find(t=>t.id===id)||null}
function questionCount(){return DATA?DATA.subjects.reduce((n,s)=>n+asList(s.questions).length,0):0}
function updateStatus(){$('#statusBtn').textContent=DATA?'Local data · '+questionCount()+' questions':'No local data'}
function updateContext(){const s=currentSubject();const m=mode==='rapid'?'Rapid':'Learn';$('#contextLabel').textContent=s?'Paper '+paper+' - '+s.subject+' - '+m:'Paper '+paper+' - '+m}

// Local change-detection marker for the answer and question actually attempted.
// Not a cryptographic signature or an official legal-content verification.
function questionRevision(q){
 const canonical=JSON.stringify([q.id,q.stem,q.options,q.answer_status,q.answer,q.answer_basis]);
 let h=2166136261;
 for(let i=0;i<canonical.length;i++)h=Math.imul(h^canonical.charCodeAt(i),16777619);
 return "local-v1-"+(h>>>0).toString(16);
}
function flatten(){
 flat=[];
 DATA.subjects.forEach(s=>{
  const base={paper:s.paper,code:s.code,subject:s.subject};
  const str=v=>Array.isArray(v)?v.join(" "):typeof v==="string"?v:"";
  asList(s.rules).forEach(x=>flat.push({...base,type:"RULE",title:x.title||x.id||"Rule",
   text:[x.topic,topicMeta(s,x.topic)?.name,x.rule,x.when,x.triggers,x.exception,x.deadline,x.procedure,x.trap,x.source,x.detail].map(str).join(" "),obj:x}));
  asList(s.deadlines).forEach(x=>flat.push({...base,type:"DEADLINE",title:x.action||x.title||"Deadline",
   text:[x.topic,topicMeta(s,x.topic)?.name,x.deadline,x.action,x.start,x.exception,x.consequence,x.source].map(str).join(" "),obj:x}));
  asList(s.procedures).forEach(x=>flat.push({...base,type:"PROCEDURE",title:x.title||"Procedure",
   text:[x.topic,topicMeta(s,x.topic)?.name,asList(x.steps).map(st=>[st.step,st.party,st.precondition,st.document,st.deadline,st.consequence,st.source].map(str).join(" ")).join(" ")].map(str).join(" "),obj:x}));
  asList(s.traps).forEach(x=>flat.push({...base,type:"TRAP",title:x.trap||x.title||"Exam trap",
   text:[x.topic,topicMeta(s,x.topic)?.name,x.attractive,x.rule,x.spot,x.source].map(str).join(" "),obj:x}));
  asList(s.topics).forEach(meta=>{
   const x=s.teach?.topics?.[meta.id]||{};
   flat.push({...base,type:"LESSON",title:meta.name||meta.id||"Lesson",
    text:[meta.common_term,meta.formal_term,x.big_picture,x.who,x.when,x.basic_rule,x.exam_application,x.exam_trap_plain,
      ...asList(x.core_concepts).map(t=>[t.term,t.plain,t.legal].map(str).join(" "))].map(str).join(" "),
    obj:x,topicId:meta.id});
  });
  asList(s.questions).forEach(x=>flat.push({...base,type:"QUESTION",title:(x.id||"Question")+" · "+(x.label||"Question")+(x.qno?" · Q"+x.qno:""),
   text:[x.topic,topicMeta(s,x.topic)?.name,x.subtopic,x.stem,Object.values(x.options||{}).join(" "),
     Object.values(x.option_expl||{}).join(" "),x.explanation,x.official_explanation,x.tested_rule,
     x.really_testing,x.answer_basis,x.key_clue,x.fastest_route,x.trap,x.common_mistake,
     x.authority,x.course_material,x.cs_guidance,x.notes,x.keywords].map(str).join(" "),obj:x}));
 });
}

function renderSubjects(){
  const nav=$('#subjects');nav.innerHTML='';
  if(!DATA)return;
  const all=document.createElement('button');
  all.textContent='All Paper '+paper;
  all.className='allSubjects'+(subject===''?' active':'');
  all.onclick=()=>{subject='';activeTab='overview';document.body.classList.remove('focusMode');renderSubjects();updateContext();renderPaperDashboard();document.body.classList.remove('navOpen')};
  nav.appendChild(all);
  DATA.subjects.filter(s=>s.paper===paper).forEach(s=>{
    const b=document.createElement('button');b.textContent=s.subject;b.classList.toggle('active',s.code===subject);
    b.onclick=()=>{subject=s.code;activeTab='overview';document.body.classList.remove('focusMode');renderSubjects();updateContext();renderSubjectDashboard();document.body.classList.remove('navOpen')};
    nav.appendChild(b);
  });
}

function paperStats(subs){return{q:subs.reduce((n,s)=>n+asList(s.questions).length,0),r:subs.reduce((n,s)=>n+asList(s.rules).length,0),d:subs.reduce((n,s)=>n+asList(s.deadlines).length,0),t:subs.reduce((n,s)=>n+asList(s.traps).length,0)}}
function subjectStats(s){return{q:asList(s.questions).length,r:asList(s.rules).length,d:asList(s.deadlines).length,t:asList(s.traps).length,l:asList(s.teach&&s.teach.topics).length}}

function renderPaperDashboard(){
 if(!DATA)return renderSetup();
 const subs=DATA.subjects.filter(s=>s.paper===paper),st=paperStats(subs);
 if(mode==='learn'){
  const totals=subs.reduce((a,s)=>{a.lessons+=asList(s.topics).length;a.done+=asList(s.topics).filter(t=>studyProgress.topics?.[t.id]?.state==='understood').length;return a;},{lessons:0,done:0});
  const cards=subs.map(s=>{
    const t=asList(s.topics),done=t.filter(x=>studyProgress.topics?.[x.id]?.state==='understood').length,
      needs=t.filter(x=>studyProgress.topics?.[x.id]?.state==='needs-review').length;
    const next=t.find(x=>studyProgress.topics?.[x.id]?.state!=='understood');
    return '<button class="subjectCard learningSubjectCard" data-subject="'+esc(s.code)+'"><div class="rowType">STUDY SUBJECT</div>'+
     '<div class="subjectCardTitle">'+esc(s.subject)+'</div><div class="subjectCardMeta">'+done+'/'+t.length+' topics marked understood · '+needs+' to review</div>'+
     (next?'<div class="subjectNext">Next: '+esc(next.name||next.id)+'</div>':'<div class="subjectNext">Review and practise questions</div>')+'</button>';
  }).join('');
  setScreen('<div class="learnHome"><div class="eyebrow">Paper '+paper+' · Study mode</div>'+
   '<h1 class="pageTitle">Learn from the beginning</h1>'+
   '<p class="pageLead">Start with the everyday explanation, learn the legal rule, work through an example, then try practice questions. Study one topic at a time.</p>'+
   '<div class="studyProgressTop"><div><strong>'+totals.done+' / '+totals.lessons+'</strong><span> topics marked understood</span></div>'+
   '<div class="progressTrack" role="progressbar" aria-valuemin="0" aria-valuemax="'+totals.lessons+'" aria-valuenow="'+totals.done+'"><span style="width:'+(totals.lessons?Math.round(totals.done*100/totals.lessons):0)+'%"></span></div></div>'+
   '<h2 class="sectionTitle">Choose your next subject</h2><div class="subjectGrid">'+cards+'</div></div>');
 }else{
  const cards=subs.map(s=>{const x=subjectStats(s);return '<button class="subjectCard" data-subject="'+esc(s.code)+'"><div class="rowType">QUICK REFERENCE</div>'+
   '<div class="subjectCardTitle">'+esc(s.subject)+'</div><div class="subjectCardMeta">'+x.r+' rules · '+x.d+' deadlines · '+x.q+' question records</div></button>'}).join('');
  setScreen('<div class="rapidHome"><div class="eyebrow">Paper '+paper+' · Rapid mode</div>'+
   '<h1 class="pageTitle">Find the rule. Check the deadline.</h1><p class="pageLead">Use concise source material without opening a full lesson. Search by a key phrase or choose a subject for essential rules, deadlines and traps.</p>'+
   '<button id="rapidSearchHome" class="primaryButton quickFind">Search this paper</button>'+
   '<div class="paperStats"><div class="statPill"><strong>'+st.r+'</strong>rules</div>'+
   '<div class="statPill"><strong>'+st.d+'</strong>deadlines</div>'+
   '<div class="statPill"><strong>'+st.t+'</strong>traps</div>'+
   '<div class="statPill"><strong>'+st.q+'</strong>question records</div></div>'+
   '<h2 class="sectionTitle">Jump to a subject</h2><div class="subjectGrid">'+cards+'</div></div>');
  $('#rapidSearchHome').onclick=()=>window.SILEFIND.render();
 }
 $$('.subjectCard[data-subject]').forEach(b=>b.onclick=()=>{
   subject=b.dataset.subject;activeTab='overview';referenceCategory='RULE';
   renderSubjects();updateContext();renderSubjectDashboard();document.body.classList.remove('navOpen');
 });
}
function renderSubjectDashboard(){
 const s=currentSubject();if(!s)return renderPaperDashboard();
 const st=subjectStats(s);
 const rapid=mode==='rapid';
 const tabs=rapid?
 [['overview','Essentials'],['rules','Rules'],['deadlines','Deadlines'],['procedures','Procedures'],['traps','Traps'],['questions','Question lookup'],['tools','Tools']]:
 [['overview','My study plan'],['learn','Lessons'],['questions','Practice'],['reference','Reference'],['tools','Tools']];
 if(!tabs.some(t=>t[0]===activeTab))activeTab='overview';
 const tabHtml=tabs.map(t=>'<button data-tab="'+t[0]+'" class="'+(activeTab===t[0]?'active':'')+'" aria-current="'+(activeTab===t[0]?'page':'false')+'">'+t[1]+'</button>').join('');
 let body='';
 if(activeTab==='overview')body=rapid?renderRapidEssentials(s):renderLearningPlan(s);
 if(activeTab==='learn')body=renderLearnList(s);
 if(activeTab==='questions')body=renderQuestionList(s);
 if(activeTab==='reference')body=renderReferenceHub(s);
 if(activeTab==='rules')body=renderGenericList(s,'RULE',asList(s.rules));
 if(activeTab==='deadlines')body=renderGenericList(s,'DEADLINE',asList(s.deadlines));
 if(activeTab==='procedures')body=renderGenericList(s,'PROCEDURE',asList(s.procedures));
 if(activeTab==='traps')body=renderGenericList(s,'TRAP',asList(s.traps));
 if(activeTab==='tools')body=renderToolsContent(s);
 setScreen('<div class="subjectHeader '+(rapid?'rapidSubject':'learningSubject')+'"><div class="subjectHeaderTop"><div>'+
  '<div class="eyebrow">Paper '+paper+' / '+(rapid?'Fast reference':'Beginner study')+'</div>'+
  '<h1 class="pageTitle">'+esc(s.subject)+'</h1><p class="pageLead">'+
  (rapid?'Find a verified rule or procedure quickly; citations and answer provenance remain visible.':
   'One topic at a time: understand the idea, see the example, check yourself and practise.')+
  '</p></div><div class="subjectStats"><div class="statPill"><strong>'+(rapid?st.r:st.l)+'</strong>'+(rapid?'rules':'lessons')+'</div>'+
  '<div class="statPill"><strong>'+st.q+'</strong>questions</div></div></div>'+
  '<div class="tabBar" role="navigation" aria-label="'+(rapid?'Rapid reference':'Learning')+' sections">'+tabHtml+'</div></div>'+body);
 $$('.tabBar button').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;renderSubjectDashboard()});
 $$('[data-nav-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.navTab;renderSubjectDashboard()});
 $$('[data-start-lesson]').forEach(b=>b.onclick=()=>openLesson(b.dataset.startLesson));
 $$('[data-ref-category]').forEach(b=>b.onclick=()=>{referenceCategory=b.dataset.refCategory;renderSubjectDashboard()});
 const rs=$('#subjectSearchNow');if(rs)rs.onclick=()=>window.SILEFIND.render();
 bindRows();
}

function renderRapidEssentials(s){
 return '<div class="modeIntro quickMode"><div class="eyebrow">Rapid reference · concise facts</div>'+
 '<h2>Get to the point</h2><p>No lessons or progress tracking in this mode. Go directly to the rule, relevant deadline, procedure or exam trap.</p>'+
 '<button class="primaryButton" id="subjectSearchNow">Search within '+esc(s.subject)+'</button></div>'+
 renderSubjectOverview(s);
}
function renderLearningPlan(s){
 const topics=asList(s.topics),done=topics.filter(t=>studyProgress.topics?.[t.id]?.state==='understood'),
 weak=topics.filter(t=>studyProgress.topics?.[t.id]?.state==='needs-review'),
 next=weak[0]||topics.find(t=>studyProgress.topics?.[t.id]?.state!=='understood')||topics[0];
 const count=topics.length,percent=count?Math.round(100*done.length/count):0;
 return '<div class="modeIntro learnMode"><div class="eyebrow">Learn · start from zero</div>'+
 '<h2>Understand → Example → Check yourself → Practise</h2>'+
 '<p>You do not need prior knowledge. Each topic starts with everyday English before introducing legal terms, rules and exam questions.</p>'+
 '<div class="studyProgressTop"><strong>'+done.length+'/'+count+' topics understood</strong>'+
 '<div class="progressTrack" role="progressbar" aria-valuemin="0" aria-valuemax="'+count+'" aria-valuenow="'+done.length+'"><span style="width:'+percent+'%"></span></div>'+
 (weak.length?'<span class="reviewCount">'+weak.length+' topics marked for revision</span>':'')+'</div>'+
 (next?'<div class="nextLesson"><div class="eyebrow">'+(weak.length?'Review this topic':'Start or continue here')+'</div>'+
 '<h3>'+esc(next.name||next.id)+'</h3><p>'+esc(s.teach?.topics?.[next.id]?.big_picture||'Open this topic to start learning from the beginning.')+'</p>'+
 '<button class="primaryButton" data-start-lesson="'+esc(next.id)+'">Start lesson</button></div>':'<p>No lessons in this subject.</p>')+
 '</div><div class="learningShortcuts"><button data-nav-tab="learn" class="learnShortcut"><strong>Study all lessons</strong><small>Plain-English lessons with examples</small></button>'+
 '<button data-nav-tab="questions" class="learnShortcut"><strong>Practice questions</strong><small>Choose an answer, then learn from the explanation</small></button>'+
 '<button data-nav-tab="reference" class="learnShortcut"><strong>Look up the law</strong><small>Rules, deadlines, procedures and traps</small></button></div>';
}
function renderReferenceHub(s){
 const types=[['RULE','Rules',s.rules],['DEADLINE','Deadlines',s.deadlines],['PROCEDURE','Procedures',s.procedures],['TRAP','Exam traps',s.traps]];
 const current=types.find(x=>x[0]===referenceCategory)||types[0];
 return '<div class="listHeader"><div><div class="eyebrow">Learn · Supporting reference</div><h2>Explore the source material</h2></div></div>'+
 '<p class="pageLead">Read the lesson first if the legal terminology is unfamiliar. Use this library to verify specific rules and exceptions.</p>'+
 '<div class="referenceFilters">'+types.map(([key,label,list])=>'<button data-ref-category="'+key+'" class="'+(current[0]===key?'active':'')+'">'+label+' ('+asList(list).length+')</button>').join('')+'</div>'+
 renderGenericList(s,current[0],asList(current[2]));
}

function renderSubjectOverview(s){
  const last=asList(s.lastminute).slice(0,3);
  const rules=asList(s.rules).filter(x=>x.priority==='P1').slice(0,4);
  const deadlines=asList(s.deadlines).slice(0,4);
  const traps=asList(s.traps).slice(0,4);
  const memory=last.length?last.map(x=>'<li>'+esc(asList(x.points).join(' | '))+'</li>').join(''):'<li>Use the Rules, Deadlines and Traps tabs for the exam-critical material.</li>';
  const ruleList=rules.length?rules.map(x=>'<li>'+esc(x.title||x.rule)+'</li>').join(''):'<li>No P1 rules flagged in this subject.</li>';
  const deadlineList=deadlines.length?deadlines.map(x=>'<li><strong>'+esc(x.deadline||'Deadline')+':</strong> '+esc(x.action||x.title||'')+'</li>').join(''):'<li>No deadline entries.</li>';
  const trapList=traps.length?traps.map(x=>'<li>'+esc(x.trap||x.title||'')+'</li>').join(''):'<li>No trap entries.</li>';
  return '<h2 class="sectionTitle">Exam essentials</h2><div class="essentialsGrid"><section class="essentialBlock"><h3>Last-minute memory</h3><ul>'+memory+'</ul></section><section class="essentialBlock"><h3>Priority rules</h3><ul>'+ruleList+'</ul></section><section class="essentialBlock"><h3>Deadlines</h3><ul>'+deadlineList+'</ul></section><section class="essentialBlock"><h3>Common traps</h3><ul>'+trapList+'</ul></section></div>';
}

function renderLearnList(s){
 const metas=asList(s.topics),teach=s.teach&&s.teach.topics?s.teach.topics:{};
 const done=metas.filter(x=>studyProgress.topics[x.id]?.state==="understood").length;
 let cards=metas.map(meta=>{
  const lesson=teach[meta.id]||{},v=studyProgress.topics[meta.id],summary=lesson.big_picture||meta.common_term||"";
  const state=v?.state==="understood"?"✓ Can explain":v?.state==="needs-review"?"↻ Needs revision":"Not studied";
  return '<button class="lessonCard" data-topic="'+esc(meta.id)+'"><div class="lessonPriority">'+esc(meta.priority||"")+'</div>'+
  '<div class="lessonTitle">'+esc(meta.name||meta.id)+'</div><div class="lessonSummary">'+esc(summary).slice(0,240)+'</div>'+
  '<div class="lessonMeta">'+esc(state)+' · '+esc(meta.cs_emphasis||"")+'</div></button>';
 }).join("");
 return '<div class="listHeader"><div><div class="eyebrow">Start from zero · lessons and practice</div><h2>Learn the subject</h2></div>'+
 '<div class="listCount">'+done+' of '+metas.length+' marked understood</div></div>'+
 '<p class="pageLead">Choose one lesson. Learn the idea first, then the words, legal rule, example, exam trap and self-check. No previous knowledge is assumed.</p>'+
 '<div class="learnGrid">'+cards+'</div>';
}
function provenanceBadges(q){
  const status=String(q.answer_status||'').toUpperCase();let out='';
  if(status==='OFFICIAL')out+='<span class="badge official">OFFICIAL SILE ANSWER</span>';
  else if(status==='DERIVED')out+='<span class="badge derived">DERIVED - NOT OFFICIAL</span>';
  else if(status.includes('UNRESOLVED'))out+='<span class="badge unresolved">UNRESOLVED - NOT SCORED</span>';
  else if(status==='EXCLUDED')out+='<span class="badge unresolved">EXCLUDED - NOT SCORED</span>';
  else if(status!=='DERIVED')out+='<span class="badge unresolved">STATUS UNVERIFIED - NOT SCORED</span>';
  if(String(q.answer_basis||'').includes('SOURCE CONFLICT')||String(q.notes||'').includes('SOURCE CONFLICT'))out+='<span class="badge conflict">SOURCE CONFLICT</span>';
  if(q.confidence)out+='<span class="badge neutral">Confidence: '+esc(q.confidence)+'</span>';
  return out;
}

function renderQuestionList(s){
  const qs=asList(s.questions);
  let rows=qs.map((q,i)=>'<button class="contentRow" data-kind="question" data-index="'+i+'"><div class="rowTop"><span class="rowType">QUESTION</span><span class="rowMeta">'+esc(q.sitting||q.category||'')+'</span></div><div class="rowTitle">'+esc((q.label||'Question')+(q.qno?' - Q'+q.qno:''))+'</div><div class="rowExcerpt">'+esc(q.stem||'').slice(0,260)+'</div><div class="provenanceStrip">'+provenanceBadges(q)+'</div></button>').join('');
  return '<div class="listHeader"><div><div class="eyebrow">Question bank</div><h2>Questions</h2></div><div class="listCount">'+qs.length+' questions</div></div><div class="contentList">'+rows+'</div>';
}

function renderGenericList(s,type,items){
 const label=type==='RULE'?'Rules':type==='DEADLINE'?'Deadlines':type==='PROCEDURE'?'Procedures':'Exam traps';
 const rows=items.map((x,i)=>{
   let title="",excerpt="";
   if(type==='RULE'){title=x.title||x.id||"Rule";excerpt=x.rule||""}
   if(type==='DEADLINE'){title=x.action||x.title||"Deadline";excerpt=[x.deadline,x.start,x.consequence].filter(Boolean).join(" · ")}
   if(type==='PROCEDURE'){title=x.title||"Procedure";excerpt=window.SILEUX.procedurePreview(x)}
   if(type==='TRAP'){title=x.trap||x.title||"Exam trap";excerpt=x.rule||x.spot||x.attractive||""}
   return '<button class="contentRow" data-kind="'+type.toLowerCase()+'" data-index="'+i+'">'+
     '<div class="rowTop"><span class="rowType">'+type+'</span><span class="rowMeta">'+esc(x.topic||"")+'</span></div>'+
     '<div class="rowTitle">'+esc(title)+'</div><div class="rowExcerpt">'+esc(excerpt).slice(0,320)+'</div></button>';
 }).join("");
 return '<div class="listHeader"><div><div class="eyebrow">'+esc(s.subject)+'</div><h2>'+label+'</h2></div>'+
  '<div class="listCount">'+items.length+' items</div></div><div class="contentList">'+rows+'</div>';
}
function bindRows(){
  $$('.lessonCard').forEach(b=>b.onclick=()=>openLesson(b.dataset.topic));
  $$('.contentRow').forEach(b=>b.onclick=()=>{const s=currentSubject();const i=Number(b.dataset.index);const kind=b.dataset.kind;if(kind==='question')openQuestion(asList(s.questions)[i]);if(kind==='rule')openRule(asList(s.rules)[i]);if(kind==='deadline')openDeadline(asList(s.deadlines)[i]);if(kind==='procedure')openProcedure(asList(s.procedures)[i]);if(kind==='trap')openTrap(asList(s.traps)[i])});
  if(window.SILETOOLS)window.SILETOOLS.bind();
}

function enterFocus(){previousView={subject,activeTab};document.body.classList.add('focusMode')}
function exitFocus(){document.body.classList.remove('focusMode');renderSubjects();updateContext();renderSubjectDashboard()}
function focusHeader(){return '<div class="focusHeader"><button id="backBtn" class="backButton"><- Back</button></div>'}
function bindBack(){$('#backBtn').onclick=exitFocus}
function section(title,content,cls){if(content==null||content===''||(Array.isArray(content)&&!content.length))return'';let body=Array.isArray(content)?'<ul class="bulletList">'+content.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>'+esc(content)+'</p>';return '<section class="readSection '+(cls||'')+'"><h2>'+esc(title)+'</h2>'+body+'</section>'}

function renderRapidQuestion(q){
 const status=String(q.answer_status||"").toUpperCase();
 const incomplete=Object.keys(q.options||{}).length!==4;
 const answer=status==="OFFICIAL"||status==="DERIVED"?(q.answer||"No answer verified"):"No settled answer — not scored";
 const opts=Object.entries(q.options||{}).map(([k,v])=>'<div class="optionBox"><strong>'+esc(k)+'.</strong> '+esc(v)+'</div>').join("");
 enterFocus();
 setScreen('<div class="reader">'+focusHeader()+
 '<div class="readerMeta">Rapid question reference · '+esc(q.sitting||q.category||"Source question")+'</div>'+
 '<h1 class="pageTitle">'+esc((q.label||"Question")+(q.qno?" · Q"+q.qno:""))+'</h1>'+
 '<div class="provenanceStrip">'+provenanceBadges(q)+'</div>'+
 (incomplete?'<div class="dataNote"><strong>Source review needed:</strong> this question has '+Object.keys(q.options||{}).length+' recorded options. Verify against the original question before relying on the answer.</div>':"")+
 section("Question",q.stem,"rule")+
 '<section class="readSection"><h2>Recorded answer choices</h2><div class="optionList">'+opts+'</div></section>'+
 section("Answer status / recorded key",answer,"answer")+
 section("Rule tested",q.tested_rule,"rule")+
 section("Reasoning",q.explanation||q.official_explanation)+
 section("Exam trap",q.trap,"trap")+
 section("Answer basis",q.answer_basis,"warning")+
 section("Legal authority",q.authority)+section("Course material",q.course_material)+
 '<div class="dataNote">For attempt tracking and self-testing, switch to Learn → Practice. The recorded answer can be derived or unresolved; refer to its provenance.</div></div>');
 bindBack();
}
function openQuestion(q){
 if(mode==='rapid')return renderRapidQuestion(q);
 currentQuestion=q;
 enterFocus();
 const opts=Object.entries(q.options||{}).map(([k,v])=>'<div class="optionBox"><strong>'+esc(k)+'.</strong> '+esc(v)+'</div>').join("");
 const perOption=Object.entries(q.option_expl||{}).map(([k,v])=>
  '<div class="conceptCard"><div class="conceptTerm">Option '+esc(k)+'</div><div class="conceptPlain">'+esc(v)+'</div></div>').join("");
 const status=String(q.answer_status||"").toUpperCase();
 const safeAnswer=status==="OFFICIAL"||status==="DERIVED"?(q.answer||"No settled answer"):"No settled answer — not scored";
 const incompleteOptions=Object.keys(q.options||{}).length!==4;
 const answer='<div id="answerBlock" class="hiddenAnswer">'+
 section("Answer",safeAnswer,"answer")+
 section("What is this question really testing?",q.really_testing||q.tested_rule,"rule")+
 section("How to reason through it",q.explanation||q.official_explanation,"")+
 section("Useful factual clue",q.key_clue)+
 section("Fastest route",q.fastest_route)+section("Exam trap",q.trap,"trap")+
 (perOption?'<section class="readSection"><h2>Why each option is right or wrong</h2><div class="conceptTable">'+perOption+'</div></section>':"")+
 section("Answer status and basis",q.answer_basis,"warning")+
 section("Course material",q.course_material)+section("Contact Session guidance",q.cs_guidance)+section("Legal authority",q.authority)+
 '</div>';
 const attempt=studyProgress.questions[q.id];
 const scoreUnverified=!!(attempt?.attempts && attempt.questionRevision!==questionRevision(q));
 setScreen('<div class="reader">'+focusHeader()+
  '<div class="readerMeta">Revision practice · '+esc(q.sitting||q.category||"Question")+'</div>'+
  '<h1 class="pageTitle">'+esc((q.label||"Question")+(q.qno?" · Q"+q.qno:""))+'</h1>'+
  '<div class="provenanceStrip">'+provenanceBadges(q)+'</div>'+
  '<div class="dataNote">'+(incompleteOptions?'Source verification needed: answer options may be incomplete and this attempt will not count as official-key accuracy.':'Practice using source questions only; the recorded answer may require later reconciliation.')+'</div>'+
  section("Question",q.stem,"rule")+
  (scoreUnverified?'<div class="dataNote"><strong>Earlier attempt history retained.</strong> Previous official-key scores cannot be verified against this answer version. Reattempt the question to establish a current score.</div>':'')+
  '<section class="readSection"><h2>Choose your answer</h2>'+window.SILEUX.questionAttemptUI(q,attempt)+'</section>'+
  '<div class="studyActions"><button type="button" id="toggleQuestionReview" class="secondaryButton" aria-pressed="'+(attempt?.needsReview?'true':'false')+'">'+
  (attempt?.needsReview?'Remove from revision list':'Mark this question for revision')+'</button><span id="questionReviewStatus" class="readerMeta" role="status"></span></div>'+
  answer+'</div>');
 bindBack();
 const reveal=async(selected,record)=>{
  const submit=$('#submitPractice');
  if(record&&selected){
   if(submit)submit.disabled=true;
   const old=studyProgress.questions[q.id]||{attempts:0,officialCorrect:0};
   const revision=questionRevision(q),sameVersion=old.questionRevision===revision;
   const official=status==="OFFICIAL"&&Object.keys(q.options||{}).length===4;
   const updated={
    ...old,attempts:Number(old.attempts||0)+1,
    officialCorrect:(sameVersion?Number(old.officialCorrect||0):0)+(official&&selected===q.answer?1:0),
    officialAttempts:(sameVersion?Number(old.officialAttempts||0):0)+(official?1:0),
    lastSelected:selected,lastStatus:status,lastAttempt:new Date().toISOString(),questionRevision:revision
   };
   const proposed={...studyProgress,questions:{...studyProgress.questions,[q.id]:updated}};
   try{await dbPut('study_progress_v1',proposed);studyProgress=proposed}
   catch(err){
    console.error("Progress save failed",err);
    const feedback=$('#practiceFeedback');
    if(feedback)feedback.textContent="Attempt NOT SAVED. Please check local storage and try again. Your answer has not been graded.";
    if(submit)submit.disabled=false;
    return;
   }
  }
  const message=window.SILEUX.interpretation(q,selected);
  const feedback=$('#practiceFeedback');
  if(feedback)feedback.textContent=(record?"Attempt saved locally. ":"")+message;
  $('#answerBlock').classList.add("revealed");
  $('#answerBlock').scrollIntoView({block:"nearest"});
 };
 $('#submitPractice').onclick=async()=>{
   const selected=document.querySelector('input[name="practiceChoice"]:checked');
   if(!selected){const feedback=$('#practiceFeedback');if(feedback)feedback.textContent="Choose an answer first, or reveal without recording.";return;}
   await reveal(selected.value,true);
 };
 $('#revealWithoutAttempt').onclick=async()=>{await reveal("",false)};
 $('#toggleQuestionReview').onclick=async()=>{
   const button=$('#toggleQuestionReview'),statusBox=$('#questionReviewStatus');
   button.disabled=true;
   const old=studyProgress.questions[q.id]||{};
   const next={...old,needsReview:!old.needsReview,reviewUpdated:new Date().toISOString()};
   const updated={...studyProgress,questions:{...studyProgress.questions,[q.id]:next}};
   try{
    await dbPut('study_progress_v1',updated);studyProgress=updated;
    button.textContent=next.needsReview?"Remove from revision list":"Mark this question for revision";
    button.setAttribute("aria-pressed",String(next.needsReview));
    statusBox.textContent=next.needsReview?"Saved to revision list.":"Removed from revision list.";
   }catch(err){console.error(err);statusBox.textContent="Could not save revision flag. No change was recorded."}
   finally{button.disabled=false}
 };
}
function openRule(r){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Rule - '+esc(r.topic||'')+'</div><h1 class="pageTitle">'+esc(r.title||r.id||'Rule')+'</h1>'+section('Core rule',r.rule,'rule')+section('When it applies',r.when,'')+section('Triggers',r.triggers,'')+section('Exception',r.exception,'')+section('Deadline',r.deadline,'')+section('Procedure',r.procedure,'')+section('Exam trap',r.trap,'trap')+section('Source',r.source,'')+section('Verification note',r.verify,'warning')+section('Detail',r.detail,'')+'</div>');bindBack()}
function openDeadline(d){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Deadline - '+esc(d.topic||'')+'</div><h1 class="pageTitle">'+esc(d.action||d.title||'Deadline')+'</h1>'+section('Deadline',d.deadline,'rule')+section('Starts from',d.start,'')+section('Exception',d.exception,'')+section('Consequence',d.consequence,'trap')+section('Source',d.source,'')+'</div>');bindBack()}
function openProcedure(p){
 enterFocus();
 const s=currentSubject(),related=asList(s?.questions).filter(q=>q.topic===p.topic);
 setScreen('<div class="reader">'+focusHeader()+window.SILEUX.procedure(p,related)+'</div>');
 bindBack();
 $$('[data-related-id]').forEach(b=>b.onclick=()=>{const q=related.find(q=>q.id===b.dataset.relatedId);if(q)openQuestion(q)});
}
function openTrap(t){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Exam trap - '+esc(t.topic||'')+'</div><h1 class="pageTitle">'+esc(t.trap||t.title||'Exam trap')+'</h1>'+section('Why it is attractive',t.attractive,'')+section('Correct rule',t.rule,'rule')+section('How to spot it',t.spot,'trap')+section('Related questions',asList(t.related_q),'')+section('Source',t.source,'')+'</div>');bindBack()}

function openLesson(topicId){
 const s=currentSubject(),meta=topicMeta(s,topicId)||{},lesson=s.teach?.topics?.[topicId]||{};
 const related=asList(s.questions).filter(q=>q.topic===topicId);
 enterFocus();
 setScreen('<div class="reader">'+focusHeader()+window.SILEUX.lesson(meta,lesson,related,studyProgress.topics[topicId]||{})+'</div>');
 bindBack();
 $$('[data-related-id]').forEach(b=>b.onclick=()=>{const q=related.find(q=>q.id===b.dataset.relatedId);if(q)openQuestion(q)});
 $$('[data-study-state]').forEach(b=>b.onclick=async()=>{
  studyProgress.topics[topicId]={state:b.dataset.studyState,updated:new Date().toISOString()};
  await dbPut('study_progress_v1',studyProgress);
  const el=$('#lessonProgressStatus');if(el)el.textContent=b.dataset.studyState==="understood"?
   "Marked as understood. Now practise related questions.":"Marked for revision. Return after reviewing examples and questions.";
 });
}
function renderToolsContent(s){return window.SILETOOLS?window.SILETOOLS.catalog(s.code):'<p>Private tools unavailable.</p>'}
function renderTools(){
 if(!DATA)return;
 const s=currentSubject();if(s){activeTab='tools';renderSubjectDashboard();return}
 const subs=DATA.subjects.filter(x=>x.paper===paper);
 setScreen('<div class="paperHero"><div class="eyebrow">Private offline tools</div><h1 class="pageTitle">Calculators and guided legal tests</h1><p>Select a subject to access its locally installed calculators and decision trees. Private source data and formula code are not on GitHub.</p><div class="subjectGrid">'+subs.map(x=>'<button class="subjectCard" data-select-tools="'+esc(x.code)+'"><div class="subjectCardTitle">'+esc(x.subject)+'</div><div class="subjectCardMeta">Open subject tools</div></button>').join('')+'</div></div>');
 $$('[data-select-tools]').forEach(b=>b.onclick=()=>{subject=b.dataset.selectTools;activeTab='tools';renderSubjects();updateContext();renderSubjectDashboard()});
}

function renderSearch(){
  if(!DATA)return;
  searchType='';
  setScreen('<div class="searchPanel"><div class="eyebrow">Search</div><h1 class="pageTitle">Find material quickly</h1><input id="globalSearch" class="searchInput" type="search" autocomplete="off" placeholder="Search rule, question, deadline, trap, phrase..."><div class="searchScope"><button data-searchtype="" class="active">All</button><button data-searchtype="QUESTION">Questions</button><button data-searchtype="RULE">Rules</button><button data-searchtype="DEADLINE">Deadlines</button><button data-searchtype="PROCEDURE">Procedures</button><button data-searchtype="TRAP">Traps</button></div><div id="searchResults" class="searchResults"></div></div>');
  $('#globalSearch').focus();
  $$('.searchScope button').forEach(b=>b.onclick=()=>{searchType=b.dataset.searchtype;$$('.searchScope button').forEach(x=>x.classList.toggle('active',x===b));runGlobalSearch()});
  $('#globalSearch').oninput=runGlobalSearch;
}
function rankText(it,q){const terms=q.toLowerCase().split(/\s+/).filter(Boolean);const title=String(it.title||'').toLowerCase();const text=String(it.text||'').toLowerCase();let score=0;terms.forEach(t=>{if(title.includes(t))score+=8;if(text.includes(t))score+=2});return score}
function runGlobalSearch(){const q=$('#globalSearch').value.trim();const box=$('#searchResults');if(!q){box.innerHTML='';return}let a=flat.filter(x=>x.paper===paper&&(!subject||x.code===subject)&&(!searchType||x.type===searchType));a=a.map(x=>[rankText(x,q),x]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,100).map(x=>x[1]);lastList=a;box.innerHTML='<div class="listHeader"><h2>Results</h2><div class="listCount">'+a.length+' results</div></div><div class="contentList">'+a.map((it,i)=>'<button class="contentRow" data-searchindex="'+i+'"><div class="rowTop"><span class="rowType">'+esc(it.type)+'</span><span class="rowMeta">'+esc(it.subject)+'</span></div><div class="rowTitle">'+esc(it.title)+'</div><div class="rowExcerpt">'+esc(it.text).slice(0,260)+'</div></button>').join('')+'</div>';$$('[data-searchindex]').forEach(b=>b.onclick=()=>openSearchItem(lastList[Number(b.dataset.searchindex)]))}
function openSearchItem(it){subject=it.code;renderSubjects();updateContext();if(it.type==='QUESTION')openQuestion(it.obj);else if(it.type==='RULE')openRule(it.obj);else if(it.type==='DEADLINE')openDeadline(it.obj);else if(it.type==='PROCEDURE')openProcedure(it.obj);else if(it.type==='TRAP')openTrap(it.obj)}

function renderData(){
 const topics=Object.values(studyProgress.topics||{}),questions=Object.values(studyProgress.questions||{});
 const known=topics.filter(x=>x.state==="understood").length,needs=topics.filter(x=>x.state==="needs-review").length;
 setScreen('<div class="dataPanel"><div class="eyebrow">Offline data</div><h1 class="pageTitle">Local content and revision progress</h1>'+
 '<p><strong>'+questionCount()+' questions</strong> are stored locally in IndexedDB on this iPad. No dataset or progress is sent to GitHub.</p>'+
 '<div class="paperStats"><div class="statPill"><strong>'+known+'</strong>lessons understood</div>'+
 '<div class="statPill"><strong>'+needs+'</strong>topics for revision</div><div class="statPill"><strong>'+questions.filter(x=>Number(x.attempts||0)>0).length+'</strong>questions attempted</div></div>'+
 '<div class="dataActions"><button id="replaceData" class="primaryButton">Replace local dataset (backup first)</button>'+
 '<button id="backupData" class="secondaryButton">Export dataset backup</button>'+
 '<button id="exportProgress" class="secondaryButton">Export revision progress</button></div>'+
 '<label class="calcField"><span>Restore revision progress from backup</span><input id="progressImport" type="file" accept=".json,application/json"></label>'+
 '<div class="dataNote"><strong>Legal-content release warning:</strong> The imported 8 November dataset predates the final Taxation Contact Session and later answer-status audits. Do not mistake local availability for legal-content certification.</div>'+
 '<div class="dataNote"><strong>Exam rules:</strong> The SILE examination brief prohibits AI-powered search engines and answer-generating applications during the examinations. This app is a revision system; any exam use requires checking the permitted reference-material rules.</div>'+
 '<p class="readerMeta">The Search page can install an optional on-device explanation model for revision. Its offline relaunch has not been verified on this iPad. Semantic-embedding retrieval is not installed.</p></div>');
 $('#replaceData').onclick=()=>$('#fileInput').click();
 $('#backupData').onclick=backup;$('#exportProgress').onclick=exportStudyProgress;
 $('#progressImport').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const x=JSON.parse(await file.text());
   if(x.version!==1||!x.topics||!x.questions||Array.isArray(x.topics)||Array.isArray(x.questions))throw new Error("Invalid progress backup");
   studyProgress=x;await dbPut('study_progress_v1',studyProgress);toast("Revision progress restored");renderData()
  }catch(err){alert("Progress restore failed: "+err.message)}
 };
}
function renderProgress(){
 const topics=studyProgress.topics||{},questions=studyProgress.questions||{};
 const summaries=DATA.subjects.filter(s=>s.paper===paper).map(s=>{
  const all=asList(s.topics),understood=all.filter(t=>topics[t.id]?.state==="understood").length,
    weak=all.filter(t=>topics[t.id]?.state==="needs-review").length;
  const attempts=asList(s.questions).filter(q=>questions[q.id]);
  const official=asList(s.questions).filter(q=>q.answer_status==="OFFICIAL" &&
    questions[q.id]?.questionRevision===questionRevision(q) &&
    Object.keys(q.options||{}).length===4);
  const scored=official.reduce((n,q)=>n+Number(questions[q.id]?.officialCorrect||0),0);
  const officialAttempts=official.reduce((n,q)=>n+Number(questions[q.id]?.officialAttempts||0),0);
  const flagged=asList(s.questions).filter(q=>questions[q.id]?.needsReview).length;
  const unverified=asList(s.questions).filter(q=>questions[q.id]?.attempts && questions[q.id]?.questionRevision!==questionRevision(q)).length;
  return '<section class="readSection"><h2>'+esc(s.subject)+'</h2><p>'+understood+'/'+all.length+' lessons understood; '+weak+' topics need revision; '+attempts.filter(q=>questions[q.id]?.attempts).length+' questions attempted; '+flagged+' questions marked for revision.'+
   (officialAttempts?' Version-matched official-key attempts: '+scored+'/'+officialAttempts+'.':"")+
   (unverified?' Earlier score history retained but unverified: '+unverified+' questions.':"")+'</p></section>';
 }).join("");
 setScreen('<div class="eyebrow">Revision progress · Paper '+paper+'</div><h1 class="pageTitle">What I understand and what to revise</h1>'+
 '<p class="pageLead">Scores include only attempts against an unchanged recorded official key and complete choices. Historical attempts without a matching answer version remain saved but unscored. The older legal-content dataset remains under NO-GO review.</p>'+
 summaries+'<div class="dataActions"><button class="secondaryButton" id="exportProgressPage">Export progress</button></div>');
 $('#exportProgressPage').onclick=exportStudyProgress;
}
function exportStudyProgress(){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(studyProgress,null,2)],{type:"application/json"}));
 a.href=url;a.download="SILE_Revision_Progress_2026.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function renderSetup(){setScreen('<div class="dataPanel"><div class="eyebrow">Setup</div><h1 class="pageTitle">Import structured SILE study data</h1><p>Import structured JSON from your private source once. The dataset is then stored locally on this iPad.</p><div class="dataActions"><button id="importNow" class="primaryButton">Choose JSON file</button></div></div>');$('#importNow').onclick=()=>$('#fileInput').click()}

function validateImportedDataset(o){
 if(!o||!Array.isArray(o.subjects)||o.subjects.length!==8)throw new Error("Expected eight subject records");
 const subjectIds=new Set(),questionIds=new Set();let count=0;
 for(const s of o.subjects){
  if(!s||typeof s.code!=="string"||!s.code||subjectIds.has(s.code)||![1,2].includes(s.paper)||
     typeof s.subject!=="string"||!Array.isArray(s.questions)||!Array.isArray(s.topics)||
     !Array.isArray(s.rules)||!Array.isArray(s.deadlines)||!Array.isArray(s.procedures)||!Array.isArray(s.traps))
   throw new Error("Invalid or duplicate subject data");
  subjectIds.add(s.code);
  const topics=new Set(s.topics.map(t=>t?.id));
  for(const q of s.questions){
   count++;
   if(!q||typeof q.id!=="string"||!q.id||questionIds.has(q.id)||
      typeof q.stem!=="string"||!q.stem.trim()||
      !q.options||typeof q.options!=="object"||Array.isArray(q.options)||
      Object.keys(q.options).length<3||Object.values(q.options).some(v=>typeof v!=="string")||
      !["OFFICIAL","DERIVED","UNRESOLVED","EXCLUDED"].includes(q.answer_status)||
      (q.topic&&!topics.has(q.topic))||
      (["OFFICIAL","DERIVED"].includes(q.answer_status)&&typeof q.answer!=="string"))
    throw new Error("Invalid question, answer status or topic reference: "+(q?.id||"unknown"));
   questionIds.add(q.id);
  }
 }
 if(count!==323)throw new Error("Expected 323 questions, found "+count);
 return {subjects:subjectIds.size,questions:count};
}
async function importFile(file){
 const o=JSON.parse(await file.text());
 validateImportedDataset(o);
 if(DATA&&typeof window.confirm==="function"&&!window.confirm(
   "Replace the existing local SILE dataset? First export a dataset backup under Offline data. This action does not reset your progress, but old scores may need review after an answer-status change."))return;
 await dbPut("dataset",o);
 DATA=o;flatten();subject="";activeTab="overview";
 updateStatus();renderSubjects();updateContext();renderPaperDashboard();
 toast("Structured dataset imported locally. Legal-answer certification is separate.");
}
async function backup(){if(!DATA)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(DATA)],{type:'application/json'}));a.download='SILE_iPad_dataset_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function bindStatic(){
  $$('[data-paper]').forEach(b=>b.onclick=()=>{paper=Number(b.dataset.paper);subject='';activeTab='overview';document.body.classList.remove('focusMode');$$('[data-paper]').forEach(x=>x.classList.toggle('active',x===b));renderSubjects();updateContext();renderPaperDashboard();document.body.classList.remove('navOpen')});
  $$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;activeTab='overview';referenceCategory='RULE';document.body.classList.remove('focusMode');$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateContext();if(subject)renderSubjectDashboard();else renderPaperDashboard()});
  $('#searchBtn').onclick=()=>{document.body.classList.remove('focusMode');window.SILEFIND.render()};
  const navToggle=$('#navToggle');navToggle.onclick=()=>{
    document.body.classList.toggle('navOpen');
    navToggle.setAttribute('aria-expanded',String(document.body.classList.contains('navOpen')));
  };
  $('#progressBtn').onclick=()=>{document.body.classList.remove('focusMode');document.body.classList.remove('navOpen');renderProgress()};
  $('#statusBtn').onclick=()=>{document.body.classList.remove('focusMode');renderData()};
  $('#toolsBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderTools()}};
  $('#dataBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderData()}};
  $('#fileInput').onchange=async e=>{const f=e.target.files&&e.target.files[0];try{if(f)await importFile(f)}catch(err){alert('Import failed: '+err.message)}finally{e.target.value=''}};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();window.SILEFIND.render()}});
}

function bootTimed(p, label) {
  return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timed out')), 12000))]);
}
async function init(){
  try {
    // Bind controls first; optional offline tools must not block main study UI.
    bindStatic();
    await bootTimed(openDB(), 'Opening offline storage');
    studyProgress = await bootTimed(dbGet('study_progress_v1'), 'Reading revision progress') || {version:1,topics:{},questions:{}};
    DATA = await bootTimed(dbGet('dataset'), 'Reading local study data');
    if(DATA) flatten();
    updateStatus();
    renderSubjects();
    updateContext();
    if(DATA) renderPaperDashboard(); else renderSetup();
    window.SILE_APP_READY = true;
    try { sessionStorage.removeItem('sile_last_startup_error'); } catch (_) {}
  } catch (err) {
    console.error('SILE app startup', err);
    window.SILE_APP_ERROR = String(err && err.message || err);
    try { sessionStorage.setItem('sile_last_startup_error',window.SILE_APP_ERROR); } catch (_) {}
    const msg = esc(window.SILE_APP_ERROR);
    setScreen('<div class="dataPanel"><div class="eyebrow">Startup diagnostic</div><h1 class="pageTitle">Unable to start the study interface</h1>' +
      '<p>The local study data and progress have not been deleted. Error: <strong>' + msg + '</strong></p>' +
      '<p>Connect to Wi-Fi, then open <a href="diagnostic.html">SILE Diagnostics</a> to check the app. Do not delete the Home Screen app or clear website data.</p></div>');
  } finally {
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(err => console.error('SILE service worker', err));
  }
  // Restore nonessential private tools only AFTER the study interface is ready.
  if(db && window.SILETOOLS) {
    Promise.resolve().then(() => window.SILETOOLS.restore()).catch(err => console.error('SILE private tools restore', err));
  }
}
init();
