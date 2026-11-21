// CSV feeds for the Google Sheet. Each feed tab pulls one of these with IMPORTDATA.
// Example: /api/sheet?tab=buffett&tickers=NVDA,AMD,MU
import { fundamentals, recent8K, insiderActivity, findTags, COMPANIES } from "../lib/sec.js";
import { buffett, graham, piotroski, DEFAULTS } from "../lib/calc.js";

const cell = (x) => {
  if (x === null || x === undefined) return "";
  const s = String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows) => rows.map((r) => r.map(cell).join(",")).join("\n");
const num = (q, d) => (q !== undefined && q !== "" && isFinite(Number(q)) ? Number(q) : d);

async function safe(fn) {
  try {
    return await fn();
  } catch (err) {
    return { status: "no data", gap: `Could not reach the source: ${err.message}` };
  }
}

const builders = {
  async buffett(tickers, q) {
    const params = {
      growth: num(q.g, DEFAULTS.growth),
      discount: num(q.r, DEFAULTS.discount),
      terminalGrowth: num(q.tg, DEFAULTS.terminalGrowth),
    };
    const rows = [["ticker", "net_income", "depreciation_amortization", "capex", "owner_earnings", "diluted_shares", "intrinsic_value_per_share", "fiscal_year_end", "source_url", "status", "data_gap", "currency", "form"]];
    for (const t of tickers) {
      const b = await safe(async () => buffett(await fundamentals(t), params));
      rows.push([t, b.netIncome, b.dna, b.capex, b.ownerEarnings, b.dilutedShares, b.intrinsicValuePerShare, b.fiscalYearEnd, b.sourceUrl, b.status, b.gap, b.currency, b.form]);
    }
    return rows;
  },
  async fundamentals(tickers) {
    const rows = [["ticker", "eps_diluted", "book_value_per_share", "graham_number", "piotroski_f_score", "piotroski_tests_computable", "piotroski_score_0_to_10", "fiscal_year_end", "source_url", "status", "data_gap"]];
    for (const t of tickers) {
      const r = await safe(async () => {
        const f = await fundamentals(t);
        return { g: graham(f), p: piotroski(f) };
      });
      const g = r.g || r;
      const p = r.p || r;
      const ok = g.status === "ok" || p.status === "ok";
      rows.push([t, g.eps, g.bookValuePerShare, g.grahamNumber, p.fScore, p.testsComputable, p.score0to10, p.fiscalYearEnd || g.fiscalYearEnd, p.sourceUrl || g.sourceUrl, ok ? "ok" : "no data", [g.gap, p.gap].filter(Boolean).join(" | ")]);
    }
    return rows;
  },
  async news(tickers) {
    const rows = [["ticker", "filed", "form", "what_was_reported", "item_codes", "source_url", "status", "data_gap"]];
    for (const t of tickers) {
      const n = await safe(() => recent8K(t));
      if (!n.filings?.length) rows.push([t, "", "", "", "", "", "no data", n.gap]);
      for (const f of n.filings || []) rows.push([t, f.filed, "8-K", f.itemNames, f.itemCodes, f.sourceUrl, "ok", ""]);
    }
    return rows;
  },
  async tags(tickers, q) {
    const rows = [["ticker", "taxonomy", "tag", "unit", "latest_period_end", "form", "value"]];
    for (const t of tickers.slice(0, 2)) rows.push(...(await findTags(t, String(q.q || ""))));
    return rows;
  },
  async insider(tickers) {
    const rows = [["ticker", "form4_filings_last_90_days", "form4_filings_last_365_days", "latest_form4_date", "source_url", "status", "data_gap"]];
    for (const t of tickers) {
      const i = await safe(() => insiderActivity(t));
      rows.push([t, i.form4Last90Days, i.form4Last365Days, i.latestForm4Date, i.sourceUrl, i.status, i.gap]);
    }
    return rows;
  },
};

export default async function handler(req, res) {
  const q = req.query || {};
  const tab = String(q.tab || "buffett").toLowerCase();
  const tickers = String(q.tickers || Object.keys(COMPANIES).join(","))
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);
  if (!builders[tab]) {
    res.status(400).send(`unknown tab. use one of: ${Object.keys(builders).join(" ")}`);
    return;
  }
  const rows = await builders[tab](tickers, q);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  res.status(200).send(csv(rows));
}
