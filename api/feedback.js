// Company Feedback helper. Two steps because a collection job takes a minute or more:
//   /api/feedback?action=start&names=NVIDIA,Intel      -> starts a job, returns its id
//   /api/feedback?action=get&snapshot=ID               -> CSV rows once the job is done
// Never prints the key.
import { hasBrightKey, startJob, readJob, toRow } from "../lib/glassdoor.js";

const cell = (x) => {
  const s = x === null || x === undefined ? "" : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async function handler(req, res) {
  const q = req.query || {};
  if (!hasBrightKey()) {
    res.status(503).json({ status: "no data", data_gap: "BRIGHTDATA_API_KEY is not set on the server yet." });
    return;
  }
  try {
    if (q.action === "start") {
      const mode = String(q.mode || "keyword");
      const list = String(q.names || q.urls || "").split(mode === "url" ? "|" : ",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
      if (!list.length) return res.status(400).json({ error: "Pass names=A,B or mode=url&urls=U1|U2" });
      const out = await startJob(list, mode, String(q.field || "keyword"));
      return res.status(200).json({ http: out.status, reply: out.json || out.text });
    }
    if (q.action === "get") {
      const out = await readJob(String(q.snapshot || ""));
      if (!Array.isArray(out.json)) return res.status(200).json({ http: out.status, reply: out.json || out.text });
      if (q.raw === "1") return res.status(200).json(out.json.slice(0, 2));
      const header = ["company", "stock_symbol", "ceo_rated", "overall_rating_out_of_5", "ceo_approval", "recommend_to_friend", "culture_rating", "work_life_rating", "review_count", "source_url", "collected", "status", "data_gap"];
      const rows = out.json.map((rec) => {
        const r = toRow(rec);
        const ok = r.overall !== "";
        return [r.company, r.ticker, r.ceo, r.overall, r.ceoApproval, r.recommend, r.culture, r.workLife, r.reviews, r.url, r.collected, ok ? "ok" : "no data", ok ? "" : String(rec.error || rec.warning || "No rating in the record.")];
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.status(200).send([header, ...rows].map((r) => r.map(cell).join(",")).join("\n"));
    }
    res.status(400).json({ error: "Use action=start or action=get" });
  } catch (err) {
    res.status(502).json({ status: "no data", data_gap: `Could not reach Bright Data: ${err.message}` });
  }
}
