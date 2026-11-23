/* Synthetic browser acceptance data. Not SILE legal material. */
const dataset={meta:{built:"synthetic-browser-smoke"},subjects:Array.from({length:8},(_,i)=>{
 const code=["BF","CG","ICR","ADM","IP","MA","COMP","TAX"][i],topic=code+"-T01";
 const n=i===0?41:i===7?36:41; // 41*7 + 36 = 323
 return {code,paper:i<4?1:2,subject:"Synthetic "+code,topics:[{id:topic,name:"Fiduciary duties and corporate procedure"}],
  teach:{topics:{[topic]:{big_picture:"This is a synthetic explanation for testing navigation.",basic_rule:"Never treat this as a real legal rule."}}},
  rules:[{id:code+"-RULE",topic,title:"Fiduciary duties and corporate procedure",rule:"An officer should act loyally in this fictional example.",source:"Synthetic test material"}],
  deadlines:[],procedures:[],traps:[],
  questions:Array.from({length:n},(_,j)=>({
    id:code+"-Q"+(j+1),topic,stem:"Which fictional officer followed the synthetic fiduciary rule? "+(j+1),
    options:{A:"Option Alpha",B:"Option Beta",C:"Option Gamma",D:"Option Delta"},
    answer_status:j===0?"OFFICIAL":"UNRESOLVED",answer:j===0?"A":"",
    option_expl:{A:"Test option only"},explanation:"Synthetic explanation for browser test."
  }))};
})};
module.exports=dataset;
