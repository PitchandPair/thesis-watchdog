import { Stock, usd } from "./data";

export const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", style: "Calm, clear" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", style: "Deep, steady" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", style: "Warm, upbeat" },
];

// Short, Best One Yet-style recap. Facts only. Never a recommendation.
export function buildScript(stocks: Stock[]): string {
  const live = stocks.filter((s) => !s.pending);
  const lines: string[] = [];
  lines.push(`This is Sift. Here's your quick read on ${live.map((s) => s.ticker).join(", ")}.`);
  for (const s of live) {
    const gap = s.price && s.intrinsicValue ? ((s.intrinsicValue - s.price) / s.price) * 100 : null;
    const valueLine = gap == null ? "" :
      gap >= 0 ? `That's ${gap.toFixed(0)} percent below its Buffett value of ${usd(s.intrinsicValue)}.`
               : `That's ${Math.abs(gap).toFixed(0)} percent above its Buffett value of ${usd(s.intrinsicValue)}.`;
    const buys = s.trades?.filter((t) => t.type === "Buy").length ?? 0;
    const sells = s.trades?.filter((t) => t.type === "Sell").length ?? 0;
    const comps = (s.competitors ?? []).map((c) => `${c.name} ${c.change30d >= 0 ? "up" : "down"} ${Math.abs(c.change30d)} percent`).join(", ");
    lines.push(
      `${s.name}. Trading at ${usd(s.price)}. ${valueLine} ` +
      `Congress logged ${buys} buy${buys === 1 ? "" : "s"} and ${sells} sell${sells === 1 ? "" : "s"} recently. ` +
      `Moat score: ${s.scores.moat ?? "pending"} out of 100. ${s.marketStructure ?? ""}. ` +
      (s.news ? `News tone over 30 days: ${s.news.positive} positive, ${s.news.negative} negative headlines. ` : "") +
      (comps ? `Over 30 days, competitors moved: ${comps}.` : "")
    );
  }
  const fact = live.find((s) => s.weirdFact);
  if (fact) lines.push(`Weird stat of the day: ${fact.weirdFact}`);
  lines.push("That's the Sift. This is information, not investment advice.");
  return lines.join("\n\n");
}
