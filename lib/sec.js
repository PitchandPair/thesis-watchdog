// SEC EDGAR data access. Every number returned carries the filing it came from.
// Public data only. No AI in this file.

export const COMPANIES = {
  NVDA: { cik: 1045810, name: "NVIDIA Corp" },
  AMD: { cik: 2488, name: "Advanced Micro Devices Inc" },
  MU: { cik: 723125, name: "Micron Technology Inc" },
  TSM: {
    cik: 1046179,
    name: "Taiwan Semiconductor Manufacturing Co Ltd",
    gap: "Files Form 20-F under IFRS in TWD. US GAAP 10-K figures are not available, so formula tabs show no data.",
  },
  "KRX:000660": {
    cik: null,
    name: "SK Hynix Inc",
    gap: "Listed in Korea. It does not file with the SEC, so there is no SEC data.",
  },
};

const UA = process.env.SEC_USER_AGENT || "StockScorecard/1.0 (hackathon research tool)";
const cache = new Map();
const TTL_MS = 60 * 60 * 1000;

async function getJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`SEC request failed (${res.status}) for ${url}`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

const pad = (cik) => String(cik).padStart(10, "0");

export function filingUrl(cik, accn) {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/${accn}-index.htm`;
}

export const companyFacts = (cik) =>
  getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`);
export const submissions = (cik) => getJson(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`);

const days = (a, b) => (new Date(b) - new Date(a)) / 86400000;
const ANNUAL_FORMS = new Set(["10-K", "10-K/A"]);

// Candidate XBRL tags per metric. Companies use different tags for the same idea.
export const TAGS = {
  netIncome: ["NetIncomeLoss"],
  dna: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "Depreciation",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  cfo: ["NetCashProvidedByUsedInOperatingActivities"],
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
  grossProfit: ["GrossProfit"],
  epsDiluted: ["EarningsPerShareDiluted"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  equity: ["StockholdersEquity"],
  assets: ["Assets"],
  assetsCurrent: ["AssetsCurrent"],
  liabilitiesCurrent: ["LiabilitiesCurrent"],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt"],
  sharesOutstanding: ["CommonStockSharesOutstanding"],
};

const INSTANT = new Set([
  "equity",
  "assets",
  "assetsCurrent",
  "liabilitiesCurrent",
  "longTermDebt",
  "sharesOutstanding",
]);

function entriesFor(facts, tag) {
  const node = facts?.facts?.["us-gaap"]?.[tag];
  if (!node) return [];
  const unit = node.units.USD || node.units["USD/shares"] || node.units.shares;
  return (unit || []).filter((e) => ANNUAL_FORMS.has(e.form));
}

// One value per period end, preferring the most recently filed version.
function byEnd(entries) {
  const m = new Map();
  for (const e of entries) {
    const cur = m.get(e.end);
    if (!cur || e.filed > cur.filed) m.set(e.end, e);
  }
  return m;
}

function annualDurations(facts, tags) {
  let best = new Map();
  let bestEnd = "";
  let bestTag = null;
  for (const tag of tags) {
    const full = entriesFor(facts, tag).filter((e) => {
      if (!e.start) return false;
      const d = days(e.start, e.end);
      return d >= 340 && d <= 380;
    });
    const m = byEnd(full);
    const latest = [...m.keys()].sort().pop() || "";
    if (latest > bestEnd) {
      best = m;
      bestEnd = latest;
      bestTag = tag;
    }
  }
  return { map: best, tag: bestTag };
}

function instantAt(facts, tags, end) {
  let found = null;
  for (const tag of tags) {
    const m = byEnd(entriesFor(facts, tag).filter((e) => !e.start));
    let e = m.get(end);
    if (!e) {
      // Allow a few days of drift between cover-page and balance-sheet dates.
      for (const [k, v] of m) if (Math.abs(days(k, end)) <= 7) e = v;
    }
    if (e) {
      found = { ...e, tag };
      break;
    }
  }
  return found;
}

function pack(cik, e, tag) {
  if (!e) return null;
  return {
    value: e.val,
    periodEnd: e.end,
    fiscalYear: e.fy,
    form: e.form,
    filed: e.filed,
    tag: tag || e.tag,
    sourceUrl: filingUrl(cik, e.accn),
  };
}

// Latest and prior fiscal-year fundamentals for one company.
export async function fundamentals(ticker) {
  const co = COMPANIES[ticker];
  if (!co) return { ticker, status: "unknown ticker", gap: "Ticker is not on the watchlist." };
  if (!co.cik || co.gap) return { ticker, name: co.name, status: "no data", gap: co.gap };

  const facts = await companyFacts(co.cik);
  const ni = annualDurations(facts, TAGS.netIncome);
  const ends = [...ni.map.keys()].sort();
  const latestEnd = ends.pop();
  if (!latestEnd) {
    return { ticker, name: co.name, status: "no data", gap: "No annual 10-K net income found in SEC XBRL data." };
  }
  const priorEnd = ends.filter((e) => days(e, latestEnd) >= 300).pop() || null;

  const out = { ticker, name: co.name, cik: co.cik, status: "ok", latestEnd, priorEnd, latest: {}, prior: {}, missing: [] };
  for (const [key, tags] of Object.entries(TAGS)) {
    if (INSTANT.has(key)) {
      out.latest[key] = pack(co.cik, instantAt(facts, tags, latestEnd));
      out.prior[key] = priorEnd ? pack(co.cik, instantAt(facts, tags, priorEnd)) : null;
    } else {
      const { map, tag } = annualDurations(facts, tags);
      out.latest[key] = pack(co.cik, map.get(latestEnd), tag);
      out.prior[key] = priorEnd ? pack(co.cik, map.get(priorEnd), tag) : null;
    }
    if (!out.latest[key]) out.missing.push(key);
  }
  return out;
}

const ITEM_NAMES = {
  "1.01": "Material agreement",
  "1.02": "Agreement terminated",
  "2.01": "Acquisition or disposal completed",
  "2.02": "Results of operations (earnings)",
  "2.03": "New direct financial obligation",
  "2.05": "Exit or restructuring costs",
  "2.06": "Material impairment",
  "3.02": "Unregistered equity sale",
  "5.02": "Director or officer change",
  "5.03": "Bylaw or fiscal-year change",
  "5.07": "Shareholder vote results",
  "7.01": "Regulation FD disclosure",
  "8.01": "Other events",
  "9.01": "Financial statements and exhibits",
};

function recentRows(sub) {
  const r = sub?.filings?.recent;
  if (!r) return [];
  return r.accessionNumber.map((accn, i) => ({
    accn,
    form: r.form[i],
    filed: r.filingDate[i],
    items: r.items?.[i] || "",
    doc: r.primaryDocument?.[i] || "",
  }));
}

// Recent 8-K filings (company news that must be reported to the SEC).
export async function recent8K(ticker, limit = 5) {
  const co = COMPANIES[ticker];
  if (!co?.cik) return { ticker, status: "no data", gap: co?.gap || "Unknown ticker.", filings: [] };
  const rows = recentRows(await submissions(co.cik))
    .filter((f) => f.form === "8-K")
    .slice(0, limit)
    .map((f) => ({
      filed: f.filed,
      itemCodes: f.items,
      itemNames: f.items
        .split(",")
        .map((c) => ITEM_NAMES[c.trim()] || c.trim())
        .filter(Boolean)
        .join("; "),
      sourceUrl: filingUrl(co.cik, f.accn),
    }));
  return { ticker, status: rows.length ? "ok" : "no data", gap: rows.length ? "" : "No 8-K filings found.", filings: rows };
}

// Count of Form 4 filings (insider trade reports). Buy/sell split is not parsed yet.
export async function insiderActivity(ticker, today = new Date()) {
  const co = COMPANIES[ticker];
  if (!co?.cik) return { ticker, status: "no data", gap: co?.gap || "Unknown ticker." };
  const rows = recentRows(await submissions(co.cik)).filter((f) => f.form === "4");
  const within = (n) => rows.filter((f) => days(f.filed, today) <= n).length;
  return {
    ticker,
    status: "ok",
    form4Last90Days: within(90),
    form4Last365Days: within(365),
    latestForm4Date: rows[0]?.filed || "",
    sourceUrl: `https://www.sec.gov/cgi-bin/own-disp?action=getissuer&CIK=${pad(co.cik)}`,
    gap: "Counts Form 4 filings only. Buy versus sell amounts are not parsed yet.",
  };
}
