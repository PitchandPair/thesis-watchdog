# Stock Scorecard

MONEY TALKS #3 hackathon, Track 1 (Money Intelligence): an AI stock analyst that shows its work.

Every number comes from an SEC filing and links back to it. Code does the math. The AI only explains, cites its sources, says "I don't know" when the data is missing, and never gives advice.

## How it works

1. `lib/sec.js` pulls public filings from SEC EDGAR (10-K figures, 8-K filings, Form 4 counts).
2. `lib/calc.js` runs the formulas: Buffett-style intrinsic value, Graham number, Piotroski F-score. No AI.
3. `api/sheet` serves each result as CSV. The Google Sheet pulls it in with `IMPORTDATA`, one feed tab per source.
4. `api/chat` answers questions from that data. Model calls go through the Nicrron API and every exchange is traced to PRISM by Block Convey.

## Endpoints

- `GET /api/sheet?tab=buffett&tickers=NVDA,AMD,MU` (tabs: `buffett`, `fundamentals`, `news`, `insider`, `congress`)
- `POST /api/chat` with `{"question": "..."}`

## Environment variables

| Name | Purpose |
| --- | --- |
| `NICRRON_API_KEY` | Model calls (required for `/api/chat`) |
| `PRISMTRACE_API_KEY` | PRISM tracing |
| `PRISMTRACE_PROJECT_ID` | PRISM project |
| `BARGO_API_KEY` | Optional. Free key for the Congress trades source (more rows per day) |
| `SEC_USER_AGENT` | Contact string the SEC asks for, for example `Your Name you@example.com` |

## Data gaps, stated plainly

- SK Hynix does not file with the SEC, so it has no SEC data.
- TSMC files Form 20-F under IFRS, so the US GAAP formula tabs show no data.
- Insider activity counts Form 4 filings. Buy versus sell amounts are not parsed yet.

Informational only. Not investment advice. Public data only.

## Survey employees (simulation)

- `public/stocks.html`: pick a stock, then "Survey employees". Runs a simulated survey of former employees.
- `api/survey.js`, `lib/survey.js`: safe AI-written questions, sample people, simulated email and payout. Nothing is emailed and no money moves.
- `api/contacts.js`, `lib/apollo.js`: a key-protected lookup of real former employees through Apollo. Built and tested with unit tests, but **not in use**: no Apollo key is set, so it returns "no data", and it has never been run against Apollo. It sends no email and contacts no one.

## Tests

`npm test`

## Web frontend (`web/`)

A Next.js dashboard for Sift, deployed as its own Vercel project (`sift-web`, root directory `web`): https://sift-web-one.vercel.app. It does not change anything in the backend above; the root project ignores the `web/` folder.

- **Dashboard:** one card per company with the Sift score, price, Buffett value gap (green below, red above), metric scores, and CEO approval. Data is a snapshot of the Google Sheet in `web/lib/data.ts`.
- **Click for source:** every number opens a panel naming its Sheet tab and cell, with "Open in Google Sheet" and the SEC or Glassdoor link.
- **Ask Sift:** question bar with Quick / Balanced / Deep, which picks the Nicrron model (Haiku / Sonnet / Opus by default). Answers use the dashboard data plus `/api/chat?facts=1`, and are traced to PRISM.
- **PRISM checks:** test runs, guardrails, and an "Ask the analyst" box that calls `/api/chat`.
- **Survey employees (simulation):** a tab that calls `/api/survey`. Nothing is sent or paid.
- **AI summary podcast:** select stocks, pick one of three ElevenLabs voices, generate audio.
- Values the Sheet doesn't have yet are tagged "demo" and never change the Sift score.

Run locally: `cd web && npm install && npm run dev`.

| `sift-web` variable | Purpose |
| --- | --- |
| `NICRRON_API_KEY` | Ask Sift answers |
| `PRISMTRACE_API_KEY`, `PRISMTRACE_PROJECT_ID` | PRISM tracing for Ask Sift |
| `ELEVENLABS_API_KEY` | Podcast audio |
| `NICRRON_MODEL_QUICK`, `_BALANCED`, `_DEEP` | Optional model overrides |
| `ANALYST_URL`, `SURVEY_URL` | Optional; default to the stock-scorecard endpoints |
