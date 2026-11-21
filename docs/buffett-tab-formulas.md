# Buffett tab: the formulas, in plain words

All math lives in the Google Sheet. The app only pipes in raw SEC figures.

## Assumptions (yellow cells, editable)
| Cell | Meaning | Default |
| --- | --- | --- |
| B2 | Growth rate of owner earnings | 8% |
| B3 | Discount rate (the return you require) | 10% |
| B4 | Terminal growth (after the last year, forever) | 3% |
| B5 | Years of growth counted | 10 |

## Columns
| Column | What it is | Formula |
| --- | --- | --- |
| B | Net income | from SEC Raw |
| C | Depreciation and amortization | from SEC Raw |
| D | Capital spending | from SEC Raw |
| E | Owner earnings | `B + C - D` |
| F | Diluted shares | from SEC Raw |
| G | Value of the next N years, in today's money | `E*(1+g)/(r-g)*(1-((1+g)/(1+r))^N)` |
| H | Value of everything after year N, in today's money | `E*(1+g)^N*(1+tg)/(r-tg)/(1+r)^N` |
| I | Total intrinsic value | `G + H` |
| J | Intrinsic value per US share, in USD | `I / F * exchange rate * shares per US share` |
| K | Stock price today | Google Finance |
| L | Price minus value | `K - J` |
| M | Price above or below value | `L / J` |
| N | Reading | below value (green), above value (red), or not applicable |
| R | Currency the company reports in | from SEC Raw |
| S | Exchange rate to USD | Google Finance, live |
| T | Ordinary shares per US-listed share | 1, or 5 for TSM |

## Where the method comes from
Warren Buffett described "owner earnings" in his 1986 shareholder letter and has said intrinsic value is the discounted value of the cash a business will produce. He has never published an exact formula, so this is a Buffett-style estimate. The result moves a lot with the assumptions.

## When the method does not apply
If owner earnings are zero or negative (Intel in fiscal 2025), the tab says so instead of printing a value.
