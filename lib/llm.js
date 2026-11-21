// One place for every AI call: goes through the Nicrron API and is traced to PRISM.
const NICRRON_URL = (process.env.NICRRON_BASE_URL || "https://api.nicrron.ai/v1") + "/chat/completions";
const PRISM_HOST = process.env.PRISMTRACE_HOST || "https://api.prism.blockconvey.com";

export const hasModelKey = () => Boolean(process.env.NICRRON_API_KEY);

export async function trace(input, output, model, latencyMs, sessionId) {
  if (!process.env.PRISMTRACE_API_KEY || !process.env.PRISMTRACE_PROJECT_ID) return "skipped (no PRISM key)";
  try {
    const r = await fetch(PRISM_HOST + "/api/traces", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": process.env.PRISMTRACE_API_KEY },
      body: JSON.stringify({
        project_id: process.env.PRISMTRACE_PROJECT_ID,
        model,
        input_messages: [{ role: "user", content: input }],
        output_message: output,
        latency_ms: latencyMs,
        session_id: sessionId,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok ? "sent" : `failed (${r.status})`;
  } catch (err) {
    return `failed (${err.message})`;
  }
}

// Returns { text, model, prism }. Throws with a plain message if the model call fails.
export async function ask({ system, user, model, sessionId = "stock-scorecard", traceInput }) {
  const started = Date.now();
  const r = await fetch(NICRRON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NICRRON_API_KEY}` },
    body: JSON.stringify({
      model: model || process.env.NICRRON_MODEL || "nicrron/auto",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || `Nicrron returned ${r.status}`);
  const text = json.choices?.[0]?.message?.content || "";
  const usedModel = json.model || model || "nicrron/auto";
  const prism = await trace(traceInput || user, text, usedModel, Date.now() - started, sessionId);
  return { text, model: usedModel, prism };
}
