# Data sources

| Source | What it gives | Cost | Feeds |
| --- | --- | --- | --- |
| SEC EDGAR company facts | Annual figures from 10-K and 20-F filings | Free, no key | SEC Raw, Buffett, Fundamentals |
| SEC EDGAR submissions | 8-K and Form 4 filing lists | Free, no key | News 8-K, Insider |
| Google Finance (in Sheets) | Company name, stock price, exchange rates | Free | Results, Buffett |
| Nicrron API | Runs the AI model that explains the numbers | Hackathon credits | AI summary |
| PRISM by Block Convey | Traces and tests the AI answers | Hackathon plan | Proof for judges |

## Known gaps
- TSM: SEC data stops at fiscal 2024, so its figures are a year old.
- ASML: reports in euros. Converted at the live rate.
- INTC: owner earnings are negative, so the Buffett method does not apply.
- SPCX and ANT: newly public. No annual report yet, so no full-year figures.
- Insider tab counts Form 4 filings only. Buy versus sell amounts are not parsed yet.

## Considered, not used
- Financial Modeling Prep, Alpha Vantage, Finnhub: free tiers exist, but a second source can disagree with the SEC filing, which makes every number harder to trace.
