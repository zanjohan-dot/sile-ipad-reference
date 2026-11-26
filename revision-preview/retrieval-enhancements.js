/* Local evidence retrieval. No network calls, generated answers, or persistent question storage. */
(function(){
"use strict";
const STOP=new Set("the a an and or but on at in is are was were this that which what with from by to for as of it if can may should would then when where how why have has had be been into does do you your their they we such not only under section act rule company singapore person persons more less question correct following statement statements".split(" "));
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalize=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokens=s=>String(s||"").toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g)?.filter(w=>(w.length>1||/^[0-9]$/.test(w))&&!STOP.has(w))||[];
let lastText="",lastMatches=[],lastSubjectScope=false,lastAll=true;

const HISTORY_KEY="sile_preview_search_history_v1";
let inputTimer=null,visibleLimit=25,returnToQuestion=null;
function history(){
 try{
  const stored=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
  return Array.isArray(stored)?stored.filter(s=>typeof s==="string").slice(0,12):[];
 }catch(_){return [];}
}
function saveHistory(values){
 try{localStorage.setItem(HISTORY_KEY,JSON.stringify(values));}catch(_){}
}
function remember(){
 const q=lastText.trim();
 if(q&&!similarSource){
  saveHistory([q,...history().filter(s=>normalize(s)!==normalize(q))].slice(0,12));
  showHistory();
 }
}
function showHistory(){
 const box=document.getElementById("findHistory");
 if(!box)return;
 const values=history();
 box.hidden=!values.length;
 box.innerHTML='<h2 class="sectionTitle">Recent searches</h2><div class="findControls">'+
  values.map((q,i)=>'<button class="secondaryButton" data-history="'+i+'">'+E(q.length>78?q.slice(0,78)+"…":q)+'</button>').join("")+
  '<button class="secondaryButton" id="clearFindHistory">Clear history</button></div>';
 box.querySelectorAll("[data-history]").forEach(el=>el.onclick=()=>{
  lastText=values[Number(el.dataset.history)];
  similarSource=null;
  document.getElementById("findQuery").value=lastText;
  submitSearch();
 });
 document.getElementById("clearFindHistory").onclick=()=>{saveHistory([]);showHistory();};
}
function open(it,resultIndex,focusSelector){
 remember();
 const context={paper,subject};
 const searchState={lastText,lastAll,lastSubjectScope,similarSource,visibleLimit,returnToQuestion};
 const scroll=document.getElementById("screen").scrollTop;
 subject=it.code;paper=it.paper;
 function sync(){
  document.querySelectorAll("[data-paper]").forEach(b=>b.classList.toggle("active",Number(b.dataset.paper)===paper));
  renderSubjects();
  updateContext();
 }
 sync();
 if(it.type==="RULE")openRule(it.obj);
 else if(it.type==="DEADLINE")openDeadline(it.obj);
 else if(it.type==="TRAP")openTrap(it.obj);
 else if(it.type==="PROCEDURE")openProcedure(it.obj);
 else if(it.type==="LESSON")openLesson(it.topicId);
 else if(it.type==="QUESTION")openQuestion(it.obj);
 const back=document.getElementById("backBtn");
 if(back){
  const label=document.getElementById("questionBackLabel");
  if(label){
   label.innerHTML='Back<span class="questionBackSuffix"> to results</span>';
   back.setAttribute("aria-label","Back to results");
  }else back.textContent="Back to results";
  back.onclick=()=>{
   ({paper,subject}=context);
   ({lastText,lastAll,lastSubjectScope,similarSource,visibleLimit,returnToQuestion}=searchState);
   sync();
   render(true);
   document.querySelector(focusSelector||'[data-find-index="'+resultIndex+'"]')?.focus({preventScroll:true});
   document.getElementById("screen").scrollTop=scroll;
  };
 }
}
const aliases = [
 ["annual general meeting", "agm"],
 ["extraordinary general meeting", "egm"],
 ["personal data protection act", "pdpa"],
 ["securities and futures act", "sfa"],
 ["insolvency restructuring and dissolution act", "irda"],
 ["takeover code", "take over code"],
 ["goods and services tax", "gst"],
 ["intellectual property", "ip"],
 ["intellectual property office of singapore", "ipos"],
 ["monetary authority of singapore", "mas"],
 ["singapore exchange", "sgx"],
 ["competition and consumer commission of singapore", "cccs"],
 ["letter of demand", "lod"],
 ["ad valorem stamp duty", "avd"],
 ["private placement", "small group offer"],
 ["judicial management", "jm"],
 ["non disclosure agreement", "nda", "confidentiality agreement"],
 ["passing off", "misrepresenting goods as someone else's"],
 ["winding up", "wind up", "liquidation", "liquidate the company"],
 ["inability to pay", "cannot pay its debts", "company can t pay debts", "company cannot pay debts"],
 ["arrest of ship", "ship arrest", "arrest a vessel", "arrest a ship"],
 ["contract in restraint of trade", "non compete clause", "restraint of trade"],
 ["exclusive dealing", "exclusive supply arrangement"],
 ["substantial lessening of competition", "slc", "merger reduces competition"],
 ["transfer pricing", "related party pricing"],
 ["statutory demand", "formal demand for payment"]
];
const normalizedAliases = aliases.map(group=>group.map(normalize));
const contentTokens = s=>new Set(tokens(normalize(s)));
const text = v=>typeof v==="string"?v:Array.isArray(v)?v.map(text).join(" "):"";
const excluded = x=>String(x.obj?.answer_status||"").toUpperCase()==="EXCLUDED";
let indexedFlat=null,index=null,similarSource=null;

function addLookup(map,key,doc){
 if(!key)return;
 if(!map.has(key))map.set(key,[]);
 map.get(key).push(doc);
}

function sessionKey(s){
 const year=s.match(/\b20\d{2}\b/)?.[0];
 const number=s.match(/\b(?:s|session\s*)([12])\b/)?.[1]||
   (/\b(?:dec|december)\b/.test(s)?"2":/\b(?:jun|june)\b/.test(s)?"1":"");
 return year&&number?year+"-"+number:"";
}

const studyAliases=normalizedAliases.concat([
 ["arrest procedure","stop a vessel from leaving","keep a ship in port","ship arrest"],
 ["scheme of arrangement","restructuring plan","plan with its creditors","negotiate with creditors"],
 ["trade mark","trademark","brand logo"],
 ["stamp duty","transfer of property"]
].map(group=>group.map(normalize)));
// Fit a TF-IDF classifier to labelled course topics in the locally imported bank.
function studyFeatures(value){
 const query=normalize(value);
 const features=contentTokens(query);
 for(const group of studyAliases){
  if(group.some(phrase=>containsPhrase(query,phrase)))for(const word of contentTokens(group[0]))features.add(word);
 }
 return new Set([...features].filter(word=>word.length>=3&&/[a-z]/.test(word)).map(word=>
  word.length>5?word.replace(/ies$/,"y").replace(/(?:ing|ed|s)$/,""):word));
}
function fitStudyTopics(items){
 const topics=new Map();
 for(const item of items){
  const key=item.type==="LESSON"?item.topicId:item.type==="QUESTION"?item.obj.topic:null;
  if(!key||excluded(item))continue;
  if(!topics.has(key))topics.set(key,{key,counts:new Map(),examples:[],paper:item.paper,code:item.code});
  const row=topics.get(key);
  let features;
  if(item.type==="LESSON"){
   row.lesson=item;
   row.labelFeatures=studyFeatures(item.title);
   features=studyFeatures(item.title+" "+item.text);
  }else{
   const q=item.obj;
   features=studyFeatures([q.stem,q.tested_rule,q.really_testing,q.subtopic,text(q.keywords)].filter(Boolean).join(" "));
   row.examples.push({item,features});
  }
  for(const term of features)row.counts.set(term,(row.counts.get(term)||0)+1);
 }
 const frequency=new Map();
 for(const row of topics.values())for(const token of row.counts.keys())frequency.set(token,(frequency.get(token)||0)+1);
 const idf=new Map([...frequency].map(([token,count])=>[token,Math.log(1+topics.size/(1+count))]));
 for(const row of topics.values()){
  const weights=new Map([...row.counts].map(([token,count])=>[token,idf.get(token)*Math.log1p(count)]));
  const norm=Math.hypot(...weights.values())||1;
  row.vector=new Map([...weights].map(([token,value])=>[token,value/norm]));
 }
 return {topics:[...topics.values()],idf};
}
function classifyStudyQuery(query,model){
 const features=studyFeatures(query), terms=[...features].filter(term=>model.idf.has(term));
 if(!terms.length||terms.length/Math.max(1,features.size)<.42)return [];
 return model.topics.filter(row=>(lastAll||row.paper===paper)&&(!lastSubjectScope||!subject||row.code===subject))
  .map(row=>{
   const matched=terms.filter(term=>row.vector.has(term));
   const strength=matched.reduce((sum,term)=>sum+row.vector.get(term)*model.idf.get(term),0);
   const labelMatch=matched.filter(term=>row.labelFeatures?.has(term));
   const labelBonus=labelMatch.length>=2?.08:0;
   return {row,matched,score:strength/(Math.hypot(...terms.map(term=>model.idf.get(term)))||1)+labelBonus};
  }).filter(hit=>hit.score>=.09&&(hit.matched.length>=2||terms.length===1&&model.idf.get(terms[0])>=3))
  .sort((a,b)=>b.score-a.score).slice(0,3).map(({row,matched})=>{
   const examples=row.examples.map(({item,features})=>({item,score:matched.reduce((sum,term)=>sum+(features.has(term)?model.idf.get(term):0),0)}))
    .sort((a,b)=>b.score-a.score);
   return {title:row.lesson?.title||row.examples[0]?.item.obj.subtopic||row.key,lesson:row.lesson,
    question:examples[0]?.item,subject:row.lesson?.subject||examples[0]?.item.subject};
  });
}
function makeIndex(items){
 const docs=[],postings=new Map(),ids=new Map(),sessions=new Map(),stems=new Map(),optionLookup=new Map();
 const lessons=new Map(items.filter(it=>it.type==="LESSON").map(it=>[it.topicId,it.title]));
 const lessonDocs=new Map();
 const subjects=new Map(items.map(it=>[normalize(it.subject),it.code]));
 const codes=new Map([...subjects.values()].map(code=>[normalize(code),code]));
 for(const it of items){
  const q=it.type==="QUESTION"?it.obj:null;
  const title=normalize(it.title);
  const stem=q?normalize(q.stem):"";
  const options=q?Object.values(q.options||{}).map(normalize).filter(Boolean):[];
  const topic=q?normalize([q.topic,lessons.get(q.topic),q.subtopic].join(" ")):"";
  const issue=q?contentTokens([q.tested_rule,q.really_testing,q.subtopic,text(q.keywords),q.authority].join(" ")):new Set();
  const key=Number(normalize(q?.qno).match(/\b\d+\b/)?.[0])||null;
  const sitting=normalize(q?.sitting);
  const weighted=new Map();
  const add=(value,weight)=>{
   const frequency=new Map();
   for(const word of tokens(normalize(value)))frequency.set(word,(frequency.get(word)||0)+1);
   for(const [word,count] of frequency)weighted.set(word,(weighted.get(word)||0)+weight*(1+Math.log(Math.min(count,4))*.25));
  };
  add(title,6);
  add(it.text,1);
  add([it.subject,it.code,topic].join(" "),q?3:2);
  if(q){
   add([stem,options.join(" ")].join(" "),5);
   add([q.authority,q.tested_rule,text(q.keywords)].join(" "),3);
  }
  const passages=q?[stem,...options,topic,normalize(q.authority),normalize(q.tested_rule)]:[title,normalize(it.text)];
  const doc={it,stem,options,topic,issue,key,sitting,passages,title};
  docs.push(doc);
  if(it.type==="LESSON")lessonDocs.set(it.topicId,doc);
  addLookup(ids,normalize(q?.id),doc);
  addLookup(stems,stem,doc);
  for(const option of new Set(options))addLookup(optionLookup,option,doc);
  addLookup(sessions,sitting,doc);
  if(key)addLookup(sessions,sitting+" q"+normalize(q.qno),doc);
  if(q?.category==="PAST")addLookup(sessions,sessionKey(sitting),doc);
  for(const [word,weight] of weighted){
   if(!postings.has(word))postings.set(word,[]);
   postings.get(word).push({doc,weight});
  }
 }
 return {docs,postings,ids,sessions,stems,optionLookup,subjects,codes,lessonDocs,spelling:new Map(),studyTopics:null};
}

function getIndex(){
 if(indexedFlat!==flat){index=makeIndex(flat);indexedFlat=flat;}
 return index;
}

function containsPhrase(value,phrase){
 return value===phrase||(" "+value+" ").includes(" "+phrase+" ");
}

function editDistanceOne(a,b){
 if(a===b||Math.abs(a.length-b.length)>1)return false;
 if(a.length>b.length)return editDistanceOne(b,a);
 let i=0;
 while(i<a.length&&a[i]===b[i])i++;
 if(a.length!==b.length)return a.slice(i)===b.slice(i+1);
 return a.slice(i+1)===b.slice(i+1)||
   (a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
}

function spellingCandidates(word,idx){
 if(idx.spelling.has(word))return idx.spelling.get(word);
 const matches=[];
 for(const candidate of idx.postings.keys()){
  if(editDistanceOne(word,candidate))matches.push(candidate);
  if(matches.length>6)break;
 }
 const result=matches.length<=6?matches:[];
 // Keep repeated spelling work bounded when a long session contains many queries.
 if(idx.spelling.size>=512)idx.spelling.clear();
 idx.spelling.set(word,result);
 return result;
}

function matchesOptions(remainder,options){
 if(!options.length)return !remainder;
 const unlabelled=remainder.replace(/^[a-h] /,"");
 for(let i=0;i<options.length;i++){
  const option=options[i];
  for(const value of new Set([remainder,unlabelled])){
   if(value===option||value.startsWith(option+" ")){
    if(matchesOptions(value.slice(option.length).trimStart(),options.filter((_,j)=>j!==i)))return true;
   }
  }
 }
 return false;
}

function questionMatch(doc,query){
 if(!doc.stem)return false;
 if(query===doc.stem)return true;
 return doc.options.length>0&&query.startsWith(doc.stem+" ")&&
   matchesOptions(query.slice(doc.stem.length+1),doc.options);
}

function structuredMatches(query,idx){
 const exactId=idx.ids.get(query);
 if(exactId)return {docs:exactId,idMatch:true};
 const complete=idx.sessions.get(query);
 if(complete)return {docs:complete,idMatch:false};
 const numbered=query.match(/(?:^| )(?:q\s*|question\s+)(\d{1,3})$/);
 const key=numbered?Number(numbered[1]):null;
 let session=numbered?query.slice(0,numbered.index).trim():query;
 const direct=idx.sessions.get(session);
 if(direct)return {docs:direct.filter(d=>!key||d.key===key),idMatch:false};
 const paperMatch=session.match(/\bpaper\s*([12])\b/);
 const scopePaper=Number(paperMatch?.[1])||null;
 if(paperMatch)session=session.replace(paperMatch[0],"").replace(/\bccp\b/,"").trim();
 let code="";
 for(const [name,subjectCode] of [...idx.subjects,...idx.codes]){
  if(name&&containsPhrase(session,name)){
   code=subjectCode;
   session=session.replace(name," ").trim().replace(/\s+/g," ");
   break;
  }
 }
 const compact=session.match(/^(?:(?:dec(?:ember)?|jun(?:e)?) 20\d{2}|20\d{2} (?:(?:s|session\s*)[12](?: (?:dec(?:ember)?|jun(?:e)?))?)|(?:dec(?:ember)?|jun(?:e)?) 20\d{2} \d{1,3})$/);
 if(!key&&compact&&/ \d{1,3}$/.test(session)){
  const number=session.match(/ (\d{1,3})$/)[1];
  return structuredMatches(query.slice(0,-number.length)+"q"+number,idx);
 }
 const docs=compact?idx.sessions.get(sessionKey(session)):null;
 if(!docs&&!compact&&!numbered?.index&&key)return {docs:idx.docs.filter(d=>d.key===key),idMatch:false};
 if(docs||compact)return {docs:(docs||[]).filter(d=>(!key||d.key===key)&&(!scopePaper||d.it.paper===scopePaper)&&(!code||d.it.code===code)),idMatch:false};
 return null;
}

function evidence(){
 if(!DATA)return [];
 const query=normalize(lastText);
 if(!query)return [];
 const idx=getIndex();
 const allowed=d=>(lastAll||d.it.paper===paper)&&(!lastSubjectScope||!subject||d.it.code===subject);
 if(similarSource){
  const source=idx.ids.get(normalize(similarSource.id))?.[0];
  if(!source)return [];
  return idx.docs.filter(d=>d.key&&d!==source&&allowed(d)&&!excluded(d.it)).map(d=>{
   const sameTopic=d.it.obj.topic&&d.it.obj.topic===source.it.obj.topic;
   let common=0,rare=0,weight=0;
   for(const t of source.issue)if(d.issue.has(t)){
    common++;
    const frequency=idx.postings.get(t)?.length||0;
    if(frequency<idx.docs.length*.18)rare++;
    weight+=Math.log(1+idx.docs.length/(1+frequency));
   }
   const score=weight/Math.sqrt(Math.max(1,Math.min(d.issue.size,source.issue.size)))+(sameTopic?6:0)+(d.stem&&d.stem===source.stem?12:0);
   return {...d.it,score,similar:sameTopic||(common>=2&&rare>=1&&common/Math.max(1,Math.min(source.issue.size,d.issue.size))>=.15)};
  }).filter(x=>x.similar).sort((a,b)=>b.score-a.score);
 }
 const structured=structuredMatches(query,idx);
 if(structured)return structured.docs.filter(allowed).map(d=>({...d.it,idMatch:structured.idMatch,score:1,matched:[]}));
 const terms=contentTokens(query);
 const expanded=new Map();
 for(const group of normalizedAliases){
  const match=group.find(p=>containsPhrase(query,p));
  if(!match)continue;
  for(const phrase of group)if(phrase!==match)expanded.set(phrase,[...contentTokens(phrase)]);
 }
 const work=new Map();
 function candidate(doc){
  if(!work.has(doc))work.set(doc,{score:0,matched:new Set(),alternate:false});
  return work.get(doc);
 }
 for(const word of terms){
  const literal=idx.postings.get(word);
  const alternatives=!literal&&word.length>=5&&/^[a-z]+$/.test(word)&&terms.size<=8?spellingCandidates(word,idx):[];
  for(const variant of literal?[word]:alternatives){
   const postings=idx.postings.get(variant);
   const idf=Math.log(1+(idx.docs.length+.5)/(postings.length+.5));
   for(const {doc,weight} of postings){
    if(!allowed(doc))continue;
    const row=candidate(doc);
    row.matched.add(word);
    row.score+=idf*weight*(literal?1:.5);
   }
  }
 }
 for(const [phrase,words] of expanded){
  if(!words.length||words.some(t=>!idx.postings.has(t)))continue;
  const seed=words.reduce((a,b)=>idx.postings.get(a).length<=idx.postings.get(b).length?a:b);
  for(const {doc} of idx.postings.get(seed)){
   if(!allowed(doc)||!doc.passages.some(p=>containsPhrase(p,phrase)))continue;
   const row=candidate(doc);
   row.alternate=true;
   row.score=Math.max(row.score,30+words.length*3);
  }
 }

 for(const doc of [...(idx.stems.get(query)||[]),...(idx.optionLookup.get(query)||[])])if(allowed(doc))candidate(doc);
 // Very short stems and options can consist entirely of stop words.
 if(query.length>10)for(const doc of idx.docs)if(doc.stem&&query.startsWith(doc.stem+" ")&&allowed(doc))candidate(doc);
 const out=[];
 for(const [doc,row] of work){
  const exact=questionMatch(doc,query);
  const phrase=doc.options.includes(query)||(query.length>=5&&doc.passages.some(p=>containsPhrase(p,query)));
  const coverage=row.matched.size/Math.max(1,terms.size);
  if(!exact&&!phrase&&!row.alternate&&(coverage<.55||row.score<6))continue;
  if(excluded(doc.it)&&!exact&&!phrase)continue;
  const primary=doc.stem&&containsPhrase(doc.stem,query);
  const standaloneOption=doc.options.includes(query);
  const option=standaloneOption||doc.options.some(p=>containsPhrase(p,query));
  const score=row.score*(.25+.75*coverage)+(standaloneOption?280:primary?190:option?145:phrase?75:0)+
   (containsPhrase(doc.topic,query)?135:0);
  out.push({...doc.it,score,matched:[...row.matched],exact});
 }
 const rank=(a,b)=>Number(b.exact)-Number(a.exact)||b.score-a.score;
 out.sort(rank);
 const linked=new Set(out.filter(x=>x.type==="LESSON").map(x=>x.topicId));
 for(const hit of out.filter(x=>x.type==="QUESTION"&&!excluded(x)).slice(0,6)){
  const lesson=idx.lessonDocs.get(hit.obj.topic);
  if(!lesson||!allowed(lesson)||linked.has(lesson.it.topicId))continue;
  linked.add(lesson.it.topicId);
  out.push({...lesson.it,score:hit.score*.2,matched:[],exact:false});
 }
 return out.sort(rank);

}
function show(){
 const box=document.getElementById("findResults");
 if(!box)return;
 const answer=document.getElementById("recordedAnswer");
 answer.replaceChildren();
 lastMatches=evidence();
 if(!lastText.trim()){
  box.innerHTML='<div class="emptyHint">Search by question text, answer choice, question ID, legal term or citation.</div>';
  return;
 }
 const hasAnswer=!similarSource&&showRecordedAnswer(answer);
 if(!lastMatches.length){
  box.innerHTML=hasAnswer?"":'<div class="emptyHint">'+(similarSource?"No related questions found.":"No local matches. Try a distinctive phrase or question ID and check the paper filters.")+'</div>';
  return;
 }
 const groups=["Exact Question Matches","Similar Past-Year Questions","SILE Sample Questions","Learning Materials","Legal References","Excluded Questions"];
 const rows=groups.map(()=>[]);
 const groupIndex=x=>{
  if(excluded(x))return 5;
  if(x.exact||x.idMatch)return 0;
  if(x.type==="QUESTION"){
   const category=String(x.obj.category||"").toUpperCase();
   if(category==="PAST")return 1;
   if(category==="SAMPLE")return 2;
   return 3;
  }
  return x.type==="LESSON"?3:4;
 };
 lastMatches.forEach((x,i)=>rows[groupIndex(x)].push({x,i}));
 const count=lastMatches.length-rows[5].length;
 box.innerHTML='<div class="listHeader"><h2>'+(similarSource?'Questions on related issues':'Search results')+'</h2><div class="listCount">'+
   count+' matches'+(rows[5].length?' · '+rows[5].length+' excluded':'')+'</div></div>'+
   (similarSource?'<p class="pageLead">Related issues from '+E(similarSource.id)+'. Review each question’s facts and recorded answer separately.</p>':'')+
   rows.map((group,g)=>{
    if(!group.length)return "";
    const shown=(g===0||g===5)?group:group.slice(0,visibleLimit);
    return '<section class="readSection"><h2>'+groups[g]+' ('+group.length+')</h2>'+
     shown.map(({x,i})=>'<button class="contentRow" data-find-index="'+i+'"><div class="rowTop"><span class="rowType">'+E(x.type)+'</span><span class="rowMeta">Paper '+E(x.paper)+' · '+E(x.subject)+'</span></div><div class="rowTitle">'+E(x.type==="QUESTION"?(x.obj.id||x.title):x.title)+'</div><div class="rowExcerpt">'+E(String(x.type==="QUESTION"?x.obj.stem:x.text).slice(0,350))+'</div><div class="sourceMeta">'+
     E([x.obj?.sitting,x.obj?.answer_status].filter(Boolean).join(" · "))+'</div></button>').join("")+
     (shown.length<group.length?'<p class="readerMeta">Showing '+shown.length+' of '+group.length+'</p>':'')+'</section>';
   }).join("")+(rows.some((group,i)=>i!==0&&i!==5&&group.length>visibleLimit)?'<button class="secondaryButton" id="showMoreMatches">Show more results</button>':'');
 box.querySelectorAll("[data-find-index]").forEach(el=>el.onclick=()=>open(lastMatches[Number(el.dataset.findIndex)],Number(el.dataset.findIndex)));
 const more=document.getElementById("showMoreMatches");
 if(more)more.onclick=()=>{visibleLimit+=25;show();};
}
function showStudyMatches(box){
 const idx=getIndex();
 idx.studyTopics??=fitStudyTopics(flat);
 const related=classifyStudyQuery(lastText,idx.studyTopics);
 if(!related.length){
  return false;
 }
 box.innerHTML='<section class="readSection"><h2>Likely study topics</h2><p>Matched against your study materials. Open a source to check its wording and answer status.</p>'+
  related.map((hit,i)=>'<div class="readSection"><h3>'+E(hit.title)+'</h3><div class="sourceMeta">'+E(hit.subject)+'</div>'+
   '<div class="studyActions">'+(hit.lesson?'<button class="secondaryButton" data-study-lesson="'+i+'">Read lesson</button>':'')+
   (hit.question?'<button class="secondaryButton" data-study-question="'+i+'">Open '+E(hit.question.obj.id)+'</button>':'')+'</div></div>').join("")+'</section>';
 box.querySelectorAll("[data-study-lesson],[data-study-question]").forEach(button=>{
  button.onclick=()=>{
   const hit=related[Number(button.dataset.studyLesson??button.dataset.studyQuestion)];
   const type=button.dataset.studyLesson===undefined?"question":"lesson";
   const selector='[data-study-'+type+'="'+(button.dataset.studyLesson??button.dataset.studyQuestion)+'"]';
   open(hit[type],undefined,selector);
  };
 });
 return true;
}
function showRecordedAnswer(box){
 const exact=lastMatches.filter(it=>it.type==="QUESTION"&&(it.idMatch||it.exact));
 if(!exact.length)return showStudyMatches(box);
 if(exact.length>1){
  box.textContent="Several records match this wording. Use the question ID or choose a result.";
  return true;
 }
 const [item]=exact, q=item.obj;
 const status=String(q.answer_status||"").toUpperCase();
 const hasKey=(status==="OFFICIAL"||status==="DERIVED")&&q.answer;
 const label=status==="OFFICIAL"?"Official SILE answer":status==="DERIVED"?"Derived answer · subject to audit":status==="EXCLUDED"?"Excluded from practice":"Unresolved · unscored";
 const key=hasKey?q.answer:"No settled answer recorded";
 const option=hasKey?q.options?.[key]:"";
 const details='<p>'+E(key)+'</p>'+(option?'<div>'+E(option)+'</div>':'')+'<div class="sourceMeta">'+E(label)+'</div>';
 box.innerHTML='<section class="readSection questionKey"><h2>Recorded answer · '+E(q.id)+'</h2>'+
  (mode==="learn"&&hasKey?'<details><summary>Show recorded answer</summary>'+details+'</details>':details)+
  '<div class="studyActions"><button class="secondaryButton" id="openRecordedAnswer">Open source question</button></div></section>';
 document.getElementById("openRecordedAnswer").onclick=()=>open(item,lastMatches.indexOf(item),"#openRecordedAnswer");
 return true;
}
function submitSearch(){
 clearTimeout(inputTimer);
 visibleLimit=25;
 remember();
 show();
}
function render(preserve=false){
 if(!DATA)return;
 clearTimeout(inputTimer);
 document.body.classList.remove("focusMode","navOpen");
 if(!preserve){
  lastText="";
  lastAll=true;
  lastSubjectScope=false;
  similarSource=null;
  returnToQuestion=null;
  visibleLimit=25;
 }
 setScreen('<div class="findPage"><h1 class="pageTitle">'+(similarSource?'Similar questions':'Search')+'</h1>'+(returnToQuestion?'<button id="returnToQuestion" class="backButton">← Back to question</button>':'')+'<div class="searchPanel"><label class="findLabel" for="findQuery">Question, key facts or legal issue</label><textarea id="findQuery" rows="3" placeholder="e.g. Dec 2025 Q18, BF-D25-01 or ship arrest"></textarea><div class="findControls"><label><input id="findSubjectOnly" type="checkbox" '+(lastSubjectScope?"checked":"")+(subject?"":" disabled")+'> This subject only</label><label><input id="findAllPapers" type="checkbox" '+(lastAll?"checked":"")+'> Include both papers</label><button id="findNow" class="primaryButton">Search</button></div></div><div id="recordedAnswer" aria-live="polite"></div><div id="findResults" class="searchResults" aria-live="polite"></div><div id="findHistory"></div></div>');
 const backToQuestion=document.getElementById("returnToQuestion");
 if(backToQuestion)backToQuestion.onclick=returnToQuestion;
 const input=document.getElementById("findQuery");
 input.value=lastText;
 input.oninput=e=>{
  lastText=e.target.value;
  similarSource=null;
  returnToQuestion=null;
  visibleLimit=25;
  clearTimeout(inputTimer);
  inputTimer=setTimeout(show,170);
 };
 input.onkeydown=e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitSearch();}
 };
 document.getElementById("findNow").onclick=submitSearch;
 document.getElementById("findSubjectOnly").onchange=e=>{lastSubjectScope=e.target.checked;visibleLimit=25;show();};
 document.getElementById("findAllPapers").onchange=e=>{lastAll=e.target.checked;visibleLimit=25;show();};
 showHistory();
 show();
}
window.SILEFIND={
 render,
 findSimilar:(q,back)=>{
  returnToQuestion=back;
  similarSource=q;
  lastText=String(q.really_testing||q.tested_rule||q.stem||q.id);
  lastAll=true;
  lastSubjectScope=false;
  visibleLimit=25;
  render(true);
 },
 get lastMatches(){return lastMatches;}
};
})();
