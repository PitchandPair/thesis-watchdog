"use client";

import { useEffect, useMemo, useState } from "react";
import { SAMPLE_STOCKS, SECTIONS, SectionKey, Stock, aggregate, grade, usd } from "@/lib/data";
import { VOICES, buildScript } from "@/lib/podcast";
import { CHECKLIST, GUARDRAILS, LATEST, PRISM_RUNS } from "@/lib/prism";

const STORE = "sift.stocks.v1";

function Spark({ data, up }: { data?: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="spark empty" />;
  const min = Math.min(...data), max = Math.max(...data), w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" />
    </svg>
  );
}

function Ring({ score }: { score: number | null }) {
  const g = grade(score), r = 26, c = 2 * Math.PI * r, pct = (score ?? 0) / 100;
  return (
    <div className={`ring tone-${g.tone}`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="ring-bg" />
        <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span className="ring-num">{score ?? "—"}</span>
    </div>
  );
}

function ValueGap({ s }: { s: Stock }) {
  if (!s.price || !s.intrinsicValue) return <span className="muted">Value pending</span>;
  const diff = s.intrinsicValue - s.price, pct = (diff / s.price) * 100, below = diff >= 0;
  return (
    <span className={below ? "pos" : "neg"}>
      {below ? "Below" : "Above"} value · {usd(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%)
    </span>
  );
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>(SAMPLE_STOCKS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Stock | null>(null);
  const [adding, setAdding] = useState(false);
  const [podcast, setPodcast] = useState(false);
  const [sort, setSort] = useState<"score" | "ticker">("score");
  const [prism, setPrism] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORE); if (raw) setStocks(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(stocks)); } catch {} }, [stocks]);

  const sorted = useMemo(() => [...stocks].sort((a, b) =>
    sort === "ticker" ? a.ticker.localeCompare(b.ticker) : (aggregate(b) ?? -1) - (aggregate(a) ?? -1)), [stocks, sort]);

  const toggle = (t: string) => setSelected((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const remove = (t: string) => { setStocks((p) => p.filter((s) => s.ticker !== t)); setSelected((p) => { const n = new Set(p); n.delete(t); return n; }); setOpen(null); };
  const avg = Math.round(stocks.map(aggregate).filter((x): x is number => x !== null).reduce((a, b, _, arr) => a + b / arr.length, 0));

  return (
    <main>
      <header className="top">
        <div className="brand"><span className="logo">◆</span> Sift <span className="tag">Stock Scorecard</span></div>
        <div className="top-actions">
          <span className="live"><i /> Sample data · Sheet sync pending</span>
          <button className="btn ghost prism-btn" onClick={() => setPrism("")}><i className="pdot" /> PRISM {LATEST.passed}/{LATEST.total} passed</button>
          <button className="btn ghost" onClick={() => setAdding(true)}>+ Add stock</button>
        </div>
      </header>

      <section className="summary">
        <div className="stat"><label>Tracked</label><b>{stocks.length}</b></div>
        <div className="stat"><label>Avg Sift score</label><b>{avg || "—"}</b></div>
        <div className="stat"><label>Below Buffett value</label><b>{stocks.filter((s) => s.price && s.intrinsicValue && s.intrinsicValue > s.price).length}</b></div>
        <div className="stat"><label>Scoring sections</label><b>{SECTIONS.length}</b></div>
      </section>

      <div className="toolbar">
        <h2>Watchlist</h2>
        <div className="seg">
          <button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>By score</button>
          <button className={sort === "ticker" ? "on" : ""} onClick={() => setSort("ticker")}>A–Z</button>
        </div>
      </div>

      <section className="grid">
        {sorted.map((s) => {
          const score = aggregate(s), g = grade(score), up = (s.change1d ?? 0) >= 0, isSel = selected.has(s.ticker);
          return (
            <article key={s.ticker} className={`card ${isSel ? "sel" : ""}`} onClick={() => setOpen(s)}>
              <div className="card-head">
                <label className="check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(s.ticker)} aria-label={`Select ${s.ticker}`} />
                </label>
                <div className="id">
                  <div className="ticker">{s.ticker}</div>
                  <div className="name">{s.name}</div>
                </div>
                <Ring score={score} />
              </div>

              <div className="price-row">
                <div className="price mono">{usd(s.price)}</div>
                <div className={`chg mono ${up ? "pos" : "neg"}`}>{s.change1d == null ? "" : `${up ? "+" : ""}${s.change1d.toFixed(2)}%`}</div>
                <Spark data={s.spark} up={up} />
              </div>

              <div className="gap"><ValueGap s={s} />{s.news && <span className="muted"> · News {s.news.score}</span>}</div>

              <div className="bars">
                {SECTIONS.slice(0, 4).map((sec) => (
                  <div key={sec.key} className="bar">
                    <span>{sec.label}</span>
                    <div className="track"><div className="fill" style={{ width: `${s.scores[sec.key] ?? 0}%` }} /></div>
                    <em className="mono">{s.scores[sec.key] ?? "—"}</em>
                  </div>
                ))}
              </div>

              {s.glassdoor && <div className="card-ceo"><span className="avatar sm">{initials(s.glassdoor.ceo)}</span><span>{s.glassdoor.ceo}</span><span className="muted mono">★ {s.glassdoor.rating} · {s.glassdoor.ceoApproval}% approve</span></div>}
              <div className="card-foot">
                <span className={`pill tone-${g.tone}`}>{g.label}</span>
                <span className="muted small">{s.sector}</span>
                <span className="more">Details →</span>
              </div>
            </article>
          );
        })}
        <button className="card add" onClick={() => setAdding(true)}>
          <span>+</span>Add a stock
        </button>
      </section>

      <p className="disclaimer">Sift shows information and scores only. It is not investment advice.</p>

      {selected.size > 0 && (
        <div className="dock">
          <span><b>{selected.size}</b> selected · {[...selected].join(", ")}</span>
          <div>
            <button className="btn ghost" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn primary" onClick={() => setPodcast(true)}>Create AI summary podcast</button>
          </div>
        </div>
      )}

      {open && <Detail s={open} onClose={() => setOpen(null)} onRemove={remove} onAsk={(q) => { setOpen(null); setPrism(q); }} />}
      {prism !== null && <Prism initial={prism} onClose={() => setPrism(null)} />}
      {adding && <AddStock onClose={() => setAdding(false)} existing={stocks.map((s) => s.ticker)}
        onAdd={(s) => { setStocks((p) => [...p, s]); setAdding(false); }} />}
      {podcast && <Podcast stocks={stocks.filter((s) => selected.has(s.ticker))} onClose={() => setPodcast(false)} />}
    </main>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

function initials(n: string) { return n.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

function toneOf(n: number) { return n >= 65 ? "Positive" : n >= 45 ? "Neutral" : "Negative"; }

function RowDetail({ s, k }: { s: Stock; k: SectionKey }) {
  if (k === "buffett") return <div className="rd"><span>Price <b className="mono">{usd(s.price)}</b></span><span>Intrinsic <b className={`mono ${s.price && s.intrinsicValue ? (s.intrinsicValue >= s.price ? "pos" : "neg") : ""}`}>{usd(s.intrinsicValue)}</b></span><ValueGap s={s} /></div>;
  if (k === "moat") return <div className="rd"><span>{s.moatNote}</span></div>;
  if (k === "competition") return (
    <div className="rd">
      <span className="tag tag-blue">{s.structure ?? "—"}</span>
      <span className="muted">{s.marketStructure}</span>
      <div className="chips">{s.competitors?.map((c) => (
        <span key={c.name} className="chip">{c.name} <span className="muted mono">{c.ticker}</span> <b className={`mono ${c.change30d >= 0 ? "pos" : "neg"}`}>{c.change30d >= 0 ? "+" : ""}{c.change30d}%</b></span>
      ))}</div>
    </div>);
  if (k === "congress") {
    const b = s.trades?.filter((t) => t.type === "Buy").length ?? 0, sl = s.trades?.filter((t) => t.type === "Sell").length ?? 0;
    return <div className="rd"><span className="pos">{b} buy{b === 1 ? "" : "s"}</span><span className="neg">{sl} sell{sl === 1 ? "" : "s"}</span><span className="muted">last 60 days</span></div>;
  }
  if (k === "feedback" && s.glassdoor) return <div className="rd"><span>Glassdoor <b className="mono">{s.glassdoor.rating}/5</b></span><span>CEO approval <b className="mono">{s.glassdoor.ceoApproval}%</b></span><span>Recommend <b className="mono">{s.glassdoor.recommend}%</b></span><span>CEO <b>{s.glassdoor.ceo}</b></span></div>;
  if (k === "news" && s.news) return <div className="rd"><span className={`tag tag-${toneOf(s.news.score) === "Positive" ? "green" : toneOf(s.news.score) === "Neutral" ? "gray" : "red"}`}>{toneOf(s.news.score)}</span><span className="pos">{s.news.positive} positive</span><span>{s.news.neutral} neutral</span><span className="neg">{s.news.negative} negative</span><span className="muted">30 days</span></div>;
  if (k === "trend") return <div className="rd"><span><b className="mono">{s.trend?.odds}%</b> chance of {s.trend?.target}</span></div>;
  return null;
}

function Detail({ s, onClose, onRemove, onAsk }: { s: Stock; onClose: () => void; onRemove: (t: string) => void; onAsk: (q: string) => void }) {
  const score = aggregate(s), g = grade(score);
  return (
    <Modal onClose={onClose} wide>
      <div className="d-head">
        <div>
          <div className="d-ticker">{s.ticker} <span className="muted">{s.name}</span></div>
          <div className="muted small">{s.sector}</div>
        </div>
        <div className="d-score"><Ring score={score} /><span className={`pill tone-${g.tone}`}>{g.label}</span></div>
      </div>

      {s.pending ? (
        <div className="pending">Added. Scores will appear after the next Google Sheet sync.</div>
      ) : (
        <>
          <div className="d-grid">
            <div className="panel">
              <h4>Buffett Value</h4>
              <div className="kv"><span>Current price</span><b className="mono">{usd(s.price)}</b></div>
              <div className="kv"><span>Intrinsic value</span><b className={`mono ${s.price && s.intrinsicValue ? (s.intrinsicValue >= s.price ? "pos" : "neg") : ""}`}>{usd(s.intrinsicValue)}</b></div>
              <div className="kv"><span>Gap</span><b><ValueGap s={s} /></b></div>
            </div>
            <div className="panel">
              <h4>Trend Odds <span className="muted small">10,000 runs</span></h4>
              <div className="big mono">{s.trend?.odds ?? "—"}%</div>
              <div className="muted small">Chance of {s.trend?.target ?? "target"}</div>
            </div>
            <div className="panel">
              <h4>News Sentiment</h4>
              <div className="big mono">{s.news?.score ?? "—"}</div>
              <div className="split">{s.news && <>
                <i className="seg-pos" style={{ flex: s.news.positive }} /><i className="seg-neu" style={{ flex: s.news.neutral }} /><i className="seg-neg" style={{ flex: s.news.negative }} />
              </>}</div>
              <div className="muted small">{s.news ? `${s.news.positive + s.news.neutral + s.news.negative} articles · ${toneOf(s.news.score)}` : "—"}</div>
            </div>
          </div>

          <h3 className="sub">Score breakdown</h3>
          <div className="breakdown">
            {SECTIONS.map((sec) => (
              <div key={sec.key} className="brow-wrap">
                <div className="brow">
                  <div><b>{sec.label}</b><div className="muted small">{sec.desc}</div></div>
                  <div className="track lg"><div className="fill" style={{ width: `${s.scores[sec.key] ?? 0}%` }} /></div>
                  <span className="mono">{s.scores[sec.key] ?? "—"}</span>
                  <span className="muted small mono">×{sec.weight}%</span>
                </div>
                <RowDetail s={s} k={sec.key} />
              </div>
            ))}
          </div>

          <div className="d-grid two">
            <div className="panel">
              <h4>Moat & Competition</h4>
              <p className="small">{s.moatNote}</p>
              <div className="pill tone-mid inline">{s.marketStructure}</div>
              <table className="tbl">
                <thead><tr><th>Competitor</th><th>30D</th></tr></thead>
                <tbody>{s.competitors?.map((c) => (
                  <tr key={c.ticker + c.name}><td>{c.name} <span className="muted">{c.ticker}</span></td>
                    <td className={`mono ${c.change30d >= 0 ? "pos" : "neg"}`}>{c.change30d >= 0 ? "+" : ""}{c.change30d}%</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="panel">
              <h4>Congress Trades</h4>
              <table className="tbl">
                <thead><tr><th>Member</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>{s.trades?.map((t, i) => (
                  <tr key={i}><td>{t.member}</td><td className={t.type === "Buy" ? "pos" : "neg"}>{t.type}</td>
                    <td className="mono small">{t.amount}</td><td className="muted small">{t.date}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="d-grid two">
            <div className="panel">
              <h4>Headlines <span className="muted small">sample</span></h4>
              <ul className="news">{s.news?.headlines.map((h, i) => (
                <li key={i}><span className={`dot dot-${h.tone}`} /><div><div>{h.title}</div><div className="muted small">{h.source} · {h.date} · {h.tone}</div></div></li>
              ))}</ul>
            </div>
            <div className="panel">
              <h4>Glassdoor <span className="muted small">{s.glassdoor?.reviews.toLocaleString()} reviews · Nov 2026</span></h4>
              {s.glassdoor && <>
                <div className="gd-top">
                  <div><div className="big mono">{s.glassdoor.rating}</div><div className="muted small">Overall / 5</div></div>
                  <div><div className="big mono">{s.glassdoor.ceoApproval}%</div><div className="muted small">CEO approval</div></div>
                  <div><div className="big mono">{s.glassdoor.recommend}%</div><div className="muted small">Recommend</div></div>
                </div>
                <div className="ceo"><span className="avatar">{initials(s.glassdoor.ceo)}</span><div><b>{s.glassdoor.ceo}</b><div className="muted small">CEO · {s.glassdoor.ceoApproval}% approval · {s.glassdoor.outlook}% positive outlook</div>{s.glassdoor.note && <span className="tag tag-blue small">{s.glassdoor.note}</span>}</div></div>
                
                <div className="pc">
                  <div><b className="pos small">Pros</b><ul>{s.glassdoor.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><b className="neg small">Cons</b><ul>{s.glassdoor.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>
                </div>
              </>}
            </div>
          </div>

          <div className="panel future">
            <h4>CEO Promises <span className="badge">Coming soon</span></h4>
            <div className="promises">
              {(["Delivered", "Behind", "Over achieved"] as const).map((p) => (
                <span key={p} className={`pill ${s.ceoPromise === p ? (p === "Behind" ? "tone-bad" : "tone-good") : "tone-none"}`}>{p}</span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="d-foot">
        <button className="btn danger" onClick={() => onRemove(s.ticker)}>Remove {s.ticker}</button>
        <button className="btn ghost" onClick={() => onAsk(`What was ${s.name}'s net income in its latest annual report?`)}>Ask the analyst about {s.ticker}</button>
        <span className="muted small">Information only. Not investment advice.</span>
      </div>
    </Modal>
  );
}

function AddStock({ onClose, onAdd, existing }: { onClose: () => void; onAdd: (s: Stock) => void; existing: string[] }) {
  const [ticker, setTicker] = useState(""); const [name, setName] = useState(""); const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!/^[A-Z.]{1,6}$/.test(t)) return setErr("Enter a valid ticker (e.g. AVGO).");
    if (existing.includes(t)) return setErr(`${t} is already on your watchlist.`);
    onAdd({ ticker: t, name: name.trim() || t, sector: "Awaiting sync", price: null, change1d: null, intrinsicValue: null, scores: {}, pending: true });
  };
  return (
    <Modal onClose={onClose}>
      <h3>Add a stock</h3>
      <p className="muted small">It's added now and scored on the next Sheet sync.</p>
      <form onSubmit={submit} className="form">
        <label>Ticker<input autoFocus value={ticker} onChange={(e) => { setTicker(e.target.value); setErr(""); }} placeholder="AVGO" /></label>
        <label>Company name <span className="muted">(optional)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Broadcom" /></label>
        {err && <div className="neg small">{err}</div>}
        <div className="row"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Add to watchlist</button></div>
      </form>
    </Modal>
  );
}

function Podcast({ stocks, onClose }: { stocks: Stock[]; onClose: () => void }) {
  const [voice, setVoice] = useState(VOICES[0].id);
  const [script, setScript] = useState(() => buildScript(stocks));
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [audio, setAudio] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const pendingCount = stocks.filter((s) => s.pending).length;

  const generate = async () => {
    setState("loading"); setMsg("");
    try {
      const r = await fetch("/api/podcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, voiceId: voice }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Audio failed."); }
      setAudio(URL.createObjectURL(await r.blob())); setState("done");
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Audio failed."); setState("error"); }
  };

  return (
    <Modal onClose={onClose} wide>
      <h3>AI summary podcast</h3>
      <p className="muted small">{stocks.map((s) => s.ticker).join(" · ")}{pendingCount ? ` · ${pendingCount} pending stock(s) skipped` : ""}</p>

      <h4 className="label">Voice</h4>
      <div className="voices">
        {VOICES.map((v) => (
          <button key={v.id} className={`voice ${voice === v.id ? "on" : ""}`} onClick={() => setVoice(v.id)}>
            <b>{v.name}</b><span className="muted small">{v.style}</span>
          </button>
        ))}
      </div>

      <h4 className="label">Script <span className="muted small">editable</span></h4>
      <textarea className="script" value={script} onChange={(e) => setScript(e.target.value)} rows={10} />

      {audio && <audio controls src={audio} className="player" autoPlay />}
      {msg && <div className="neg small">{msg}</div>}

      <div className="row">
        {audio && <a className="btn ghost" href={audio} download="sift-podcast.mp3">Download MP3</a>}
        <button className="btn primary" onClick={generate} disabled={state === "loading"}>
          {state === "loading" ? "Generating…" : audio ? "Regenerate" : "Generate audio"}
        </button>
      </div>
    </Modal>
  );
}

type AskResult = { answer?: string; prism_trace?: string; model?: string; error?: string };

function Prism({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setQ(question); setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      setRes(await r.json());
    } catch { setRes({ error: "The analyst didn't respond. Try again." }); }
    setBusy(false);
  };
  return (
    <Modal onClose={onClose} wide>
      <h3>PRISM checks</h3>
      <p className="muted small">Every analyst answer is traced and tested on PRISM by Block Convey. PRISM writes its own tests and flags anything ungrounded.</p>

      <div className="d-grid" style={{ marginTop: 24 }}>
        <div className="panel"><h4>Latest test run</h4><div className="big mono">{LATEST.passed}/{LATEST.total}</div><div className="muted small">{Math.round((LATEST.passed / LATEST.total) * 100)}% passed · {LATEST.when}</div></div>
        <div className="panel"><h4>Conversation check</h4><div className="big mono">{LATEST.convoBreaks}</div><div className="muted small">rule breaks in {LATEST.convos} conversations</div></div>
        <div className="panel"><h4>Improvement</h4><div className="big mono pos">+{Math.round((LATEST.passed / LATEST.total - PRISM_RUNS[0].passed / PRISM_RUNS[0].total) * 100)} pts</div><div className="muted small">run 1 to run {LATEST.run}</div></div>
      </div>

      <div className="d-grid two">
        <div className="panel">
          <h4>Guardrails</h4>
          <ul className="news">{GUARDRAILS.map((g) => (
            <li key={g.rule}><span className={`dot dot-${g.status === "pass" ? "Positive" : "Neutral"}`} /><div>{g.rule}<div className="muted small">{g.status === "pass" ? "Passing" : "1 open fix"}</div></div></li>
          ))}</ul>
        </div>
        <div className="panel">
          <h4>Test history</h4>
          <table className="tbl"><thead><tr><th>Run</th><th>Passed</th><th>Flagged / fix</th></tr></thead>
            <tbody>{PRISM_RUNS.map((r) => (
              <tr key={r.run}><td className="mono">{r.run}</td><td className="mono">{r.passed}/{r.total}</td><td className="small">{r.flagged}<div className="muted">{r.fixed}</div></td></tr>
            ))}</tbody></table>
        </div>
      </div>

      <div className="panel future">
        <h4>Ask the analyst <span className="muted small">answers from SEC filings, traced to PRISM</span></h4>
        <form className="askrow" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What was Micron's revenue in its latest fiscal year?" />
          <button className="btn primary" disabled={busy}>{busy ? "Asking…" : "Ask"}</button>
        </form>
        {res && (
          <div className="answer">
            {res.error ? <span className="neg">{res.error}</span> : <>
              <p>{res.answer}</p>
              <div className="muted small">PRISM trace: <b className={res.prism_trace === "sent" ? "pos" : ""}>{res.prism_trace ?? "—"}</b>{res.model ? ` · ${res.model}` : ""} · Information, not investment advice.</div>
            </>}
          </div>
        )}
        <h4 className="label">Test questions</h4>
        <div className="checks">{CHECKLIST.map((c) => (
          <button key={c.q} className="check-q" onClick={() => ask(c.q)}><span>{c.q}</span><span className="muted small">Expect: {c.expect}</span></button>
        ))}</div>
      </div>
      <div className="d-foot"><span className="muted small">PRISM by Block Convey · test ids on file</span></div>
    </Modal>
  );
}
