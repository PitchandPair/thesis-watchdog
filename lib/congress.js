// Congress trades: stock trades disclosed by members of the House and Senate (STOCK Act filings).
// Source: Bargo Congress Trades API (https://www.bargo.ai). Free tier, last 3 months of trades.
// Bargo's terms require a visible "Data via Bargo" credit wherever these rows are shown.
//
// Free-tier budget per day: 30 requests / 100 rows without a key, 100 requests / 1,000 rows
// with a free key (BARGO_API_KEY). One request per ticker, so rows per ticker are kept small.
const BASE = "https://www.bargo.ai/free-apis/congress/v1";

export const hasCongressKey = () => Boolean(process.env.BARGO_API_KEY);

// Rows to ask for per ticker, so one full refresh stays inside the daily row budget.
export function rowsPerTicker(tickerCount, hasKey = hasCongressKey()) {
  const budget = hasKey ? 250 : 100;
  return Math.max(1, Math.min(hasKey ? 25 : 10, Math.floor(budget / Math.max(1, tickerCount))));
}

// The source says "purchase", "sale", "sale_partial", "exchange"... The Sheet rules only need
// buy, sell or other. Anything unrecognised is "other", never guessed.
export function buyOrSell(type) {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("purchase") || t === "buy") return "buy";
  if (t.startsWith("sale") || t.startsWith("sell")) return "sell";
  return "other";
}

export function toRow(ticker, t) {
  return {
    ticker,
    member: t.member || "",
    chamber: t.chamber || "",
    buyOrSell: buyOrSell(t.type),
    amountRange: t.amount_range || "",
    tradeDate: t.transaction_date || "",
    filedDate: t.disclosure_date || "",
    // Official disclosure site for the member's chamber. The source gives no per-filing link.
    sourceUrl: t.filing_portal || "",
  };
}

export async function congressTrades(ticker, limit = 10) {
  const headers = { Accept: "application/json" };
  if (hasCongressKey()) headers.Authorization = `Bearer ${process.env.BARGO_API_KEY}`;
  const res = await fetch(`${BASE}/trades/${encodeURIComponent(ticker)}?limit=${limit}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    return { trades: [], limited: true, gap: "The free daily limit of the Congress trades source is used up. Try again tomorrow." };
  }
  if (!res.ok) throw new Error(`Congress trades source returned ${res.status}`);
  const json = await res.json();
  const trades = (json?.trades || []).map((t) => toRow(ticker, t));
  return { trades, limited: false, gap: trades.length ? "" : "No trades disclosed by members of Congress in the last 3 months." };
}
