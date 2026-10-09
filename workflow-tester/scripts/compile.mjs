import {readFile,writeFile,readdir} from 'node:fs/promises';
const root = new URL('../',import.meta.url);
// Read the canonical repository sources; only the generated Worker embeds them.
const catalog = await Promise.all((await readdir(new URL('../summaries/',root))).filter(n=>n.endsWith('.json')).sort().map(async n=>JSON.parse(await readFile(new URL('../summaries/'+n,root),'utf8'))));
const skill = await readFile(new URL('../SKILL.md',root),'utf8');
const assets = {};
for (const [file,type] of [['index.html','text/html; charset=utf-8'],['app.mjs','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8']]) assets['/'+file] = {body:await readFile(new URL('public/'+file,root),'utf8'),type};
const engine = (await readFile(new URL('engine.mjs',root),'utf8')).replace(/^export /gm,'');
const handler = (await readFile(new URL('handler.mjs',root),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
await writeFile(new URL('worker/index.js',root),`${engine}\n${handler}\nconst handle=createHandler(${JSON.stringify(assets)},${JSON.stringify(catalog)},${JSON.stringify(skill)});\nexport default {fetch:handle};\n`);
console.log('Bundled UI, skill, all ten resources and node runtime.');
