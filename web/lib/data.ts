// Synced from the "Stock Scorecard" Google Sheet on Nov 21, 2026 (3:30 PM ET).
// Every value carries a source: the Sheet tab and cell it came from, plus the original source where there is one.
// Values marked demo are placeholders for the demo, for metrics the Sheet doesn't have yet.

export const SHEET_ID = "13m3cJszYxjUIAfiswwQ2f7D9mzkLGMB7a0x-3-T01EM";
export const SYNCED_AT = "Nov 21, 2026, 3:30 PM ET";
export const TABS = { results: 0, weights: 8, buffett: 7, moat: 34, feedback: 37, congress: 17, news: 12 } as const;
export type TabKey = keyof typeof TABS;
export const TAB_NAMES: Record<TabKey, string> = {
  results: "Results", weights: "Weights", buffett: "Buffett", moat: "Moat + Competitors",
  feedback: "Company Feedback", congress: "Congress Summary", news: "News Sentiment",
};
export const sheetUrl = (tab: TabKey, range?: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${TABS[tab]}${range ? `&range=${range}` : ""}`;

export type Source = { label: string; value: string; tab?: TabKey; cell?: string; url?: string; urlLabel?: string; note?: string; demo?: boolean };

export type SectionKey = "buffett" | "graham" | "scenarios" | "news" | "congress" | "feedback" | "moat" | "competition" | "flags" | "trend";
// Column letters on the Results tab. All weights are 5 of 10 on the Weights tab today.
export const SECTIONS: { key: SectionKey; label: string; col: string; weightRow: number; desc: string; demo?: boolean }[] = [
  { key: "buffett", label: "Buffett Value", col: "H", weightRow: 2, desc: "Price versus Buffett-style intrinsic value" },
  { key: "graham", label: "Graham + Piotroski", col: "I", weightRow: 3, desc: "Financial health from SEC filings" },
  { key: "scenarios", label: "Scenarios", col: "J", weightRow: 4, desc: "How value holds up in bull, base and bear cases" },
  { key: "news", label: "News Sentiment", col: "L", weightRow: 6, desc: "Recent headlines, labeled by AI" },
  { key: "congress", label: "Congress Trades", col: "N", weightRow: 8, desc: "Trades disclosed by members of Congress" },
  { key: "feedback", label: "Company Feedback", col: "P", weightRow: 10, desc: "Employee approval of the CEO (Glassdoor)" },
  { key: "moat", label: "Moat", col: "Q", weightRow: 11, desc: "How hard the business is to copy" },
  { key: "competition", label: "Competitors", col: "R", weightRow: 12, desc: "How many real competitors it has" },
  { key: "flags", label: "8-K Flags", col: "T", weightRow: 14, desc: "Red flags in official company announcements" },
  { key: "trend", label: "Trend Alert", col: "O", weightRow: 9, desc: "What happened to similar companies in similar events", demo: true },
];
export const WEIGHT = 5;

export type Headline = { title: string; publisher: string; date: string; tone: "Positive" | "Neutral" | "Negative"; reason: string; row: number };
export type Stock = {
  ticker: string; name: string; sector: string; row: number; // row on Results tab
  price: number | null; intrinsicValue: number | null; ivNote?: string;
  aggregate: number | null; confidence: string;
  scores: Partial<Record<SectionKey, number | null>>; // 0-10, null = no data
  demoScores?: Partial<Record<SectionKey, number>>;
  summary: string; secUrl?: string; gap?: string;
  moat?: { label: string; reason: string; structure: string; competitors: string[]; structureReason: string };
  glassdoor?: { ceo: string; approval: number | null; rating: number; reviews: number; url: string; note?: string };
  congress?: { buys: number; sales: number; membersBuying: number; membersSelling: number; latest: string; signal: string };
  news?: { positive: number; neutral: number; negative: number; headlines: Headline[] };
  // demo-only fields
  change1d: number; spark: number[]; trendOdds?: number; ceoPromise?: "Delivered" | "Behind" | "Over achieved"; comp30d?: number[];
  pending?: boolean;
};

// Deterministic demo series so the look is stable between visits.
function demoSpark(seed: number, end: number, drift: number) {
  const out: number[] = []; let v = end * (1 - drift); let s = seed;
  for (let i = 0; i < 10; i++) { s = (s * 9301 + 49297) % 233280; v += (end - v) / (10 - i) + (s / 233280 - 0.5) * end * 0.03; out.push(+v.toFixed(2)); }
  out[9] = end; return out;
}

type Raw = Omit<Stock, "change1d" | "spark"> & { seed: number; drift: number; chg: number };
const RAW: Raw[] = [
  { ticker: "NVDA", name: "NVIDIA", sector: "Semiconductors · AI accelerators", row: 2, price: 125.53, intrinsicValue: 101.55, aggregate: 5.5, confidence: "Medium: 9 of 13 metrics have data",
    scores: { buffett: 2.6, graham: 4.4, scenarios: 2, news: 5, congress: 5.5, feedback: 9.8, moat: 9, competition: 6, flags: 5 }, demoScores: { trend: 4.5 },
    summary: "NVIDIA's 10-K for the fiscal year ended January 25, 2026 shows revenue of 215.9 billion USD and net income of 120.1 billion USD. Recent filings include November 2026 earnings results and a director or officer change, and headlines discuss Jensen Huang's exit. Not known: today's share price or insider trade amounts.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/0001045810-26-000021-index.htm",
    moat: { label: "Wide", reason: "CUDA software ecosystem, developer lock-in, full-stack systems and networking, and scale in advanced chip design are very hard to replicate.", structure: "Oligopoly", competitors: ["AMD", "Intel", "Broadcom", "Google (TPU)"], structureReason: "NVIDIA dominates AI accelerators. AMD, Intel and hyperscaler custom chips are the few other credible suppliers." },
    glassdoor: { ceo: "Jensen Huang", approval: 98, rating: 4.5, reviews: 4056, url: "https://www.glassdoor.com/Reviews/NVIDIA-Reviews-E7633.htm", note: "An 8-K filed 2026-11-12 reported a CEO change. This approval is for the CEO named here." },
    congress: { buys: 5, sales: 5, membersBuying: 2, membersSelling: 4, latest: "2026-10-28", signal: "Mixed" },
    news: { positive: 1, neutral: 3, negative: 1, headlines: [
      { title: "Nvidia Earnings Are Sideshow as Huang's Ouster Looms Over Market", publisher: "Bloomberg", date: "Nov 17", tone: "Negative", reason: "Reports possible ouster of CEO Huang, a key executive leaving.", row: 3 },
      { title: "Nvidia Earnings: Business as Usual as Forecasts Suggest That All Is Well", publisher: "Morningstar", date: "Nov 18", tone: "Positive", reason: "Forecasts suggest all is well, with earnings described as business as usual.", row: 6 },
      { title: "Congressman Sold Nvidia Stock Two Weeks Before Jensen Huang Exit", publisher: "Benzinga", date: "Nov 20", tone: "Neutral", reason: "Congressional stock trade story; Huang exit mentioned but impact unclear.", row: 4 } ] },
    seed: 11, drift: 0.12, chg: 1.8, trendOdds: 52, ceoPromise: "Over achieved", comp30d: [4.2, -3.1, 2.9, 1.6] },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors · CPUs and GPUs", row: 3, price: 424.39, intrinsicValue: 80.49, aggregate: 5.1, confidence: "Medium: 8 of 13 metrics have data",
    scores: { buffett: 0, graham: 7.8, scenarios: 0, news: 4, congress: null, feedback: 9.6, moat: 6, competition: 8, flags: 5 }, demoScores: { trend: 5.5 },
    summary: "The fiscal 2025 annual report (10-K, year ended December 27, 2025) shows revenue of 34.6 billion dollars and net income of 4.3 billion dollars. Filings cover earnings, a bylaw change and an unregistered equity sale, while headlines cover share falls and a short seller's China concerns. Not known: today's share price, insider trades, or your own goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/2488/000000248826000018/0000002488-26-000018-index.htm",
    moat: { label: "Narrow", reason: "x86 license, chiplet design expertise and customer relationships are hard to copy, but AMD depends on TSMC and trails Nvidia's AI software.", structure: "Duopoly", competitors: ["Intel", "Nvidia", "Qualcomm", "Amazon (Graviton)"], structureReason: "x86 CPUs are essentially AMD and Intel. Arm chips and Nvidia in AI GPUs add pressure." },
    glassdoor: { ceo: "Dr. Lisa Su", approval: 96, rating: 4.0, reviews: 5037, url: "https://www.glassdoor.com/Reviews/AMD-Reviews-E15.htm" },
    congress: { buys: 0, sales: 0, membersBuying: 0, membersSelling: 0, latest: "none", signal: "No trades" },
    news: { positive: 0, neutral: 4, negative: 1, headlines: [
      { title: "AMD Shares Slump After Shortseller Raises China Concerns", publisher: "Bloomberg", date: "Nov 19", tone: "Negative", reason: "Short seller raises China concerns; a credible business risk.", row: 8 },
      { title: "Is NVIDIA's Turmoil AMD's Biggest Opening Yet?", publisher: "Yahoo Finance", date: "Nov 17", tone: "Neutral", reason: "Speculative framing about rival turmoil; no clear business impact stated.", row: 7 },
      { title: "Why Is AMD Stock Falling on Friday?", publisher: "Benzinga", date: "Nov 20", tone: "Neutral", reason: "Price movement headline with no stated business cause.", row: 10 } ] },
    seed: 23, drift: 0.08, chg: -0.6, trendOdds: 57, ceoPromise: "Delivered", comp30d: [-3.1, 6.1, 1.4, 2.2] },
  { ticker: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors · Foundry", row: 4, price: 318.71, intrinsicValue: 108.37, aggregate: 5.4, confidence: "Medium: 8 of 13 metrics have data",
    scores: { buffett: 0, graham: 8.9, scenarios: 0, news: 6, congress: 7, feedback: 6.6, moat: 9, competition: 6, flags: null }, demoScores: { trend: 6, flags: 6 },
    summary: "The fiscal 2024 annual report shows revenue of 88.3 billion dollars and net income of 35.3 billion, up from 27.8 billion. Recent 8-K filings date from November 10 to 13, 2026, while headlines cover a sharp Taiwan market slide and debate over AI spending. Not known: today's share price, insider trades, or what the 8-K filings contain.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/1046179/000119312525083423/0001193125-25-083423-index.htm",
    moat: { label: "Wide", reason: "Leading-edge process technology, enormous capital requirements, manufacturing yield expertise and decades of customer trust are extremely hard to replicate.", structure: "Oligopoly", competitors: ["Samsung Foundry", "Intel Foundry", "GlobalFoundries", "SMIC"], structureReason: "Several foundries exist, but a few dominate revenue. At the leading edge only TSMC, Samsung and Intel compete." },
    glassdoor: { ceo: "C.C. Wei", approval: 66, rating: 3.2, reviews: 2215, url: "https://www.glassdoor.com/Reviews/TSMC-Reviews-E4130.htm" },
    congress: { buys: 2, sales: 0, membersBuying: 2, membersSelling: 0, latest: "2026-10-09", signal: "Net buying" },
    news: { positive: 1, neutral: 4, negative: 0, headlines: [
      { title: "TSM Stock Trending After Nvidia Posts Strong Q3 Results", publisher: "TradingView", date: "Nov 18", tone: "Positive", reason: "Strong Nvidia results likely benefit TSMC as a key chip supplier.", row: 13 },
      { title: "TSMC Stock Slides As Taiwan Market Suffers Worst Week Since 1990", publisher: "Benzinga", date: "Nov 20", tone: "Neutral", reason: "Stock slide tied to a broader market selloff, not a business event.", row: 12 },
      { title: "TSM Opened Down by 4.21% on Nov 16", publisher: "TradingKey", date: "Nov 16", tone: "Neutral", reason: "Intraday price move quote with no business news.", row: 14 } ] },
    seed: 37, drift: 0.1, chg: 0.9, trendOdds: 61, ceoPromise: "Delivered", comp30d: [1.1, -3.1, -1.8, 0.7] },
  { ticker: "MU", name: "Micron Technology", sector: "Semiconductors · Memory", row: 5, price: 594.51, intrinsicValue: 1188.19, aggregate: 7.2, confidence: "Medium: 9 of 13 metrics have data",
    scores: { buffett: 10, graham: 8.9, scenarios: 10, news: 6, congress: 4, feedback: 8.2, moat: 6, competition: 6, flags: 6 }, demoScores: { trend: 6.5 },
    summary: "The 10-K for the fiscal year ended September 3, 2026 shows net income of 85.0 billion dollars, up from 8.5 billion. Recent filings include a September 30, 2026 earnings report and officer changes, and headlines discuss whether prices keep rising and recent trading moves. Not known: today's share price, insider buy or sell amounts, and anything about your own goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/723125/000072312526000023/0000723125-26-000023-index.htm",
    moat: { label: "Narrow", reason: "Huge capital costs, process know-how and patents deter entrants, but memory is commoditized and cyclical, which limits pricing power.", structure: "Oligopoly", competitors: ["Samsung Electronics", "SK Hynix", "CXMT", "Kioxia"], structureReason: "DRAM is dominated by three suppliers: Samsung, SK Hynix and Micron. China's CXMT is a smaller, emerging rival." },
    glassdoor: { ceo: "Sanjay Mehrotra", approval: 82, rating: 3.9, reviews: 8026, url: "https://www.glassdoor.com/Reviews/Micron-Technology-Reviews-E1648.htm" },
    congress: { buys: 5, sales: 6, membersBuying: 2, membersSelling: 2, latest: "2026-10-21", signal: "Mixed" },
    news: { positive: 1, neutral: 4, negative: 0, headlines: [
      { title: "Micron: A 40% Drop With A $150B Backlog (Rating Upgrade)", publisher: "Seeking Alpha", date: "Nov 19", tone: "Positive", reason: "Rating upgrade and a $150B backlog suggest strong business demand.", row: 21 },
      { title: "What Happens To Micron Stock If Prices Stop Rising?", publisher: "Trefis", date: "Nov 20", tone: "Neutral", reason: "Hypothetical scenario; no concrete business event.", row: 18 },
      { title: "What's Going On With Micron Technology Stock Monday?", publisher: "Benzinga", date: "Nov 16", tone: "Neutral", reason: "No specific business news.", row: 17 } ] },
    seed: 41, drift: -0.15, chg: 2.4, trendOdds: 58, ceoPromise: "Behind", comp30d: [1.1, 3.4, -2.2, 0.8] },
  { ticker: "LRCX", name: "Lam Research", sector: "Semiconductor equipment", row: 6, price: 183.27, intrinsicValue: 113.85, aggregate: 5.9, confidence: "Medium: 9 of 13 metrics have data",
    scores: { buffett: 0, graham: 8.9, scenarios: 0, news: 5, congress: 8, feedback: 9.4, moat: 9, competition: 6, flags: 7 }, demoScores: { trend: 5 },
    summary: "The latest annual report, for the fiscal year ended June 28, 2026, shows revenue of 23.2 billion and net income of 7.3 billion dollars. Recent filings cover October earnings results and a November shareholder vote, and headlines mention a 5.13% share move on November 16. Not known: today's share price, insider transaction amounts, or your own goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/707549/000070754926000037/0000707549-26-000037-index.htm",
    moat: { label: "Wide", reason: "Deep etch and deposition process know-how, co-development with chipmakers, a large installed base and service revenue create high switching costs.", structure: "Oligopoly", competitors: ["Applied Materials", "Tokyo Electron", "Hitachi High-Tech", "ASM International"], structureReason: "Plasma etch is led by Lam, Tokyo Electron and Applied Materials, with few smaller players." },
    glassdoor: { ceo: "Tim Archer", approval: 94, rating: 4.1, reviews: 2487, url: "https://www.glassdoor.com/Reviews/Lam-Research-Reviews-E1582.htm" },
    congress: { buys: 2, sales: 0, membersBuying: 1, membersSelling: 0, latest: "2026-11-05", signal: "Net buying" },
    news: { positive: 0, neutral: 5, negative: 0, headlines: [
      { title: "Lam Research stock outperforms competitors despite losses on the day", publisher: "MarketWatch", date: "Nov 20", tone: "Neutral", reason: "Mixed signals, no business impact.", row: 23 },
      { title: "Lam Research Moved Down by 5.13% on Nov 16", publisher: "TradingKey", date: "Nov 16", tone: "Neutral", reason: "Daily share price move report.", row: 24 },
      { title: "Billionaires Split on Lam Research", publisher: "24/7 Wall St.", date: "Nov 18", tone: "Neutral", reason: "Opinion piece, no clear business impact.", row: 26 } ] },
    seed: 53, drift: 0.09, chg: -1.2, trendOdds: 49, ceoPromise: "Delivered", comp30d: [2.1, -0.6, 1.3, 3.0] },
  { ticker: "ASML", name: "ASML Holding", sector: "Semiconductor equipment · Lithography", row: 7, price: 1266.22, intrinsicValue: 544.36, aggregate: 5.2, confidence: "Medium: 7 of 13 metrics have data",
    scores: { buffett: 0, graham: 8.9, scenarios: 0, news: 6, congress: null, feedback: 6.8, moat: 9, competition: 6, flags: null }, demoScores: { trend: 5.5, flags: 7 },
    summary: "The 2025 annual report shows revenue of 32.7 billion euros and net income of 9.6 billion euros, up from 7.6 billion. Recent 8-K filings date from April to October 2026; headlines cover investor interest, an analyst rating and a 3.02% share drop on November 17. Not known: today's share price, insider transaction amounts, or what the filings contain.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/937966/000162828026011378/0001628280-26-011378-index.htm",
    moat: { label: "Wide", reason: "Sole EUV supplier; decades of R&D, the Zeiss optics partnership, a complex supply chain and installed-base service make replication extremely difficult.", structure: "Oligopoly", competitors: ["Nikon", "Canon"], structureReason: "Three lithography suppliers overall; ASML holds roughly 90% share and a monopoly in EUV systems." },
    glassdoor: { ceo: "Christophe Fouquet", approval: 68, rating: 4.0, reviews: 3170, url: "https://www.glassdoor.com/Reviews/ASML-Reviews-E5781.htm" },
    congress: { buys: 0, sales: 0, membersBuying: 0, membersSelling: 0, latest: "none", signal: "No trades" },
    news: { positive: 1, neutral: 4, negative: 0, headlines: [
      { title: "ASML Holding NV: New Buy Recommendation for This Technology Giant", publisher: "The Globe and Mail", date: "Nov 20", tone: "Positive", reason: "New buy recommendation is an analyst upgrade-type signal.", row: 29 },
      { title: "ASML reports transactions under its current share buyback program", publisher: "Yahoo Finance", date: "Nov 16", tone: "Neutral", reason: "Routine buyback disclosure.", row: 31 },
      { title: "ASML Moved Down by 3.02% on Nov 17", publisher: "TradingKey", date: "Nov 17", tone: "Neutral", reason: "Price move without stated business cause.", row: 30 } ] },
    seed: 67, drift: 0.07, chg: -0.4, trendOdds: 55, ceoPromise: "Delivered", comp30d: [-0.9, 1.7] },
  { ticker: "AVGO", name: "Broadcom", sector: "Semiconductors · Networking and custom AI", row: 8, price: 304.41, intrinsicValue: 136.67, aggregate: 5.2, confidence: "Medium: 9 of 13 metrics have data",
    scores: { buffett: 0, graham: 8.8, scenarios: 0, news: 4, congress: 7, feedback: 6.4, moat: 9, competition: 6, flags: 6 }, demoScores: { trend: 4 },
    summary: "Broadcom's latest annual report (year ended November 2, 2025) shows revenue of 63.9 billion dollars and net income of 23.1 billion dollars. Recent filings show a September 2026 earnings report and an October 2026 financial obligation, while headlines cover a selloff and reports Google is cutting AI chip shipments. Not known: today's share price, insider trading amounts, or your personal goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/1730168/000173016825000121/0001730168-25-000121-index.htm",
    moat: { label: "Wide", reason: "Deep chip IP, custom ASIC design expertise, high switching costs for hyperscaler customers and VMware enterprise lock-in.", structure: "Oligopoly", competitors: ["Marvell", "Nvidia", "Cisco", "MediaTek"], structureReason: "Networking switch chips and custom AI ASICs are dominated by a handful of capable suppliers." },
    glassdoor: { ceo: "Hock E. Tan", approval: 64, rating: 3.3, reviews: 6452, url: "https://www.glassdoor.com/Reviews/Broadcom-Reviews-E6926.htm" },
    congress: { buys: 3, sales: 2, membersBuying: 1, membersSelling: 2, latest: "2026-11-05", signal: "Net buying" },
    news: { positive: 0, neutral: 4, negative: 1, headlines: [
      { title: "Broadcom Stock Falls on Report Google is Cutting AI Chip Shipments", publisher: "Barron's", date: "Nov 20", tone: "Negative", reason: "Report of Google cutting AI chip shipments suggests lost business.", row: 34 },
      { title: "Broadcom Stock Plunges Over 11% As Semiconductor Selloff Hits Tech Giants", publisher: "Benzinga", date: "Nov 20", tone: "Neutral", reason: "Drop attributed to a sector-wide selloff.", row: 33 },
      { title: "Broadcom stock outperforms competitors despite losses on the day", publisher: "MarketWatch", date: "Nov 20", tone: "Neutral", reason: "Mixed signal.", row: 35 } ] },
    seed: 71, drift: 0.11, chg: -2.8, trendOdds: 46, ceoPromise: "Over achieved", comp30d: [2.4, 6.1, 0.3, -1.1] },
  { ticker: "INTC", name: "Intel", sector: "Semiconductors · CPUs and foundry", row: 9, price: 51.28, intrinsicValue: null, ivNote: "Not applicable: owner earnings are negative.", aggregate: 6.2, confidence: "Medium: 6 of 13 metrics have data",
    scores: { buffett: null, graham: 6.7, scenarios: null, news: 3, congress: null, feedback: 7.5, moat: 6, competition: 8, flags: 6 }, demoScores: { trend: 3.5 },
    summary: "The annual report for the year ended December 27, 2025 shows revenue of 52.9 billion dollars and a net loss of 267.0 million dollars. Recent filings include July and October 2026 earnings reports, while headlines cover a shareholder lawsuit after a 29% stock plunge. Not known: today's share price, insider trading amounts, or your own goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/50863/000005086326000011/0000050863-26-000011-index.htm", gap: "Owner earnings are zero or negative, so the Buffett method does not apply.",
    moat: { label: "Narrow", reason: "x86 ecosystem, scale and customer relationships help, but manufacturing lag, AMD share gains and Arm alternatives have weakened its advantage.", structure: "Duopoly", competitors: ["AMD", "Qualcomm", "Nvidia", "TSMC"], structureReason: "Intel and AMD dominate x86 PC and server CPUs; Arm-based chips are a growing threat." },
    glassdoor: { ceo: "Lip-Bu Tan", approval: 75, rating: 3.9, reviews: 32372, url: "https://www.glassdoor.com/Reviews/Intel-Corporation-Reviews-E1519.htm" },
    congress: { buys: 0, sales: 0, membersBuying: 0, membersSelling: 0, latest: "none", signal: "No trades" },
    news: { positive: 0, neutral: 3, negative: 2, headlines: [
      { title: "Intel sued by shareholders following 29% stock plunge", publisher: "Reuters", date: "Nov 16", tone: "Negative", reason: "Shareholder lawsuit signals legal and reputational risk.", row: 37 },
      { title: "Why Nvidia Just Slashed Its Stake in Intel Stock by 25%", publisher: "Barchart", date: "Nov 18", tone: "Negative", reason: "May signal reduced strategic partner confidence.", row: 41 },
      { title: "Intel Faces a High-Stakes Turnaround as Server Demand Improves", publisher: "Yahoo Finance", date: "Nov 20", tone: "Neutral", reason: "Mixed signals.", row: 38 } ] },
    seed: 83, drift: -0.2, chg: -1.9, trendOdds: 38, ceoPromise: "Behind", comp30d: [-3.1, 1.4, 6.1, 0.7] },
  { ticker: "QCOM", name: "Qualcomm", sector: "Semiconductors · Mobile and modems", row: 10, price: 149.94, intrinsicValue: 253.38, aggregate: 6.6, confidence: "Medium: 8 of 13 metrics have data",
    scores: { buffett: 9.1, graham: 6.3, scenarios: 10, news: 4, congress: null, feedback: 6.6, moat: 6, competition: 6, flags: 5 }, demoScores: { trend: 5 },
    summary: "The 2026 annual report (10-K, year ended September 27) shows net income of 13.6 billion USD, up from 5.5 billion. Recent filings include November 4 earnings results, a November 13 material agreement and a September 8 unregistered equity sale, and headlines cite a 3.02% drop on November 18. Not known: today's share price, insider trade amounts, or your personal goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/804328/000080432826000128/0000804328-26-000128-index.htm",
    moat: { label: "Narrow", reason: "Large wireless patent portfolio and modem expertise create real advantage, but Apple's in-house modems and MediaTek pressure chip share.", structure: "Oligopoly", competitors: ["MediaTek", "Apple", "Samsung Electronics", "UNISOC"], structureReason: "Smartphone processor and modem supply is concentrated among a few vendors." },
    glassdoor: { ceo: "Cristiano Amon", approval: 66, rating: 3.8, reviews: 11213, url: "https://www.glassdoor.com/Reviews/Qualcomm-Reviews-E640.htm" },
    congress: { buys: 0, sales: 0, membersBuying: 0, membersSelling: 0, latest: "none", signal: "No trades" },
    news: { positive: 0, neutral: 4, negative: 1, headlines: [
      { title: "Baird lowers Qualcomm stock price target on AI chip export concerns", publisher: "Investing.com", date: "Nov 18", tone: "Negative", reason: "Analyst lowers price target.", row: 46 },
      { title: "Qualcomm stock outperforms competitors on strong trading day", publisher: "MarketWatch", date: "Nov 19", tone: "Neutral", reason: "Price performance report.", row: 43 },
      { title: "Qualcomm: A Quality Dividend Stock for Income Investors", publisher: "ChartMill", date: "Nov 18", tone: "Neutral", reason: "Generic profile page.", row: 42 } ] },
    seed: 97, drift: -0.05, chg: 0.6, trendOdds: 53, ceoPromise: "Delivered", comp30d: [1.9, 0.4, 1.1, -0.5] },
  { ticker: "AMAT", name: "Applied Materials", sector: "Semiconductor equipment", row: 11, price: 302.63, intrinsicValue: 136.37, aggregate: 5.5, confidence: "Medium: 9 of 13 metrics have data",
    scores: { buffett: 0, graham: 6.7, scenarios: 0, news: 7, congress: 6, feedback: 8.4, moat: 9, competition: 6, flags: 6 }, demoScores: { trend: 6 },
    summary: "Applied Materials' fiscal 2025 annual report shows revenue of 28.4 billion dollars and net income of 7.0 billion dollars. Recent filings include an earnings results release dated 2026-11-12, and headlines mention a 35% gain this year and a recent drop of over 5%. Not known: today's share price, insider buy or sell amounts, or your own goals.",
    secUrl: "https://www.sec.gov/Archives/edgar/data/6951/000162828025056742/0001628280-25-056742-index.htm",
    moat: { label: "Wide", reason: "Decades of process know-how, a broad patented tool portfolio, deep co-development with chipmakers and a large installed service base create high switching costs.", structure: "Oligopoly", competitors: ["Lam Research", "Tokyo Electron", "KLA", "ASM International"], structureReason: "Deposition and etch equipment are dominated by a few suppliers." },
    glassdoor: { ceo: "Gary Dickerson", approval: 84, rating: 3.9, reviews: 4697, url: "https://www.glassdoor.com/Reviews/Applied-Materials-Reviews-E1139.htm" },
    congress: { buys: 1, sales: 1, membersBuying: 1, membersSelling: 1, latest: "2026-10-26", signal: "Mixed" },
    news: { positive: 2, neutral: 3, negative: 0, headlines: [
      { title: "Applied Materials Reports Another Double Beat in Q4", publisher: "Barchart", date: "Nov 17", tone: "Positive", reason: "A double beat in Q4 indicates strong performance.", row: 51 },
      { title: "Earnings Beat Might Change The Case For Investing In Applied Materials", publisher: "Yahoo Finance", date: "Nov 19", tone: "Positive", reason: "Reports an earnings beat.", row: 50 },
      { title: "Why Is Applied Materials Stock Down Over 5%?", publisher: "Trefis", date: "Nov 17", tone: "Neutral", reason: "Stock drop without a stated business cause.", row: 49 } ] },
    seed: 101, drift: 0.1, chg: 1.1, trendOdds: 59, ceoPromise: "Over achieved", comp30d: [-1.2, -0.6, 2.2, 3.0] },
  { ticker: "SPCX", name: "SpaceX", sector: "Space launch · Satellite broadband", row: 12, price: 127.79, intrinsicValue: null, ivNote: "Not applicable: newly public, no annual report filed yet.", aggregate: 6.1, confidence: "Medium: 6 of 13 metrics have data",
    scores: { buffett: null, graham: null, scenarios: null, news: 5, congress: 4, feedback: 7.8, moat: 9, competition: 6, flags: 5 }, demoScores: { trend: 5.5 },
    summary: "No annual report is in SEC data yet, because the company is newly public and has not filed its first full-year report. Recent 8-K filings cover earnings results in October 2026 and an officer change on 2026-11-06, while headlines discuss a recent stock drop. Not known: today's share price, insider buy or sell amounts, or your own goals.",
    gap: "No annual report in SEC data yet. Newly public companies have no full-year filing until their first 10-K.",
    moat: { label: "Wide", reason: "Reusable rockets, high launch cadence, cost lead and Starlink's large constellation are very hard to copy.", structure: "Oligopoly", competitors: ["Amazon (Kuiper)", "Eutelsat OneWeb", "Viasat", "United Launch Alliance"], structureReason: "Only a few satellite operators compete, and SpaceX leads launch too." },
    glassdoor: { ceo: "Elon Musk", approval: 78, rating: 3.8, reviews: 2832, url: "https://www.glassdoor.com/Reviews/SpaceX-Reviews-E40371.htm" },
    congress: { buys: 0, sales: 1, membersBuying: 0, membersSelling: 1, latest: "2026-09-24", signal: "Mixed" },
    news: { positive: 0, neutral: 5, negative: 0, headlines: [
      { title: "Why SpaceX Stock Is Down Today", publisher: "Yahoo Finance", date: "Nov 19", tone: "Neutral", reason: "Price-movement headline with no stated business cause.", row: 52 },
      { title: "SpaceX IPO: Valuation, Timeline and Investment Options", publisher: "SmartAsset", date: "Nov 17", tone: "Neutral", reason: "IPO profile, no clear business impact.", row: 54 },
      { title: "Why is Space Exploration Technologies stock climbing today?", publisher: "Investing.com", date: "Nov 18", tone: "Neutral", reason: "Price-movement headline.", row: 56 } ] },
    seed: 113, drift: 0.05, chg: -3.4, trendOdds: 50, ceoPromise: "Behind", comp30d: [1.8, -2.4, -0.9, 0.5] },
  { ticker: "ANT", name: "Anthropic", sector: "AI · Frontier models", row: 13, price: 88.91, intrinsicValue: null, ivNote: "Not applicable: newly public, no annual report filed yet.", aggregate: 5.3, confidence: "Low: 3 of 13 metrics have data",
    scores: { buffett: null, graham: null, scenarios: null, news: 4, congress: null, feedback: null, moat: 6, competition: 6, flags: null }, demoScores: { trend: 5, flags: 6, feedback: 8 },
    summary: "No annual report is in SEC data yet, because newly public companies file their first 10-K later. No recent 8-K filings found, but headlines say Anthropic priced its IPO at $83 per share, valuing it at $1.5 trillion, and shares slumped, nearly erasing the IPO pop. Not known: today's share price, insider transactions, and anything about your goals.",
    gap: "No annual report in SEC data yet. Newly public companies have no full-year filing until their first 10-K.",
    moat: { label: "Narrow", reason: "Frontier training needs scarce talent and capital, but customers switch models easily. (The research model is built by Anthropic, so possible bias.)", structure: "Oligopoly", competitors: ["OpenAI", "Google (Gemini)", "Meta", "xAI"], structureReason: "A few labs lead frontier models; open-weight rivals add pressure." },
    glassdoor: { ceo: "Not shown", approval: null, rating: 4.2, reviews: 43, url: "https://www.glassdoor.com/Reviews/Anthropic-Reviews-E8109027.htm", note: "No CEO approval figure on the page. Only 43 reviews." },
    congress: { buys: 0, sales: 0, membersBuying: 0, membersSelling: 0, latest: "none", signal: "No trades" },
    news: { positive: 0, neutral: 3, negative: 1, headlines: [
      { title: "Anthropic prices its IPO at $83 per share, valuing the AI giant at $1.5 trillion", publisher: "PBS", date: "Nov 19", tone: "Neutral", reason: "IPO pricing and valuation.", row: 57 },
      { title: "Anthropic Share Slump Nearly Erases IPO Pop as AI Trade Unravels", publisher: "Bloomberg", date: "Nov 20", tone: "Negative", reason: "Slump erasing IPO gains signals investor disappointment.", row: 58 },
      { title: "Anthropic's blockbuster debut tests Wall Street's faith in AI boom", publisher: "Reuters", date: "Nov 19", tone: "Neutral", reason: "Mixed signals.", row: 60 } ] },
    seed: 127, drift: -0.03, chg: -1.5, trendOdds: 47, ceoPromise: "Delivered", comp30d: [2.0, 0.6, -1.4, 3.1] },
];

export const SAMPLE_STOCKS: Stock[] = RAW.map(({ seed, drift, chg, ...s }) => ({ ...s, change1d: chg, spark: s.price ? demoSpark(seed, s.price, drift) : [] }));

// Row offsets on the per-company tabs (same order as Results).
const idx = (s: Stock) => s.row - 2;
export const rowOn = { buffett: (s: Stock) => idx(s) + 8, moat: (s: Stock) => idx(s) + 2, feedback: (s: Stock) => idx(s) + 2, congress: (s: Stock) => idx(s) + 3 };

export const scoreOf = (s: Stock, k: SectionKey): { v: number | null; demo: boolean } => {
  const real = s.scores[k];
  if (typeof real === "number") return { v: real, demo: false };
  const d = s.demoScores?.[k];
  return typeof d === "number" ? { v: d, demo: true } : { v: null, demo: false };
};

export function aggregate(s: Stock): number | null {
  if (typeof s.aggregate === "number") return s.aggregate;
  const vals = SECTIONS.map((x) => scoreOf(s, x.key).v).filter((v): v is number => typeof v === "number");
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
}

export function grade(score: number | null): { label: string; tone: "good" | "mid" | "bad" | "none" } {
  if (score === null) return { label: "Pending", tone: "none" };
  if (score >= 7) return { label: "Strong", tone: "good" };
  if (score >= 5) return { label: "Neutral", tone: "mid" };
  return { label: "Weak", tone: "bad" };
}

export const usd = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
