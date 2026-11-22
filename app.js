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
function updateStatus(){$('#statusBtn').textContent=DATA?'Offline - '+questionCount()+' questions':'No data'}
function updateContext(){const s=currentSubject();const m=mode==='rapid'?'Rapid':'Learn';$('#contextLabel').textContent=s?'Paper '+paper+' - '+s.subject+' - '+m:'Paper '+paper+' - '+m}

function flatten(){
  flat=[];
  DATA.subjects.forEach(s=>{
    const base={paper:s.paper,code:s.code,subject:s.subject};
    asList(s.rules).forEach(x=>flat.push({...base,type:'RULE',title:x.title||x.id||'Rule',text:[x.rule,x.when,x.triggers,x.exception,x.deadline,x.procedure,x.trap,x.source,x.detail].join(' '),obj:x}));
    asList(s.deadlines).forEach(x=>flat.push({...base,type:'DEADLINE',title:x.action||x.title||'Deadline',text:JSON.stringify(x),obj:x}));
    asList(s.procedures).forEach(x=>flat.push({...base,type:'PROCEDURE',title:x.title||x.name||x.action||'Procedure',text:JSON.stringify(x),obj:x}));
    asList(s.traps).forEach(x=>flat.push({...base,type:'TRAP',title:x.trap||x.title||'Exam trap',text:JSON.stringify(x),obj:x}));
    asList(s.questions).forEach(x=>flat.push({...base,type:'QUESTION',title:(x.label||'Question')+(x.qno?' - Q'+x.qno:''),text:[x.stem,Object.values(x.options||{}).join(' '),x.explanation,x.tested_rule,x.trap,x.authority,x.course_material].join(' '),obj:x}));
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
    b.onclick=()=>{subject=s.code;activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');renderSubjects();updateContext();renderSubjectDashboard();document.body.classList.remove('navOpen')};
    nav.appendChild(b);
  });
}

function paperStats(subs){return{q:subs.reduce((n,s)=>n+asList(s.questions).length,0),r:subs.reduce((n,s)=>n+asList(s.rules).length,0),d:subs.reduce((n,s)=>n+asList(s.deadlines).length,0),t:subs.reduce((n,s)=>n+asList(s.traps).length,0)}}
function subjectStats(s){return{q:asList(s.questions).length,r:asList(s.rules).length,d:asList(s.deadlines).length,t:asList(s.traps).length,l:asList(s.teach&&s.teach.topics).length}}

function renderPaperDashboard(){
  if(!DATA)return renderSetup();
  const subs=DATA.subjects.filter(s=>s.paper===paper);const st=paperStats(subs);
  let cards=subs.map(s=>{const x=subjectStats(s);return '<button class="subjectCard" data-subject="'+esc(s.code)+'"><div class="subjectCardTitle">'+esc(s.subject)+'</div><div class="subjectCardMeta">'+x.q+' questions - '+x.r+' rules - '+x.d+' deadlines</div></button>'}).join('');
  setScreen('<div class="paperHero"><div class="eyebrow">Paper '+paper+'</div><h1 class="pageTitle">'+(mode==='rapid'?'Rapid reference':'Learning dashboard')+'</h1><p class="pageLead">'+(mode==='rapid'?'Choose a subject for exam essentials, questions, rules, deadlines and traps. Use Search only when you need to find something across the paper.':'Choose a subject to study topic-by-topic in a structured teaching view. Raw dataset objects are not shown in Learn mode.')+'</p><div class="paperStats"><div class="statPill"><strong>'+st.q+'</strong>questions</div><div class="statPill"><strong>'+st.r+'</strong>rules</div><div class="statPill"><strong>'+st.d+'</strong>deadlines</div><div class="statPill"><strong>'+st.t+'</strong>traps</div></div><div class="subjectGrid">'+cards+'</div></div>');
  $$('.subjectCard').forEach(b=>b.onclick=()=>{subject=b.dataset.subject;activeTab=mode==='learn'?'learn':'overview';renderSubjects();updateContext();renderSubjectDashboard()});
}

function renderSubjectDashboard(){
  const s=currentSubject();if(!s)return renderPaperDashboard();
  const st=subjectStats(s);
  const tabs=[['overview','Overview'],['learn','Learn'],['questions','Questions'],['rules','Rules'],['deadlines','Deadlines'],['procedures','Procedures'],['traps','Traps'],['tools','Tools']];
  let tabHtml=tabs.map(t=>'<button data-tab="'+t[0]+'" class="'+(activeTab===t[0]?'active':'')+'">'+t[1]+'</button>').join('');
  let body='';
  if(activeTab==='overview')body=renderSubjectOverview(s);
  if(activeTab==='learn')body=renderLearnList(s);
  if(activeTab==='questions')body=renderQuestionList(s);
  if(activeTab==='rules')body=renderGenericList(s,'RULE',asList(s.rules));
  if(activeTab==='deadlines')body=renderGenericList(s,'DEADLINE',asList(s.deadlines));
  if(activeTab==='procedures')body=renderGenericList(s,'PROCEDURE',asList(s.procedures));
  if(activeTab==='traps')body=renderGenericList(s,'TRAP',asList(s.traps));
  if(activeTab==='tools')body=renderToolsContent(s);
  setScreen('<div class="subjectHeader"><div class="subjectHeaderTop"><div><div class="eyebrow">Paper '+paper+'</div><h1 class="pageTitle">'+esc(s.subject)+'</h1><p class="pageLead">'+(mode==='rapid'?'Exam-focused reference. Start with Overview, then jump directly to questions, rules, deadlines or traps.':'Structured study mode. Start with Learn, then test yourself using Questions.')+'</p></div><div class="subjectStats"><div class="statPill"><strong>'+st.q+'</strong>questions</div><div class="statPill"><strong>'+st.l+'</strong>lessons</div></div></div><div class="tabBar">'+tabHtml+'</div></div>'+body);
  $$('.tabBar button').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;renderSubjectDashboard()});
  bindRows();
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

function openQuestion(q){
 currentQuestion=q;
 enterFocus();
 const opts=Object.entries(q.options||{}).map(([k,v])=>'<div class="optionBox"><strong>'+esc(k)+'.</strong> '+esc(v)+'</div>').join("");
 const perOption=Object.entries(q.option_expl||{}).map(([k,v])=>
  '<div class="conceptCard"><div class="conceptTerm">Option '+esc(k)+'</div><div class="conceptPlain">'+esc(v)+'</div></div>').join("");
 const status=String(q.answer_status||"").toUpperCase();
 const safeAnswer=status.includes("UNRESOLVED")?"No settled answer — not scored":(q.answer||"No settled answer");
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
 setScreen('<div class="reader">'+focusHeader()+
  '<div class="readerMeta">Revision practice · '+esc(q.sitting||q.category||"Question")+'</div>'+
  '<h1 class="pageTitle">'+esc((q.label||"Question")+(q.qno?" · Q"+q.qno:""))+'</h1>'+
  '<div class="provenanceStrip">'+provenanceBadges(q)+'</div>'+
  '<div class="dataNote">Practice using source questions only. Do not copy or save live examination questions.</div>'+
  section("Question",q.stem,"rule")+
  '<section class="readSection"><h2>Choose your answer</h2>'+window.SILEUX.questionAttemptUI(q,attempt)+'</section>'+
  answer+'</div>');
 bindBack();
 const reveal=(selected,record)=>{
  if(record&&selected){
   const old=studyProgress.questions[q.id]||{attempts:0,officialCorrect:0};
   const official=status==="OFFICIAL";
   studyProgress.questions[q.id]={
     attempts:old.attempts+1,officialCorrect:old.officialCorrect+(official&&selected===q.answer?1:0),
     lastSelected:selected,lastStatus:status,lastAttempt:new Date().toISOString()
   };
   dbPut('study_progress_v1',studyProgress).catch(err=>console.error("Progress save failed",err));
  }
  const message=window.SILEUX.interpretation(q,selected);
  const feedback=$('#practiceFeedback');
  if(feedback)feedback.innerHTML='<div class="dataNote">'+esc(message)+'</div>';
  $('#answerBlock').classList.add("revealed");
  $('#answerBlock').scrollIntoView({block:"nearest"});
 };
 $('#submitPractice').onclick=()=>{
   const selected=document.querySelector('input[name="practiceChoice"]:checked');
   if(!selected){const feedback=$('#practiceFeedback');if(feedback)feedback.textContent="Choose an answer first, or reveal without recording.";return;}
   reveal(selected.value,true);$('#submitPractice').disabled=true;
 };
 $('#revealWithoutAttempt').onclick=()=>reveal("",false);
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
 '<div class="statPill"><strong>'+needs+'</strong>topics for revision</div><div class="statPill"><strong>'+questions.length+'</strong>questions attempted</div></div>'+
 '<div class="dataActions"><button id="replaceData" class="primaryButton">Replace verified JSON</button>'+
 '<button id="backupData" class="secondaryButton">Export dataset backup</button>'+
 '<button id="exportProgress" class="secondaryButton">Export revision progress</button></div>'+
 '<label class="calcField"><span>Restore revision progress from backup</span><input id="progressImport" type="file" accept=".json,application/json"></label>'+
 '<div class="dataNote"><strong>Legal-content release warning:</strong> The imported 8 November dataset predates the final Taxation Contact Session and later answer-status audits. Do not mistake local availability for legal-content certification.</div>'+
 '<div class="dataNote"><strong>Exam rules:</strong> The SILE examination brief prohibits AI-powered search engines and answer-generating applications during the examinations. This app is a revision system; any exam use requires checking the permitted reference-material rules.</div>'+
 '<p class="readerMeta">Search runs locally over existing material; a language model and semantic embeddings are not installed or verified in this build.</p></div>');
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
  const official=asList(s.questions).filter(q=>q.answer_status==="OFFICIAL"&&questions[q.id]);
  const scored=official.reduce((n,q)=>n+(questions[q.id]?.officialCorrect||0),0);
  const officialAttempts=official.reduce((n,q)=>n+(questions[q.id]?.attempts||0),0);
  return '<section class="readSection"><h2>'+esc(s.subject)+'</h2><p>'+understood+'/'+all.length+' lessons understood; '+weak+' need revision. '+attempts.length+' questions attempted.'+
   (officialAttempts?' Official-answer attempts: '+scored+'/'+officialAttempts+' matching the key.':"")+'</p></section>';
 }).join("");
 setScreen('<div class="eyebrow">Revision progress · Paper '+paper+'</div><h1 class="pageTitle">What I understand and what to revise</h1>'+
 '<p class="pageLead">Only questions with official SILE answers contribute to scored accuracy. Derived-answer comparisons and unresolved questions are not counted as officially correct or incorrect.</p>'+
 summaries+'<div class="dataActions"><button class="secondaryButton" id="exportProgressPage">Export progress</button></div>');
 $('#exportProgressPage').onclick=exportStudyProgress;
}
function exportStudyProgress(){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(studyProgress,null,2)],{type:"application/json"}));
 a.href=url;a.download="SILE_Revision_Progress_2026.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function renderSetup(){setScreen('<div class="dataPanel"><div class="eyebrow">Setup</div><h1 class="pageTitle">Import verified SILE data</h1><p>Import the verified JSON once. The dataset is then stored locally on this iPad.</p><div class="dataActions"><button id="importNow" class="primaryButton">Choose JSON file</button></div></div>');$('#importNow').onclick=()=>$('#fileInput').click()}

async function importFile(file){const o=JSON.parse(await file.text());if(!Array.isArray(o.subjects)||o.subjects.length!==8)throw new Error('Expected 8-subject SILE dataset');const q=o.subjects.reduce((n,s)=>n+asList(s.questions).length,0);if(q!==323)throw new Error('Expected 323 questions, found '+q);await dbPut('dataset',o);DATA=o;flatten();subject='';activeTab=mode==='learn'?'learn':'overview';updateStatus();renderSubjects();updateContext();renderPaperDashboard();toast('Verified dataset stored locally')}
async function backup(){if(!DATA)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(DATA)],{type:'application/json'}));a.download='SILE_iPad_dataset_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function bindStatic(){
  $$('[data-paper]').forEach(b=>b.onclick=()=>{paper=Number(b.dataset.paper);subject='';activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');$$('[data-paper]').forEach(x=>x.classList.toggle('active',x===b));renderSubjects();updateContext();renderPaperDashboard();document.body.classList.remove('navOpen')});
  $('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateContext();if(subject)renderSubjectDashboard();else renderPaperDashboard()});
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

async function init(){await openDB();studyProgress=await dbGet('study_progress_v1')||{version:1,topics:{},questions:{}};DATA=await dbGet('dataset');if(DATA)flatten();if(window.SILETOOLS)await window.SILETOOLS.restore();updateStatus();renderSubjects();updateContext();bindStatic();if(DATA)renderPaperDashboard();else renderSetup();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}
init();
