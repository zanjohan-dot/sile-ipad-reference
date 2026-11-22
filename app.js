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
  all.onclick=()=>{subject='';activeTab='overview';document.body.classList.remove('focusMode');renderSubjects();updateContext();renderPaperDashboard()};
  nav.appendChild(all);
  DATA.subjects.filter(s=>s.paper===paper).forEach(s=>{
    const b=document.createElement('button');b.textContent=s.subject;b.classList.toggle('active',s.code===subject);
    b.onclick=()=>{subject=s.code;activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');renderSubjects();updateContext();renderSubjectDashboard()};
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
  const metas=asList(s.topics);const teach=s.teach&&s.teach.topics?s.teach.topics:{};
  let cards=metas.map(meta=>{const lesson=teach[meta.id]||{};const summary=lesson.big_picture||meta.common_term||'';return '<button class="lessonCard" data-topic="'+esc(meta.id)+'"><div class="lessonPriority">'+esc(meta.priority||'')+(meta.freq?' - '+esc(meta.freq):'')+'</div><div class="lessonTitle">'+esc(meta.name||meta.id)+'</div><div class="lessonSummary">'+esc(summary).slice(0,230)+'</div><div class="lessonMeta">'+esc(meta.cs_emphasis||'')+'</div></button>'}).join('');
  return '<div class="listHeader"><div><div class="eyebrow">Learn mode</div><h2>Topics</h2></div><div class="listCount">'+metas.length+' topics</div></div><div class="learnGrid">'+cards+'</div>';
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
  let rows=items.map((x,i)=>{let title='';let excerpt='';if(type==='RULE'){title=x.title||x.id||'Rule';excerpt=x.rule||''}if(type==='DEADLINE'){title=x.action||x.title||'Deadline';excerpt=[x.deadline,x.start,x.consequence].filter(Boolean).join(' - ')}if(type==='PROCEDURE'){title=x.title||x.name||x.action||'Procedure';excerpt=[x.steps,x.procedure,x.when,x.detail,x.source].filter(Boolean).map(v=>Array.isArray(v)?v.join(' '):String(v)).join(' - ')}if(type==='TRAP'){title=x.trap||x.title||'Exam trap';excerpt=x.rule||x.spot||x.attractive||''}return '<button class="contentRow" data-kind="'+type.toLowerCase()+'" data-index="'+i+'"><div class="rowTop"><span class="rowType">'+type+'</span><span class="rowMeta">'+esc(x.topic||'')+'</span></div><div class="rowTitle">'+esc(title)+'</div><div class="rowExcerpt">'+esc(excerpt).slice(0,280)+'</div></button>'}).join('');
  return '<div class="listHeader"><div><div class="eyebrow">'+esc(s.subject)+'</div><h2>'+label+'</h2></div><div class="listCount">'+items.length+' items</div></div><div class="contentList">'+rows+'</div>';
}

function bindRows(){
  $$('.lessonCard').forEach(b=>b.onclick=()=>openLesson(b.dataset.topic));
  $$('.contentRow').forEach(b=>b.onclick=()=>{const s=currentSubject();const i=Number(b.dataset.index);const kind=b.dataset.kind;if(kind==='question')openQuestion(asList(s.questions)[i]);if(kind==='rule')openRule(asList(s.rules)[i]);if(kind==='deadline')openDeadline(asList(s.deadlines)[i]);if(kind==='procedure')openProcedure(asList(s.procedures)[i]);if(kind==='trap')openTrap(asList(s.traps)[i])});
}

function enterFocus(){previousView={subject,activeTab};document.body.classList.add('focusMode')}
function exitFocus(){document.body.classList.remove('focusMode');renderSubjects();updateContext();renderSubjectDashboard()}
function focusHeader(){return '<div class="focusHeader"><button id="backBtn" class="backButton"><- Back</button></div>'}
function bindBack(){$('#backBtn').onclick=exitFocus}
function section(title,content,cls){if(content==null||content===''||(Array.isArray(content)&&!content.length))return'';let body=Array.isArray(content)?'<ul class="bulletList">'+content.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>'+esc(content)+'</p>';return '<section class="readSection '+(cls||'')+'"><h2>'+esc(title)+'</h2>'+body+'</section>'}

function openQuestion(q){
  enterFocus();
  let options=Object.entries(q.options||{}).map(([k,v])=>'<div class="optionBox"><strong>'+esc(k)+'.</strong> '+esc(v)+'</div>').join('');
  let wrong=Object.entries(q.option_expl||{}).map(([k,v])=>'<div class="conceptCard"><div class="conceptTerm">Option '+esc(k)+'</div><div class="conceptPlain">'+esc(v)+'</div></div>').join('');
  let answer='<div id="answerBlock" class="hiddenAnswer">'+section('Answer',(q.answer||'')+(q.answer_status?' - '+q.answer_status:''),'answer')+section('Explanation',q.explanation||q.official_explanation,'')+section('Tested rule',q.tested_rule,'rule')+section('Fastest route',q.fastest_route,'')+section('Exam trap',q.trap,'trap')+(wrong?'<section class="readSection"><h2>Option-by-option explanation</h2><div class="conceptTable">'+wrong+'</div></section>':'')+section('Answer basis',q.answer_basis,'warning')+section('Course material',q.course_material,'')+section('Contact Session guidance',q.cs_guidance,'')+section('Authority',q.authority,'')+'</div>';
  setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">'+esc(q.sitting||q.category||'Question')+'</div><h1 class="pageTitle">'+esc((q.label||'Question')+(q.qno?' - Q'+q.qno:''))+'</h1><div class="provenanceStrip">'+provenanceBadges(q)+'</div>'+section('Question',q.stem,'rule')+'<section class="readSection"><h2>Options</h2><div class="optionList">'+options+'</div><div class="answerReveal"><button id="revealBtn" class="revealButton">Reveal answer and explanation</button></div></section>'+answer+'</div>');
  bindBack();$('#revealBtn').onclick=()=>{$('#answerBlock').classList.add('revealed');$('#revealBtn').style.display='none'};
}

function openRule(r){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Rule - '+esc(r.topic||'')+'</div><h1 class="pageTitle">'+esc(r.title||r.id||'Rule')+'</h1>'+section('Core rule',r.rule,'rule')+section('When it applies',r.when,'')+section('Triggers',r.triggers,'')+section('Exception',r.exception,'')+section('Deadline',r.deadline,'')+section('Procedure',r.procedure,'')+section('Exam trap',r.trap,'trap')+section('Source',r.source,'')+section('Verification note',r.verify,'warning')+section('Detail',r.detail,'')+'</div>');bindBack()}
function openDeadline(d){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Deadline - '+esc(d.topic||'')+'</div><h1 class="pageTitle">'+esc(d.action||d.title||'Deadline')+'</h1>'+section('Deadline',d.deadline,'rule')+section('Starts from',d.start,'')+section('Exception',d.exception,'')+section('Consequence',d.consequence,'trap')+section('Source',d.source,'')+'</div>');bindBack()}
function openProcedure(p){enterFocus();let steps=p.steps||p.procedure||p.process||p.detail||'';setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Procedure - '+esc(p.topic||'')+'</div><h1 class="pageTitle">'+esc(p.title||p.name||p.action||'Procedure')+'</h1>'+section('When to use it',p.when||p.trigger||'','')+section('Procedure',Array.isArray(steps)?steps:String(steps),'rule')+section('Deadline',p.deadline||p.time_limit||'','')+section('Exam point',p.trap||p.exam_point||'','trap')+section('Source',p.source||'','')+'</div>');bindBack()}
function openTrap(t){enterFocus();setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">Exam trap - '+esc(t.topic||'')+'</div><h1 class="pageTitle">'+esc(t.trap||t.title||'Exam trap')+'</h1>'+section('Why it is attractive',t.attractive,'')+section('Correct rule',t.rule,'rule')+section('How to spot it',t.spot,'trap')+section('Related questions',asList(t.related_q),'')+section('Source',t.source,'')+'</div>');bindBack()}

function openLesson(topicId){
  const s=currentSubject();const meta=topicMeta(s,topicId)||{};const lesson=(s.teach&&s.teach.topics&&s.teach.topics[topicId])||{};enterFocus();
  let concepts=asList(lesson.core_concepts).map(c=>'<div class="conceptCard"><div class="conceptTerm">'+esc(c.term)+'</div><div class="conceptPlain">'+esc(c.plain)+'</div><div class="conceptLegal">'+esc(c.legal)+'</div></div>').join('');
  let how=asList(lesson.how_it_works).map(x=>'<li>'+esc(x)+'</li>').join('');
  let ex='';if(lesson.example)ex='<section class="readSection"><h2>Worked example</h2><div class="miniGrid"><div class="miniBlock"><div class="miniLabel">Facts</div>'+esc(lesson.example.facts||'')+'</div><div class="miniBlock"><div class="miniLabel">Working</div>'+esc(lesson.example.working||'')+'</div><div class="miniBlock"><div class="miniLabel">Result</div>'+esc(lesson.example.result||'')+'</div><div class="miniBlock"><div class="miniLabel">Source</div>'+esc(lesson.example.source||'')+'</div></div></section>';
  let conflicts=asList(lesson.conflict_teaching).map(c=>'<div class="conflictBox"><strong>Source:</strong> '+esc(c.what_source_says||'')+'<br><strong>Conflict:</strong> '+esc(c.conflict||'')+'<br><strong>Exam strategy:</strong> '+esc(c.strategy||'')+'</div>').join('');
  let checks=asList(lesson.learning_check).map(c=>'<details><summary>'+esc(c.q||'Check')+'</summary><div class="checkAnswer">'+esc(c.a||'')+'</div></details>').join('');
  setScreen('<div class="reader">'+focusHeader()+'<div class="readerMeta">'+esc(meta.priority||'')+(meta.freq?' - '+esc(meta.freq):'')+'</div><h1 class="pageTitle">'+esc(meta.name||topicId)+'</h1>'+section('Big picture',lesson.big_picture,'rule')+'<div class="miniGrid"><div class="miniBlock"><div class="miniLabel">Who</div>'+esc(lesson.who||'')+'</div><div class="miniBlock"><div class="miniLabel">When</div>'+esc(lesson.when||'')+'</div></div>'+section('Core rule',lesson.basic_rule,'rule')+(concepts?'<section class="readSection"><h2>Core concepts</h2><div class="conceptTable">'+concepts+'</div></section>':'')+(how?'<section class="readSection"><h2>How it works</h2><ol class="numberedList">'+how+'</ol></section>':'')+ex+section('Exceptions',asList(lesson.exceptions_plain),'')+section('How SILE tests it',lesson.exam_application,'')+(lesson.exam_trap_plain?'<div class="trapBox"><div class="miniLabel">Exam trap</div>'+esc(lesson.exam_trap_plain)+'</div>':'')+(asList(lesson.memory_version).length?'<div class="memoryBox"><div class="miniLabel">Memory version</div><ul class="bulletList">'+asList(lesson.memory_version).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+(conflicts?'<section class="readSection warning"><h2>Conflicts and exam strategy</h2>'+conflicts+'</section>':'')+(checks?'<section class="readSection"><h2>Self-check</h2><div class="checkList">'+checks+'</div></section>':'')+'</div>');
  bindBack();
}

function renderToolsContent(s){
  const items=Object.entries((s.teach&&s.teach.calculators)||{});
  if(!items.length)return '<div class="dataPanel"><h2>No calculator definitions for this subject</h2><p>Use the rules and procedure tabs for the subject reference material.</p></div>';
  return '<div class="listHeader"><div><div class="eyebrow">'+esc(s.subject)+'</div><h2>Tools and calculators</h2></div><div class="listCount">'+items.length+' tools</div></div><div class="toolsGrid">'+items.map(([id,x])=>'<div class="toolCard"><div class="rowType">'+esc(id)+'</div><h3>'+esc(x.title||id)+'</h3><p>'+esc(x.why||x.interpret||'Decision aid from verified dataset.')+'</p></div>').join('')+'</div>';
}
function renderTools(){const s=currentSubject();if(s){activeTab='tools';renderSubjectDashboard();return}const subs=DATA.subjects.filter(x=>x.paper===paper);let cards='';subs.forEach(x=>{cards+='<section class="essentialBlock"><h3>'+esc(x.subject)+'</h3>'+renderToolsContent(x)+'</section>'});setScreen('<h1 class="pageTitle">Tools and calculators</h1>'+cards)}

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

function renderData(){setScreen('<div class="dataPanel"><div class="eyebrow">Offline data</div><h1 class="pageTitle">Local dataset</h1><p><strong>'+questionCount()+' questions</strong> are stored locally in IndexedDB on this iPad.</p><div class="dataActions"><button id="replaceData" class="primaryButton">Replace verified JSON</button><button id="backupData" class="secondaryButton">Export backup</button></div><div class="dataNote">The public GitHub Pages site contains only the application shell. Your imported SILE dataset is not uploaded to GitHub.</div></div>');$('#replaceData').onclick=()=>$('#fileInput').click();$('#backupData').onclick=backup}
function renderSetup(){setScreen('<div class="dataPanel"><div class="eyebrow">Setup</div><h1 class="pageTitle">Import verified SILE data</h1><p>Import the verified JSON once. The dataset is then stored locally on this iPad.</p><div class="dataActions"><button id="importNow" class="primaryButton">Choose JSON file</button></div></div>');$('#importNow').onclick=()=>$('#fileInput').click()}

async function importFile(file){const o=JSON.parse(await file.text());if(!Array.isArray(o.subjects)||o.subjects.length!==8)throw new Error('Expected 8-subject SILE dataset');const q=o.subjects.reduce((n,s)=>n+asList(s.questions).length,0);if(q!==323)throw new Error('Expected 323 questions, found '+q);await dbPut('dataset',o);DATA=o;flatten();subject='';activeTab=mode==='learn'?'learn':'overview';updateStatus();renderSubjects();updateContext();renderPaperDashboard();toast('Verified dataset stored locally')}
async function backup(){if(!DATA)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(DATA)],{type:'application/json'}));a.download='SILE_iPad_dataset_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function bindStatic(){
  $$('[data-paper]').forEach(b=>b.onclick=()=>{paper=Number(b.dataset.paper);subject='';activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');$$('[data-paper]').forEach(x=>x.classList.toggle('active',x===b));renderSubjects();updateContext();renderPaperDashboard()});
  $$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;activeTab=mode==='learn'?'learn':'overview';document.body.classList.remove('focusMode');$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateContext();if(subject)renderSubjectDashboard();else renderPaperDashboard()});
  $('#searchBtn').onclick=()=>{document.body.classList.remove('focusMode');renderSearch()};
  $('#statusBtn').onclick=()=>{document.body.classList.remove('focusMode');renderData()};
  $('#toolsBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderTools()}};
  $('#dataBtn').onclick=()=>{if(DATA){document.body.classList.remove('focusMode');renderData()}};
  $('#fileInput').onchange=async e=>{const f=e.target.files&&e.target.files[0];try{if(f)await importFile(f)}catch(err){alert('Import failed: '+err.message)}finally{e.target.value=''}};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();renderSearch()}});
}

async function init(){await openDB();DATA=await dbGet('dataset');if(DATA)flatten();updateStatus();renderSubjects();updateContext();bindStatic();if(DATA)renderPaperDashboard();else renderSetup();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}
init();
