/* Synthetic-only regression. Run: node tests/practice-persistence.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
let code=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const a=code.indexOf("function dbPut(k,v)"),b=code.indexOf("\nfunction toast",a);
assert(a>=0&&b>a,"Expected storage helper");
code=code.slice(0,a)+"function dbPut(k,v){return window.__mockPut(k,v)}"+code.slice(b);
assert(/\binit\(\);\s*$/.test(code),"Expected startup entry point");
code=code.replace(/\binit\(\);\s*$/,"");
code+="\nthis.__studyTest={openQuestion,renderProgress,questionRevision,setProgress:v=>studyProgress=v,getProgress:()=>studyProgress,setMode:v=>mode=v,setData:v=>DATA=v};";
const elements=new Map();let screen="";
function el(key){
 if(!elements.has(key))elements.set(key,{onclick:null,textContent:"",disabled:false,
  classList:{add(){},remove(){}},scrollIntoView(){},setAttribute(){},
  set innerHTML(v){this._html=v;if(key==="#screen"){screen=v;for(const k of [...elements.keys()])if(k!=="#screen")elements.delete(k)}},
  get innerHTML(){return this._html||""}});
 return elements.get(key);
}
const document={querySelector:key=>key==='input[name="practiceChoice"]:checked'?{value:"A"}:el(key),querySelectorAll:()=>[],
 body:{classList:{add(){},remove(){}}}};
let shouldReject=false,writes=0;
const window={SILEUX:{questionAttemptUI:()=>"<p>options</p>",interpretation:()=>"Practice explanation"},
 __mockPut:async()=>{if(shouldReject)throw Error("simulated quota failure");writes++}};
const sandbox={window,document,console:{error(){}},Date,Math,Promise};
vm.runInNewContext(code,sandbox,{filename:"app.js"});
const app=sandbox.__studyTest;
const original={id:"Q-ONE",stem:"Synthetic question",options:{A:"one",B:"two",C:"three",D:"four"},
 answer:"A",answer_status:"OFFICIAL",label:"Test question"};
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
(async()=>{
 app.setProgress({version:1,topics:{},questions:{}});app.setMode("learn");
 app.openQuestion(original);
 await el("#submitPractice").onclick();
 assert.equal(app.getProgress().questions["Q-ONE"].officialCorrect,1);
 assert.equal(app.getProgress().questions["Q-ONE"].officialAttempts,1);
 assert.match(el("#practiceFeedback").textContent,/saved locally/i);
 app.openQuestion(original);
 await el("#toggleQuestionReview").onclick();
 assert.equal(app.getProgress().questions["Q-ONE"].needsReview,true);
 const count=writes;
 shouldReject=true;
 app.openQuestion({...original,id:"Q-TWO"});
 await el("#submitPractice").onclick();
 assert.equal(writes,count);
 assert.equal(app.getProgress().questions["Q-TWO"],undefined);
 assert.match(el("#practiceFeedback").textContent,/NOT SAVED/);
 assert.equal(el("#submitPractice").disabled,false);
 shouldReject=false;
 app.openQuestion({...original,answer:"B"});
 assert.match(screen,/Earlier attempt history retained/);
 app.setData({subjects:[{paper:1,subject:"Synthetic subject",topics:[],questions:[{...original,answer:"B"}]}]});
 app.renderProgress();
 assert.match(screen,/history retained but unverified/);
 assert.doesNotMatch(screen,/matching the key/);
 console.log("PASS: confirmed saves; rejected writes; revision flags; answer-version scoring gate");
})().catch(e=>{console.error(e);process.exitCode=1});
