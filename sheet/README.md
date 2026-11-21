# The Google Sheet

The Sheet is the user interface of Stock Scorecard: one row per stock, one tab per data feed, and every scoring rule in a yellow cell.

- **Live Sheet (view only):** https://docs.google.com/spreadsheets/d/13m3cJszYxjUIAfiswwQ2f7D9mzkLGMB7a0x-3-T01EM/edit
- **Copy in this folder:** `Stock-Scorecard.xlsx`, exported on 2026-11-21. It holds all 28 tabs and their formulas.

## Things to know about the file copy

- It is a snapshot. The live Sheet keeps updating; this file does not.
- Feed tabs pull data with `IMPORTDATA` from the app (`/api/sheet?tab=...`). Excel does not have that function, so in Excel those tabs show the values saved at export time. Open the live Sheet, or upload the file to Google Sheets, to see them refresh.
- **Congress Trades:** the individual trade rows were removed from this file. The source (Bargo, https://www.bargo.ai) does not allow its raw records to be redistributed as a file. The formulas and the rules are kept, and the live Sheet shows the rows. Data via Bargo.
- **Feedback Survey (SIM)** and **Feedback Contacts** hold made-up people. No real person was contacted and no money moved.

## Main tabs

| Tab | What it is |
| --- | --- |
| Results | One row per stock: scores for each metric and the Aggregate Score |
| Weights | Yellow cells: how much each metric counts |
| Buffett, Scenarios | Intrinsic value, and the same value in bear, base and bull cases |
| Congress Trades, Congress Rules, Congress Summary | Trades disclosed by members of Congress, the scoring rules, and one row per company |
| News Sentiment, 8-K Filings, Moat + Competitors, AI Summary | AI-labelled feeds, each with its source link |
| Feedback Rules | Rules for the simulated former-employee survey, with the link to the survey form |

Informational only. Not investment advice.
