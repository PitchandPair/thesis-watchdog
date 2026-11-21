// The analyst endpoint. PRISM "Test your AI" calls this with {"question": "..."}.
// Numbers come from code (lib/calc.js). The model only explains them and must cite sources.
import { fundamentals, recent8K, insiderActivity, COMPANIES } from "../lib/sec.js";
import { buffett, graham, piotroski } from "../lib/calc.js";

const NICRRON_URL = (process.env.NICRRON_BASE_URL || "https://api.nicrron.ai/v1") + "/chat/completions";
const MODEL = process.env.NICRRON_MODEL || "nicrron/auto";
const PRISM_HOST = process.env.PRISMTRACE_HOST || "https://api.prism.blockconvey.com";

const SYSTEM = `You are a stock research analyst that shows its work.
Rules:
1. Use ONLY the facts in the DATA block. Never use outside knowledge for numbers.
2. After every number, give its source link in parentheses.
3. If the DATA block does not cover the question, say "I don't know" and say what data is missing.
4. Inform, never advise. Do not tell anyone to buy, sell or hold. Do not predict or promise returns.
5. Keep answers short and plain.`;

const money = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "no data");

async function buildData() {
  const blocks = [];
  for (const ticker of Object.keys(COMPANIES)) {
    try {
      const f = await fundamentals(ticker);
      if (f.status !== "ok") {
        blocks.push(`## ${ticker} (${COMPANIES[ticker].name})\nNO DATA. Reason: ${f.gap}`);
        continue;
      }
      const b = buffett(f);
      const g = graham(f);
      const p = piotroski(f);
      const news = await recent8K(ticker, 3);
      const ins = await insiderActivity(ticker);
      const src = f.latest.netIncome.sourceUrl;
      const L = (k) => (f.latest[k] ? money(f.latest[k].value) : "no data");
      blocks.push(
        [
          `## ${ticker} (${f.name}), fiscal year ended ${f.latestEnd}. Source: ${src}`,
          `Revenue: ${L("revenue")} USD`,
          `Net income: ${L("netIncome")} USD`,
          `Operating cash flow: ${L("cfo")} USD`,
          `Depreciation and amortization: ${L("dna")} USD`,
          `Capital spending: ${L("capex")} USD`,
          `Diluted EPS: ${L("epsDiluted")} USD`,
          `Total assets: ${L("assets")} USD`,
          `Stockholders equity: ${L("equity")} USD`,
          b.status === "ok"
            ? `Owner earnings (calculated): ${money(b.ownerEarnings)} USD. Buffett-style intrinsic value per share (calculated, assumes ${b.params.growth * 100}% growth for ${b.params.years} years, ${b.params.discount * 100}% discount rate, ${b.params.terminalGrowth * 100}% terminal growth): ${b.intrinsicValuePerShare} USD`
            : `Buffett intrinsic value: no data. ${b.gap}`,
          g.status === "ok" ? `Graham number (calculated): ${g.grahamNumber} USD` : `Graham number: no data. ${g.gap}`,
          p.status === "ok" ? `Piotroski F-score (calculated): ${p.fScore} of ${p.testsComputable} tests passed` : `Piotroski: no data. ${p.gap}`,
          ...news.filings.map((n) => `8-K filed ${n.filed}: ${n.itemNames}. Source: ${n.sourceUrl}`),
          ins.status === "ok" ? `Form 4 insider filings in the last 90 days: ${ins.form4Last90Days}. Source: ${ins.sourceUrl}. Note: ${ins.gap}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (err) {
      blocks.push(`## ${ticker}\nNO DATA. Reason: could not reach the SEC (${err.message})`);
    }
  }
  blocks.push("Stock prices are NOT in this data. Share prices live in the Google Sheet, not here.");
  return blocks.join("\n\n");
}

function readQuestion(body) {
  if (!body) return "";
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return body;
    }
  }
  for (const k of ["question", "message", "input", "query", "prompt", "text"]) {
    if (typeof body[k] === "string" && body[k].trim()) return body[k];
  }
  if (Array.isArray(body.messages)) {
    const last = [...body.messages].reverse().find((m) => m.role === "user");
    if (typeof last?.content === "string") return last.content;
    if (Array.isArray(last?.content)) return last.content.map((c) => c.text || "").join(" ");
    if (Array.isArray(last?.parts)) return last.parts.map((c) => c.text || "").join(" ");
  }
  return "";
}

async function trace(question, answer, model, latencyMs, sessionId) {
  if (!process.env.PRISMTRACE_API_KEY || !process.env.PRISMTRACE_PROJECT_ID) return "skipped";
  try {
    const r = await fetch(PRISM_HOST + "/api/traces", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": process.env.PRISMTRACE_API_KEY },
      body: JSON.stringify({
        project_id: process.env.PRISMTRACE_PROJECT_ID,
        model,
        input_messages: [{ role: "user", content: question }],
        output_message: answer,
        latency_ms: latencyMs,
        session_id: sessionId,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok ? "sent" : `failed (${r.status})`;
  } catch (err) {
    return `failed (${err.message})`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST a JSON body like {\"question\": \"...\"}" });
    return;
  }
  const question = readQuestion(req.body).slice(0, 4000);
  if (!question) {
    res.status(400).json({ error: "No question found in the request body." });
    return;
  }
  if (!process.env.NICRRON_API_KEY) {
    res.status(503).json({ error: "NICRRON_API_KEY is not set on the server yet." });
    return;
  }
  const started = Date.now();
  const data = await buildData();
  let answer;
  let model = MODEL;
  try {
    const r = await fetch(NICRRON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NICRRON_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `DATA:\n${data}\n\nQUESTION: ${question}` },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json?.error?.message || `Nicrron returned ${r.status}`);
    answer = json.choices?.[0]?.message?.content || "";
    model = json.model || MODEL;
  } catch (err) {
    res.status(502).json({ error: `Model call failed: ${err.message}` });
    return;
  }
  const sessionId = String(req.body?.session_id || req.headers["x-session-id"] || "stock-scorecard");
  const prism = await trace(question, answer, model, Date.now() - started, sessionId);
  res.status(200).json({ answer, model, prism_trace: prism, disclaimer: "Informational only. Not investment advice." });
}
