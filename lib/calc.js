// Deterministic calculations. No AI. Every input comes from lib/sec.js with a source link.

const v = (x) => (x && typeof x.value === "number" ? x.value : null);
const round = (n, d = 2) => (n === null || !isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

export const DEFAULTS = { growth: 0.08, discount: 0.1, terminalGrowth: 0.03, years: 10 };

// Buffett "owner earnings" = net income + depreciation and amortization - capital spending.
// Intrinsic value = those earnings grown for N years, discounted back, plus a terminal value.
export function buffett(f, params = {}) {
  const p = { ...DEFAULTS, ...params };
  if (f.status !== "ok") return { status: "no data", gap: f.gap };
  const ni = v(f.latest.netIncome);
  const dna = v(f.latest.dna);
  const capex = v(f.latest.capex);
  const shares = v(f.latest.dilutedShares);
  const need = { netIncome: ni, dna, capex, dilutedShares: shares };
  const missing = Object.keys(need).filter((k) => need[k] === null);
  const raw = {
    netIncome: ni, dna, capex, dilutedShares: shares,
    fiscalYearEnd: f.latestEnd, currency: f.currency || "USD", form: f.form || "",
    sourceUrl: f.latest.netIncome?.sourceUrl,
  };
  if (missing.length) return { ...raw, status: "no data", gap: `Missing from SEC data: ${missing.join(" ")}` };
  if (p.discount <= p.terminalGrowth) return { status: "no data", gap: "Discount rate must be above terminal growth." };

  const ownerEarnings = ni + dna - capex;
  if (ownerEarnings <= 0) {
    return { ...raw, status: "negative", ownerEarnings, gap: "Owner earnings are zero or negative, so this method does not apply." };
  }
  let pv = 0;
  let cash = ownerEarnings;
  for (let y = 1; y <= p.years; y++) {
    cash *= 1 + p.growth;
    pv += cash / (1 + p.discount) ** y;
  }
  const terminal = (cash * (1 + p.terminalGrowth)) / (p.discount - p.terminalGrowth);
  pv += terminal / (1 + p.discount) ** p.years;

  return {
    status: "ok",
    netIncome: ni,
    dna,
    capex,
    ownerEarnings,
    dilutedShares: shares,
    intrinsicValueTotal: round(pv, 0),
    intrinsicValuePerShare: round(pv / shares, 2),
    params: p,
    fiscalYearEnd: f.latestEnd,
    currency: f.currency || "USD",
    form: f.form || "",
    sourceUrl: f.latest.netIncome.sourceUrl,
  };
}

// Graham number = sqrt(22.5 x earnings per share x book value per share).
export function graham(f) {
  if (f.status !== "ok") return { status: "no data", gap: f.gap };
  const eps = v(f.latest.epsDiluted);
  const equity = v(f.latest.equity);
  const shares = v(f.latest.sharesOutstanding) ?? v(f.latest.dilutedShares);
  if (eps === null || equity === null || shares === null) {
    return { status: "no data", gap: "Missing EPS, equity or share count in SEC data." };
  }
  const bvps = equity / shares;
  if (eps <= 0 || bvps <= 0) {
    return { status: "no data", eps, bookValuePerShare: round(bvps), gap: "EPS or book value is not positive, so the Graham number does not apply." };
  }
  return {
    status: "ok",
    eps,
    bookValuePerShare: round(bvps),
    grahamNumber: round(Math.sqrt(22.5 * eps * bvps)),
    fiscalYearEnd: f.latestEnd,
    sourceUrl: f.latest.epsDiluted.sourceUrl,
  };
}

// Piotroski F-score: nine yes/no health tests comparing this year with last year.
export function piotroski(f) {
  if (f.status !== "ok") return { status: "no data", gap: f.gap };
  const L = (k) => v(f.latest[k]);
  const P = (k) => v(f.prior[k]);
  const ratio = (a, b) => (a === null || b === null || b === 0 ? null : a / b);
  const tests = [
    ["Positive return on assets", ratio(L("netIncome"), L("assets")), (x) => x > 0],
    ["Positive operating cash flow", L("cfo"), (x) => x > 0],
    ["Return on assets improved", [ratio(L("netIncome"), L("assets")), ratio(P("netIncome"), P("assets"))], ([a, b]) => a > b],
    ["Cash flow exceeds net income", [L("cfo"), L("netIncome")], ([a, b]) => a > b],
    ["Long-term debt ratio fell", [ratio(L("longTermDebt"), L("assets")), ratio(P("longTermDebt"), P("assets"))], ([a, b]) => a < b],
    ["Current ratio improved", [ratio(L("assetsCurrent"), L("liabilitiesCurrent")), ratio(P("assetsCurrent"), P("liabilitiesCurrent"))], ([a, b]) => a > b],
    ["No new shares issued", [L("sharesOutstanding") ?? L("dilutedShares"), P("sharesOutstanding") ?? P("dilutedShares")], ([a, b]) => a <= b],
    ["Gross margin improved", [ratio(L("grossProfit"), L("revenue")), ratio(P("grossProfit"), P("revenue"))], ([a, b]) => a > b],
    ["Asset turnover improved", [ratio(L("revenue"), L("assets")), ratio(P("revenue"), P("assets"))], ([a, b]) => a > b],
  ];
  let passed = 0;
  let computable = 0;
  const detail = [];
  for (const [name, input, test] of tests) {
    const vals = Array.isArray(input) ? input : [input];
    if (vals.some((x) => x === null || x === undefined)) {
      detail.push({ name, result: "no data" });
      continue;
    }
    computable++;
    const ok = test(input);
    if (ok) passed++;
    detail.push({ name, result: ok ? "pass" : "fail" });
  }
  if (computable === 0) return { status: "no data", gap: "No Piotroski tests could be computed." };
  return {
    status: "ok",
    fScore: passed,
    testsComputable: computable,
    score0to10: round((passed / computable) * 10, 1),
    detail,
    gap: computable < 9 ? `${9 - computable} of 9 tests lack data` : "",
    fiscalYearEnd: f.latestEnd,
    sourceUrl: f.latest.netIncome.sourceUrl,
  };
}
