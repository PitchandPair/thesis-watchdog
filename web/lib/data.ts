// Sample data for the demo. Swap for the Google Sheet feed (end-results tab) when ready.

export type SectionKey = "buffett" | "moat" | "competition" | "congress" | "feedback" | "news" | "trend";

export const SECTIONS: { key: SectionKey; label: string; weight: number; desc: string }[] = [
  { key: "buffett", label: "Buffett Value", weight: 25, desc: "Intrinsic value vs current price (SEC EDGAR via edgartools)" },
  { key: "moat", label: "Moat", weight: 15, desc: "Durability of competitive advantage (one-time research)" },
  { key: "competition", label: "Competition", weight: 15, desc: "Market structure and how many real rivals exist" },
  { key: "congress", label: "Congress Trades", weight: 10, desc: "Net buying vs selling in congressional disclosures" },
  { key: "feedback", label: "Company Feedback", weight: 15, desc: "Glassdoor, employee surveys, CEO approval" },
  { key: "news", label: "News Sentiment", weight: 10, desc: "Tone of the last 30 days of headlines" },
  { key: "trend", label: "Trend Odds", weight: 10, desc: "Time Machine: 10,000 simulated runs, fixed seed" },
];

export type Trade = { member: string; type: "Buy" | "Sell"; amount: string; date: string };
export type Competitor = { name: string; ticker: string; change30d: number; share?: string };
export type Headline = { title: string; source: string; date: string; tone: "Positive" | "Neutral" | "Negative" };
export type Glassdoor = {
  ceo: string; rating: number; ceoApproval: number; recommend: number; outlook: number; reviews: number;
  surveyResponses: number; pros: string[]; cons: string[]; note?: string;
};
export type News = { score: number; positive: number; neutral: number; negative: number; headlines: Headline[] };

export type Stock = {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change1d: number | null;
  intrinsicValue: number | null;
  scores: Partial<Record<SectionKey, number>>; // 0-100
  marketStructure?: string;
  moatNote?: string;
  competitors?: Competitor[];
  trades?: Trade[];
  structure?: "Monopoly" | "Near-monopoly" | "Duopoly" | "Triopoly" | "Oligopoly" | "Crowded";
  glassdoor?: Glassdoor;
  news?: News;
  trend?: { odds: number; target: string };
  ceoPromise?: "Delivered" | "Behind" | "Over achieved";
  weirdFact?: string;
  spark?: number[];
  pending?: boolean;
};

export const SAMPLE_STOCKS: Stock[] = [
  {
    ticker: "NVDA", structure: "Near-monopoly",
    glassdoor: { ceo: "Jensen Huang", rating: 4.4, ceoApproval: 98, recommend: 90, outlook: 91, reviews: 5506, surveyResponses: 38,
      pros: ["CEO has vision", "High pay and stock growth", "Meaningful work"], cons: ["Can be chaotic", "High pressure"], note: "No. 1 on Glassdoor Best CEOs 2026" },
    news: { score: 78, positive: 24, neutral: 9, negative: 3, headlines: [
      { title: "Data center orders lift quarterly outlook", source: "Sample Wire", date: "Nov 19", tone: "Positive" },
      { title: "New export rules add uncertainty for China sales", source: "Sample Daily", date: "Nov 14", tone: "Negative" },
      { title: "Cloud providers expand GPU capacity plans", source: "Sample Markets", date: "Nov 10", tone: "Positive" } ] },
    name: "NVIDIA", sector: "Semiconductors · GPUs",
    price: 182.4, change1d: 1.8, intrinsicValue: 164.0,
    scores: { buffett: 52, moat: 94, competition: 88, congress: 71, feedback: 92, news: 78, trend: 63 },
    marketStructure: "Near-monopoly in AI accelerators",
    moatNote: "CUDA software ecosystem and developer lock-in; full-stack data center platform.",
    competitors: [{ name: "AMD", ticker: "AMD", change30d: 4.2 }, { name: "Broadcom", ticker: "AVGO", change30d: 2.9 }, { name: "Intel", ticker: "INTC", change30d: -3.1 }],
    trades: [{ member: "Rep. A", type: "Buy", amount: "$250K–$500K", date: "Oct 28" }, { member: "Sen. B", type: "Buy", amount: "$15K–$50K", date: "Oct 12" }, { member: "Rep. C", type: "Sell", amount: "$1K–$15K", date: "Sep 30" }],
    trend: { odds: 63, target: "+10% in 90 days" },
    ceoPromise: "Over achieved",
    weirdFact: "Sample fact: NVIDIA started out making graphics chips for video games.",
    spark: [140, 148, 151, 146, 158, 166, 171, 169, 176, 182],
  },
  {
    ticker: "AMD", structure: "Duopoly",
    glassdoor: { ceo: "Lisa Su", rating: 4.1, ceoApproval: 96, recommend: 83, outlook: 85, reviews: 4917, surveyResponses: 21,
      pros: ["People are great and helpful", "Good benefits"], cons: ["Frequent layoffs", "Pay trails NVIDIA and Intel"] },
    news: { score: 61, positive: 15, neutral: 12, negative: 6, headlines: [
      { title: "New AI accelerator wins a large cloud customer", source: "Sample Wire", date: "Nov 18", tone: "Positive" },
      { title: "PC chip demand stays flat into year end", source: "Sample Daily", date: "Nov 12", tone: "Neutral" },
      { title: "Software gap vs rival still cited by analysts", source: "Sample Markets", date: "Nov 6", tone: "Negative" } ] },
    name: "Advanced Micro Devices", sector: "Semiconductors · CPUs/GPUs",
    price: 236.1, change1d: -0.6, intrinsicValue: 248.5,
    scores: { buffett: 68, moat: 72, competition: 64, congress: 58, feedback: 84, news: 61, trend: 55 },
    marketStructure: "Duopoly in x86 CPUs, challenger in AI GPUs",
    moatNote: "Chiplet design lead and x86 license; software ecosystem still catching up.",
    competitors: [{ name: "NVIDIA", ticker: "NVDA", change30d: 6.1 }, { name: "Intel", ticker: "INTC", change30d: -3.1 }, { name: "Qualcomm", ticker: "QCOM", change30d: 1.4 }],
    trades: [{ member: "Rep. D", type: "Buy", amount: "$15K–$50K", date: "Nov 3" }, { member: "Rep. E", type: "Sell", amount: "$50K–$100K", date: "Oct 19" }],
    trend: { odds: 55, target: "+10% in 90 days" },
    ceoPromise: "Delivered",
    spark: [210, 218, 225, 231, 228, 240, 244, 238, 239, 236],
  },
  {
    ticker: "TSM", structure: "Near-monopoly",
    glassdoor: { ceo: "C.C. Wei", rating: 3.3, ceoApproval: 74, recommend: 47, outlook: 71, reviews: 2146, surveyResponses: 12,
      pros: ["Strong salary", "World-leading process tech"], cons: ["Very long working hours", "High pressure"] },
    news: { score: 70, positive: 18, neutral: 10, negative: 4, headlines: [
      { title: "Arizona fab ramps ahead of schedule", source: "Sample Wire", date: "Nov 17", tone: "Positive" },
      { title: "Regional tension risk flagged in filings", source: "Sample Daily", date: "Nov 11", tone: "Negative" },
      { title: "Monthly revenue tops estimates", source: "Sample Markets", date: "Nov 8", tone: "Positive" } ] },
    name: "Taiwan Semiconductor", sector: "Semiconductors · Foundry",
    price: 291.7, change1d: 0.9, intrinsicValue: 318.2,
    scores: { buffett: 74, moat: 92, competition: 90, congress: 49, feedback: 58, news: 70, trend: 60 },
    marketStructure: "Near-monopoly in leading-edge foundry",
    moatNote: "Process technology lead and scale; customers can't easily switch fabs.",
    competitors: [{ name: "Samsung", ticker: "SSNLF", change30d: 1.1 }, { name: "Intel Foundry", ticker: "INTC", change30d: -3.1 }, { name: "GlobalFoundries", ticker: "GFS", change30d: -1.8 }],
    trades: [{ member: "Sen. F", type: "Buy", amount: "$1K–$15K", date: "Oct 22" }],
    trend: { odds: 60, target: "+10% in 90 days" },
    ceoPromise: "Delivered",
    spark: [262, 270, 268, 275, 281, 279, 286, 284, 289, 292],
  },
  {
    ticker: "MU", structure: "Triopoly",
    glassdoor: { ceo: "Sanjay Mehrotra", rating: 3.9, ceoApproval: 81, recommend: 77, outlook: 75, reviews: 7846, surveyResponses: 9,
      pros: ["Strong company growth", "Rewarding RSU packages"], cons: ["Teams work in silos", "Strict internal security rules"] },
    news: { score: 66, positive: 14, neutral: 11, negative: 5, headlines: [
      { title: "HBM supply sold out through next year", source: "Sample Wire", date: "Nov 16", tone: "Positive" },
      { title: "Memory prices seen softening in consumer PCs", source: "Sample Daily", date: "Nov 9", tone: "Negative" },
      { title: "New Idaho fab on track", source: "Sample Markets", date: "Nov 4", tone: "Neutral" } ] },
    name: "Micron Technology", sector: "Semiconductors · Memory",
    price: 128.3, change1d: 2.4, intrinsicValue: 141.9,
    scores: { buffett: 71, moat: 58, competition: 61, congress: 62, feedback: 74, news: 66, trend: 58 },
    marketStructure: "Triopoly in DRAM",
    moatNote: "One of three DRAM makers at scale; HBM demand helps, but memory is cyclical.",
    competitors: [{ name: "Samsung", ticker: "SSNLF", change30d: 1.1 }, { name: "Western Digital", ticker: "WDC", change30d: 3.6 }, { name: "Sandisk", ticker: "SNDK", change30d: 5.2 }],
    trades: [{ member: "Rep. G", type: "Buy", amount: "$50K–$100K", date: "Nov 6" }, { member: "Rep. H", type: "Buy", amount: "$15K–$50K", date: "Oct 15" }],
    trend: { odds: 58, target: "+10% in 90 days" },
    ceoPromise: "Behind",
    spark: [104, 109, 112, 110, 116, 119, 121, 124, 125, 128],
  },
];

export function aggregate(s: Stock): number | null {
  let total = 0, w = 0;
  for (const sec of SECTIONS) {
    const v = s.scores[sec.key];
    if (typeof v === "number") { total += v * sec.weight; w += sec.weight; }
  }
  return w ? Math.round(total / w) : null;
}

export function grade(score: number | null): { label: string; tone: "good" | "mid" | "bad" | "none" } {
  if (score === null) return { label: "Pending", tone: "none" };
  if (score >= 75) return { label: "Strong", tone: "good" };
  if (score >= 60) return { label: "Neutral", tone: "mid" };
  return { label: "Weak", tone: "bad" };
}

export const usd = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
