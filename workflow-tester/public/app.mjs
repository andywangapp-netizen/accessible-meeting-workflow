const $ = id => document.getElementById(id);
const state = {catalog:[],skills:[],attached:null,mode:'ai',tab:'preview',node:'reasoning',result:null,busy:false,ready:false,ai:false};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text,error=false){$('result-message').textContent=text;$('result-message').classList.toggle('error',error);}
function updateAttached(){
  $('attached-skill').innerHTML=state.attached ? `<span class="skill-glyph">✧</span><button class="skill-name" id="inspect-skill">${escape(state.attached.name)}<small>${state.attached.id==='builtin'?'Bundled · SKILL.md':'Imported · this session'}</small></button><button id="remove-skill" class="remove-skill" aria-label="Remove attached skill">×</button>` : '<span>No skill attached</span><button id="pick-skill" class="text-button">Attach a skill</button>';
  $('inspect-skill')?.addEventListener('click',()=>{$('skill-content-title').textContent=state.attached.name;$('skill-content-text').textContent=state.attached.content;$('skill-content-dialog').showModal();});
  $('remove-skill')?.addEventListener('click',()=>{state.attached=null;updateAttached();markChanged();});
  $('pick-skill')?.addEventListener('click',openSkills);
  $('config-status').textContent=state.attached?'✓ Skill attached':'Attach a skill to test';
}
function renderSkills(){
  const query=$('skill-search').value.toLowerCase();
  const skills=state.skills.filter(s=>(s.name+' '+s.description).toLowerCase().includes(query));
  $('skill-list').innerHTML=skills.length?skills.map(s=>`<article class="library-skill"><span class="skill-glyph">✧</span><div><h3>${escape(s.name)}</h3><p>${escape(s.description)}</p></div><button class="button ${state.attached?.id===s.id?'':'primary'}" data-skill="${escape(s.id)}">${state.attached?.id===s.id?'Attached':'Attach'}</button></article>`).join(''):'<p>No matching skills. Import a SKILL.md below.</p>';
  document.querySelectorAll('[data-skill]').forEach(button=>button.addEventListener('click',()=>{state.attached=state.skills.find(s=>s.id===button.dataset.skill);updateAttached();markChanged();$('skill-dialog').close();}));
}
function openSkills(){if(state.busy)return;$('skill-search').value='';$('skill-error').textContent='';renderSkills();$('skill-dialog').showModal();}
function markChanged(){
  if(state.result){$('result-badge').textContent='Previous run';$('output-note').textContent='Configuration changed · run again to refresh';}
}
function selectNode(node){
  state.node=node;document.querySelectorAll('[data-node]').forEach(b=>{b.classList.toggle('selected',b.dataset.node===node);b.setAttribute('aria-pressed',String(b.dataset.node===node));});
  for(const key of ['reasoning','trigger','output'])$(key+'-panel').hidden=key!==node;
  const info={reasoning:['AI powered nodes','2. AI reasoning','purple','✧'],trigger:['Triggers','1. Zoom Meetings event','blue','▣'],output:['Output','3. HTML email preview','mint','✉']}[node];
  $('panel-category').textContent=info[0];$('panel-title').textContent=info[1];$('panel-icon').className='node-icon '+info[2];$('panel-icon').textContent=info[3];
}
function setMode(mode,changed=true){
  state.mode=mode;for(const key of ['ai','template']){$('mode-'+key).classList.toggle('active',key===mode);$('mode-'+key).setAttribute('aria-pressed',String(key===mode));}
  $('mode-help').textContent=mode==='template'?'No AI call. Checks the template and output path using source excerpts; does not evaluate skill adherence.':state.ai?'Uses the attached skill to reason over your selected source.':'AI is not configured here. Set OPENAI_API_KEY on the server, or choose Template dry run.';
  if(changed)markChanged();
}
function sourceChanged(){
  const id=$('source').value,summary=state.catalog.find(s=>s.id===id);
  $('custom-summary').hidden=id!=='custom';$('view-source').disabled=!summary&&!(id==='custom'&&$('custom-summary').value.trim());
  $('resource-name').textContent=summary?summary.id+'.json':id==='custom'?'User-provided plain text':'No resource selected';markChanged();
}
function updateView(){
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-selected',String(b.dataset.tab===state.tab));});
  $('empty-state').hidden=!!state.result||state.tab==='log';
  $('preview').hidden=state.tab!=='preview'||state.result?.status!=='complete';
  $('html-view').hidden=state.tab!=='html'||!state.result;
  $('log-view').hidden=state.tab!=='log';
  if(state.tab==='log'&&!state.result)$('log-view').innerHTML='<p class="field-help">The execution log appears after a test.</p>';
}
function renderResult(){
  const result=state.result;$('preview').srcdoc=result.status==='complete'?result.response:'';
  $('html-view').textContent=result.response||'';
  $('log-count').textContent=result.trace.length;
  $('log-view').innerHTML=result.trace.map(item=>`<article class="log-item"><strong>${escape(item.label)}</strong><p>${escape(item.detail)}</p></article>`).join('');
  $('result-badge').textContent=result.status==='skipped'?'Skipped':result.mode==='template'?'Dry run':'Complete';
  $('output-note').textContent=result.status==='skipped'?'Skip routed to status · no email':result.mode==='template'?'Template output · no AI called':'HTML ready · nothing sent';
  $('copy').disabled=false;$('download').disabled=result.status!=='complete';
  for(const node of ['trigger','reasoning','output'])$('state-'+node).textContent=result.status==='skipped'&&node==='reasoning'?'–':'✓';
  message(result.status==='skipped'?result.response:result.mode==='template'?'Template dry run complete. Source excerpts only; no AI reasoning performed.':'AI recap generated. Review decisions and dates against the source.');
  updateView();
}
function setBusy(busy){
  state.busy=busy;document.body.classList.toggle('running',busy);$('run').disabled=busy||!state.ready;$('run').innerHTML=busy?'Running test…':'<span>▷</span> Test workflow';
  document.querySelectorAll('.panel-content input:not([readonly]),.panel-content textarea,.panel-content select,.panel-content button,#export,#import-template').forEach(e=>{e.disabled=busy;});
  if(!busy){sourceChanged();$('variables').disabled=false;}
}
function config(){return {version:1,name:'Accessible meeting recap',trigger:{event:$('event').value,meetings:$('monitor').value,offsetMinutes:Number($('offset').value),simulated:true},instructions:$('instructions').value,sourceId:$('source').value,summary:$('source').value==='custom'?$('custom-summary').value:'',skill:state.attached?{id:state.attached.id,name:state.attached.name,description:state.attached.description,content:state.attached.content}:null,maxActions:Number($('max-actions').value),mode:state.mode,output:{type:'html-preview',body:'{{2.response}}',send:false}};}
async function run(){
  if(state.busy)return;
  if(!$('source').value){selectNode('reasoning');message('Choose one of the ten summaries, or Paste my own.',true);$('source').focus();return;}
  if(!state.attached){selectNode('reasoning');message('Attach a skill before testing.',true);openSkills();return;}
  if(!$('instructions').value.trim()){message('Enter task instructions.',true);$('instructions').focus();return;}
  if(!$('max-actions').checkValidity()){message('Maximum actions must be a whole number from 1 to 20.',true);$('max-actions').focus();return;}
  if(state.mode==='ai'&&!state.ai){message('AI is not configured on this server. Choose Template dry run, or set OPENAI_API_KEY on the server and restart.',true);selectNode('reasoning');return;}
  const body=config();
  setBusy(true);state.result=null;$('copy').disabled=true;$('download').disabled=true;$('preview').srcdoc='';$('html-view').textContent='';$('log-count').textContent='0';$('log-view').replaceChildren();updateView();$('result-badge').textContent='Running';message('Running the test with the selected skill and summary…');
  for(const node of ['trigger','reasoning','output'])$('state-'+node).textContent='';
  try{
    const response=await fetch('/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(190000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'The test could not finish.');state.result=data;renderResult();
  }catch(error){message(error.name==='TimeoutError'?'The test timed out. Try again.':error.message,true);$('result-badge').textContent='Failed';$('output-note').textContent='No output generated';}
  finally{setBusy(false);if(state.result)renderResult();}
}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('run').addEventListener('click',run);$('add-skill').addEventListener('click',openSkills);$('skill-search').addEventListener('input',renderSkills);
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>selectNode(b.dataset.node)));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;updateView();}));
$('mode-ai').addEventListener('click',()=>setMode('ai'));$('mode-template').addEventListener('click',()=>setMode('template'));
$('source').addEventListener('change',sourceChanged);$('custom-summary').addEventListener('input',sourceChanged);
for(const id of ['instructions','max-actions','offset'])$(id).addEventListener('input',markChanged);
$('view-source').addEventListener('click',()=>{const source=state.catalog.find(s=>s.id===$('source').value);$('source-title').textContent=source?.title||'User-provided summary';$('source-text').textContent=source?JSON.stringify(source,null,2):$('custom-summary').value;$('source-dialog').showModal();});
$('variables').addEventListener('click',()=>{$('variable-menu').hidden=!$('variable-menu').hidden;});
document.querySelectorAll('[data-variable]').forEach(b=>b.addEventListener('click',()=>{const textarea=$('instructions');textarea.setRangeText(b.dataset.variable,textarea.selectionStart,textarea.selectionEnd,'end');textarea.focus();$('variable-menu').hidden=true;markChanged();}));
$('skill-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>60000)throw new Error('Choose a skill file smaller than 60 KB.');const content=await file.text();if(!content.trim()||content.includes('\0'))throw new Error('Choose a readable, nonempty Markdown skill.');const name=content.match(/^name:\s*["']?([^\r\n"']+)/m)?.[1]?.trim()||file.name;const description=content.match(/^description:\s*(.+)$/m)?.[1]?.trim()||'Manually attached skill. The six-section email adapter remains fixed.';const skill={id:'import-'+crypto.randomUUID(),name,description,content};state.skills.push(skill);state.attached=skill;updateAttached();markChanged();$('skill-dialog').close();}catch(e){$('skill-error').textContent=e.message;}finally{event.target.value='';}
});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.result.response);$('output-note').textContent='Copied output to clipboard';}catch{state.tab='html';updateView();message('Clipboard unavailable. Select and copy the HTML from this tab.',true);}});
$('download').addEventListener('click',()=>download(state.result.response,'meeting-recap.html','text/html'));
$('export').addEventListener('click',()=>download(JSON.stringify(config(),null,2),'meeting-workflow.template.json','application/json'));
// Exported templates can be re-imported without a repository scan.
const importButton=document.createElement('button');importButton.id='import-template';importButton.className='button';importButton.textContent='↑ Import';$('export').before(importButton);
const importInput=document.createElement('input');importInput.type='file';importInput.accept='.json';importInput.hidden=true;document.body.append(importInput);importButton.addEventListener('click',()=>importInput.click());
importInput.addEventListener('change',async()=>{const file=importInput.files[0];if(!file)return;try{
  if(file.size>120000)throw new Error('Template is too large.');const template=JSON.parse(await file.text());
  if(template.version!==1||!['ai','template'].includes(template.mode)||typeof template.instructions!=='string'||template.instructions.length>8000||!Number.isInteger(template.maxActions)||template.maxActions<1||template.maxActions>20||!(template.sourceId===''||template.sourceId==='custom'||state.catalog.some(s=>s.id===template.sourceId))||typeof template.summary!=='string'||template.summary.length>24000)throw new Error('This file is not a valid Node Lab template.');
  let skill=null;if(template.skill){if(template.skill.id==='builtin')skill=state.skills[0];else{if(typeof template.skill.content!=='string'||!template.skill.content.trim()||template.skill.content.length>60000||typeof template.skill.name!=='string')throw new Error('The attached skill is invalid.');skill={...template.skill,id:'import-'+crypto.randomUUID(),description:String(template.skill.description||'Imported skill')};state.skills.push(skill);}}
  const offset=template.trigger?.offsetMinutes??3;if(!Number.isInteger(offset)||offset<0||offset>60)throw new Error('Trigger offset must be from 0 to 60.');
  $('instructions').value=template.instructions;$('source').value=template.sourceId;$('custom-summary').value=template.summary;$('max-actions').value=template.maxActions;$('offset').value=offset;state.attached=skill;updateAttached();setMode(template.mode);sourceChanged();message('Template imported. Choose Test workflow to generate a fresh output.');
}catch(e){message(e.message,true);}finally{importInput.value='';}});
async function init(){
  $('run').disabled=true;
  try{
    const [catalogResponse,statusResponse]=await Promise.all([fetch('/api/catalog'),fetch('/api/status')]);if(!catalogResponse.ok||!statusResponse.ok)throw new Error('The server could not load skills and resources.');
    const [data,status]=await Promise.all([catalogResponse.json(),statusResponse.json()]);state.catalog=data.summaries;state.skills=[data.skill];state.attached=data.skill;state.ai=status.ai;
    $('source').innerHTML='<option value="">Choose a summary…</option>'+state.catalog.map((s,i)=>`<option value="${escape(s.id)}">${i+1}. ${escape(s.title)}</option>`).join('')+'<option value="custom">Paste my own summary</option>';
    updateAttached();$('ai-badge').textContent=status.ai?'AI ready':'No API key';setMode(status.ai?'ai':'template',false);state.ready=true;$('run').disabled=false;selectNode('reasoning');
  }catch(e){message(e.message,true);$('ai-badge').textContent='Server unavailable';}
}
init();
