# Data sources

| Source | What it gives | Cost | Feeds |
| --- | --- | --- | --- |
| SEC EDGAR company facts | Annual figures from 10-K and 20-F filings | Free, no key | SEC Raw, Buffett, Fundamentals |
| SEC EDGAR submissions | 8-K and Form 4 filing lists | Free, no key | News 8-K, Insider |
| Google Finance (in Sheets) | Company name, stock price, exchange rates | Free | Results, Buffett |
| Bargo Congress Trades API (bargo.ai) | House and Senate stock trades from STOCK Act filings, last 3 months | Free: 30 requests / 100 rows a day, more with a free key. Credit "Data via Bargo" required | Congress Trades |
| Nicrron API | Runs the AI model that explains the numbers | Hackathon credits | AI summary |
| PRISM by Block Convey | Traces and tests the AI answers | Hackathon plan | Proof for judges |

## Known gaps
- TSM: SEC data stops at fiscal 2024, so its figures are a year old.
- ASML: reports in euros. Converted at the live rate.
- INTC: owner earnings are negative, so the Buffett method does not apply.
- SPCX and ANT: newly public. No annual report yet, so no full-year figures.
- Insider tab counts Form 4 filings only. Buy versus sell amounts are not parsed yet.

- Congress trades: the free source returns the newest trades only (8 per ticker for 12 tickers) and links to the chamber's disclosure site, not to the single filing. Disclosures can lag the trade by up to 45 days.

## Considered, not used
- crnicholson/capitol-api (House trades): needs its own always-on server to download and parse filing PDFs, has no hosted API, covers the House only, and its bundled snapshot stops in mid-2026.
- Financial Modeling Prep, Alpha Vantage, Finnhub: free tiers exist, but a second source can disagree with the SEC filing, which makes every number harder to trace.
