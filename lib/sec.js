// SEC EDGAR data access. Every number returned carries the filing it came from.
// Public data only. No AI in this file.

export const COMPANIES = {
  NVDA: { cik: 1045810, name: "NVIDIA Corp" },
  AMD: { cik: 2488, name: "Advanced Micro Devices Inc" },
  MU: { cik: 723125, name: "Micron Technology Inc" },
  TSM: { cik: 1046179, name: "Taiwan Semiconductor Manufacturing Co Ltd" },
  LRCX: { cik: 707549, name: "Lam Research Corp" },
  ASML: { cik: 937966, name: "ASML Holding NV" },
  AVGO: { cik: 1730168, name: "Broadcom Inc" },
  INTC: { cik: 50863, name: "Intel Corp" },
  QCOM: { cik: 804328, name: "Qualcomm Inc" },
  AMAT: { cik: 6951, name: "Applied Materials Inc" },
};

// Any other US-listed ticker is looked up in the SEC's own ticker list.
export async function resolveCompany(ticker) {
  if (COMPANIES[ticker]) return COMPANIES[ticker];
  try {
    const list = await getJson("https://www.sec.gov/files/company_tickers.json");
    const hit = Object.values(list).find((c) => c.ticker === ticker);
    if (hit) return (COMPANIES[ticker] = { cik: hit.cik_str, name: hit.title });
  } catch {
    // fall through to "not found"
  }
  return null;
}

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
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "S-1", "S-1/A", "424B4"]);

// Candidate XBRL tags per metric. Companies use different tags for the same idea.
export const TAGS = {
  netIncome: ["NetIncomeLoss", "ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
  dna: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "DepreciationAndAmortisationExpense",
    "AdjustmentsForDepreciationAndAmortisationExpense",
  ],
  depreciationOnly: ["Depreciation", "AdjustmentsForDepreciationExpense", "DepreciationExpense"],
  amortizationOnly: ["AmortizationOfIntangibleAssets", "AdjustmentsForAmortisationExpense", "AmortisationExpense"],
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
  ],
  cfo: ["NetCashProvidedByUsedInOperatingActivities", "CashFlowsFromUsedInOperatingActivities"],
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "Revenue", "RevenueFromContractsWithCustomers"],
  grossProfit: ["GrossProfit"],
  epsDiluted: ["EarningsPerShareDiluted", "DilutedEarningsLossPerShare"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "AdjustedWeightedAverageShares"],
  equity: ["StockholdersEquity", "EquityAttributableToOwnersOfParent", "Equity"],
  assets: ["Assets"],
  assetsCurrent: ["AssetsCurrent", "CurrentAssets"],
  liabilitiesCurrent: ["LiabilitiesCurrent", "CurrentLiabilities"],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt", "NoncurrentPortionOfNoncurrentBondsIssued", "LongtermBorrowings"],
  sharesOutstanding: ["CommonStockSharesOutstanding", "NumberOfSharesOutstanding", "NumberOfSharesIssued"],
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
  const node = facts?.facts?.["us-gaap"]?.[tag] || facts?.facts?.["ifrs-full"]?.[tag];
  if (!node) return [];
  // A filer can report the same line in more than one unit (for example TWD plus a USD
  // convenience figure). Use the unit with the most recent annual data; prefer USD on a tie.
  let best = [];
  let bestEnd = "";
  for (const [unit, list] of Object.entries(node.units)) {
    if (!/^([A-Z]{3}|[A-Z]{3}\/shares|shares)$/.test(unit)) continue;
    const rows = list.filter((e) => ANNUAL_FORMS.has(e.form));
    const latest = rows.reduce((m, e) => (e.end > m ? e.end : m), "");
    if (latest > bestEnd || (latest === bestEnd && latest && unit.startsWith("USD"))) {
      best = rows.map((e) => ({ ...e, unit }));
      bestEnd = latest;
    }
  }
  return best;
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
    unit: e.unit,
    sourceUrl: filingUrl(cik, e.accn),
  };
}

// Latest and prior fiscal-year fundamentals for one company.
export async function fundamentals(ticker) {
  const co = await resolveCompany(ticker);
  if (!co) return { ticker, status: "no data", gap: "Ticker not found in the SEC company list. It may not file with the SEC." };

  const facts = await companyFacts(co.cik);
  const ni = annualDurations(facts, TAGS.netIncome);
  const ends = [...ni.map.keys()].sort();
  const latestEnd = ends.pop();
  if (!latestEnd) {
    return { ticker, name: co.name, status: "no data", gap: "No annual report in SEC data yet. Newly public companies have no full-year filing until their first 10-K." };
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
  }
  // Some filers report depreciation and amortization on separate lines.
  for (const period of [out.latest, out.prior]) {
    if (!period.dna && period.depreciationOnly) {
      period.dna = {
        ...period.depreciationOnly,
        value: period.depreciationOnly.value + (period.amortizationOnly?.value || 0),
        tag: "depreciation + amortization (two lines added together)",
      };
    }
  }
  for (const key of Object.keys(TAGS)) {
    if (!out.latest[key] && key !== "depreciationOnly" && key !== "amortizationOnly") out.missing.push(key);
  }
  out.currency = (out.latest.netIncome?.unit || "USD").slice(0, 3);
  out.form = out.latest.netIncome?.form || "";
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
  const co = await resolveCompany(ticker);
  if (!co?.cik) return { ticker, status: "no data", gap: "Ticker not found in the SEC company list.", filings: [] };
  const rows = recentRows(await submissions(co.cik))
    .filter((f) => f.form === "8-K" || f.form === "6-K")
    .slice(0, limit)
    .map((f) => ({
      filed: f.filed,
      itemCodes: f.items.split(",").map((c) => c.trim()).filter(Boolean).map((c) => "Item " + c).join(" | "),
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
  const co = await resolveCompany(ticker);
  if (!co?.cik) return { ticker, status: "no data", gap: "Ticker not found in the SEC company list." };
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

// Lists the XBRL tags a company uses that match a search word. For checking data gaps.
export async function findTags(ticker, word = "") {
  const co = await resolveCompany(ticker);
  if (!co?.cik) return [];
  const facts = await companyFacts(co.cik);
  const rows = [];
  for (const tax of ["us-gaap", "ifrs-full"]) {
    for (const [tag, node] of Object.entries(facts?.facts?.[tax] || {})) {
      if (word && !tag.toLowerCase().includes(word.toLowerCase())) continue;
      for (const [unit, list] of Object.entries(node.units)) {
        const last = list[list.length - 1];
        rows.push([ticker, tax, tag, unit, last.end, last.form, last.val]);
      }
    }
  }
  return rows.sort((a, b) => (a[4] < b[4] ? 1 : -1)).slice(0, 80);
}
