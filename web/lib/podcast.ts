import { Stock, usd } from "./data";

export const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", style: "Calm, clear" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", style: "Deep, steady" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", style: "Warm, upbeat" },
];

// Short Sift briefing. Facts from the Sheet only. Never a recommendation. Skips anything missing.
export function buildScript(stocks: Stock[]): string {
  const live = stocks.filter((s) => !s.pending);
  const lines: string[] = [`This is Sift. Here's your quick read on ${live.map((s) => s.name).join(", ")}.`];
  for (const s of live) {
    const parts: string[] = [`${s.name}.`];
    if (s.price) parts.push(`Trading at ${usd(s.price)}.`);
    if (s.price && s.intrinsicValue) {
      const gap = ((s.price - s.intrinsicValue) / s.intrinsicValue) * 100;
      parts.push(gap >= 0
        ? `That's ${gap.toFixed(0)} percent above its Buffett value of ${usd(s.intrinsicValue)}.`
        : `That's ${Math.abs(gap).toFixed(0)} percent below its Buffett value of ${usd(s.intrinsicValue)}.`);
    }
    if (s.congress) parts.push(s.congress.buys + s.congress.sales === 0 ? "No Congress trades in the last three months." : `Congress disclosed ${s.congress.buys} buys and ${s.congress.sales} sales in the last three months.`);
    if (s.moat) parts.push(`Moat: ${s.moat.label.toLowerCase()}. Market: ${s.moat.structure.toLowerCase()}, with ${s.moat.competitors.slice(0, 3).join(", ")} as the main rivals.`);
    lines.push(parts.join(" "));
  }
  lines.push("That's the Sift. This is information, not investment advice.");
  return lines.join("\n\n");
}
