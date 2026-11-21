// The spoken briefing: a short script that walks through every stock on the Results tab.
// The Sheet sends its own Results columns in the web address, so the AI reads exactly what the user sees.
import { ask } from "./llm.js";

export const BRIEFING_MODEL = () => process.env.NICRRON_SUMMARY_MODEL || process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5";

// Field order the Sheet sends for each stock, joined with "~". Rows are joined with "_".
export const FIELDS = ["ticker", "price", "buffett_value", "pct_above_value", "aggregate_score", "confidence", "news_score", "congress_score", "filings_score", "moat", "market_structure"];

// "NVDA~125.53~101.55~0.24~4.3~Medium~4~5~5~wide~oligopoly_AMD~..." -> array of objects. Exported for tests.
export function parseRows(data) {
  return String(data || "")
    .split("_")
    .map((r) => r.split("~"))
    .filter((c) => c[0])
    .map((c) => Object.fromEntries(FIELDS.map((f, i) => [f, (c[i] || "").trim() || "no data"])));
}

export function tableText(rows) {
  return rows
    .map((r) => {
      const pct = isFinite(Number(r.pct_above_value)) ? `${Math.round(Number(r.pct_above_value) * 100)}% ${Number(r.pct_above_value) >= 0 ? "above" : "below"} its Buffett-style value` : "no value estimate";
      return `${r.ticker}: price ${r.price}, ${pct}, overall score ${r.aggregate_score} out of 10 (${r.confidence} confidence), news score ${r.news_score}, Congress trades score ${r.congress_score}, official filings score ${r.filings_score}, moat ${r.moat}, market ${r.market_structure}`;
    })
    .join("\n");
}

export const BRIEFING_RULES = `You write a spoken briefing for one person about the stocks on their own research sheet.
Rules:
1. Use ONLY the TABLE. Never add a number, name or event that is not in it.
2. About 170 words, so it takes about 60 seconds to read aloud. Plain spoken English, short sentences, no lists, no symbols, no markdown.
3. Start with one sentence on the whole list. Then call out what stands out: the highest and lowest overall scores, any stock priced below its value estimate, any stock with low confidence or missing data. You do not need to mention every stock.
4. Say tickers as company names where obvious (NVDA is Nvidia, MU is Micron, TSM is Taiwan Semiconductor, SPCX is SpaceX, ANT is Anthropic).
5. Scores are out of 10. "no data" means that part is not known: say so, do not guess.
6. Never say buy, sell, hold, cheap, expensive, undervalued, overvalued, bargain, or predict prices. These are estimates from assumptions, not advice.
7. End with exactly: "This is information, not advice."`;

export async function writeBriefing(rows) {
  const table = tableText(rows);
  const { text, model, prism } = await ask({
    system: BRIEFING_RULES,
    user: `TABLE\n${table}`,
    model: BRIEFING_MODEL(),
    sessionId: "briefing",
    traceInput: `Write the 60-second briefing from the Results table.\n${table}`,
  });
  const script = String(text || "").replace(/\s+/g, " ").trim();
  return { script, words: script.split(" ").filter(Boolean).length, table, model, prism };
}
