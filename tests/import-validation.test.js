/* Run with: node tests/import-validation.test.js
 * Synthetic content only: never commit private course data to this repository.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const start=app.indexOf("function validateImportedDataset(o){"),end=app.indexOf("\nasync function importFile(file){",start);
assert(start>=0&&end>start,"Import validator source must exist");
const validate=new Function(app.slice(start,end)+";return validateImportedDataset;")();
function fixture(){
 return {subjects:Array.from({length:8},(_,i)=>({
  code:"S"+i,subject:"Subject "+i,paper:i<4?1:2,
  topics:[{id:"T"+i}],rules:[],deadlines:[],procedures:[],traps:[],
  questions:Array.from({length:i===0?323:0},(_,j)=>({
   id:"Q"+j,topic:"T"+i,stem:"Synthetic question "+j,
   options:{A:"A",B:"B",C:"C"},answer_status:"OFFICIAL",answer:"A"
  }))
 }))};
}
assert.equal(validate(fixture()).questions,323);
function shouldReject(mutator){
 const d=fixture();mutator(d);
 assert.throws(()=>validate(d));
}
shouldReject(d=>d.subjects[0].questions.pop());
shouldReject(d=>d.subjects[0].questions[0].answer_status="UNKNOWN");
shouldReject(d=>d.subjects[0].questions[0].stem="");
shouldReject(d=>d.subjects[0].questions[0].topic="OTHER");
shouldReject(d=>d.subjects[1].questions.push({...d.subjects[0].questions[0]}));
console.log("PASS import-validation: valid schema, wrong count, status, stem, topic, duplicated ID");
