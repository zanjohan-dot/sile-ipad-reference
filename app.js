const DBNAME='sile-ipad-stage3';
const STORE='kv';
let db=null;
let DATA=null;
let sourceBank=null;
let originalPractice=[];
let flat=[];
let paper=1;
let subject='';
let mode='rapid';
let activeTab='overview';
let previousView=null;
let studyProgress={version:1,topics:{},questions:{}};
let referenceCategory='RULE';

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const asList=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DBNAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function dbGet(k){return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbPut(k,v){return dbPutAll([[k,v]])}
function dbPutAll(entries){return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readwrite');
 tx.oncomplete=()=>resolve();
 tx.onabort=()=>reject(tx.error||new Error('Local storage transaction aborted'));
 const store=tx.objectStore(STORE);
 for(const [key,value] of entries)store.put(value,key);
})}
function saveStudyProgress(field,id,update){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  const store=tx.objectStore(STORE);
  const request=store.get('study_progress_v1');
  let next;
  tx.oncomplete=()=>{studyProgress=next;resolve();};
  tx.onabort=()=>reject(tx.error||new Error('Could not save revision progress'));
  request.onsuccess=()=>{
   const previous=request.result||{version:1,topics:{},questions:{}};
   const values=previous[field]||{};
   next={...previous,[field]:{...values,[id]:update(values[id])}};
   store.put(next,'study_progress_v1');
  };
 });
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',1800)}
function setScreen(html){
 const bar=$('#questionBar');
 if(!bar.hidden){bar.hidden=true;bar.replaceChildren();document.body.classList.remove('questionMode');}
$('#screen').innerHTML='<div class="screenInner">'+html+'</div>';$('#screen').scrollTop=0}
function currentSubject(){return DATA?DATA.subjects.find(s=>s.code===subject):null}
function topicMeta(s,id){return asList(s&&s.topics).find(t=>t.id===id)||null}
function questionCount(){return DATA?DATA.subjects.reduce((n,s)=>n+asList(s.questions).length,0):0}
function updateStatus(){$('#statusBtn').textContent=DATA?'Local data · '+questionCount()+' questions':'No local data'}
function updateContext(){const s=currentSubject();const m=mode==='rapid'?'Rapid':'Learn';$('#contextLabel').textContent=s?'Paper '+paper+' - '+s.subject+' - '+m:'Paper '+paper+' - '+m}

function flatten(source=DATA){
 const records=[];
 source.subjects.forEach(s=>{
  const base={paper:s.paper,code:s.code,subject:s.subject};
  const str=v=>Array.isArray(v)?v.join(" "):typeof v==="string"?v:"";
  asList(s.rules).forEach(x=>records.push({...base,type:"RULE",title:x.title||x.id||"Rule",
   text:[x.rule,x.when,x.triggers,x.exception,x.deadline,x.procedure,x.trap,x.source,x.detail].map(str).join(" "),obj:x}));
  asList(s.deadlines).forEach(x=>records.push({...base,type:"DEADLINE",title:x.action||x.title||"Deadline",
   text:[x.deadline,x.action,x.start,x.exception,x.consequence,x.source].map(str).join(" "),obj:x}));
  asList(s.procedures).forEach(x=>records.push({...base,type:"PROCEDURE",title:x.title||"Procedure",
   text:asList(x.steps).map(st=>[st.step,st.party,st.precondition,st.document,st.deadline,st.consequence,st.source].map(str).join(" ")).join(" "),obj:x}));
  asList(s.traps).forEach(x=>records.push({...base,type:"TRAP",title:x.trap||x.title||"Exam trap",
   text:[x.attractive,x.rule,x.spot,x.source].map(str).join(" "),obj:x}));
  asList(s.topics).forEach(meta=>{
   const x=s.teach?.topics?.[meta.id]||{};
   records.push({...base,type:"LESSON",title:meta.name||meta.id||"Lesson",
    text:[meta.common_term,meta.formal_term,x.big_picture,x.who,x.when,x.basic_rule,x.exam_application,x.exam_trap_plain,
      ...asList(x.core_concepts).map(t=>[t.term,t.plain,t.legal].map(str).join(" "))].map(str).join(" "),
    obj:x,topicId:meta.id});
  });
  asList(s.questions).forEach(x=>records.push({...base,type:"QUESTION",title:(x.label||"Question")+(x.qno?" · Q"+x.qno:""),
   text:[x.stem,Object.values(x.options||{}).join(" "),x.explanation,x.tested_rule,x.trap,x.authority,x.course_material].map(str).join(" "),obj:x}));
 });
 return records;
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
function answerClassification(q){
  const status=String(q.answer_status||'').toUpperCase();let out='';
  if(status==='OFFICIAL')out+='<span class="badge official">OFFICIAL SILE ANSWER</span>';
  else if(status==='DERIVED')out+='<span class="badge derived">DERIVED - NOT OFFICIAL</span>';
  else if(status==='PRACTICE')out+='<span class="badge neutral">ORIGINAL PRACTICE KEY</span>';
  else if(status==='EXCLUDED')out+='<span class="badge unresolved">EXCLUDED</span>';
  else if(status.includes('UNRESOLVED'))out+='<span class="badge unresolved">UNRESOLVED - NOT SCORED</span>';
  return out;
}
function answerProvenance(q){
  let out='';
  if(String(q.answer_basis||'').includes('SOURCE CONFLICT')||String(q.notes||'').includes('SOURCE CONFLICT'))out+='<span class="badge conflict">SOURCE CONFLICT</span>';
  if(q.confidence)out+='<span class="badge neutral">Confidence: '+esc(q.confidence)+'</span>';
  return out;
}

function provenanceBadges(q){return answerClassification(q)+answerProvenance(q)}

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

function questionDetails(label,body,id){
 return '<details class="readSection questionDetails"'+(id?' id="'+id+'"':'')+'><summary>'+label+'</summary>'+
  (body||'<p>No source text recorded for this section.</p>')+'</details>';
}

function questionBar(q){
 const bar=$('#questionBar');
 bar.innerHTML='<button id="backBtn" class="backButton"><span aria-hidden="true">←</span> <span id="questionBackLabel">Back</span></button>'+
  '<div class="questionBarContext"><strong>'+esc(q.id)+'</strong><span>'+(mode==='rapid'?'Rapid':'Learn')+'</span></div>';
 bar.hidden=false;
 document.body.classList.add('questionMode');
}

function reasoningSection(value){
 if(typeof value!=='string'||!value.trim())return section('Recorded reasoning',value);
 // Use only markers already present in the source and escape all source text.
 const boundary=/(?<=\s)(?=(?:Step \d+\s*[-–—:.]|(?:\(?[ivxlcdm]+[.)]?)\s+(?:TRUE|FALSE)\b))/gi;
 const blocks=value.split(/\n\s*\n|\r?\n|(?<=\s)(?=\d+\.\s+(?:Governing rule|Polarity check|Analysis|Application|Conclusion|Result)\b)/i)
  .flatMap(line=>line.split(boundary)).map(line=>line.trim()).filter(Boolean);
 return '<section id="questionReasoning" class="readSection" tabindex="-1"><h2>Recorded reasoning</h2>'+
  blocks.map(line=>'<p>'+esc(line)+'</p>').join('')+'</section>';
}

function openQuestion(q){
 const rapid=mode==='rapid';
 const status=String(q.answer_status||'').toUpperCase();
 const excluded=status==='EXCLUDED';
 const entries=Object.entries(q.options||{});
 const incomplete=entries.length!==4;
 const official=status==='OFFICIAL'&&!incomplete&&Object.hasOwn(q.options||{},q.answer);
 const acceptedStatus=status==='DERIVED'||status==='OFFICIAL'||status==='PRACTICE';
 const answer=acceptedStatus&&q.answer?q.answer:'No settled answer recorded';
 const settings=studyProgress.review?.[q.id]||{};
 const opts='<div class="optionList">'+entries.map(([k,v])=>'<div class="optionBox"><strong>'+esc(k)+'.</strong> '+esc(v)+'</div>').join('')+'</div>';
 const perOption=entries.map(([key])=>'<div class="conceptCard"><div class="conceptTerm">Option '+esc(key)+'</div><div class="conceptPlain">'+
  esc(q.option_expl?.[key]||'No explanation recorded for this option.')+'</div></div>').join('');
 const provenance='<div class="provenanceStrip">'+provenanceBadges(q)+'</div>';
 const key='<section class="questionKey"><h2>Recorded answer</h2><p>'+esc(answer)+'</p><div class="provenanceStrip">'+answerClassification(q)+'</div></section>';
 const secondary=answerProvenance(q);
 const answerNotes=secondary?'<div class="questionAnswerNotes">'+secondary+'</div>':'';
 const warning=(status==='DERIVED'?'<p class="questionAudit"><strong>Derived answer subject to audit.</strong> The 8 November bank has yet to be reconciled with the later review. Check the original material.</p>':'');
 const source=section('Source attribution',q.source||[q.sitting,q.course_material].filter(Boolean));
 const explanation='<div id="questionReasoningStart" tabindex="-1">'+section('Rule tested',q.tested_rule,'rule')+section('Exam trap',q.trap,'trap')+
  reasoningSection(q.explanation)+
  (q.official_explanation!==q.explanation?section('Official explanation',q.official_explanation):'')+
  section('Common mistake',q.common_mistake)+section('Answer basis',q.answer_basis,'warning')+'</div>';
 const layman=section('What the question is testing',q.really_testing)+section('Key factual clue',q.key_clue)+section('How to approach it',q.fastest_route);
 const resources='<div class="questionResources">'+
  questionDetails('Explain in Layman Terms',layman,'plainExplanation')+
  questionDetails('Explain Each Option',perOption,'optionExplanations')+
  questionDetails('Show Legal Authority',section('Authority',q.authority)+section('Course material',q.course_material)+section('Contact Session guidance',q.cs_guidance),'legalAuthority')+'</div>';
 const review='<div id="answerContent" class="questionReview" tabindex="-1">'+(rapid?explanation+resources:key+warning+answerNotes+resources+explanation)+source+'</div>';
 const similar='<div class="studyActions"><button id="findSimilar" class="secondaryButton">Find Similar Questions</button></div>';
 enterFocus();
 setScreen('<div class="reader questionReader" data-question-id="'+esc(q.id)+'">'+

  '<h1 class="pageTitle" id="questionTitle" tabindex="-1">Question '+esc(q.qno||q.id)+'</h1>'+
  (rapid&&!excluded?key+warning+answerNotes+'<button id="jumpToReasoning" class="questionJump">Read reasoning ↓</button>':excluded?provenance:'')+
  '<div class="readerMeta">'+esc(q.sitting||q.category||'Source question')+'</div>'+
  (incomplete?'<div class="dataNote">The source contains '+entries.length+' recorded choices. This question does not count toward official accuracy.</div>':'')+
  (excluded?'<div class="dataNote"><strong>Excluded from practice and scoring.</strong></div>':'')+
  section('Factual scenario',q.scenario||q.facts,'questionWording')+section('Question',q.stem,'rule questionWording')+
  '<section class="readSection questionChoices"><h2>'+(rapid||excluded?'Recorded answer choices':'Choose your answer')+'</h2>'+
  (rapid||excluded?opts:window.SILEUX.questionAttemptUI(q,studyProgress.questions[q.id]))+'</section>'+
  (excluded?section('Exclusion basis',q.answer_basis)+source:
   similar+(rapid?review:'<details id="answerBlock" class="questionDetails answerDisclosure"><summary>Show Answer</summary>'+review+'</details>'))+
  '<details class="readSection questionDetails"><summary>Bookmark and notes</summary><div class="studyActions">'+
  '<label><input type="checkbox" id="questionBookmark"'+(settings.bookmarked?' checked':'')+'> Bookmark this question</label></div>'+
  '<label for="questionNote">My notes</label><textarea id="questionNote" rows="3" maxlength="6000">'+esc(settings.note||'')+'</textarea>'+
  '<div class="studyActions"><button id="saveQuestionNote" type="button" class="secondaryButton">Save bookmark and notes</button></div>'+
  '<p id="reviewFeedback" role="status"></p></details></div>');
 questionBar(q);
 bindBack();
 $('#backBtn').focus({preventScroll:true});
 const jump=$('#jumpToReasoning');
 if(jump)jump.onclick=()=>{
  const target=$('#questionReasoningStart');
  target.scrollIntoView({block:'start'});
  target.focus({preventScroll:true});
 };
 const related=$('#findSimilar');
 if(related)related.onclick=()=>{
  const back=$('#backBtn');
  const returnToResults=back.onclick;
  const label=back.innerHTML;
  const accessibleLabel=back.getAttribute("aria-label");
  const scroll=$('#screen').scrollTop;
  const openPanels=$$('.questionReader details[open]').map(el=>el.id).filter(Boolean);
  window.SILEFIND.findSimilar(q,()=>{
   openQuestion(q);
   $('#backBtn').innerHTML=label;
   if(accessibleLabel)$('#backBtn').setAttribute('aria-label',accessibleLabel);
   $('#backBtn').onclick=returnToResults;
   for(const id of openPanels)document.getElementById(id).open=true;
   $('#screen').scrollTop=scroll;
   $('#findSimilar').focus({preventScroll:true});
  });
 };
 $('#saveQuestionNote').onclick=async()=>{
  const feedback=$('#reviewFeedback');
  const entry={bookmarked:$('#questionBookmark').checked,note:$('#questionNote').value.trim()};
  try{
   await saveStudyProgress('review',q.id,()=>entry);
   feedback.textContent='Bookmark and notes saved on this device.';
  }catch(err){feedback.textContent='Could not save bookmark and notes: '+err.message;}
 };
 if(rapid||excluded)return;
 function reveal(selected){
  $('#practiceFeedback').textContent=window.SILEUX.interpretation(q,selected);
  $('#answerBlock').open=true;
  $('#answerBlock').scrollIntoView({block:'start'});
  $('#answerBlock > summary').focus({preventScroll:true});
 }
 $('#submitPractice').onclick=async()=>{
  const selected=document.querySelector('input[name="practiceChoice"]:checked');
  if(!selected){$('#practiceFeedback').textContent='Choose an answer first, or use Show Answer.';return;}
  const submit=$('#submitPractice'), feedback=$('#practiceFeedback');
  submit.disabled=true;
  try{
   await saveStudyProgress('questions',q.id,(old={attempts:0,officialCorrect:0})=>({
    attempts:old.attempts+1,officialCorrect:(old.officialCorrect||0)+(official&&selected.value===q.answer?1:0),
    lastSelected:selected.value,lastStatus:status,lastAttempt:new Date().toISOString()
   }));
   if(submit.isConnected)reveal(selected.value);
  }catch(err){feedback.textContent='Could not save this attempt: '+err.message;submit.disabled=false;}
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
  const state=b.dataset.studyState;
  const el=$('#lessonProgressStatus');
  try{await saveStudyProgress('topics',topicId,()=>({state,updated:new Date().toISOString()}));}
  catch(err){el.textContent='Could not save topic progress: '+err.message;return;}
  if(el)el.textContent=state==="understood"?
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

async function checkOfflineSetup(){
 const output=$('#offlineSetupStatus');
 const script=[...document.scripts].find(node=>node.src&&new URL(node.src).pathname.endsWith('/app.js'));
 try{
  const shell=!!navigator.serviceWorker?.controller&&!!script&&!!await window.caches?.match(script.src);
  const tools=!!await dbGet('sile_private_tools_2026_11_08');
  output.textContent=(shell?'App shell cached. ':'App shell is still preparing. Keep the preview open while connected and check again. ')+
   questionCount()+' questions stored. '+(tools?'Private tools stored.':'Private tools can be imported from a local file.');
 }catch(error){output.textContent='Could not check local storage: '+error.message;}
}
function renderData(){
 const topics=Object.values(studyProgress.topics||{}),questions=Object.values(studyProgress.questions||{});
 const known=topics.filter(x=>x.state==="understood").length,needs=topics.filter(x=>x.state==="needs-review").length;
 setScreen('<div class="dataPanel"><div class="eyebrow">Offline data</div><h1 class="pageTitle">Local content and revision progress</h1>'+
 '<p><strong>'+questionCount()+' questions</strong> are stored on this device.</p><p>Use Import study JSON to install a combined file or add a practice pack. Export combined study JSON saves both question banks in one file.</p>'+
 '<div class="paperStats"><div class="statPill"><strong>'+known+'</strong>lessons understood</div>'+
 '<div class="statPill"><strong>'+needs+'</strong>topics for revision</div><div class="statPill"><strong>'+questions.length+'</strong>questions attempted</div></div>'+
 '<div class="dataActions"><button id="replaceData" class="primaryButton">Import study JSON</button>'+
 '<button id="backupData" class="secondaryButton">Export combined study JSON</button>'+
 '<button id="exportProgress" class="secondaryButton">Export revision progress</button></div>'+
 '<label class="calcField"><span>Restore revision progress from backup</span><input id="progressImport" type="file" accept=".json,application/json"></label>'+
 '<div class="dataNote"><strong>Legal-content release warning:</strong> The imported 8 November dataset predates the final Taxation Contact Session and later answer-status audits. Do not mistake local availability for legal-content certification.</div>'+
 '<div class="dataNote"><strong>Exam rules:</strong> The SILE examination brief prohibits AI-powered search engines and answer-generating applications during the examinations. This app is a revision system; any exam use requires checking the permitted reference-material rules.</div>'+
 '<div class="dataActions"><button id="checkOfflineSetup" class="secondaryButton">Check offline setup</button></div>'+
 '<p id="offlineSetupStatus" role="status"></p>'+
 '<p class="readerMeta">Search, topic matching and the question reader use the study bank on this device.</p></div>');
 $('#checkOfflineSetup').onclick=checkOfflineSetup;
 $('#replaceData').onclick=()=>$('#fileInput').click();
 $('#backupData').onclick=backup;$('#exportProgress').onclick=exportStudyProgress;
 $('#progressImport').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const x=JSON.parse(await file.text());
   if(x.version!==1||!x.topics||!x.questions||Array.isArray(x.topics)||Array.isArray(x.questions))throw new Error("Invalid progress backup");
   await dbPut('study_progress_v1',x);studyProgress=x;toast("Revision progress restored");renderData()
  }catch(err){alert("Progress restore failed: "+err.message)}
 };
}
function renderProgress(){
 const topics=studyProgress.topics||{},questions=studyProgress.questions||{};
 if(!DATA)return renderSetup();
 const saved=flat.filter(x=>x.type==="QUESTION"&&studyProgress.review?.[x.obj.id]?.bookmarked);
 const savedRows=saved.map((x,i)=>'<button class="contentRow" data-saved-question="'+i+'">'+esc(x.obj.id+' · '+x.title)+'</button>').join('');
 const summaries=DATA.subjects.filter(s=>s.paper===paper).map(s=>{
  const all=asList(s.topics),understood=all.filter(t=>topics[t.id]?.state==="understood").length,
    weak=all.filter(t=>topics[t.id]?.state==="needs-review").length;
  const attempts=asList(s.questions).filter(q=>questions[q.id]);
  const official=asList(s.questions).filter(q=>q.answer_status==="OFFICIAL"&&Object.keys(q.options||{}).length===4&&Object.hasOwn(q.options,q.answer)&&questions[q.id]?.lastStatus==="OFFICIAL");
  const scored=official.reduce((n,q)=>n+(questions[q.id]?.officialCorrect||0),0);
  const officialAttempts=official.reduce((n,q)=>n+(questions[q.id]?.attempts||0),0);
  return '<section class="readSection"><h2>'+esc(s.subject)+'</h2><p>'+understood+'/'+all.length+' lessons understood; '+weak+' need revision. '+attempts.length+' questions attempted.'+
   (officialAttempts?' Official-answer attempts: '+scored+'/'+officialAttempts+' matching the key.':"")+'</p></section>';
 }).join("");
 setScreen('<div class="eyebrow">Revision progress · Paper '+paper+'</div><h1 class="pageTitle">What I understand and what to revise</h1>'+
 '<p class="pageLead">Only questions with official SILE answers contribute to scored accuracy. Derived-answer comparisons and unresolved questions are not counted as officially correct or incorrect.</p>'+
 summaries+'<section class="readSection"><h2>Bookmarked questions</h2>'+
   (savedRows||'<p>Choose Bookmark and notes in a question reader to save it here.</p>')+'</section><div class="dataActions"><button class="secondaryButton" id="exportProgressPage">Export progress</button></div>');
 $('#exportProgressPage').onclick=exportStudyProgress;
 $$('[data-saved-question]').forEach(button=>button.onclick=()=>{
  const item=saved[Number(button.dataset.savedQuestion)];
  subject=item.code;
  paper=item.paper;
  $$('[data-paper]').forEach(x=>x.classList.toggle('active',Number(x.dataset.paper)===paper));
  renderSubjects();
  updateContext();
  openQuestion(item.obj);
  $('#backBtn').textContent='Back to revision progress';
  $('#backBtn').onclick=()=>{document.body.classList.remove('focusMode');renderProgress();};
 });
}
function exportStudyProgress(){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(studyProgress,null,2)],{type:"application/json"}));
 a.href=url;a.download="SILE_Revision_Progress_2026.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
const PRACTICE_FORMAT='sile-original-practice-v1';

function mergeStudyBank(bank,practice){
 return {...bank,subjects:bank.subjects.map(s=>({...s,
  questions:[...asList(s.questions),...practice.filter(q=>q.subjectCode===s.code)]
 }))};
}

function validatePracticePack(pack,bank){
 if(pack?.format!==PRACTICE_FORMAT||!Array.isArray(pack.questions)||pack.questions.length>600){
  throw new Error('Choose a SILE original practice pack.');
 }
 const groups=new Map(bank.subjects.map(s=>[s.code,s]));
 const ids=new Set(bank.subjects.flatMap(s=>asList(s.questions).map(q=>q.id)));
 return pack.questions.map(q=>{
  const group=groups.get(q?.subjectCode);
  const complete=['A','B','C','D'].every(letter=>typeof q?.options?.[letter]==='string'&&q.options[letter].trim()&&typeof q?.option_expl?.[letter]==='string'&&q.option_expl[letter].trim());
  const texts=['stem','explanation','tested_rule','authority','answer_basis','source'];
  if(!group||!/^P[12]-[A-Z]+-\d{2,3}$/.test(q?.id)||!q.id.startsWith('P'+group.paper+'-'+group.code+'-')||
     ids.has(q.id)||!complete||Object.keys(q.options).length!==4||!['A','B','C','D'].includes(q.answer)||
     texts.some(key=>typeof q[key]!=='string'||!q[key].trim())||!topicMeta(group,q.topic)){
   throw new Error('Invalid or duplicate practice record: '+(q?.id||'missing ID'));
  }
  ids.add(q.id);
  return {...q,answer_status:'PRACTICE',category:'ORIGINAL_PRACTICE',sitting:'Original revision practice · Paper '+group.paper};
 });
}

function renderOriginalPractice(){
 if(!DATA)return renderSetup();
 setScreen('<div class="eyebrow">Question bank</div><h1 class="pageTitle">Original practice</h1>'+
  '<p class="pageLead">New exam-style scenarios with an explanation for every option. Open a question in Learn mode to attempt it before seeing the practice key.</p>'+
  (originalPractice.length?'':'<p>Use Import study JSON in Offline data to install practice questions.</p><button id="openOfflineData" class="secondaryButton">Open Offline data</button>')+
  [1,2].map(number=>{
   const items=originalPractice.filter(q=>q.id.startsWith('P'+number+'-'));
   if(!items.length)return '';
   return '<section class="readSection"><h2>Paper '+number+' · '+items.length+' questions</h2>'+
    items.map(q=>'<button class="contentRow" data-practice-id="'+esc(q.id)+'"><strong>'+esc(q.id)+'</strong> · '+esc(q.label)+'</button>').join('')+'</section>';
  }).join(''));
 const openOfflineData=$('#openOfflineData');
 if(openOfflineData)openOfflineData.onclick=renderData;
 $$('[data-practice-id]').forEach(button=>button.onclick=()=>{
  const q=originalPractice.find(item=>item.id===button.dataset.practiceId);
  const group=DATA.subjects.find(s=>s.code===q.subjectCode);
  paper=group.paper;
  subject=group.code;
  mode='learn';
  $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $$('[data-paper]').forEach(b=>b.classList.toggle('active',Number(b.dataset.paper)===paper));
  renderSubjects();
  updateContext();
  openQuestion(q);
  $('#backBtn').textContent='Back to practice';
  $('#backBtn').onclick=()=>{document.body.classList.remove('focusMode');renderOriginalPractice();};
 });
}
function renderSetup(){setScreen('<div class="dataPanel"><div class="eyebrow">Setup</div><h1 class="pageTitle">Import SILE study data</h1><p>Choose a combined study JSON. If you still have two files, select the verified bank and practice pack together. They will be stored on this iPad.</p><div class="dataActions"><button id="importNow" class="primaryButton">Import study JSON</button></div></div>');$('#importNow').onclick=()=>$('#fileInput').click()}

function validateStudyBank(dataset){
 if(!Array.isArray(dataset?.subjects)||dataset.subjects.length!==8)throw new Error('Expected an eight-subject SILE dataset');
 if(dataset.subjects.some(s=>!s||typeof s.code!=='string'||typeof s.subject!=='string'||![1,2].includes(s.paper))){
  throw new Error('Subject names, codes and paper numbers are required');
 }
 const questions=dataset.subjects.flatMap(s=>asList(s.questions));
 if(questions.length!==323)throw new Error('Expected 323 questions, found '+questions.length);
 if(questions.some(q=>typeof q?.id!=='string'||!q.id.trim()||typeof q.stem!=='string')){
  throw new Error('Every question needs an ID and recorded wording');
 }
 if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Question IDs must be unique');
}

let studyImportInProgress=false;
async function importStudyFiles(files){
 if(studyImportInProgress)return;
 studyImportInProgress=true;
 try{
  const inputs=await Promise.all(files.map(async file=>JSON.parse(await file.text())));
  const banks=inputs.filter(input=>input?.format!==PRACTICE_FORMAT);
  const packs=inputs.filter(input=>input?.format===PRACTICE_FORMAT);
  if(banks.length>1||packs.length>1)throw new Error('Select one study bank and, if needed, one practice pack');
  const incoming=banks[0];
  if(banks.length)validateStudyBank(incoming);
  if(!incoming&&!sourceBank)throw new Error('Select the verified study bank together with the practice pack');
  const {originalPractice:embeddedPractice,...dataset}=incoming||sourceBank;
  const practiceById=new Map(originalPractice.map(question=>[question.id,question]));
  for(const pack of [embeddedPractice,...packs].filter(pack=>pack!==undefined)){
   for(const question of validatePracticePack(pack,dataset))practiceById.set(question.id,question);
  }
  const practice=validatePracticePack({format:PRACTICE_FORMAT,questions:[...practiceById.values()]},dataset);
  const bank=mergeStudyBank(dataset,practice);
  const records=flatten(bank);
  await dbPutAll([['dataset',dataset],['original_practice_v1',practice]]);
  sourceBank=dataset;
  originalPractice=practice;
  DATA=bank;
  flat=records;
  subject='';
  activeTab='overview';
  updateStatus();
  renderSubjects();
  updateContext();
  renderPaperDashboard();
  toast(questionCount()+' study questions stored on this device');
 }finally{
  studyImportInProgress=false;
 }
}
function combinedStudyBank(){
 return {...sourceBank,originalPractice:{format:PRACTICE_FORMAT,questions:originalPractice}};
}
function backup(){
 if(!DATA)return;
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(combinedStudyBank())],{type:'application/json'}));
 a.download='SILE_Combined_Study_Bank.json';
 a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function bindStatic(){
  $$('[data-paper]').forEach(b=>b.onclick=()=>{paper=Number(b.dataset.paper);subject='';activeTab='overview';document.body.classList.remove('focusMode');$$('[data-paper]').forEach(x=>x.classList.toggle('active',x===b));renderSubjects();updateContext();renderPaperDashboard();document.body.classList.remove('navOpen')});
  $$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;activeTab='overview';referenceCategory='RULE';document.body.classList.remove('focusMode');$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateContext();if(subject)renderSubjectDashboard();else renderPaperDashboard()});
  $('#searchBtn').onclick=()=>{document.body.classList.remove('focusMode');window.SILEFIND.render()};
  const navToggle=$('#navToggle');navToggle.onclick=()=>{
    document.body.classList.toggle('navOpen');
    navToggle.setAttribute('aria-expanded',String(document.body.classList.contains('navOpen')));
  };
  $('#progressBtn').onclick=()=>{document.body.classList.remove('focusMode');document.body.classList.remove('navOpen');renderProgress()};
  $('#statusBtn').onclick=()=>{document.body.classList.remove('focusMode');if(DATA)renderData();else renderSetup()};
  $('#toolsBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderTools()}};
  $('#practiceBtn').onclick=()=>{document.body.classList.remove('focusMode','navOpen');renderOriginalPractice();};
  $('#dataBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderData()}};
  $('#fileInput').onchange=async e=>{
    const files=Array.from(e.target.files||[]);
    try{if(files.length)await importStudyFiles(files)}
    catch(err){alert('Import failed: '+err.message)}
    finally{e.target.value=''}
  };
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
    sourceBank = await bootTimed(dbGet('dataset'), 'Reading local study data');
    originalPractice=await bootTimed(dbGet('original_practice_v1'),'Reading original practice')||[];
    if(sourceBank){DATA=mergeStudyBank(sourceBank,originalPractice);flat=flatten();}
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
      '<p>Open <a href="diagnostic.html">SILE Diagnostics</a> to check the app. Do not delete the Home Screen app or clear website data.</p></div>');
  } finally {
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(err => console.error('SILE service worker', err));
  }
  // Restore nonessential private tools only AFTER the study interface is ready.
  if(db && window.SILETOOLS) {
    Promise.resolve().then(() => window.SILETOOLS.restore()).catch(err => console.error('SILE private tools restore', err));
  }
}
init();
