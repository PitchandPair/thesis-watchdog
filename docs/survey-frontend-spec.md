# Survey Employees: front-end build spec

For the front-end team. This describes one feature of Sift: a "Survey employees" button that runs a simulated survey of former employees of a company and shows the result.

## Read this first

**Everything in this feature is a simulation.** No real person is contacted. No money moves. The screen must say so in plain sight at all times (see "Required labels").

- Recipients are made-up people. Their email addresses end in `.example`, a reserved domain that can never receive mail.
- "Sending email" and "paying via Meow" only produce rows marked `simulated`.
- The real Apollo search is written in `lib/survey.js` but switched off. Do not add a way to switch it on from the screen.

## What the user does

1. Opens a stock (for example NVIDIA) and clicks **Survey employees**.
2. Picks how many people to survey: **20**, **50** or **200**.
3. Types a thank-you payment per completed survey, in dollars (0 to 500).
4. Clicks **Run survey (simulation)**.
5. Sees: the questions and whether each passed the safety checks, the email that would be sent, the list of recipients with status, and the totals.

## The one API call

```
GET https://stock-scorecard-nine.vercel.app/api/survey?ticker=NVDA&count=20&payment=50
```

| Parameter | Required | Meaning |
|-----------|----------|---------|
| `ticker` | yes | Stock ticker, for example `NVDA` |
| `count` | no | People to survey, 1 to 200. Default 20 |
| `payment` | no | Dollars per completed survey, 0 to 500. Default 0 |
| `company` | no | Company name to show. Looked up from the ticker if left out |

It also accepts POST with the same fields as JSON. It takes 3 to 10 seconds because two AI calls run. Show a loading state.

### What comes back

```json
{
  "mode": "simulation",
  "notice": "Sample data. No real person was contacted and no money moved.",
  "live_search_enabled": false,
  "request": { "ticker": "NVDA", "company": "NVIDIA Corp", "count": 20, "payment_usd": 50 },
  "questions": {
    "source": "ai",
    "model": "anthropic/claude-haiku-5-5",
    "prism_trace": "sent",
    "approved": [
      { "id": "q1", "type": "rating", "text": "...", "safe": true, "rule_check": "passed", "ai_review": "safe: asks about personal experience" }
    ],
    "all_generated": [ "...same shape, includes any question that was blocked..." ]
  },
  "email_preview": { "subject": "...", "body": "..." },
  "recipients": [
    {
      "id": "nvda-sample-001",
      "name": "Avery Alder",
      "email": "avery.alder.1@former-nvda.example",
      "former_role": "Software Engineer",
      "left_company_in": 2022,
      "synthetic": true,
      "email_status": "simulated (not sent)",
      "survey_status": "completed (simulated)",
      "payout_status": "simulated (no money moved)",
      "payout_amount": 50,
      "payout_reference": "MEOW-SIM-nvda-sample-001"
    }
  ],
  "totals": { "invited": 20, "completed": 7, "response_rate": 0.35, "payout_total": 350, "max_cost_if_all_complete": 1000 },
  "steps": [ { "step": 1, "name": "Find former employees", "status": "simulated", "detail": "..." } ]
}
```

The same `ticker` and `count` always return the same people, so the demo looks the same every time.

## Screen layout

**1. Setup panel**
- Company name and ticker.
- Count selector: three buttons, 20 / 50 / 200.
- Payment field: dollar amount. Show live text under it: "If everyone completes it: $X" (count x payment).
- Button: **Run survey (simulation)**.

**2. Progress strip** (from `steps`)
- Five steps in order, each with its `status` as a badge: `done`, `simulated` or `fallback`.
- Show `detail` under each step.

**3. Questions card** (from `questions`)
- List `approved` questions. Each row: the text, a green "Passed" badge, and the two check results (`rule_check`, `ai_review`).
- If `all_generated` has a question with `safe: false`, show it in a separate "Blocked" list with the reason, struck through. This is the proof that the check works.
- Footer line: "Written by AI through Nicrron (`model`). Checked by code rules and a second AI review. Both AI calls are recorded in PRISM." Show `prism_trace`.
- If `source` starts with `fallback`, show: "AI was unavailable or its questions did not pass, so the hand-written safe set is shown."

**4. Email preview card** (from `email_preview`)
- Subject and body, read-only, in a mail-style box.

**5. Recipients table** (from `recipients`)
- Columns: Name, Email, Former role, Left in, Email, Survey, Payout.
- For 200 rows, page or scroll inside the card.
- Every row gets a small "Sample" tag.

**6. Totals bar** (from `totals`)
- Invited, Completed, Response rate (as a percent), Payout total, Maximum cost.

## Required labels

These are not optional. A judge or user must never think this was real.

- A banner at the top of the feature, always visible: the `notice` text from the response.
- The run button text includes "(simulation)".
- The payout column header reads "Payout (simulated)".
- Do not show a real Meow logo next to a "paid" state. Text only: "Meow payout, simulated".

## Safety rules the back end enforces

The front end does not need to re-check these. They are listed so the screen copy matches.

- Only former employees are surveyed, never current ones.
- Questions cover the person's own past experience only: culture, management, tools, workload, growth.
- Blocked topics: financial results, customers and deals, unreleased products and plans, corporate actions (mergers, layoffs, lawsuits), anything confidential, the stock.
- A question is shown as approved only if the code rules pass and the AI reviewer did not flag it.
- If fewer than 3 questions pass, the hand-written safe set is used instead.

## What PRISM does here, exactly

PRISM records both AI calls (writing the questions, and the safety review), so each generated question and each verdict can be inspected in the PRISM dashboard. PRISM does not approve or block questions itself in this build. The blocking is done by the code rules in `lib/survey.js` plus the AI reviewer. Please do not write "PRISM approved" on the screen. Write "Recorded in PRISM".

## Going live later (not for the hackathon)

These steps are for after the hackathon and need a legal review first.

1. **Apollo**: get an API key with access to People API Search. Set `APOLLO_API_KEY` and `SURVEY_LIVE=true` on the server. The search endpoint is `POST https://api.apollo.io/api/v1/mixed_people/api_search` with the company domain in `q_organization_domains_list[]`. That filter matches current and previous employers, so the code removes anyone who still works there.
2. **Email addresses**: the search does not return them. They come from Apollo's People Enrichment endpoint, which spends credits. Not written yet.
3. **Sending**: needs an email provider, an unsubscribe link, and consent rules for cold email. Not written yet.
4. **Survey form**: needs a hosted form that stores answers and discards any answer containing blocked topics. Not written yet.
5. **Payouts**: Meow or another provider, with the owner's approval on every batch. Not written yet. The hackathon rules forbid money movement, so this must stay simulated today.

## Files

- `api/survey.js`: the endpoint.
- `lib/survey.js`: questions, checks, sample people, simulated ledger, and the switched-off Apollo search.
- `tests/survey.test.js`: checks that blocked topics are caught, sample emails cannot deliver, and nothing is ever marked sent or paid.
