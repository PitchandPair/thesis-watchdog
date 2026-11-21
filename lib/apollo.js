// Apollo: find people who used to work at a company (for the Company Feedback survey).
// Nothing here sends email or contacts anyone. It only looks people up.
// Search costs 0 Apollo credits. Enrichment costs 1 credit per person found (work email only:
// personal emails and phone numbers are never requested).
const BASE = "https://api.apollo.io/api/v1";

export const hasApolloKey = () => Boolean(process.env.APOLLO_API_KEY);

export const COMPANY_DOMAINS = {
  NVDA: { name: "NVIDIA", domain: "nvidia.com", match: /nvidia/i },
  AMD: { name: "Advanced Micro Devices", domain: "amd.com", match: /\bamd\b|advanced micro devices/i },
  TSM: { name: "Taiwan Semiconductor", domain: "tsmc.com", match: /tsmc|taiwan semiconductor/i },
  MU: { name: "Micron", domain: "micron.com", match: /micron/i },
  LRCX: { name: "Lam Research", domain: "lamresearch.com", match: /lam research/i },
  ASML: { name: "ASML", domain: "asml.com", match: /\basml\b/i },
  AVGO: { name: "Broadcom", domain: "broadcom.com", match: /broadcom/i },
  INTC: { name: "Intel", domain: "intel.com", match: /\bintel\b/i },
  QCOM: { name: "Qualcomm", domain: "qualcomm.com", match: /qualcomm/i },
  AMAT: { name: "Applied Materials", domain: "appliedmaterials.com", match: /applied materials/i },
  SPCX: { name: "SpaceX", domain: "spacex.com", match: /spacex|space exploration tech/i },
  ANT: { name: "Anthropic", domain: "anthropic.com", match: /anthropic/i },
};

async function call(path, params, body) {
  const qs = new URLSearchParams();
  for (const [k, v] of params) qs.append(k, v);
  const res = await fetch(`${BASE}${path}?${qs}`, {
    method: "POST",
    headers: { "x-api-key": process.env.APOLLO_API_KEY, "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Apollo returned ${res.status}: ${String(json.error || json.message || json.error_message || "").slice(0, 160)}`);
  return json;
}

// People linked to the company's domain (current OR previous employer) who are not there now.
export async function searchFormerEmployees(co, perPage = 50) {
  const json = await call("/mixed_people/api_search", [
    ["q_organization_domains_list[]", co.domain],
    ["not_organization_websites_list[]", co.domain],
    ["per_page", String(perPage)],
    ["page", "1"],
  ]);
  const people = json.people || [];
  return {
    total: json.total_entries ?? json.pagination?.total_entries ?? null,
    people: people.map((p) => ({ id: p.id, title: p.title || "", currentOrg: p.organization?.name || "", hasEmail: p.has_email })),
  };
}

// From an enriched person: did they work at the company, are they gone, and when did they leave?
export function formerEmployeeFacts(person, co, today = new Date()) {
  const jobs = (person.employment_history || []).filter((j) => co.match.test(j.organization_name || ""));
  if (!jobs.length) return { worked: false, stillThere: false, leftDate: "", lastTitle: "", over12Months: "unknown" };
  const stillThere = jobs.some((j) => j.current) || co.match.test(person.organization?.name || "");
  const ended = jobs.map((j) => j.end_date).filter(Boolean).sort();
  const leftDate = stillThere ? "" : ended[ended.length - 1] || "";
  const last = jobs.slice().sort((a, b) => String(b.end_date || b.start_date || "").localeCompare(String(a.end_date || a.start_date || "")))[0];
  let over12Months = "unknown";
  if (stillThere) over12Months = "no";
  else if (leftDate) {
    const cutoff = new Date(today);
    cutoff.setMonth(cutoff.getMonth() - 12);
    over12Months = new Date(leftDate) <= cutoff ? "yes" : "no";
  }
  return { worked: true, stillThere, leftDate, lastTitle: last?.title || "", over12Months };
}

export async function enrichPeople(ids) {
  const json = await call("/people/bulk_match", [["reveal_personal_emails", "false"], ["reveal_phone_number", "false"]], { details: ids.slice(0, 10).map((id) => ({ id })) });
  return { matches: (json.matches || []).filter(Boolean), creditsConsumed: json.credits_consumed ?? null };
}
