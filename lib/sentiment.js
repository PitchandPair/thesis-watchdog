// Headline sentiment. The AI only labels; the Sheet turns labels into a score.
import { ask } from "./llm.js";

export const SENTIMENT_RULES = `You label stock news headlines for one company.
Rules:
1. positive = the headline describes something likely good for the company's business
   (strong results, new contract, product win, analyst upgrade, raised guidance).
2. negative = something likely bad for the business
   (weak results, lawsuit, investigation, recall, analyst downgrade, key executive forced out, cut guidance).
3. neutral = no clear business impact, a price-quote or profile page, a generic list, or mixed signals.
4. Judge only what the headline says. If you are unsure, answer neutral.
5. Never give investment advice.
Reply with JSON only: [{"i": 1, "label": "positive|negative|neutral", "reason": "max 12 words"}]`;

const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

export async function labelHeadlines(ticker, name, items) {
  if (!items.length) return [];
  const key = ticker + "|" + items.map((h) => h.title).join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const list = items.map((h, i) => `${i + 1}. ${h.title}`).join("\n");
  const user = `Company: ${name || ticker} (${ticker})\nHeadlines:\n${list}`;
  const { text, model, prism } = await ask({
    system: SENTIMENT_RULES,
    user,
    model: process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5",
    sessionId: `sentiment-${ticker}`,
  });

  let parsed = [];
  try {
    parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
  } catch {
    parsed = [];
  }
  const rows = items.map((h, i) => {
    const p = parsed.find((x) => Number(x.i) === i + 1) || {};
    const label = ["positive", "negative", "neutral"].includes(p.label) ? p.label : "unreadable";
    return { ...h, label, reason: p.reason || "The model reply could not be read.", model, prism };
  });
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

export const FILING_RULES = `You read one official SEC 8-K filing for one company and label it.
Rules:
1. positive = the filing reports something likely good for the business
   (results above last year, raised guidance, a major new contract, a completed deal that adds revenue).
2. negative = something likely bad
   (results below last year, cut guidance, write-down, layoffs, restatement, lawsuit, a key executive leaving abruptly).
3. neutral = routine paperwork, or the text does not show clear good or bad news.
4. Use ONLY the filing text. If a number supports your label, quote it in the reason.
5. If you are unsure, answer neutral. Never give investment advice.
Reply with JSON only: {"label": "positive|negative|neutral", "reason": "max 20 words"}`;

const filingCache = new Map();

export async function labelFiling(ticker, name, filing) {
  const key = ticker + "|" + filing.sourceUrl;
  if (filingCache.has(key)) return filingCache.get(key);
  const user = `Company: ${name || ticker} (${ticker})\nFiled: ${filing.filed}\nItems: ${filing.itemNames}\nFILING TEXT:\n${filing.text}`;
  const { text, model, prism } = await ask({
    system: FILING_RULES,
    user,
    model: process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5",
    sessionId: `filing-${ticker}`,
    traceInput: `Label the 8-K filed ${filing.filed} by ${ticker} (${filing.itemNames}). Source: ${filing.sourceUrl}`,
  });
  let p = {};
  try {
    p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    p = {};
  }
  const label = ["positive", "negative", "neutral"].includes(p.label) ? p.label : "unreadable";
  const out = { label, reason: p.reason || "The model reply could not be read.", model, prism };
  filingCache.set(key, out);
  return out;
}
