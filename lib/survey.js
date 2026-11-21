// Company Feedback survey: ask FORMER employees a few safe questions about what it was like to work there.
//
// STATUS: SIMULATION ONLY. Nothing here emails a real person or moves money.
//  - Recipients are made-up sample people with addresses on the reserved ".example" domain, which can never deliver.
//  - "Sending" and "paying" only write rows to a ledger marked "simulated".
//  - The real Apollo search is written out below so it can be switched on later, but it stays off
//    unless BOTH SURVEY_LIVE=true and APOLLO_API_KEY are set, and even then no email or payment is sent.
//
// Why former employees and why "safe" questions: a current employee could leak non-public company
// information, which is an insider-trading risk for the person asking. So the survey only asks about
// past, personal experience (culture, management, tools, work-life) and blocks anything about
// financial results, customers, deals, unreleased products or plans.
import { ask } from "./llm.js";

export const SURVEY_MODEL = () => process.env.NICRRON_SUMMARY_MODEL || process.env.NICRRON_SENTIMENT_MODEL || "anthropic/claude-haiku-5-5";
export const isLive = () => process.env.SURVEY_LIVE === "true" && Boolean(process.env.APOLLO_API_KEY);

// ---------- 1. Safe questions ----------

// Used when the AI is unavailable or its questions fail the checks. Written by hand, reviewed, always safe.
export const FALLBACK_QUESTIONS = [
  { id: "q1", type: "rating", text: "Overall, how would you rate your time working at the company? (1 = poor, 5 = excellent)" },
  { id: "q2", type: "rating", text: "How much did you trust senior leadership to be honest with employees? (1 = not at all, 5 = completely)" },
  { id: "q3", type: "rating", text: "How good were the tools and technology you were given to do your job? (1 = poor, 5 = excellent)" },
  { id: "q4", type: "rating", text: "How sustainable was your workload? (1 = not at all, 5 = very)" },
  { id: "q5", type: "rating", text: "Would you recommend the company to a friend as a place to work? (1 = no, 5 = definitely)" },
  { id: "q6", type: "text", text: "In one sentence, what was the best thing about the culture there?" },
];

// Topics a survey question must never touch. Checked in code, so the result does not depend on an AI.
export const BLOCKED_TOPICS = [
  ["financial results", /\b(revenue|earnings|profit|margin|guidance|forecast|quarter(ly)? (results|numbers)|sales (figures|numbers)|bookings|backlog)\b/i],
  ["customers and deals", /\b(customer|client|contract|deal|order|supplier|pricing|partnership)s?\b/i],
  ["unreleased products and plans", /\b(unreleased|upcoming|roadmap|launch|pipeline|next[- ]gen|prototype|in development|future product)\b/i],
  ["corporate actions", /\b(merger|acquisition|acquire|layoff|restructur|buyback|lawsuit|investigation|regulator)\w*/i],
  ["confidential information", /\b(confidential|non-?public|insider|secret|internal (data|numbers|documents)|nda)\b/i],
  ["stock and trading", /\b(stock price|share price|shares|buy or sell|invest)\b/i],
  ["current employees", /\b(current(ly)? (work|employ)|still work|your team now)\b/i],
];

// Returns the reason a question is blocked, or "" if it passes. Exported for tests.
export function ruleCheck(text) {
  for (const [topic, re] of BLOCKED_TOPICS) if (re.test(String(text))) return `Touches a blocked topic: ${topic}.`;
  if (String(text).length > 220) return "Too long. Keep questions under 220 characters.";
  return "";
}

export const QUESTION_RULES = `You write survey questions for people who USED TO work at a company. They are asked about their own past experience as an employee.
Rules:
1. Write exactly 6 questions: five rated 1 to 5, and one short free-text question.
2. Topics allowed: culture, management honesty and competence, tools and technology quality, workload, growth opportunities, whether they would recommend it as a workplace.
3. NEVER ask about: financial results, sales, customers, contracts, deals, suppliers, pricing, unreleased products, roadmaps, plans, layoffs, mergers, lawsuits, the stock, or anything confidential or non-public.
4. Ask only about the past ("when you worked there"). Never ask about current employees or current events.
5. Plain words, one idea per question, under 200 characters each. Do not name the company.
Reply with JSON only: [{"id":"q1","type":"rating|text","text":"..."}]`;

export const REVIEW_RULES = `You are a compliance reviewer. For each survey question, decide if it is SAFE to send to a former employee.
A question is UNSAFE if a truthful answer could reveal non-public company information: financial results, customers, deals, unreleased products, plans, corporate actions, legal matters, or anything confidential. It is also unsafe if it asks about the stock or asks for investment views.
Questions about the person's own past experience of culture, management, tools, workload and growth are SAFE.
Reply with JSON only: [{"id":"q1","verdict":"safe|unsafe","reason":"max 12 words"}]`;

const parseArray = (text) => {
  try {
    return JSON.parse(String(text).slice(String(text).indexOf("["), String(text).lastIndexOf("]") + 1));
  } catch {
    return null;
  }
};

// AI writes the questions, code rules check them, a second AI pass reviews them. Both AI calls go
// through Nicrron and are traced to PRISM, so every generated question and verdict is on record there.
export async function safeQuestions(company) {
  let source = "ai";
  let prism = "";
  let model = "";
  let questions = null;
  try {
    const out = await ask({ system: QUESTION_RULES, user: `Industry context only (do not name it): ${company}`, model: SURVEY_MODEL(), sessionId: "survey-questions", traceInput: `Write 6 safe former-employee survey questions (company context: ${company}).` });
    questions = parseArray(out.text);
    prism = out.prism;
    model = out.model;
  } catch {
    questions = null;
  }
  if (!Array.isArray(questions) || questions.length < 3) {
    questions = FALLBACK_QUESTIONS;
    source = "fallback (AI unavailable)";
  }
  questions = questions.slice(0, 6).map((q, i) => ({ id: q.id || `q${i + 1}`, type: q.type === "text" ? "text" : "rating", text: String(q.text || "").trim() }));

  let review = [];
  try {
    const out = await ask({ system: REVIEW_RULES, user: JSON.stringify(questions.map(({ id, text }) => ({ id, text }))), model: SURVEY_MODEL(), sessionId: "survey-safety-review", traceInput: `Review ${questions.length} survey questions for safety.` });
    review = parseArray(out.text) || [];
    prism = prism || out.prism;
    model = model || out.model;
  } catch {
    review = [];
  }

  const checked = questions.map((q) => {
    const rule = ruleCheck(q.text);
    const ai = review.find((r) => r.id === q.id);
    const aiUnsafe = ai?.verdict === "unsafe";
    const reviewed = Boolean(ai);
    // A question is only sent if the code rules pass AND the AI reviewer did not flag it.
    const safe = !rule && !aiUnsafe;
    return { ...q, safe, rule_check: rule || "passed", ai_review: reviewed ? `${ai.verdict}${ai.reason ? `: ${ai.reason}` : ""}` : "not reviewed (AI unavailable)" };
  });
  const approved = checked.filter((q) => q.safe);
  // Never send fewer than 3 questions: fall back to the hand-written safe set.
  const final = approved.length >= 3 ? approved : FALLBACK_QUESTIONS.map((q) => ({ ...q, safe: true, rule_check: "passed", ai_review: "hand-written safe set" }));
  return { source: approved.length >= 3 ? source : "fallback (too few questions passed)", model, prism_trace: prism, all: checked, approved: final };
}

// ---------- 2. Who to ask ----------

const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Quinn", "Devon", "Skyler", "Reese", "Harper", "Emerson", "Rowan", "Sage", "Tatum", "Blake", "Finley", "Hayden", "Kendall", "Logan", "Parker"];
const LAST = ["Alder", "Birch", "Cedar", "Dunmore", "Ellery", "Fairbank", "Garland", "Hollis", "Ivers", "Jessup", "Kimball", "Larkin", "Merrow", "Northam", "Oakley", "Penrose", "Quill", "Radley", "Sutter", "Thorne"];
const ROLES = ["Software Engineer", "Hardware Engineer", "Program Manager", "Process Engineer", "Field Applications Engineer", "Technical Writer", "Recruiter", "Test Engineer", "Product Marketing Manager", "Facilities Technician"];

// Made-up former employees for the demo. Deterministic: the same ticker and count always give the same list.
// Addresses use ".example", a domain reserved for documentation that can never receive mail (RFC 2606).
export function sampleEmployees(ticker, count) {
  const n = Math.max(1, Math.min(200, Number(count) || 20));
  const t = String(ticker || "DEMO").toLowerCase().replace(/[^a-z0-9]/g, "");
  let seed = [...t].reduce((a, c) => a + c.charCodeAt(0), 7);
  const next = () => (seed = (seed * 9301 + 49297) % 233280);
  return Array.from({ length: n }, (_, i) => {
    const first = FIRST[next() % FIRST.length];
    const last = LAST[next() % LAST.length];
    const leftYear = 2019 + (next() % 7);
    return {
      id: `${t}-sample-${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${last}`,
      email: `${first}.${last}.${i + 1}@former-${t}.example`.toLowerCase(),
      former_role: ROLES[next() % ROLES.length],
      left_company_in: leftYear,
      synthetic: true,
    };
  });
}

// LIVE PATH (off by default). Finds people whose past employer matches the company domain.
// Apollo's People API Search matches q_organization_domains_list[] against current OR previous employers,
// so current employees are removed afterwards. Search results do not include email addresses: those need
// Apollo's People Enrichment endpoint (people/match), which spends credits. That step is deliberately not written.
export async function apolloFormerEmployees(domain, count) {
  if (!isLive()) throw new Error("Live Apollo search is switched off. Set SURVEY_LIVE=true and APOLLO_API_KEY to enable it.");
  const params = new URLSearchParams();
  params.append("q_organization_domains_list[]", domain);
  params.append("per_page", String(Math.min(100, count * 3)));
  const r = await fetch(`https://api.apollo.io/api/v1/mixed_people/api_search?${params}`, {
    method: "POST",
    headers: { "x-api-key": process.env.APOLLO_API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Apollo returned ${r.status}`);
  const json = await r.json();
  const people = (json.people || []).filter((p) => {
    const current = String(p.organization?.primary_domain || p.organization?.website_url || "").toLowerCase();
    return !current.includes(domain.toLowerCase()); // keep only people who no longer work there
  });
  return people.slice(0, count).map((p) => ({ id: p.id, name: [p.first_name, p.last_name_obfuscated || p.last_name].filter(Boolean).join(" "), former_role: p.title || "", email: "", synthetic: false }));
}

// ---------- 3. Email, responses and payout (all simulated) ----------

export function emailPreview(company, questions, payment) {
  return {
    subject: `A 2-minute survey about your time at ${company} ($${payment} thank-you)`,
    body: [
      "Hello,",
      "",
      `We are researching what it was like to work at ${company}. Our records suggest you used to work there.`,
      `The survey has ${questions.length} short questions about your own past experience: culture, management, tools and workload.`,
      "",
      "Please do not share anything confidential or non-public. We do not ask about financial results, customers, products or plans, and we will discard any answer that includes them.",
      "",
      `As a thank-you, completed surveys receive $${payment}.`,
      "",
      "Survey link: [link added when sending is switched on]",
      "To stop receiving messages, reply STOP.",
    ].join("\n"),
  };
}

// Builds the ledger the interface shows. Deterministic so the demo looks the same every time.
// "completed" is a made-up response pattern (about one in three), not a prediction.
export function simulateRun(people, payment) {
  const pay = Math.max(0, Number(payment) || 0);
  const rows = people.map((p, i) => {
    const completed = (i * 7 + p.name.length) % 3 === 0;
    return {
      ...p,
      email_status: "simulated (not sent)",
      survey_status: completed ? "completed (simulated)" : "no response (simulated)",
      payout_status: completed ? "simulated (no money moved)" : "none",
      payout_amount: completed ? pay : 0,
      payout_reference: completed ? `MEOW-SIM-${p.id}` : "",
    };
  });
  const done = rows.filter((r) => r.payout_amount > 0).length;
  return { rows, totals: { invited: rows.length, completed: done, response_rate: rows.length ? Math.round((done / rows.length) * 100) / 100 : 0, payout_total: done * pay, max_cost_if_all_complete: rows.length * pay } };
}
