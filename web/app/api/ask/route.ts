import { NextRequest } from "next/server";

// Proxies to the Sift analyst, which answers from SEC data and traces every exchange to PRISM.
const ANALYST = process.env.ANALYST_URL ?? "https://stock-scorecard-nine.vercel.app/api/chat";

export async function POST(req: NextRequest) {
  const { question } = await req.json().catch(() => ({}));
  if (!question || typeof question !== "string") return Response.json({ error: "Ask a question." }, { status: 400 });
  try {
    const r = await fetch(ANALYST, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": "sift-web" },
      body: JSON.stringify({ question: question.slice(0, 1000) }),
      signal: AbortSignal.timeout(55000),
    });
    const j = await r.json().catch(() => ({}));
    return Response.json(j, { status: r.status });
  } catch {
    return Response.json({ error: "The analyst didn't respond. Try again." }, { status: 502 });
  }
}
