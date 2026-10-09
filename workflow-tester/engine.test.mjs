import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {SKIP,HEADINGS,KEYS,runNode,validateSections,sourceExcerpts,sectionSchema} from './engine.mjs';
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
