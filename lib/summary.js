// One short plain-English summary per stock for the Results tab.
// The AI only rewrites facts that code already pulled from the SEC and the news feed.
// It runs on a low-cost model through Nicrron and every call is traced to PRISM.
import { ask } from "./llm.js";
import { fundamentals, recent8K } from "./sec.js";
import { buffett, graham, piotroski } from "./calc.js";
import { headlines } from "./news.js";

export const SUMMARY_MODEL = () => process.env.NICRRON_SUMMARY_MODEL || process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5";

export const SUMMARY_RULES = `You write a short summary of one stock for a personal research sheet.
Rules:
1. Use ONLY the FACTS given. Never add a number, name or event that is not in FACTS.
2. Write exactly 3 short sentences, 60 words at most in total, plain English, no jargon:
   sentence 1 = what the latest annual report shows (use 1 or 2 numbers, rounded, with the fiscal year).
   sentence 2 = what recent official filings and headlines are about.
   sentence 3 = starts with "Not known:" and names what the facts do not cover.
3. Never say buy, sell, hold, cheap, expensive, undervalued, overvalued, or predict the price.
4. If FACTS has no annual report, say so plainly in sentence 1.
5. No markdown, no bullet points, no quotes.`;

const big = (n) => {
  if (n === null || n === undefined || !isFinite(n)) return "not available";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  return String(n);
};

// Builds the fact sheet the model is allowed to use. Exported so tests can check it.
export function factSheet(ticker, f, filings = [], news = []) {
  const lines = [`Company: ${f?.name || ticker} (${ticker})`];
  if (!f || f.status !== "ok") {
    lines.push(`Annual report: none in SEC data. ${f?.gap || ""}`.trim());
  } else {
    const b = buffett(f);
    const g = graham(f);
    const p = piotroski(f);
    const cur = f.currency || "USD";
    lines.push(`Annual report: fiscal year ended ${f.latestEnd}, form ${f.form || "10-K"}, figures in ${cur}`);
    lines.push(`Revenue: ${big(f.latest.revenue?.value)}`);
    lines.push(`Net income: ${big(f.latest.netIncome?.value)}`);
    if (f.prior?.netIncome?.value) lines.push(`Net income the year before: ${big(f.prior.netIncome.value)}`);
    lines.push(`Owner earnings (net income + depreciation - capital spending): ${big(b.ownerEarnings)}`);
    if (p.fScore !== null && p.fScore !== undefined) lines.push(`Piotroski financial health tests passed: ${p.fScore} of ${p.testsComputable || 9}`);
    if (g.eps !== null && g.eps !== undefined) lines.push(`Diluted earnings per share: ${g.eps}`);
  }
  lines.push(filings.length ? `Recent official 8-K filings: ${filings.map((x) => `${x.filed}: ${x.itemNames}`).join(" | ")}` : "Recent official 8-K filings: none found");
  lines.push(news.length ? `Recent headlines: ${news.map((h) => h.title).join(" | ")}` : "Recent headlines: none found in the last 7 days");
  lines.push("Not in these facts: today's share price, insider buy or sell amounts, anything about the reader's own goals.");
  return lines.join("\n");
}

const cache = new Map();
const TTL_MS = 60 * 60 * 1000;

export async function summarize(ticker) {
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.out;

  const gaps = [];
  const f = await fundamentals(ticker).catch((err) => ({ status: "no data", gap: `Could not reach the SEC: ${err.message}` }));
  const k = await recent8K(ticker, 3).catch(() => ({ filings: [] }));
  const news = await headlines(ticker, f?.name, 4).catch(() => []);
  if (f.status !== "ok") gaps.push(f.gap || "No annual report.");
  if (!k.filings?.length) gaps.push("No 8-K filings found.");
  if (!news.length) gaps.push("No headlines in the last 7 days.");

  const facts = factSheet(ticker, f, k.filings || [], news);
  const { text, model, prism } = await ask({
    system: SUMMARY_RULES,
    user: `FACTS\n${facts}`,
    model: SUMMARY_MODEL(),
    sessionId: `summary-${ticker}`,
    traceInput: `Summarize ${ticker} from SEC and news facts.\n${facts}`,
  });
  const out = {
    summary: String(text || "").replace(/\s+/g, " ").trim(),
    factsUsed: facts,
    sourceUrl: f?.latest?.netIncome?.sourceUrl || "",
    model,
    prism,
    gap: gaps.join(" | "),
  };
  cache.set(ticker, { at: Date.now(), out });
  return out;
}
