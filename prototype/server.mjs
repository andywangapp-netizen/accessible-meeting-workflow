// Serve the existing coaching prototype and its shared server-side AI routes.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {handlePrototypeApi} from './api.mjs';
const root=new URL('./',import.meta.url);
for (const file of [new URL('../.env',root),new URL('.env',root)]) {try {process.loadEnvFile(file);} catch {}}
const catalog=await Promise.all((await readdir(new URL('../summaries/',root))).filter(f=>f.endsWith('.json')).sort().map(async f=>JSON.parse(await readFile(new URL('../summaries/'+f,root),'utf8'))));
const assets={};
for (const [file,type] of [['index.html','text/html; charset=utf-8'],['app.mjs','text/javascript; charset=utf-8'],['coach.mjs','text/javascript; charset=utf-8'],['meeting-link.mjs','text/javascript; charset=utf-8'],['styles.css','text/css; charset=utf-8'],['favicon.svg','image/svg+xml']]) assets['/'+file]={body:await readFile(new URL(file,root)),type};
const port=Number(process.env.PORT || 4173);
createServer(async (req,res)=>{
  try {
    if (![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) {res.writeHead(403);return res.end('Invalid host');}
    const url=new URL(req.url,`http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
      const response=await handlePrototypeApi(request,process.env,catalog);
      res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
    if (req.method!=='GET' || !asset) {res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'content-type':asset.type,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end(asset.body);
  } catch {res.writeHead(500);res.end('Server error');}
}).listen(port,'127.0.0.1',()=>console.log(`Meeting Coach on http://127.0.0.1:${port}`));
