# Stock Scorecard: product requirements

## Goal
One Google Sheet that scores only the stocks you add, with every number traceable to its source.

## How it works
1. Add a ticker to the Results tab.
2. Raw numbers are piped into feed tabs from public sources. No math in the pipe.
3. Plain Sheet formulas do the scoring, so anyone can click a cell and see how it was calculated.
4. The Results tab combines the scores.

## Tabs
| Tab | What it holds |
| --- | --- |
| Results | Final screen: one row per stock |
| Build Steps | Every build step with owner and status |
| Sources | What data feeds which column |
| SEC Raw | Raw figures from SEC filings, with a link to each filing |
| Buffett | Owner earnings and intrinsic value, with editable assumptions |
| Fundamentals | Graham number and Piotroski F-score |
| News 8-K | Recent company events reported to the SEC |
| Insider | Count of insider trade reports (Form 4) |

## Scoring modules
Each module is its own tab, gives a 0 to 10 score and has an adjustable weight.

Built or in progress:
1. Buffett intrinsic value
2. Graham number and Piotroski F-score
5. News and 8-K filings
13. Insider and institutional buying

Planned:
3. Scenarios (bull, base, bear)
4. CEO promises kept
6. Reddit sentiment
7. Congress trades
8. Trend alert (past look-alike events)
9. Future opportunities and brand power
10. Company feedback
11. Moat
12. Competitors

## Rules
- Numbers come from formulas, never from AI.
- Every number links to its source.
- Missing data says "no data" and why. Nothing is guessed.
- The tool informs. It never advises and never promises returns.

## Hackathon scope (MONEY TALKS #3, Track 1: Money Intelligence)
- Model calls go through the Nicrron API.
- Every AI answer is traced and tested on PRISM by Block Convey.
- Optional: a spoken summary with ElevenLabs.
