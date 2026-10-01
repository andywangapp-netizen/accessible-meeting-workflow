// Local server: serves the prototype and relays chat requests to the OpenAI API.
// The API key stays on this machine, in OPENAI_API_KEY; the browser never sees it.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSystemPrompt, buildSummaryPrompt, validateSummary } from "./coach.mjs";

const root = dirname(fileURLToPath(import.meta.url));
for (const file of [join(root, "../.env"), join(root, ".env")]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const port = Number(process.env.PORT || 4173);
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const maxMessages = 20;
const maxChars = 2000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(
    typeof body === "string" || Buffer.isBuffer(body)
      ? body
      : JSON.stringify(body),
  );
};

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Error("Request too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function openai(messages, extra = {}) {
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, ...extra }),
  });
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
  return (await upstream.json()).choices?.[0]?.message?.content ?? "";
}

async function generateSummary(req, res) {
  if (!process.env.OPENAI_API_KEY)
    return send(res, 503, {
      error: "AI is not set up. Add OPENAI_API_KEY to .env and restart the server.",
    });
  let description;
  try {
    description = String((await readJson(req)).description ?? "").trim();
    if (description.length > 500) throw new Error();
  } catch {
    return send(res, 400, { error: "Keep the description to 500 characters." });
  }
  try {
    const dir = join(root, "../summaries");
    const [first] = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    const example = JSON.parse(await readFile(join(dir, first), "utf8")).summary;
    const messages = [
      { role: "system", content: buildSummaryPrompt(example) },
      { role: "user", content: description ? `Meeting description: ${description}` : "No description. Choose any everyday meeting topic." },
    ];
    let problem = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = JSON.parse(
          await openai(messages, { response_format: { type: "json_object" }, temperature: 1 }),
        );
        return send(res, 200, {
          title: String(out.title || "Generated meeting").slice(0, 100),
          summary: validateSummary(out.summary),
        });
      } catch (error) {
        if (error.message.startsWith("upstream")) throw error;
        problem = error.message;
        messages.push({
          role: "user",
          content: `That did not follow the format (${problem}). Reply again with corrected JSON.`,
        });
      }
    }
    send(res, 502, { error: "The AI did not produce a valid summary. Try again or rephrase." });
  } catch {
    send(res, 502, { error: "Could not reach the AI service. Check your API key and model." });
  }
}

async function chat(req, res) {
  if (!process.env.OPENAI_API_KEY)
    return send(res, 503, {
      error: "Chat is not set up. Add OPENAI_API_KEY to .env and restart the server.",
    });
  let system, messages;
  try {
    const body = await readJson(req);
    system = buildSystemPrompt(String(body.transcript), String(body.person));
    messages = body.messages;
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.length > maxMessages ||
      !messages.every(
        (m) =>
          ["user", "assistant"].includes(m?.role) &&
          typeof m.content === "string" &&
          m.content.length <= maxChars,
      ) ||
      messages.at(-1).role !== "user"
    )
      throw new Error("Invalid messages.");
  } catch (error) {
    return send(res, 400, { error: error.message });
  }
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok)
      return send(res, 502, {
        error: `The AI service returned an error (${upstream.status}). Check your API key and model.`,
      });
    send(res, 200, { reply: data.choices?.[0]?.message?.content ?? "" });
  } catch {
    send(res, 502, { error: "Could not reach the AI service." });
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/api/status")
    return send(res, 200, { chat: Boolean(process.env.OPENAI_API_KEY) });
  if (pathname === "/api/summaries") {
    try {
      const dir = join(root, "../summaries");
      const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
      const meetings = await Promise.all(
        files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))),
      );
      return send(res, 200, meetings.map(({ id, title, summary }) => ({ id, title, summary })));
    } catch {
      return send(res, 500, { error: "Could not read the summaries folder." });
    }
  }
  if (pathname === "/api/generate-summary")
    return req.method === "POST"
      ? generateSummary(req, res)
      : send(res, 405, { error: "Use POST." });
  if (pathname === "/api/chat")
    return req.method === "POST"
      ? chat(req, res)
      : send(res, 405, { error: "Use POST." });
  const path = normalize(pathname === "/" ? "/index.html" : pathname);
  const type = types[extname(path)];
  if (!type || path.includes(".."))
    return send(res, 404, "Not found", "text/plain");
  try {
    send(res, 200, await readFile(join(root, path)), type);
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Meeting Coach on http://127.0.0.1:${port} (model: ${model})`),
);
