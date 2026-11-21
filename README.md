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

## Tests

`npm test`
