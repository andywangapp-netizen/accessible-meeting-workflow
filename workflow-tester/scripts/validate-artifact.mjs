import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

// Verify that the standalone hosted bundle contains the complete link destination.
const handle = workerModule.default.fetch;
for (const path of ['/prototype/','/prototype/app.mjs','/prototype/coach.mjs','/prototype/meeting-link.mjs','/prototype/styles.css','/prototype/api/status','/prototype/api/summaries']) {
  const response = await handle(new Request(`https://meetings.example${path}`));
  assert.equal(response.status,200,`Missing hosted asset: ${path}`);
}
const page = await handle(new Request('https://meetings.example/prototype/'));
assert.ok((await page.text()).includes('Which person are you?'));
const catalogResponse = await handle(new Request('https://meetings.example/api/catalog'));
const catalog = await catalogResponse.json();
const recap = await handle(new Request('https://meetings.example/api/run',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({mode:'template',maxActions:1,instructions:'Apply the skill.',skill:{id:'builtin'},sourceId:catalog.summaries[0].id}),
}));
assert.equal(recap.status,200);
const result = await recap.json();
assert.ok(result.meetingLink.startsWith('https://meetings.example/prototype/#meeting='));
assert.ok(result.response.includes(result.meetingLink));

console.log("Artifact is valid ESM; hosted meeting assets and email links work");
