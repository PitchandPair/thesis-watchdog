// Pulls the actual text of recent 8-K filings from the SEC. Deterministic: no AI here.
import { resolveCompany, submissions, filingUrl } from "./sec.js";

const UA = process.env.SEC_USER_AGENT || "StockScorecard/1.0 (hackathon research tool)";
const cache = new Map();

async function get(url, as = "text") {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SEC returned ${res.status}`);
  const body = as === "json" ? await res.json() : await res.text();
  cache.set(url, body);
  return body;
}

export function htmlToText(html) {
  return html
    .replace(/<(script|style|ix:header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;|&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ITEM_NAMES = {
  "1.01": "Signed an important contract", "1.02": "An important contract ended", "1.03": "Bankruptcy",
  "2.01": "Finished buying or selling a business", "2.02": "Earnings results", "2.04": "Debt came due early",
  "2.05": "Layoffs or restructuring", "2.06": "Asset write-down", "3.01": "Delisting warning",
  "4.02": "Past financials restated", "5.02": "Executive or director change", "5.07": "Shareholder vote",
  "7.01": "Investor presentation or press release", "8.01": "Other company news", "9.01": "Attachments",
};

// Latest 8-K filings with the text of the filing and its press release (exhibit 99), if any.
export async function recentFilingText(ticker, limit = 2) {
  const co = await resolveCompany(ticker);
  if (!co?.cik) return { ticker, status: "no data", gap: "Ticker not found in the SEC company list.", filings: [] };
  const r = (await submissions(co.cik))?.filings?.recent;
  if (!r) return { ticker, status: "no data", gap: "No filings found.", filings: [] };

  const picked = [];
  for (let i = 0; i < r.form.length && picked.length < limit; i++) {
    if (r.form[i] === "8-K") picked.push(i);
  }
  if (!picked.length) return { ticker, name: co.name, status: "no data", gap: "No 8-K filings yet.", filings: [] };

  const filings = [];
  for (const i of picked) {
    const accn = r.accessionNumber[i];
    const base = `https://www.sec.gov/Archives/edgar/data/${co.cik}/${accn.replace(/-/g, "")}`;
    const codes = (r.items?.[i] || "").split(",").map((c) => c.trim()).filter(Boolean);
    let text = "";
    let note = "";
    try {
      const main = htmlToText(await get(`${base}/${r.primaryDocument[i]}`));
      text = main.slice(0, 2000);
      try {
        const index = await get(`${base}/index.json`, "json");
        const exhibit = (index?.directory?.item || []).find(
          (f) => /ex[-_]?99|exhibit99/i.test(f.name) && /\.html?$/i.test(f.name),
        );
        if (exhibit) text += " PRESS RELEASE: " + htmlToText(await get(`${base}/${exhibit.name}`)).slice(0, 6000);
      } catch {
        note = "Press release attachment could not be read.";
      }
    } catch (err) {
      note = `Filing text could not be read: ${err.message}`;
    }
    filings.push({
      filed: r.filingDate[i],
      itemCodes: codes.map((c) => "Item " + c).join(" | "),
      itemNames: codes.filter((c) => c !== "9.01").map((c) => ITEM_NAMES[c] || "Item " + c).join("; "),
      text,
      note,
      sourceUrl: filingUrl(co.cik, accn),
    });
  }
  return { ticker, name: co.name, status: "ok", gap: "", filings };
}
