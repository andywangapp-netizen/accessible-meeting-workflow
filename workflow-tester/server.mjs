import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createHandler} from './handler.mjs';
const root = new URL('./',import.meta.url);
for (const url of [new URL('../.env',root),new URL('.env',root)]) { try { process.loadEnvFile(url); } catch {} }
const summaryDirectory = new URL('../summaries/',root);
const skillFile = new URL('../SKILL.md',root);
const files = (await readdir(summaryDirectory)).filter(n=>n.endsWith('.json')).sort();
const catalog = await Promise.all(files.map(async n=>JSON.parse(await readFile(new URL(n,summaryDirectory),'utf8'))));
const skill = await readFile(skillFile,'utf8');
const assets = {};
for (const [file,type] of [['index.html','text/html; charset=utf-8'],['app.mjs','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8']]) assets['/'+file] = {body:await readFile(new URL('public/'+file,root),'utf8'),type};
const handle = createHandler(assets,catalog,skill);
const port = Number(process.env.WORKFLOW_PORT || 4174);
createServer(async (req,res)=>{
  try {
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {res.writeHead(403);return res.end('Invalid host');}
    const url = `http://${req.headers.host}${req.url}`;
    const request = new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
    const response = await handle(request,process.env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(500);res.end('Server error');}
}).listen(port,'127.0.0.1',()=>console.log(`Node Lab on http://127.0.0.1:${port} (AI ${process.env.OPENAI_API_KEY?'configured':'not configured'})`));
