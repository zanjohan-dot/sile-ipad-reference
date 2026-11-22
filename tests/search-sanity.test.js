/* Run with: node tests/search-sanity.test.js
 * Synthetic data only. Does not include private SILE materials.
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../retrieval-enhancements.js"),"utf8");
const rule={paper:1,code:"CG",subject:"Corporate Governance",type:"RULE",
 title:"Director fiduciary duty",text:"Fiduciary duty requires loyalty",
 obj:{id:"CG-R1",topic:"CG-T01",rule:"A director must act loyally.",source:"Synthetic lecture"}};
const question={paper:1,code:"CG",subject:"Corporate Governance",type:"QUESTION",
 title:"CG-J26-TEST",text:"What should the corporate officer do?",
 obj:{id:"CG-J26-TEST",stem:"What should the corporate officer do?",topic:"CG-T01",answer_status:"UNRESOLVED"}};
const excluded={paper:1,code:"CG",subject:"Corporate Governance",type:"QUESTION",
 title:"CG-D25-EXCLUDED",text:"Test director fiduciary duties",
 obj:{id:"CG-D25-EXCLUDED",stem:"Test director fiduciary duties",topic:"CG-T01",answer_status:"EXCLUDED"}};
const trademark={paper:2,code:"IP",subject:"Intellectual Property",type:"QUESTION",
 title:"IP-SQ-TEST",text:"Trade mark registration",
 obj:{id:"IP-SQ-TEST",stem:"What is a trademark?",topic:"IP-T01",answer_status:"OFFICIAL"}};
function harness(mode){
 let html="",opened=[];
 const box={
  get innerHTML(){return html},set innerHTML(v){html=v},
  querySelectorAll(selector){return []}
 };
 const document={getElementById:k=>k==="findResults"?box:null,querySelectorAll:()=>[]};
 const ctx={window:{},document,DATA:{subjects:[]},flat:[rule,question,excluded,trademark],mode,paper:1,subject:"",
  openQuestion(q){opened.push(q.id)},openRule(){},openDeadline(){},openTrap(){},openProcedure(){},openLesson(){},
  renderSubjects(){},updateContext(){},setScreen(){}};
 vm.runInNewContext(source,ctx,{filename:"retrieval-enhancements.js"});
 return {find:ctx.window.SILEFIND,html:()=>html,opened};
}
for(const mode of ["rapid","learn"]){
 const h=harness(mode);
 const hits=h.find.refreshEvidence("fiduciary");
 assert(hits.some(x=>x.obj?.id==="CG-J26-TEST"),"topic-linked question accessible in "+mode);
 assert(h.html().includes("CG-J26-TEST"),"question visible in "+mode);
 assert(h.html().includes("A director must act loyally."),"source extract");
 assert(h.html().includes("NOT generative AI"),"source extract must not impersonate AI");
 const b=h.find.refreshEvidence("fiduciary duty");
 assert(b.some(x=>x.obj?.id==="CG-D25-EXCLUDED"),"excluded question remains findable");
 assert(h.html().includes("EXCLUDED, not scored"),"excluded not scored");
 assert(h.find.refreshEvidence("trademark").some(x=>x.obj?.id==="IP-SQ-TEST"),"both papers searched by default");
 assert(!h.html().includes("No source or question matched"),"question-only result");
}
console.log("PASS search-sanity: Rapid + Learn; topic-linked questions; both papers; source extracts; excluded status.");
