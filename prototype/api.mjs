import {buildSystemPrompt, buildSummaryPrompt, validateSummary} from './coach.mjs';

// Shared by the standalone prototype and the workflow's hosted prototype mount.
export async function handlePrototypeApi(request, env, catalog, fetcher = fetch) {
  const url = new URL(request.url);
  const json = (body,status=200) => Response.json(body,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
  if (url.pathname === '/api/status' && request.method === 'GET') return json({chat:!!env.OPENAI_API_KEY});
  if (url.pathname === '/api/summaries' && request.method === 'GET') return json(catalog.map(({id,title,summary})=>({id,title,summary})));
  if (!['/api/chat','/api/generate-summary'].includes(url.pathname)) return json({error:'Not found.'},404);
  if (request.method !== 'POST') return json({error:'Use POST.'},405);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({error:'Cross-origin requests are not allowed.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Use JSON.'},415);
  let body;
  try {
    const reader=request.body?.getReader(); if (!reader) throw new Error();
    const chunks=[]; let length=0;
    while (true) { const {done,value}=await reader.read(); if (done) break; length+=value.length; if (length>100000) {await reader.cancel();return json({error:'Request is too large.'},413);} chunks.push(value); }
    const bytes=new Uint8Array(length); let offset=0; for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
    body=JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {return json({error:'Invalid JSON request.'},400);}
  if (!env.OPENAI_API_KEY) return json({error:'AI is not set up. Configure OPENAI_API_KEY on the server.'},503);
  const call = async (messages,extra={}) => {
    const response=await fetcher('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:env.OPENAI_MODEL || 'gpt-4o-mini',messages,store:false,...extra}),signal:AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}. Check the server API key and model.`);
    const choice=(await response.json()).choices?.[0];
    if (choice?.message?.refusal || choice?.finish_reason !== 'stop' || !choice?.message?.content?.trim()) throw new Error('The AI response was incomplete or declined. Try again.');
    return choice.message.content;
  };
  if (url.pathname === '/api/chat') {
    let system;
    try {
      if (typeof body.transcript !== 'string' || body.transcript.length > 30000 || typeof body.person !== 'string') throw new Error('Invalid meeting context.');
      system=buildSystemPrompt(body.transcript,body.person);
      if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length>20 || body.messages.at(-1)?.role !== 'user' || body.messages.some(m=>!['user','assistant'].includes(m?.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length>(m.role==='assistant'?16000:2000))) throw new Error('Invalid messages.');
    } catch (error) {return json({error:error.message},400);}
    try {return json({reply:await call([{role:'system',content:system},...body.messages])});}
    catch (error) {return json({error:error.message},502);}
  }
  const description=String(body.description ?? '').trim();
  if (description.length>500) return json({error:'Keep the description to 500 characters.'},400);
  const messages=[{role:'system',content:buildSummaryPrompt(catalog[0].summary)},{role:'user',content:description?`Meeting description: ${description}`:'No description. Choose any everyday meeting topic.'}];
  try {
    for (let attempt=0;attempt<2;attempt++) {
      const content=await call(messages,{response_format:{type:'json_object'},temperature:1});
      try {const value=JSON.parse(content);return json({title:String(value.title || 'Generated meeting').slice(0,100),summary:validateSummary(value.summary)});}
      catch (error) {if (attempt===1) throw error;messages.push({role:'assistant',content},{role:'user',content:`Correct the JSON summary format: ${error.message}`});}
    }
  } catch (error) {return json({error:error.message},502);}
}
