import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return Response.json({ error: "Add ELEVENLABS_API_KEY in Vercel env vars to generate audio." }, { status: 501 });
  }
  const { script, voiceId } = await req.json();
  if (!script || !voiceId) return Response.json({ error: "Missing script or voice." }, { status: 400 });

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: String(script).slice(0, 5000), model_id: process.env.ELEVENLABS_MODEL ?? "eleven_turbo_v2_5" }),
  });
  if (!r.ok) return Response.json({ error: `ElevenLabs error ${r.status}` }, { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg" } });
}
