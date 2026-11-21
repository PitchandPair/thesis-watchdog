// Survey employees (SIMULATION). One call returns everything the interface needs to show:
//   GET /api/survey?ticker=NVDA&company=NVIDIA&count=20&payment=50
// count: how many former employees to survey (1 to 200; the interface offers 20, 50, 200).
// payment: thank-you amount in USD per completed survey.
// Nothing is emailed and no money moves. See lib/survey.js.
import { safeQuestions, sampleEmployees, emailPreview, simulateRun, isLive, FALLBACK_QUESTIONS } from "../lib/survey.js";
import { resolveCompany } from "../lib/sec.js";
import { hasModelKey } from "../lib/llm.js";

export default async function handler(req, res) {
  const q = { ...(req.query || {}), ...(typeof req.body === "object" && req.body ? req.body : {}) };
  const ticker = String(q.ticker || "").trim().toUpperCase();
  const count = Math.max(1, Math.min(200, Number(q.count) || 20));
  const payment = Math.max(0, Math.min(500, Number(q.payment) || 0));
  if (!ticker) {
    res.status(400).json({ error: "Pass ticker, count and payment. Example: /api/survey?ticker=NVDA&count=20&payment=50" });
    return;
  }
  let company = String(q.company || "").trim();
  if (!company) {
    const co = await resolveCompany(ticker).catch(() => null);
    company = co?.name || ticker;
  }

  const questions = hasModelKey()
    ? await safeQuestions(company)
    : { source: "fallback (AI key not set)", model: "", prism_trace: "", all: [], approved: FALLBACK_QUESTIONS.map((x) => ({ ...x, safe: true, rule_check: "passed", ai_review: "hand-written safe set" })) };

  const people = sampleEmployees(ticker, count);
  const run = simulateRun(people, payment);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    mode: "simulation",
    notice: "Sample data. No real person was contacted and no money moved.",
    live_search_enabled: isLive(),
    request: { ticker, company, count, payment_usd: payment },
    questions: { source: questions.source, model: questions.model, prism_trace: questions.prism_trace, approved: questions.approved, all_generated: questions.all },
    email_preview: emailPreview(company, questions.approved, payment),
    recipients: run.rows,
    totals: run.totals,
    steps: [
      { step: 1, name: "Find former employees", status: "simulated", detail: `${count} made-up sample people. Live source would be Apollo People API Search.` },
      { step: 2, name: "Write safe questions", status: questions.source.startsWith("ai") ? "done" : "fallback", detail: "AI writes them, code rules and a second AI review check them. Both AI calls are traced to PRISM." },
      { step: 3, name: "Send survey emails", status: "simulated", detail: "Nothing is sent." },
      { step: 4, name: "Collect responses", status: "simulated", detail: "A fixed made-up response pattern." },
      { step: 5, name: "Pay thank-you via Meow", status: "simulated", detail: "No money moves. Hackathon rules forbid money movement." },
    ],
  });
}
