// CSV feeds for the Google Sheet. Each feed tab pulls one of these with IMPORTDATA.
// Example: /api/sheet?tab=buffett&tickers=NVDA,AMD,MU
import { fundamentals, recent8K, insiderActivity, findTags, COMPANIES } from "../lib/sec.js";
import { buffett, graham, piotroski, DEFAULTS } from "../lib/calc.js";
import { headlines, redditPosts } from "../lib/news.js";
import { resolveCompany } from "../lib/sec.js";
import { labelHeadlines } from "../lib/sentiment.js";
import { hasModelKey } from "../lib/llm.js";
import { labelFiling } from "../lib/sentiment.js";
import { recentFilingText } from "../lib/filings.js";
import { hasRedditKey, trendingPosts } from "../lib/reddit.js";
import { congressTrades, rowsPerTicker } from "../lib/congress.js";

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
  async headlines(tickers) {
    const rows = [["ticker", "headline", "publisher", "published", "source_url", "status", "data_gap"]];
    for (const t of tickers) {
      try {
        const co = await resolveCompany(t);
        const list = await headlines(t, co?.name);
        if (!list.length) rows.push([t, "", "", "", "", "no data", "No headlines in the last 7 days."]);
        for (const h of list) rows.push([t, h.title, h.publisher || h.source, h.published, h.url, "ok", ""]);
      } catch (err) {
        rows.push([t, "", "", "", "", "no data", `Could not reach the source: ${err.message}`]);
      }
    }
    return rows;
  },
  async news_sentiment(tickers) {
    const header = ["ticker", "headline", "publisher", "published", "label", "reason", "source_url", "model", "prism_trace", "status", "data_gap"];
    if (!hasModelKey()) return [header, ["", "", "", "", "", "", "", "", "", "no data", "The AI key is not set on the server yet."]];
    const perTicker = await Promise.all(
      tickers.map(async (t) => {
        try {
          const co = await resolveCompany(t);
          const list = await headlines(t, co?.name);
          if (!list.length) return [[t, "", "", "", "", "", "", "", "", "no data", "No headlines in the last 7 days."]];
          const labeled = await labelHeadlines(t, co?.name, list);
          return labeled.map((h) => [t, h.title, h.source, h.published, h.label, h.reason, h.url, h.model, h.prism, "ok", ""]);
        } catch (err) {
          return [[t, "", "", "", "", "", "", "", "", "no data", `Could not score: ${err.message}`]];
        }
      }),
    );
    return [header, ...perTicker.flat()];
  },
  // 8-K filing text (pulled from the SEC, no AI) plus the AI's label for each filing.
  async filings_ai(tickers) {
    const header = ["ticker", "filed", "what_was_reported", "item_codes", "ai_label", "ai_reason", "filing_text_excerpt", "source_url", "model", "prism_trace", "status", "data_gap"];
    const rows = [header];
    for (let i = 0; i < tickers.length; i += 4) {
      const batch = await Promise.all(
        tickers.slice(i, i + 4).map(async (t) => {
          try {
            const f = await recentFilingText(t);
            if (!f.filings.length) return [[t, "", "", "", "", "", "", "", "", "", "no data", f.gap]];
            const out = [];
            for (const x of f.filings) {
              let ai = { label: "", reason: "", model: "", prism: "" };
              let gap = x.note;
              if (!x.text) gap = gap || "No filing text to read.";
              else if (!hasModelKey()) gap = "The AI key is not set on the server yet.";
              else {
                try {
                  ai = await labelFiling(t, f.name, x);
                } catch (err) {
                  gap = `AI could not read it: ${err.message}`;
                }
              }
              out.push([t, x.filed, x.itemNames, x.itemCodes, ai.label, ai.reason, x.text.slice(0, 700), x.sourceUrl, ai.model, ai.prism, "ok", gap]);
            }
            return out;
          } catch (err) {
            return [[t, "", "", "", "", "", "", "", "", "", "no data", `Could not reach the source: ${err.message}`]];
          }
        }),
      );
      rows.push(...batch.flat());
    }
    return rows;
  },
  // Trending Reddit posts per company, with the AI's label for each post title.
  async reddit_ai(tickers) {
    const header = ["ticker", "post_title", "subreddit", "upvotes", "comments", "published", "ai_label", "ai_reason", "source_url", "how_subreddit_was_found", "status", "data_gap"];
    if (!hasRedditKey()) return [header, ["", "", "", "", "", "", "", "", "", "", "no data", "Reddit is not connected yet. It needs a free Reddit API key."]];
    const rows = [header];
    for (let i = 0; i < tickers.length; i += 4) {
      const batch = await Promise.all(
        tickers.slice(i, i + 4).map(async (t) => {
          try {
            const co = await resolveCompany(t);
            const { posts, foundBy } = await trendingPosts(t, co?.name);
            if (!posts.length) return [[t, "", "", "", "", "", "", "", "", foundBy, "no data", "No trending posts found this week."]];
            let labeled = posts.map((p) => ({ ...p, label: "", reason: "" }));
            let gap = "";
            if (hasModelKey()) {
              try {
                labeled = await labelHeadlines(t, co?.name, posts);
              } catch (err) {
                gap = `AI could not label: ${err.message}`;
              }
            } else gap = "The AI key is not set on the server yet.";
            return labeled.map((p) => [t, p.title, p.subreddit, p.upvotes, p.comments, p.published, p.label, p.reason, p.url, foundBy, "ok", gap]);
          } catch (err) {
            return [[t, "", "", "", "", "", "", "", "", "", "no data", `Could not reach Reddit: ${err.message}`]];
          }
        }),
      );
      rows.push(...batch.flat());
    }
    return rows;
  },
  // Stock trades disclosed by members of Congress (House + Senate). Data via Bargo (https://www.bargo.ai).
  // status: "ok" = a trade, "no trades" = nothing disclosed in the last 3 months, "no data" = source problem.
  async congress(tickers) {
    const rows = [["ticker", "member", "chamber", "buy_or_sell", "amount_range", "trade_date", "filed_date", "source_url", "status", "data_gap"]];
    const limit = rowsPerTicker(tickers.length);
    for (let i = 0; i < tickers.length; i += 4) {
      const batch = await Promise.all(
        tickers.slice(i, i + 4).map(async (t) => {
          try {
            const c = await congressTrades(t, limit);
            if (!c.trades.length) return [[t, "", "", "", "", "", "", "https://www.bargo.ai", c.limited ? "no data" : "no trades", c.gap]];
            const capped = c.trades.length >= limit ? `Only the newest ${limit} trades are shown (free source limit). Older ones are not counted.` : "";
            return c.trades.map((x) => [t, x.member, x.chamber, x.buyOrSell, x.amountRange, x.tradeDate, x.filedDate, x.sourceUrl || "https://www.bargo.ai", "ok", x.sourceUrl ? capped : "No link to the filing from the source."]);
          } catch (err) {
            return [[t, "", "", "", "", "", "", "https://www.bargo.ai", "no data", `Could not reach the source: ${err.message}`]];
          }
        }),
      );
      rows.push(...batch.flat());
    }
    return rows;
  },
  async reddit(tickers) {
    const rows = [["ticker", "post_title", "subreddit", "upvotes", "comments", "published", "source_url", "status", "data_gap"]];
    for (const t of tickers) {
      try {
        const list = await redditPosts(t);
        if (!list.length) rows.push([t, "", "", "", "", "", "", "no data", "No Reddit posts found this week."]);
        for (const r of list) rows.push([t, r.title, r.subreddit, r.upvotes, r.comments, r.published, r.url, "ok", ""]);
      } catch (err) {
        rows.push([t, "", "", "", "", "", "", "no data", `Could not reach the source: ${err.message}`]);
      }
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
  // Congress trades change slowly and the free source has a small daily budget: cache for 12 hours.
  // A failed pull is only cached for 10 minutes so it can recover.
  const failed = rows.some((r) => r[r.length - 2] === "no data");
  const cache = tab === "congress" && !failed ? "s-maxage=43200, stale-while-revalidate=86400" : tab === "congress" ? "s-maxage=600" : "s-maxage=900, stale-while-revalidate=3600";
  res.setHeader("Cache-Control", cache);
  res.status(200).send(csv(rows));
}
