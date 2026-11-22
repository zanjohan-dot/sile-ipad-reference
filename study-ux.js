/* SILE beginner learning and procedure presentation — shell only; no private course content. */
(function(root){
"use strict";
const esc=v=>String(v===null||v===undefined?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeArr=v=>Array.isArray(v)?v:[];
const filled=v=>typeof v==="string"&&v.trim().length>0;
const paragraph=v=>filled(v)?"<p>"+esc(v)+"</p>":"";
const bullets=(a,ordered=false)=>safeArr(a).length?"<"+(ordered?"ol":"ul")+" class='"+(ordered?"numberedList":"bulletList")+"'>"+a.map(x=>"<li>"+esc(x)+"</li>").join("")+"</"+(ordered?"ol":"ul")+">":"";
const block=(title,v,css="")=>(filled(v)||safeArr(v).length)?'<section class="readSection '+css+'"><h2>'+esc(title)+'</h2>'+(Array.isArray(v)?bullets(v):paragraph(v))+'</section>':"";
function procedurePreview(p){
 const s=safeArr(p.steps);
 return s.slice(0,2).map((x,i)=>(i+1)+". "+String(x.step||"")).join("  •  ")+(s.length>2?"  •  "+s.length+" steps total":"");
}
function procedure(p,related=[]){
 const steps=safeArr(p.steps);
 let html='<div class="eyebrow">Guided procedure • '+steps.length+' steps</div><h1 class="pageTitle">'+esc(p.title||"Procedure")+'</h1>'+
 '<p class="pageLead">Follow the steps in order. Each step identifies who acts, what they must do, any preconditions or deadlines, and what happens if the requirement is missed.</p>'+
 '<div class="dataNote">The legal steps below come from the imported source material. A blank field means the source did not specify it; it does not mean that no requirement exists.</div>';
 if(!steps.length)return html+'<section class="readSection warning"><h2>Missing procedure</h2><p>No steps were supplied in this dataset.</p></section>';
 html+='<ol class="procedureSteps">';
 steps.forEach((s,i)=>{
  const fields=[
   ["Who acts",s.party],["Before this step",s.precondition],["Document or evidence",s.document],
   ["When or deadline",s.deadline],["If not satisfied",s.consequence],["Source",s.source]
  ].filter(x=>filled(x[1]));
  html+='<li class="procedureStep"><div class="procedureNum">STEP '+(i+1)+' OF '+steps.length+'</div><h2>'+esc(s.step||"Action not supplied")+'</h2>'+
    (fields.length?'<dl class="procedureFacts">'+fields.map(x=>'<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>').join("")+'</dl>':
    '<p class="readerMeta">No additional step details supplied.</p>')+'</li>';
 });
 html+='</ol>';
 if(related.length)html+='<section class="readSection"><h2>Questions testing this topic</h2><div class="relatedQuestions">'+related.slice(0,10).map(q=>'<button type="button" class="relatedQuestion" data-related-id="'+esc(q.id)+'">'+esc(q.label||q.id)+(q.qno?" · Q"+esc(q.qno):"")+' <small>'+esc(q.answer_status||"")+'</small></button>').join("")+'</div></section>';
 html+='<div class="memoryBox"><strong>How to revise this procedure</strong><p>Explain aloud what each party does, the order of the steps, and what changes if a precondition is not met. Return to the sources before memorising a statutory threshold.</p></div>';
 return html;
}
function conceptCards(arr){
 const a=safeArr(arr);
 return a.length?'<section class="readSection"><h2>Essential words — learn these first</h2><div class="conceptTable">'+a.map(c=>'<div class="conceptCard"><div class="conceptTerm">'+esc(c.term||"Term")+'</div>'+ (filled(c.plain)?'<div class="conceptPlain"><strong>In everyday English:</strong> '+esc(c.plain)+'</div>':"")+(filled(c.legal)?'<div class="conceptLegal"><strong>Legal wording or source:</strong> '+esc(c.legal)+'</div>':"")+'</div>').join("")+'</div></section>':"";
}
function lesson(meta,source,related=[],progress={}){
 const x=source||{},m=meta||{};
 let html='<div class="eyebrow">Start from zero • '+esc(m.priority||"Study topic")+'</div><h1 class="pageTitle">'+esc(m.name||m.id||"Topic")+'</h1>'+
 '<div class="dataNote"><strong>Your learning path:</strong> Understand the idea → learn the words → see the rule → follow the steps → work an example → recognise the exam trap → test yourself.</div>';
 html+='<div class="learningStage activeStage"><span class="stageNum">1</span><div class="stageBody"><h2>What is this about?</h2>'+paragraph(x.big_picture)+
    (filled(x.who)?'<h3>Who is involved?</h3>'+paragraph(x.who):"")+
    (filled(x.when)?'<h3>When would this come up?</h3>'+paragraph(x.when):"")+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">2</span><div class="stageBody"><h2>Words you need to understand</h2>'+
    conceptCards(x.core_concepts)+(safeArr(x.before_you_start).length?'<details><summary>Other key terms mentioned</summary>'+bullets(x.before_you_start)+'</details>':"")+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">3</span><div class="stageBody"><h2>The legal rule — in context</h2>'+
    block("The core rule",x.basic_rule,"rule")+
    (filled(x.basic_rule)?'<p class="readerMeta">Read this after the everyday explanation above. Check the original course material for statutory qualifications.</p>':"")+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">4</span><div class="stageBody"><h2>What happens, step by step?</h2>'+
    (safeArr(x.how_it_works).length?bullets(x.how_it_works,true):'<p>Step-by-step details were not supplied.</p>')+
    block("Exceptions and qualifications",x.exceptions_plain)+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">5</span><div class="stageBody"><h2>See it in a real-world example</h2>';
 if(x.example){html+=block("Facts",x.example.facts)+block("How to reason it through",x.example.working)+block("Result",x.example.result,"rule")+
   (filled(x.example.source)?block("Source",x.example.source):"")}
 else html+='<p>No source-backed worked example was supplied. Do not treat a newly invented example as verified.</p>';
 html+='</div></div>';
 html+='<div class="learningStage"><span class="stageNum">6</span><div class="stageBody"><h2>How the examination tests this</h2>'+
   block("What to look for",x.exam_application)+block("The common trap",x.exam_trap_plain,"trap")+
   (safeArr(x.conflict_teaching).length?'<details class="sourceConflicts"><summary>Source conflicts — read before relying on the answer</summary>'+safeArr(x.conflict_teaching).map(c=>'<div class="conflictBox">'+
     paragraph("What the source says: "+String(c.what_source_says||""))+paragraph("Conflict: "+String(c.conflict||""))+paragraph("How the existing materials address it: "+String(c.strategy||""))+'</div>').join("")+'</details>':"")+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">7</span><div class="stageBody"><h2>Remember it</h2>'+
    (safeArr(x.memory_version).length?'<div class="memoryBox">'+bullets(x.memory_version)+'</div>':"<p>No summary provided.</p>")+'</div></div>';
 html+='<div class="learningStage"><span class="stageNum">8</span><div class="stageBody"><h2>Can you explain it back?</h2>'+
    '<p>Try answering these questions before opening the explanations.</p><div class="checkList">'+safeArr(x.learning_check).map(q=>'<details><summary>'+esc(q.q||"Check")+'</summary><div class="checkAnswer">'+esc(q.a||"No answer in source")+'</div></details>').join("")+'</div></div></div>';
 if(related.length)html+='<section class="readSection"><h2>Practise this topic</h2><div class="relatedQuestions">'+related.slice(0,8).map(q=>'<button type="button" class="relatedQuestion" data-related-id="'+esc(q.id)+'">'+esc(q.label||q.id)+(q.qno?" · Q"+esc(q.qno):"")+
   ' <small>'+esc(q.answer_status||"")+'</small></button>').join("")+'</div></section>';
 html+='<section class="readSection progressPanel"><h2>My understanding</h2><p>Mark this after completing the lesson and its self-checks. Merely opening a lesson does not count as understanding.</p>'+
  '<div class="studyActions"><button type="button" data-study-state="needs-review" class="secondaryButton">I need to revise this</button>'+
  '<button type="button" data-study-state="understood" class="primaryButton">I can explain it</button></div>'+
  '<p id="lessonProgressStatus" class="readerMeta">'+(progress.state==="understood"?"Previously marked: can explain":progress.state==="needs-review"?"Previously marked: needs revision":"Not yet assessed")+'</p></section>';
 return html;
}
function questionAttemptUI(q,attempt){
 const opts=Object.entries(q.options||{});
 const multi=/choose all|which of the following statements|are correct/i.test(q.stem||"")&&q.qtype==="multi"; // no assumption on selection method; answer options are A-D
 let html='<div class="optionList" role="group" aria-label="Select an answer">';
 for(const [k,v] of opts)html+='<label class="answerChoice"><input type="radio" name="practiceChoice" value="'+esc(k)+'">'+
 '<span class="answerLetter">'+esc(k)+'</span><span class="answerText">'+esc(v)+'</span></label>';
 html+='</div><div class="studyActions"><button type="button" class="primaryButton" id="submitPractice">Record attempt & reveal explanation</button>'+
 '<button type="button" class="secondaryButton" id="revealWithoutAttempt">Reveal without recording</button></div>'+
 '<div id="practiceFeedback" role="status" aria-live="polite"></div>';
 if(attempt)html+='<div class="readerMeta">Previous attempts: '+Number(attempt.attempts||0)+'. Repeated practice is recorded locally on this iPad.</div>';
 return html;
}
function interpretation(q,selected){
 const status=(q.answer_status||"").toUpperCase();
 if(status.includes("UNRESOLVED"))return "Unresolved question — not scored. Review the source conflict and legal reasoning.";
 if(!selected)return "Explanation revealed without recording an attempt.";
 if(status==="OFFICIAL")return selected===q.answer?"Matches the official answer.":"Does not match the official answer. Review why.";
 if(status==="DERIVED")return selected===q.answer?"Matches the derived answer (not an official key).":"Differs from the derived answer; this is not an official grading result.";
 return "Answer status requires verification.";
}
function audit(data){
 if(!data||!Array.isArray(data.subjects))return {ok:false,error:"No data"};
 const subjects=data.subjects.length,questions=data.subjects.reduce((n,s)=>n+(s.questions||[]).length,0);
 const procedures=data.subjects.flatMap(s=>s.procedures||[]),steps=procedures.flatMap(p=>p.steps||[]);
 const lessons=data.subjects.reduce((n,s)=>n+Object.keys(s.teach?.topics||{}).length,0);
 const bad=steps.filter(x=>!x||typeof x!=="object"||typeof x.step!=="string");
 return {ok:subjects===8&&questions===323&&!bad.length,subjects,questions,procedures:procedures.length,steps:steps.length,lessons,badSteps:bad.length};
}
root.SILEUX={procedurePreview,procedure,lesson,questionAttemptUI,interpretation,audit,escape:esc};
})(window);
