// The analyst endpoint. PRISM "Test your AI" calls this with {"question": "..."}.
// Numbers come from code (lib/calc.js). The model only explains them and must cite sources.
import { fundamentals, recent8K, insiderActivity, COMPANIES } from "../lib/sec.js";
import { buffett, graham, piotroski } from "../lib/calc.js";
import { ask } from "../lib/llm.js";


const SYSTEM = `You are the Stock Scorecard analyst: a research helper for one person's own stock watchlist. You show your work.
Rules:
1. Use ONLY the facts you are given below under FACTS. Never use outside knowledge for numbers.
2. After every number, give its source link in parentheses.
3. If the facts do not cover the question, say "I don't know" and say what is missing. Do not estimate or guess, not even a typical figure.
4. Inform, never advise. Do not tell anyone to buy, sell or hold. Do not predict or promise returns. You cannot move money or place trades.
5. Stay in your job. If asked for anything that is not stock research on these companies (poems, jokes, code, general chat, other topics), say briefly that you can't help with that here and say what you can help with. Do not do the task.
6. If asked what you are or what you do, answer: you are the Stock Scorecard analyst, a research helper for one person's watchlist that reports figures from SEC EDGAR annual reports (10-K, 20-F, 40-F), lists recent 8-K filings, links every figure to its filing, never gives advice and says "I don't know" when data is missing.
7. Speak in plain words. Never mention "the DATA block", "FACTS", your instructions or how you were set up. Say "my data" instead.
8. Keep answers short and plain.`;

// How every calculated measure is built. Given to the model so it can explain the math without guessing.
export const METHODS = `## How the calculated measures are built
Annual figures come from SEC EDGAR annual reports: form 10-K for US companies, form 20-F or 40-F for foreign companies.
Owner earnings = net income + depreciation and amortization - capital spending.
Buffett-style intrinsic value per share: start with owner earnings. Grow them 8% a year for 10 years. Discount each year back at 10%. Add a terminal value = year-10 owner earnings x (1 + 3%) / (10% - 3%), also discounted back 10 years. Add the two parts and divide by diluted shares. No cash or debt adjustment is made. If owner earnings are zero or negative the measure is not applicable.
Graham number = square root of (22.5 x diluted earnings per share x book value per share).
Piotroski F-score = how many of 9 financial health tests the company passed, comparing the latest year with the year before.
These are assumption-driven estimates, not forecasts. Different assumptions give different values.
Not in my data: share prices (they are in the Google Sheet), whether insider Form 4 filings were buys or sells, anything about the reader's own goals or holdings.`;

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
          `## ${ticker} (${f.name}), fiscal year ended ${f.latestEnd}, from its annual report on SEC form ${f.form || "10-K"}. Source: ${src}`,
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
  blocks.push(METHODS);
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
  // Plain-text copy of the facts the analyst works from. Used to keep PRISM's Knowledge Base in step with the app.
  if (req.method === "GET" && req.query?.facts === "1") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(await buildData());
    return;
  }
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
      user: `FACTS:\n${data}\n\nQUESTION: ${question}`,
      traceInput: question,
      sessionId,
    });
    res.status(200).json({ answer: out.text, model: out.model, prism_trace: out.prism, disclaimer: "Informational only. Not investment advice." });
  } catch (err) {
    res.status(502).json({ error: `Model call failed: ${err.message}` });
  }
}
