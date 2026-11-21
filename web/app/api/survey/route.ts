import { NextRequest } from "next/server";

// Proxies to the simulated employee survey on the Sift backend. Nothing real is sent or paid.
const SURVEY = process.env.SURVEY_URL ?? "https://stock-scorecard-nine.vercel.app/api/survey";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ticker = (p.get("ticker") || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
  if (!ticker) return Response.json({ error: "Pick a company." }, { status: 400 });
  const count = Math.min(200, Math.max(1, Number(p.get("count")) || 20));
  const payment = Math.min(500, Math.max(0, Number(p.get("payment")) || 0));
  const qs = new URLSearchParams({ ticker, count: String(count), payment: String(payment) });
  const company = p.get("company");
  if (company) qs.set("company", company.slice(0, 80));
  try {
    const r = await fetch(`${SURVEY}?${qs}`, { signal: AbortSignal.timeout(55000) });
    const j = await r.json().catch(() => ({ error: "The survey service returned something unreadable." }));
    return Response.json(j, { status: r.status });
  } catch {
    return Response.json({ error: "The survey service didn't respond. Try again." }, { status: 502 });
  }
}
