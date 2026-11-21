// "Sift": the spoken briefing in a fixed show format (cold open, up to 3 stories, one fact, outro).
// The Sheet picks the stocks and sends their numbers. Code adds the latest official filing, headlines
// and Congress trades. The AI only arranges those facts into the script. Anything missing is skipped.
import { ask } from "./llm.js";
import { recent8K } from "./sec.js";
import { headlines } from "./news.js";
import { congressTrades } from "./congress.js";

export const SIFT_MODEL = () => process.env.NICRRON_SUMMARY_MODEL || process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5";

// Field order the Sheet sends for each chosen stock, joined with "~". Stocks are joined with "_".
export const SIFT_FIELDS = ["ticker", "company", "price", "change_pct_last_session", "buffett_value", "price_minus_value", "pct_vs_value", "moat_label", "moat_score", "moat_reason", "market_structure", "main_competitors"];

export function parseSift(data) {
  return String(data || "")
    .split("_")
    .map((r) => r.split("~"))
    .filter((c) => c[0] && c[0].trim())
    .slice(0, 3)
    .map((c) => Object.fromEntries(SIFT_FIELDS.map((f, i) => [f, (c[i] || "").trim()])));
}

const has = (v) => v !== "" && v !== undefined && v !== null && v !== "no data";
const pct = (v) => `${Math.abs(Math.round(Number(v) * 1000) / 10)}%`;

// The fact sheet for one stock. Lines with no data are left out, so the AI has nothing to guess from. Exported for tests.
export function storyFacts(s, extra = {}) {
  const out = [`STOCK ${s.ticker}${has(s.company) ? ` (${s.company})` : ""}`];
  if (has(s.price)) {
    const move = has(s.change_pct_last_session) && isFinite(Number(s.change_pct_last_session)) ? `, ${Number(s.change_pct_last_session) >= 0 ? "up" : "down"} ${pct(s.change_pct_last_session)} in the last trading session` : "";
    out.push(`Price: $${s.price}${move}`);
  }
  if (has(s.buffett_value) && isFinite(Number(s.buffett_value)) && has(s.price_minus_value)) {
    const d = Number(s.price_minus_value);
    out.push(`Buffett: intrinsic value estimate $${s.buffett_value} vs price $${s.price}. Price is ${d >= 0 ? "over" : "under"} the estimate by $${Math.abs(d)} (${has(s.pct_vs_value) ? pct(s.pct_vs_value) : "percent not available"})`);
  }
  if (extra.congress) out.push(`Congress: ${extra.congress}`);
  if (has(s.moat_label)) out.push(`Moat: ${s.moat_label}${has(s.moat_score) ? `, score ${s.moat_score} out of 10` : ""}${has(s.moat_reason) ? `, because ${s.moat_reason}` : ""}`);
  if (has(s.main_competitors)) out.push(`Competitors: ${s.main_competitors}${has(s.market_structure) ? ` (market: ${s.market_structure})` : ""}. No price moves for competitors are available.`);
  if (extra.filing) out.push(`Latest official filing: ${extra.filing}`);
  if (extra.news?.length) out.push(`Recent headlines: ${extra.news.join(" | ")}`);
  return out.join("\n");
}

export const SIFT_RULES = `You write the script for "Sift", a short spoken stock briefing for one person about their own watchlist.
Use ONLY the FACTS. Never add a number, name, date or event that is not in FACTS. If a line of the format has no fact behind it, skip that line silently. Never say a fact is missing.

FORMAT (spoken, no labels read aloud, no lists, no symbols, no markdown):
COLD OPEN: "It's [date], this is Sift. Today: [stock 1, what changed]. [stock 2, what changed]. [stock 3, what changed]."
ONE STORY PER STOCK, in the order given, each in this order:
 1. Headline: company and ticker, what changed in one line (latest filing, headline, or price move).
 2. Price: current price and the move in the last trading session.
 3. Buffett: intrinsic value estimate versus price, under or over by how many dollars and percent.
 4. Congress: who bought or sold, the dollar range and the date. If FACTS says there were none, say "no new trades by members of Congress".
 5. Moat: the score out of 10 and the reason.
 6. Competitors: name them. Only give competitor price moves if FACTS has them.
 7. Recap: one factual line on what moved and why.
PLUS ONE FACT: one surprising fact about one of these companies, taken only from FACTS.
OUTRO, exactly: "That's your Sift. This is information only, not investment advice."

RULES
- No opinions. Never say buy, sell, hold, cheap, expensive, undervalued, overvalued, bargain, or predict prices.
- The intrinsic value is an estimate from assumptions. Call it an estimate.
- Say dollar amounts and percents as words a voice can read. Round to whole dollars and whole percents.
- Never say or imply that an event caused a price move, unless a headline in FACTS says so. Use "and", not "after" or "because", when you put a price move next to a filing.
- For the one fact, pick something not already said in the stories (a moat reason, a competitor detail, a filing detail).
- About 110 words per story. Short sentences.`;

async function extras(s) {
  const out = {};
  const [k, n, c] = await Promise.all([
    recent8K(s.ticker, 1).catch(() => null),
    headlines(s.ticker, s.company, 2).catch(() => []),
    congressTrades(s.ticker, 2).catch(() => null),
  ]);
  const f = k?.filings?.[0];
  if (f) out.filing = `${f.filed}: ${f.itemNames || "8-K"}`;
  if (n?.length) out.news = n.map((h) => h.title);
  if (c && !c.limited) {
    const t = c.trades?.[0];
    out.congress = t ? `${t.member}${t.chamber ? ` (${t.chamber})` : ""} reported a ${t.buyOrSell} of ${t.amountRange || "an undisclosed amount"} on ${t.tradeDate}` : "no new trades disclosed by members of Congress in the last 3 months";
  }
  return out;
}

export async function writeSift(stocks, today = new Date()) {
  const date = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const blocks = await Promise.all(stocks.map(async (s) => storyFacts(s, await extras(s))));
  const facts = `Date: ${date}\n\n${blocks.join("\n\n")}`;
  const { text, model, prism } = await ask({
    system: SIFT_RULES,
    user: `FACTS\n${facts}`,
    model: SIFT_MODEL(),
    sessionId: "sift-briefing",
    traceInput: `Write the Sift briefing.\n${facts}`,
  });
  const script = String(text || "").replace(/\s+/g, " ").trim();
  const words = script.split(" ").filter(Boolean).length;
  return { script, words, seconds: Math.round((words / 160) * 60), facts, model, prism };
}
