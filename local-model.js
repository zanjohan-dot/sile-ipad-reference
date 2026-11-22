/* Experimental Revision-only local language model; no remote inference. */
(function(){
"use strict";
const runtime="https://esm.run/@mlc-ai/web-llm@0.2.86";
const models=["SmolLM2-1.7B-Instruct-q4f16_1-MLC","SmolLM2-360M-Instruct-q4f16_1-MLC"];
let engine=null,loaded="",pending=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tell=s=>{if($("modelStatus"))$("modelStatus").textContent=s};
function panel(){
 const host=$("modelPanel");if(!host)return;
 host.innerHTML='<details class="readSection" id="modelSection"><summary><strong>Explain with local Search</strong> · Revision-only experimental model</summary>'+
 '<p>Install a quantised language model on this iPad, then ask Search to explain relevant legal material from your imported SILE sources. The first download needs internet; later use should be offline after verification.</p>'+
 '<label class="calcField"><span>Local model</span><select id="modelPick"><option value="'+models[0]+'">1.5B model · stronger, requires more memory</option><option value="'+models[1]+'">0.5B model · smaller, less reliable</option></select></label>'+
 '<div class="studyActions"><button class="primaryButton" id="modelInstall">Download / load model</button><button class="secondaryButton" id="modelExplain">Explain retrieved material</button></div>'+
 '<p class="readerMeta" id="modelStatus">Model not loaded. Offline inference has NOT been verified on this device.</p>'+
 '<div id="modelAnswer" aria-live="polite"></div>'+
 '<p class="dataNote">Revision only. Generated answers may be incorrect and are not official SILE keys. No user question or SILE excerpt is uploaded to a cloud inference API. Model files come from public model hosts during initial setup. The SILE examination rules prohibit AI-powered search and answer generation during examinations.</p></details>';
 $("modelExplain").disabled=!engine;
 $("modelInstall").onclick=()=>load().catch(e=>tell(String(e.message||e)));
 $("modelExplain").onclick=explain;
}
async function load(){
 if(pending)return pending;
 const id=$("modelPick")?.value||models[0];
 if(!models.includes(id))throw Error("Unsupported model");
 if(engine&&loaded===id){tell("Local model already loaded; offline relaunch has not been verified.");return engine}
 pending=(async()=>{
   if(!navigator.gpu)throw Error("WebGPU not available; unable to load local model.");
   const adapter=await navigator.gpu.requestAdapter();
   if(!adapter)throw Error("No usable WebGPU adapter.");
   tell("Loading local model runtime…");
   const w=await import(runtime);
   if(!w.prebuiltAppConfig?.model_list?.some(m=>m.model_id===id))throw Error("Model ID not supported by installed runtime");
   const e=await w.CreateMLCEngine(id,{
     appConfig:{...w.prebuiltAppConfig,cacheBackend:"cache"},
     initProgressCallback:p=>{if(p?.text)tell(String(p.text))}
   });
   engine=e;loaded=id;
   tell("Model loaded locally. Turn on airplane mode, fully close and reopen the installed app, and test Search again before calling it offline-ready.");
   if($("modelExplain"))$("modelExplain").disabled=false;
   return engine;
 })().finally(()=>{pending=null});
 return pending;
}
function getEvidence(){
 const query=$("findQuery")?.value?.trim()||"";
 const refs=(window.SILEFIND?.lastMatches||[]).slice(0,7);
 const docs=refs.map((it,i)=>{
   const o=it.obj||{};
   const fields=it.type==="QUESTION"?[
     o.stem,Object.entries(o.options||{}).map(([k,v])=>k+". "+v).join("; "),
     o.answer_status==="OFFICIAL"?"Official keyed answer: "+String(o.answer||""):
     o.answer_status==="DERIVED"?"Derived non-official answer: "+String(o.answer||""):
     "Not an official settled answer",
     o.explanation,o.tested_rule,o.answer_basis,o.authority
   ]:[o.big_picture,o.basic_rule,o.rule,o.when,it.text,o.source];
   const passage=fields.filter(x=>typeof x==="string").join(" ").slice(0,1250);
   return "["+(i+1)+"] "+it.subject+" / "+it.type+" — "+it.title+
     "\nSTATUS: "+String(o.answer_status||"reference only")+
     "\nSOURCE: "+String(o.source||o.authority||o.course_material||"Exact citation unavailable")+
     "\nTEXT: "+passage;
 });
 return {query,docs};
}
async function explain(){
 if(typeof mode!=="undefined"&&mode!=="learn"){tell("Switch to Learn for generated explanations; Rapid is non-generative.");return}
 if(!engine){tell("Download and load the local model first.");return}
 const {query,docs}=getEvidence();
 if(!query){tell("Enter a revision question first.");return}
 if(!docs.length){tell("First run local Search to retrieve evidence; no passage available.");return}
 const out=$("modelAnswer"),b=$("modelExplain");if(!out)return;
 b.disabled=true;out.textContent="Generating on your iPad…";
 try{
 const messages=[
 {role:"system",content:"You are a beginner-friendly Singapore SILE Part B REVISION tutor. Use ONLY the numbered local excerpts supplied. No cloud services. Never invent law, deadlines or sources. Explain from zero knowledge in plain English, give a simple example, identify the applicable rule and apply it to the study question. Suggest an answer only when supported by cited excerpts. Citations must be [1], [2] etc and correspond to the supplied passages. Explicitly label OFFICIAL vs DERIVED — NOT OFFICIAL vs UNRESOLVED. Unresolved questions must not be scored. If facts or sources are insufficient, say 'Insufficient verified material to reach a reliable conclusion.' Keep it clear and concise: Plain English; Rule; Application; Suggested answer (if supported); Evidence and limitations. Never claim the answer is an official key unless the excerpt states that."},
 {role:"user",content:"REVISION QUESTION:\n"+query+"\n\nRETRIEVED LOCAL EXCERPTS:\n"+docs.join("\n\n")}
 ];
 const result=await engine.chat.completions.create({messages,temperature:0.15,top_p:0.85,max_tokens:700});
 const answer=result.choices?.[0]?.message?.content;
 if(typeof answer!=="string"||!answer)throw Error("No local model output");
 out.innerHTML='<div class="readSection"><div class="eyebrow">Unverified local explanation • Revision only</div><p class="modelText">'+esc(answer)+'</p></div>'+
 '<p class="readerMeta">Generated text may contain mistakes. Check every rule and source against the original materials. No cloud inference was used.</p>';
 tell("Local explanation generated. Offline relaunch must still be tested independently.");
 }catch(e){out.textContent="Local generation failed: "+String(e);tell("Local generation failed; search references remain available.")}
 finally{b.disabled=false}
}
window.SILELOCALMODEL={panel,load,explain,get ready(){return !!engine},get model(){return loaded}};
})();