// PRIVATE endpoint: looks up former employees through Apollo for the Company Feedback survey.
// It returns real people's contact details, so it is locked with a key, never cached and never
// used in an IMPORTDATA formula. It does not send email or contact anyone.
//   GET /api/contacts?ticker=NVDA&mode=search          (0 Apollo credits, no names or emails)
//   GET /api/contacts?ticker=NVDA&mode=enrich&n=5      (up to n Apollo credits)
import { createHash } from "node:crypto";
import { COMPANY_DOMAINS, hasApolloKey, searchFormerEmployees, enrichPeople, formerEmployeeFacts } from "../lib/apollo.js";

// SHA-256 of the access key. The key itself is not stored in this repo.
const KEY_HASH = "6398de773090cf7cfdfe13caf7764e24653a2ba7f3efdd5f21ad214a55349708";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const given = String(req.headers["x-feed-key"] || "");
  if (createHash("sha256").update(given).digest("hex") !== KEY_HASH) return res.status(401).json({ error: "not allowed" });
  if (!hasApolloKey()) return res.status(200).json({ status: "no data", data_gap: "APOLLO_API_KEY is not set on the server." });

  const q = req.query || {};
  const ticker = String(q.ticker || "").toUpperCase();
  const co = COMPANY_DOMAINS[ticker];
  if (!co) return res.status(400).json({ error: "unknown ticker" });
  const n = Math.max(1, Math.min(10, Number(q.n) || 5));

  try {
    const found = await searchFormerEmployees(co);
    // Only people whose current employer is a different company.
    const candidates = found.people.filter((p) => p.id && p.currentOrg && !co.match.test(p.currentOrg));
    if (String(q.mode || "search") !== "enrich") {
      return res.status(200).json({ status: "ok", ticker, total_in_apollo: found.total, returned: found.people.length, candidates: candidates.length, sample_current_employers: candidates.slice(0, 8).map((p) => p.currentOrg) });
    }
    if (!candidates.length) return res.status(200).json({ status: "no data", ticker, data_gap: "Apollo returned no former employees for this company.", rows: [] });
    const { matches, creditsConsumed } = await enrichPeople(candidates.slice(0, n).map((p) => p.id));
    const rows = matches.map((p) => {
      const f = formerEmployeeFacts(p, co);
      return {
        ticker,
        former_employer: co.name,
        full_name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" "),
        last_title_at_company: f.lastTitle,
        left_company_year: f.leftDate ? f.leftDate.slice(0, 4) : "",
        left_over_12_months_ago: f.over12Months,
        worked_there_confirmed: f.worked ? "yes" : "no",
        current_employer: p.organization?.name || "",
        current_title: p.title || "",
        work_email: p.email || "",
        email_status: p.email_status || "",
        linkedin_url: p.linkedin_url || "",
        location: [p.city, p.state, p.country].filter(Boolean).join(", "),
      };
    });
    return res.status(200).json({ status: "ok", ticker, credits_consumed: creditsConsumed, rows });
  } catch (err) {
    return res.status(200).json({ status: "no data", ticker, data_gap: `Could not reach Apollo: ${err.message}`, rows: [] });
  }
}
