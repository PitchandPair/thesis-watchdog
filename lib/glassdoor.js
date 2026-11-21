// Company Feedback: employee ratings from public Glassdoor company pages, collected by Bright Data.
// Glassdoor has no public API, so this goes through Bright Data's Web Scraper API.
// A collection job takes a minute or more, so it runs in two steps: start a job, then read it.
// The result is stored in the Sheet as one-time research. Ratings move slowly.
const BASE = "https://api.brightdata.com/datasets/v3";
export const DATASET = process.env.BRIGHTDATA_GLASSDOOR_DATASET || "gd_l7j0bx501ockwldaqf";

export const hasBrightKey = () => Boolean(process.env.BRIGHTDATA_API_KEY);
const headers = () => ({ Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`, "Content-Type": "application/json" });

async function call(url, init) {
  const r = await fetch(url, { ...init, headers: headers() });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: r.status, json, text: text.slice(0, 1500) };
}

// Start a job. mode "keyword" searches by company name. mode "url" takes Glassdoor overview page addresses.
export async function startJob(inputs, mode = "keyword", field = "keyword") {
  const q = mode === "url" ? "" : `&type=discover_new&discover_by=${mode}`;
  // Searching by name: Bright Data wants a Glassdoor search page address and how many results to keep.
  const search = (v) => ({ search_url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(v)}`, max_search_results: 1 });
  const body = mode === "url" ? inputs.map((url) => ({ url })) : inputs.map((v) => (field === "keyword" ? search(v) : { [field]: v }));
  return call(`${BASE}/trigger?dataset_id=${DATASET}&format=json&include_errors=true${q}`, { method: "POST", body: JSON.stringify(body) });
}

export async function readJob(snapshotId) {
  return call(`${BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`, { method: "GET" });
}

const pick = (o, keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return "";
};

// One clean row per company record. Field names vary a little between records, so several are tried. Exported for tests.
export function toRow(rec) {
  return {
    company: pick(rec, ["company", "company_name", "name"]),
    overall: pick(rec, ["ratings_overall", "rating", "overall_rating"]),
    ceoApproval: pick(rec, ["ratings_ceo_approval", "ceo_approval", "ratings_ceo_approval_percentage"]),
    recommend: pick(rec, ["ratings_recommend_to_friend", "recommend_to_friend"]),
    culture: pick(rec, ["ratings_cutlure_values", "ratings_culture_values"]),
    workLife: pick(rec, ["ratings_work_life_balance"]),
    reviews: pick(rec, ["reviews_count", "ratings_count", "details_reviews_count"]),
    ceo: pick(rec, ["ratings_rated_ceo"]),
    ticker: pick(rec, ["stock_symbol"]),
    url: pick(rec, ["url_reviews", "url", "url_overview"]),
    collected: pick(rec, ["timestamp"]),
  };
}
