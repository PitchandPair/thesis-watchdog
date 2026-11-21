// The analyst endpoint. PRISM "Test your AI" calls this with {"question": "..."}.
// Numbers come from code (lib/calc.js). The model only explains them and must cite sources.
import { fundamentals, recent8K, insiderActivity, COMPANIES } from "../lib/sec.js";
import { buffett, graham, piotroski } from "../lib/calc.js";
import { ask } from "../lib/llm.js";


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
  const tickers = ["NVDA", "AMD", "MU", "TSM", "LRCX", "ASML", "AVGO", "INTC", "QCOM", "AMAT"];
  for (const ticker of tickers) {
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

export default async function handler(req, res) {
  const question = (req.method === "GET" ? String(req.query?.question || "") : readQuestion(req.body)).slice(0, 4000);
  if (!question) {
    res.status(400).json({ error: "No question found. POST {\"question\": \"...\"} or use ?question=" });
    return;
  }
  if (!process.env.NICRRON_API_KEY) {
    res.status(503).json({ error: "NICRRON_API_KEY is not set on the server yet." });
    return;
  }
  try {
    const data = await buildData();
    const sessionId = String(req.body?.session_id || req.headers["x-session-id"] || "stock-scorecard-chat");
    const out = await ask({
      system: SYSTEM,
      user: `DATA:\n${data}\n\nQUESTION: ${question}`,
      traceInput: question,
      sessionId,
    });
    res.status(200).json({ answer: out.text, model: out.model, prism_trace: out.prism, disclaimer: "Informational only. Not investment advice." });
  } catch (err) {
    res.status(502).json({ error: `Model call failed: ${err.message}` });
  }
}
