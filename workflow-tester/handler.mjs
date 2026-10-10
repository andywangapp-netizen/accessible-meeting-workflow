import { runNode } from './engine.mjs';
import {handlePrototypeApi} from '../prototype/api.mjs';
export function createHandler(assets, catalog, skill, fetcher = fetch) {
  let running = false;
  return async function handle(request, env = {}) {
    const url = new URL(request.url);
    const headers = {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
    const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json'}});
    if (url.pathname === '/prototype') {url.pathname='/prototype/';return Response.redirect(url.href,302);}
    if (url.pathname === '/api/status' && request.method === 'GET') return json({ai:!!env.OPENAI_API_KEY,model:env.OPENAI_MODEL || 'gpt-4o-mini'});
    if (url.pathname === '/api/catalog' && request.method === 'GET') return json({summaries:catalog,skill:{id:'builtin',name:'autism-friendly-meeting-card-test',description:'Clear, predictable six-section meeting recaps. Testing only.',content:skill}});
    if (url.pathname.startsWith('/prototype/api/')) {
      const prototypeURL = new URL(request.url); prototypeURL.pathname = url.pathname.slice('/prototype'.length);
      return handlePrototypeApi(new Request(prototypeURL,request),env,catalog,fetcher);
    }
    if (url.pathname === '/api/run') {
      if (request.method !== 'POST') return json({error:'Use POST.'},405);
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({error:'Cross-origin requests are not allowed.'},403);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Use JSON.'},415);
      if (running) return json({error:'A test is already running. Try again when it finishes.'},429);
      let body;
      try {
        const reader = request.body?.getReader();
        if (!reader) throw new Error();
        const chunks=[]; let length=0;
        while (true) { const {done,value} = await reader.read(); if (done) break; length+=value.byteLength; if (length>120000) { await reader.cancel(); return json({error:'Request is too large.'},413); } chunks.push(value); }
        const bytes = new Uint8Array(length); let offset=0; for (const c of chunks) { bytes.set(c,offset); offset+=c.byteLength; }
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch { return json({error:'Invalid JSON request.'},400); }
      running = true;
      try {
        return json(await runNode(body,{...env,MEETING_WEBSITE_URL:env.MEETING_WEBSITE_URL || new URL('/prototype/',url.origin).href},catalog,skill,fetcher));
      }
      catch (e) { return json({error:e.name === 'TimeoutError' ? 'AI request timed out. Try again.' : e.message},422); }
      finally { running = false; }
    }
    const file = url.pathname === '/' ? '/index.html' : ['/prototype/','/prototype'].includes(url.pathname) ? '/prototype/index.html' : url.pathname;
    if (request.method !== 'GET' || !assets[file]) return new Response('Not found',{status:404,headers});
    return new Response(assets[file].body,{headers:{...headers,'content-type':assets[file].type,'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"}});
  };
}
