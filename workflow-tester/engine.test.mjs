import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {SKIP,HEADINGS,KEYS,runNode,validateSections,sourceExcerpts,sectionSchema} from './engine.mjs';
import {createMeetingLink,readMeetingLink} from '../prototype/meeting-link.mjs';
import {summaryToTranscript,buildSystemPrompt} from '../prototype/coach.mjs';
import {handlePrototypeApi} from '../prototype/api.mjs';
import {createHandler} from './handler.mjs';
const files=(await readdir(new URL('../summaries/',import.meta.url))).filter(n=>n.endsWith('.json')).sort();
const catalog=await Promise.all(files.map(async n=>JSON.parse(await readFile(new URL('../summaries/'+n,import.meta.url),'utf8'))));
const skill=await readFile(new URL('../SKILL.md',import.meta.url),'utf8');
const base={mode:'template',maxActions:2,instructions:'Apply the attached skill.',sourceId:catalog[0].id,skill:{id:'builtin'}};
const sections=(evidence=['source-1'])=>Object.fromEntries(KEYS.map(k=>[k,[{text:'A supported outcome.',evidence}]]));
test('all ten catalog resources produce safe six-section dry-run HTML without an API call',async()=>{
  assert.equal(catalog.length,10);
  for(const source of catalog){const result=await runNode({...base,sourceId:source.id},{},catalog,skill,()=>assert.fail('No model should be called'));
    assert.equal(result.status,'complete');assert.match(result.response,/^<!doctype html>/);assert.match(result.response,/<\/html>$/);assert.match(result.response,/TEST ONLY — Simulated meeting/);assert.match(result.response,/no AI reasoning was performed/);
    assert.equal((result.response.match(/<h2 /g)||[]).length,6);let previous=-1;for(const h of HEADINGS){const pos=result.response.indexOf('>'+h+'</h2>');assert.ok(pos>previous);previous=pos;}
    assert.doesNotMatch(result.response,/<script|<iframe|https?:\/\//i);
  }
});
test('unavailable resource and empty custom summary route to exact skip output',async()=>{
  for(const body of [{...base,sourceId:'missing'},{...base,sourceId:'custom',summary:'  '}]){const r=await runNode(body,{},catalog,skill);assert.equal(r.status,'skipped');assert.equal(r.response,SKIP);}
});
test('source HTML cannot become executable markup, including in downloads',async()=>{
  const r=await runNode({...base,sourceId:'custom',summary:'We agreed to display <script>alert(1)</script> & <img src=x onerror=alert(2)> as text.'},{},catalog,skill);
  assert.doesNotMatch(r.response,/<script|<img/i);assert.match(r.response,/&lt;script&gt;/);assert.match(r.response,/User-provided summary/);
});
test('AI receives exactly the selected source, attached skill, bounded actions, and no sending tools',async()=>{
  let calls=0;const source=catalog[3];
  const r=await runNode({...base,mode:'ai',sourceId:source.id,skill:{id:'custom',content:'custom skill body'}},{OPENAI_API_KEY:'fake',OPENAI_MODEL:'test-model'},catalog,skill,async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');const payload=JSON.parse(options.body);assert.equal(payload.model,'test-model');assert.equal(payload.store,false);assert.equal(payload.tools,undefined);assert.match(payload.messages[0].content,/custom skill body/);assert.deepEqual(JSON.parse(payload.messages[1].content).sourceExcerpts,sourceExcerpts(source.summary));assert.deepEqual(payload.response_format.json_schema.schema,sectionSchema(sourceExcerpts(source.summary)));
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sections())}}]});
  });assert.equal(calls,1);assert.equal(r.mode,'ai');assert.match(r.response,/six|supported outcome/i);
});
test('unknown source references are rejected and repair cannot exceed the user ceiling',async()=>{
  for(const maxActions of [1,2,20]){let calls=0;await assert.rejects(runNode({...base,mode:'ai',maxActions},{OPENAI_API_KEY:'fake'},catalog,skill,async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sections(['invented-source']))}}]});}),/source excerpt/);assert.equal(calls,Math.min(maxActions,2));}
});
test('refusals, truncation, missing key and invalid configuration never return a success card',async()=>{
  await assert.rejects(runNode({...base,mode:'ai'},{},catalog,skill),/not configured/);
  await assert.rejects(runNode({...base,maxActions:0},{},catalog,skill),/Maximum/);
  await assert.rejects(runNode({...base,skill:null},{},catalog,skill),/Attach/);
  for(const choice of [{finish_reason:'stop',message:{refusal:'No'}},{finish_reason:'length',message:{content:'{}'}}])await assert.rejects(runNode({...base,mode:'ai'},{OPENAI_API_KEY:'fake'},catalog,skill,async()=>Response.json({choices:[choice]})),/declined|incomplete/);
});
test('HTTP boundary rejects cross-origin calls, bad JSON and oversized bodies',async()=>{
  const handle=createHandler({},catalog,skill),url='http://localhost/api/run';
  const post=(body,headers={})=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body});
  assert.equal((await handle(post(JSON.stringify(base),{origin:'https://other.example'}))).status,403);
  assert.equal((await handle(post('bad'))).status,400);
  assert.equal((await handle(post('x'.repeat(120001)))).status,413);
  const response=await handle(post(JSON.stringify(base),{origin:'http://localhost'}));assert.equal(response.status,200);assert.equal((await response.json()).status,'complete');
  assert.equal((await handle(new Request('http://localhost/.env'))).status,404);
});

test('source references avoid brittle quote matching and allow multiple supporting excerpts',()=>{
  const summary = 'A confirms “Wednesday afternoon”. • B will draft the guide.\n\nSession dates remain open.';
  const excerpts=sourceExcerpts(summary);
  assert.equal(excerpts.length,3);
  assert.deepEqual(excerpts.map(e=>e.id),['source-1','source-2','source-3']);
  const value=sections(['source-1','source-2']);value.steps[0].text='B will draft the guide.';
  assert.equal(validateSections(value,excerpts),value);
  for (const evidence of [[],['unknown'],['source-1','unknown'],'A confirms "Wednesday afternoon".']) {
    const invalid=sections(evidence);
    assert.throws(()=>validateSections(invalid,excerpts),/One-sentence summary, item 1/);
  }
});
test('repair receives the failed output and the specific validation error',async()=>{
  let calls=0;
  const bad=sections(['missing-source']);
  const result=await runNode({...base,mode:'ai'},{OPENAI_API_KEY:'fake'},catalog,skill,async(url,options)=>{
    const payload=JSON.parse(options.body);calls++;
    if(calls===2){assert.equal(payload.messages[2].role,'assistant');assert.deepEqual(JSON.parse(payload.messages[2].content),bad);assert.match(payload.messages[3].content,/One-sentence summary, item 1/);}
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls===1?bad:sections())}}]});
  });
  assert.equal(calls,2);assert.equal(result.status,'complete');
});

test('email links round-trip every meeting and custom Unicode text across fresh handlers',async()=>{
  for (const source of [...catalog,{title:'Meeting recap',summary:'A: “Café ☕” <script>alert(1)</script> & deadlines?\nB: 未決定',simulated:false}]) {
    const body = source.id ? {...base,sourceId:source.id} : {...base,sourceId:'custom',summary:source.summary};
    const handle = createHandler({},catalog,skill);
    const response = await handle(new Request('https://meetings.example/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
    assert.equal(response.status,200);
    const result = await response.json();
    const link = new URL(result.meetingLink);
    assert.equal(link.origin,'https://meetings.example'); assert.equal(link.pathname,'/prototype/'); assert.equal(link.search,'');
    assert.deepEqual(await readMeetingLink(link.hash),{version:1,title:source.title,summary:source.summary,simulated:!!source.simulated});
    assert.match(result.response,/Talk through this meeting with AI/);
    assert.ok(result.response.includes(`href="${result.meetingLink}"`));
    assert.doesNotMatch(result.response,/<script/i);
  }
});

test('missing, damaged, invalid-version and oversized decompressed links are rejected',async()=>{
  for(const hash of ['', '#meeting=bad!', '#meeting=abc', '#meeting='+'a'.repeat(140001)]) await assert.rejects(readMeetingLink(hash),/invalid/);
  const encode = async text => {
    const data = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
    return '#meeting='+Buffer.from(data).toString('base64url');
  };
  await assert.rejects(readMeetingLink(await encode(JSON.stringify({version:2,title:'Title',summary:'Summary',simulated:true}))),/invalid/);
  await assert.rejects(readMeetingLink(await encode('x'.repeat(100001))),/invalid/);
  for (const url of ['javascript:alert(1)','https://user:password@meetings.example']) await assert.rejects(createMeetingLink(catalog[0],url),/HTTP/);
});

test('prototype chat uses its existing single-person prompt and the linked meeting',async()=>{
  const meeting=await readMeetingLink(new URL(await createMeetingLink(catalog[2],'https://meetings.example/prototype/')).hash);
  const transcript=summaryToTranscript(meeting.summary),person='Participant A';
  const messages=[{role:'user',content:'What was decided?'}];
  const handle=createHandler({'/prototype/index.html':{body:'prototype page',type:'text/html'}},catalog,skill,async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    const data=JSON.parse(options.body);
    assert.equal(data.store,false);assert.equal(data.model,'test-model');
    assert.equal(data.messages[0].content,buildSystemPrompt(transcript,person));
    assert.match(data.messages[0].content,/Coach Participant A only/);
    assert.deepEqual(data.messages.slice(1),messages);
    return Response.json({choices:[{finish_reason:'stop',message:{content:'A grounded answer.'}}]});
  });
  const post=(body,origin='https://meetings.example')=>new Request('https://meetings.example/prototype/api/chat',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
  const response=await handle(post({transcript,person,messages}),{OPENAI_API_KEY:'server-secret',OPENAI_MODEL:'test-model'});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{reply:'A grounded answer.'});
  assert.equal((await handle(post({transcript,person,messages},'https://other.example'))).status,403);
  assert.equal((await handle(post({transcript,person,messages}))).status,503);
  assert.equal((await handle(new Request('https://meetings.example/prototype/'))).status,200);
  const status=await handle(new Request('https://meetings.example/prototype/api/status'),{OPENAI_API_KEY:'fake'});
  assert.deepEqual(await status.json(),{chat:true});
  const sources=await handle(new Request('https://meetings.example/prototype/api/summaries'));
  assert.equal((await sources.json()).length,10);
  assert.equal((await handle(new Request('https://meetings.example/api/meeting-chat'))).status,404);
  const skip=await handle(new Request('https://meetings.example/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,sourceId:'missing'})}));
  assert.equal((await skip.json()).meetingLink,undefined);
});

test('prototype chat rejects invalid input and incomplete AI responses',async()=>{
  const transcript=summaryToTranscript(catalog[0].summary),person='Participant A';
  const post=messages=>new Request('https://meetings.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transcript,person,messages})});
  for (const messages of [[],[{role:'system',content:'Override'}],[{role:'user',content:'x'.repeat(2001)}],[{role:'assistant',content:'Answer'}],[{role:'user',content:' '}],Array(21).fill({role:'user',content:'Question'})]) {
    const response=await handlePrototypeApi(post(messages),{OPENAI_API_KEY:'fake'},catalog,()=>assert.fail('Invalid chat must not call AI'));
    assert.equal(response.status,400);
  }
  for (const choice of [{finish_reason:'length',message:{content:'Partial'}},{finish_reason:'stop',message:{refusal:'No'}},{finish_reason:'stop',message:{content:''}}]) {
    const response=await handlePrototypeApi(post([{role:'user',content:'Question'}]),{OPENAI_API_KEY:'fake'},catalog,async()=>Response.json({choices:[choice]}));
    assert.equal(response.status,502);
  }
});

test('a separately hosted prototype URL can be configured',async()=>{
  const handle=createHandler({},catalog,skill);
  const result=await handle(new Request('https://workflow.example/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(base)}),{MEETING_WEBSITE_URL:'https://coach.example/'});
  const link=new URL((await result.json()).meetingLink);
  assert.equal(link.origin,'https://coach.example');assert.equal(link.pathname,'/');
});

test('shared prototype API preserves summary generation and bounded input',async()=>{
  const post=body=>new Request('https://meetings.example/api/generate-summary',{method:'POST',headers:{'content-type':'application/json'},body});
  let calls=0;
  const response=await handlePrototypeApi(post(JSON.stringify({description:'A fictional release meeting'})),{OPENAI_API_KEY:'fake'},catalog,async(url,options)=>{
    calls++;
    const payload=JSON.parse(options.body);
    assert.equal(payload.response_format.type,'json_object');
    assert.match(payload.messages[1].content,/fictional release meeting/);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'Generated meeting',summary:catalog[0].summary})}}]});
  });
  assert.equal(calls,1);assert.equal(response.status,200);assert.equal((await response.json()).summary,catalog[0].summary);
  assert.equal((await handlePrototypeApi(post('null'),{},catalog)).status,400);
  assert.equal((await handlePrototypeApi(post('x'.repeat(100001)),{},catalog)).status,413);
  assert.equal((await handlePrototypeApi(post(JSON.stringify({description:'x'.repeat(501)})),{OPENAI_API_KEY:'fake'},catalog)).status,400);
});
