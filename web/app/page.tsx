"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  SAMPLE_STOCKS, SECTIONS, SYNCED_AT, TAB_NAMES, WEIGHT, Source, Stock, aggregate, grade, rowOn, scoreOf, sheetUrl, usd,
} from "@/lib/data";
import { VOICES, buildScript } from "@/lib/podcast";
import { CHECKLIST, GUARDRAILS, LATEST, PRISM_RUNS } from "@/lib/prism";
import { md } from "@/lib/md";

const STORE = "sift.stocks.v2";

// ---------- Click-for-source ----------
const SrcCtx = createContext<(s: Source) => void>(() => {});
function Src({ s, children, className = "" }: { s: Source; children: React.ReactNode; className?: string }) {
  const open = useContext(SrcCtx);
  return (
    <span role="button" tabIndex={0} className={`src ${s.demo ? "is-demo" : ""} ${className}`}
      onClick={(e) => { e.stopPropagation(); open(s); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); open(s); } }}
      title={s.demo ? "Demo value. Click for details" : "Click to see the source"}>
      {children}
    </span>
  );
}
function SourcePanel({ s, onClose }: { s: Source; onClose: () => void }) {
  return (
    <aside className="srcpanel" role="dialog" aria-label="Source">
      <button className="x" onClick={onClose} aria-label="Close">×</button>
      <div className="muted small">Source</div>
      <h4>{s.label}</h4>
      <div className="big mono">{s.value}</div>
      {s.demo && <div className="tag-gray demo-tag">Demo value: not in the Sheet yet</div>}
      {s.tab && <div className="kv"><span>Sheet</span><b>{TAB_NAMES[s.tab]}{s.cell ? `, cell ${s.cell}` : ""}</b></div>}
      {s.note && <p className="small src-note">{s.note}</p>}
      <div className="src-links">
        {s.tab && <a className="btn primary" href={sheetUrl(s.tab, s.cell)} target="_blank" rel="noreferrer">Open in Google Sheet</a>}
        {s.url && <a className="btn ghost" href={s.url} target="_blank" rel="noreferrer">{s.urlLabel ?? "Original source"}</a>}
      </div>
    </aside>
  );
}

// ---------- Small pieces ----------
function Spark({ data, up }: { data?: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="spark empty" />;
  const min = Math.min(...data), max = Math.max(...data), w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(" ");
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" /></svg>;
}
function Ring({ score }: { score: number | null }) {
  const g = grade(score), r = 26, c = 2 * Math.PI * r, pct = (score ?? 0) / 10;
  return (
    <div className={`ring tone-${g.tone}`}>
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} className="ring-bg" /><circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" /></svg>
      <span className="ring-num">{score ?? "—"}</span>
    </div>
  );
}
const gapPct = (s: Stock) => (s.price && s.intrinsicValue ? ((s.price - s.intrinsicValue) / s.intrinsicValue) * 100 : null);
function ValueGap({ s }: { s: Stock }) {
  const p = gapPct(s);
  if (p === null) return <span className="muted">{s.ivNote ?? "Value pending"}</span>;
  const above = p >= 0, diff = Math.abs((s.price ?? 0) - (s.intrinsicValue ?? 0));
  return <span className={above ? "neg" : "pos"}>{above ? "Above" : "Below"} value · {usd(diff)} ({Math.abs(p).toFixed(0)}%)</span>;
}
const ivClass = (s: Stock) => (s.price && s.intrinsicValue ? (s.intrinsicValue >= s.price ? "pos" : "neg") : "");
function initials(n: string) { return n.replace(/^Dr\.\s*/, "").split(/[\s.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

// Source builders
const srcPrice = (s: Stock): Source => ({ label: `${s.name} stock price`, value: usd(s.price), tab: "results", cell: `C${s.row}`, note: "Price as recorded in the Sheet when it last refreshed." });
const srcIV = (s: Stock): Source => ({ label: `${s.name} Buffett intrinsic value per share`, value: s.intrinsicValue ? usd(s.intrinsicValue) : s.ivNote ?? "No data", tab: "buffett", cell: `J${rowOn.buffett(s)}`, url: s.secUrl, urlLabel: "SEC filing", note: "Owner earnings grown 8% a year for 10 years, discounted at 10%, plus 3% terminal growth, divided by diluted shares. Change the yellow cells on the Buffett tab to recalculate." });
const srcGap = (s: Stock): Source => ({ label: `${s.name} price vs Buffett value`, value: gapPct(s) === null ? "No data" : `${gapPct(s)!.toFixed(0)}%`, tab: "results", cell: `E${s.row}` });
const srcAgg = (s: Stock): Source => ({ label: `${s.name} Sift score (0 to 10)`, value: String(aggregate(s) ?? "—"), tab: "results", cell: `F${s.row}`, note: `${s.confidence}. Weighted average of the metric scores using the Weights tab. Demo values are not included.` });
const srcScore = (s: Stock, k: (typeof SECTIONS)[number]): Source => {
  const sc = scoreOf(s, k.key);
  return { label: `${s.name} · ${k.label} score`, value: sc.v === null ? (k.key === "congress" ? "No trades" : "No data") : `${sc.v} / 10`, tab: "results", cell: `${k.col}${s.row}`, demo: sc.demo, note: sc.demo ? "This metric isn't built in the Sheet yet. The value is a placeholder for the demo." : `${k.desc}. Weight ${WEIGHT} of 10 on the Weights tab.` };
};

// ---------- Page ----------
export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>(SAMPLE_STOCKS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Stock | null>(null);
  const [adding, setAdding] = useState(false);
  const [podcast, setPodcast] = useState(false);
  const [sort, setSort] = useState<"score" | "ticker">("score");
  const [prism, setPrism] = useState<string | null>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [tab, setTab] = useState<"dashboard" | "survey">("dashboard");
  const [surveyTicker, setSurveyTicker] = useState("NVDA");

  useEffect(() => { try { const raw = localStorage.getItem(STORE); if (raw) setStocks(JSON.parse(raw)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(stocks)); } catch {} }, [stocks]);
  useEffect(() => { const h = () => setTab(location.hash === "#survey" ? "survey" : "dashboard"); h(); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  const go = (t: "dashboard" | "survey") => { setTab(t); try { history.replaceState(null, "", t === "survey" ? "#survey" : location.pathname); } catch {} };

  const sorted = useMemo(() => [...stocks].sort((a, b) => sort === "ticker" ? a.ticker.localeCompare(b.ticker) : (aggregate(b) ?? -1) - (aggregate(a) ?? -1)), [stocks, sort]);
  const toggle = (t: string) => setSelected((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const remove = (t: string) => { setStocks((p) => p.filter((s) => s.ticker !== t)); setSelected((p) => { const n = new Set(p); n.delete(t); return n; }); setOpen(null); };
  const scored = stocks.map(aggregate).filter((x): x is number => x !== null);
  const avg = scored.length ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1) : "—";

  return (
    <SrcCtx.Provider value={setSrc}>
      <main>
        <header className="top">
          <div className="brand">Sift <span className="tag">Stock Scorecard</span></div>
          <nav className="tabs" aria-label="Sections">
            <button className={tab === "dashboard" ? "on" : ""} onClick={() => go("dashboard")}>Dashboard</button>
            <button className={tab === "survey" ? "on" : ""} onClick={() => go("survey")}>Survey employees</button>
          </nav>
          <div className="top-actions">
            <a className="live" href={sheetUrl("results")} target="_blank" rel="noreferrer"><i /> Synced from Sheet · {SYNCED_AT}</a>
            <button className="btn ghost prism-btn" onClick={() => setPrism("")}><i className="pdot" /> PRISM {LATEST.passed}/{LATEST.total} passed</button>
            {tab === "dashboard" && <button className="btn ghost" onClick={() => setAdding(true)}>+ Add stock</button>}
          </div>
        </header>

        {tab === "survey" ? (
          <Survey stocks={stocks} ticker={surveyTicker} setTicker={setSurveyTicker} />
        ) : (
          <>
            <AskBar stocks={stocks} />

            <section className="summary">
              <div className="stat"><label>Tracked</label><b>{stocks.length}</b></div>
              <div className="stat"><label>Avg Sift score</label><b>{avg}</b></div>
              <div className="stat"><label>Below Buffett value</label><b>{stocks.filter((s) => s.price && s.intrinsicValue && s.intrinsicValue > s.price).length}</b></div>
              <div className="stat"><label>Scoring metrics</label><b>{SECTIONS.length}</b></div>
            </section>

            <div className="toolbar">
              <h2>Watchlist <span className="muted small">Click any number to see where it came from</span></h2>
              <div className="seg">
                <button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>By score</button>
                <button className={sort === "ticker" ? "on" : ""} onClick={() => setSort("ticker")}>A–Z</button>
              </div>
            </div>

            <section className="grid">
              {sorted.map((s) => {
                const score = aggregate(s), g = grade(score), up = s.change1d >= 0, isSel = selected.has(s.ticker);
                return (
                  <article key={s.ticker} className={`card ${isSel ? "sel" : ""}`} onClick={() => setOpen(s)}>
                    <div className="card-head">
                      <label className="check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSel} onChange={() => toggle(s.ticker)} aria-label={`Select ${s.ticker}`} /></label>
                      <div className="id"><div className="ticker">{s.ticker}</div><div className="name">{s.name}</div></div>
                      <Src s={srcAgg(s)}><Ring score={score} /></Src>
                    </div>
                    <div className="price-row">
                      <Src s={srcPrice(s)}><span className="price mono">{usd(s.price)}</span></Src>
                      <Src s={{ label: `${s.name} 1-day change`, value: `${s.change1d}%`, demo: true, note: "The Sheet doesn't track daily price moves yet." }}><span className={`chg mono ${up ? "pos" : "neg"}`}>{up ? "+" : ""}{s.change1d.toFixed(2)}%</span></Src>
                      <Src s={{ label: `${s.name} price trend`, value: "10 points", demo: true, note: "The Sheet has no price history yet." }} className="spark-wrap"><Spark data={s.spark} up={up} /></Src>
                    </div>
                    <div className="gap"><Src s={srcGap(s)}><ValueGap s={s} /></Src>{s.news && <span className="muted"> · News {s.scores.news ?? "—"}/10</span>}</div>
                    <div className="bars">
                      {SECTIONS.slice(0, 4).map((k) => {
                        const sc = scoreOf(s, k.key);
                        return (
                          <Src key={k.key} s={srcScore(s, k)} className="bar">
                            <span>{k.label}</span><div className="track"><div className="fill" style={{ width: `${(sc.v ?? 0) * 10}%` }} /></div><em className="mono">{sc.v ?? "—"}</em>
                          </Src>
                        );
                      })}
                    </div>
                    {s.glassdoor && (
                      <Src s={{ label: `${s.name} CEO approval (Glassdoor)`, value: s.glassdoor.approval !== null ? `${s.glassdoor.approval}%` : "Not shown", tab: "feedback", cell: `D${rowOn.feedback(s)}`, url: s.glassdoor.url, urlLabel: "Glassdoor page", note: s.glassdoor.note ?? "One-time pull on 2026-11-21 via Bright Data." }} className="card-ceo">
                        <span className="avatar sm">{s.glassdoor.approval !== null ? initials(s.glassdoor.ceo) : "—"}</span><span>{s.glassdoor.ceo}</span><span className="muted mono">★ {s.glassdoor.rating}{s.glassdoor.approval !== null ? ` · ${s.glassdoor.approval}%` : ""}</span>
                      </Src>
                    )}
                    <div className="card-foot"><span className={`pill tone-${g.tone}`}>{g.label}</span><span className="muted small">{s.sector}</span><span className="more">Details →</span></div>
                  </article>
                );
              })}
              <button className="card add" onClick={() => setAdding(true)}><span>+</span>Add a stock</button>
            </section>

            <p className="disclaimer">Sift shows information and scores only. It is not investment advice. Values tagged demo are placeholders until the Sheet has them.</p>

            {selected.size > 0 && (
              <div className="dock">
                <span><b>{selected.size}</b> selected · {[...selected].join(", ")}</span>
                <div><button className="btn ghost" onClick={() => setSelected(new Set())}>Clear</button><button className="btn primary" onClick={() => setPodcast(true)}>Create AI summary podcast</button></div>
              </div>
            )}
          </>
        )}

        {open && <Detail s={open} onClose={() => setOpen(null)} onRemove={remove}
          onAsk={(q) => { setOpen(null); setPrism(q); }}
          onSurvey={(t) => { setOpen(null); setSurveyTicker(t); go("survey"); }} />}
        {prism !== null && <Prism initial={prism} onClose={() => setPrism(null)} />}
        {adding && <AddStock onClose={() => setAdding(false)} existing={stocks.map((s) => s.ticker)} onAdd={(s) => { setStocks((p) => [...p, s]); setAdding(false); }} />}
        {podcast && <Podcast stocks={stocks.filter((s) => selected.has(s.ticker))} onClose={() => setPodcast(false)} />}
        {src && <SourcePanel s={src} onClose={() => setSrc(null)} />}
      </main>
    </SrcCtx.Provider>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

function Detail({ s, onClose, onRemove, onAsk, onSurvey }: { s: Stock; onClose: () => void; onRemove: (t: string) => void; onAsk: (q: string) => void; onSurvey: (t: string) => void }) {
  const score = aggregate(s), g = grade(score);
  return (
    <Modal onClose={onClose} wide>
      <div className="d-head">
        <div><div className="d-ticker">{s.ticker} <span className="muted">{s.name}</span></div><div className="muted small">{s.sector} · {s.confidence}</div></div>
        <div className="d-score"><Src s={srcAgg(s)}><Ring score={score} /></Src><span className={`pill tone-${g.tone}`}>{g.label}</span></div>
      </div>

      {s.pending ? <div className="pending">Added. Scores will appear after the next Google Sheet sync.</div> : (
        <>
          <div className="d-grid">
            <div className="panel">
              <h4>Buffett Value</h4>
              <div className="kv"><span>Current price</span><Src s={srcPrice(s)}><b className="mono">{usd(s.price)}</b></Src></div>
              <div className="kv"><span>Intrinsic value</span><Src s={srcIV(s)}><b className={`mono ${ivClass(s)}`}>{s.intrinsicValue ? usd(s.intrinsicValue) : "N/A"}</b></Src></div>
              <div className="kv"><span>Gap</span><Src s={srcGap(s)}><b><ValueGap s={s} /></b></Src></div>
            </div>
            <div className="panel">
              <h4>Trend Alert <span className="tag-gray demo-tag">demo</span></h4>
              <Src s={{ label: `${s.name} trend odds`, value: `${s.trendOdds}%`, demo: true, tab: "results", cell: `O${s.row}`, note: "Trend Alert is not built in the Sheet yet (Weights tab: Not built yet)." }}><div className="big mono">{s.trendOdds ?? "—"}%</div></Src>
              <div className="muted small">Chance of +10% in 90 days, 10,000 simulated runs</div>
            </div>
            <div className="panel">
              <h4>News Sentiment</h4>
              <Src s={{ label: `${s.name} news score`, value: `${s.scores.news ?? "—"} / 10`, tab: "results", cell: `L${s.row}`, note: "Headlines from the last 7 days, each labeled positive, neutral or negative by AI (Claude Haiku via Nicrron), recorded in PRISM." }}><div className="big mono">{s.scores.news ?? "—"}<span className="muted small"> /10</span></div></Src>
              {s.news && <div className="split"><i className="seg-pos" style={{ flex: s.news.positive || 0.001 }} /><i className="seg-neu" style={{ flex: s.news.neutral || 0.001 }} /><i className="seg-neg" style={{ flex: s.news.negative || 0.001 }} /></div>}
              {s.news && <div className="muted small">{s.news.positive} positive · {s.news.neutral} neutral · {s.news.negative} negative</div>}
            </div>
          </div>

          <h3 className="sub">AI summary</h3>
          <Src s={{ label: `${s.name} AI summary`, value: "Written from SEC filings and headlines", tab: "results", cell: `U${s.row}`, url: s.secUrl, urlLabel: "SEC filing" }} className="summary-box"><p>{s.summary}</p></Src>

          <h3 className="sub">Score breakdown <span className="muted small">click a row for its source</span></h3>
          <div className="breakdown">
            {SECTIONS.map((k) => {
              const sc = scoreOf(s, k.key);
              return (
                <div key={k.key} className="brow-wrap">
                  <Src s={srcScore(s, k)} className="brow">
                    <div><b>{k.label}</b>{sc.demo && <span className="tag-gray demo-tag">demo</span>}<div className="muted small">{k.desc}</div></div>
                    <div className="track lg"><div className="fill" style={{ width: `${(sc.v ?? 0) * 10}%` }} /></div>
                    <span className="mono">{sc.v ?? "—"}</span><span className="muted small mono">×{WEIGHT}</span>
                  </Src>
                  <RowDetail s={s} k={k.key} />
                </div>
              );
            })}
          </div>

          <div className="d-grid two">
            <div className="panel">
              <h4>Moat & Competition</h4>
              {s.moat && <>
                <div className="moat-tags">
                  <Src s={{ label: `${s.name} moat`, value: s.moat.label, tab: "moat", cell: `C${rowOn.moat(s)}`, note: s.moat.reason + " From the AI model's general knowledge, not a filing (Claude Opus via Nicrron, recorded in PRISM)." }}><span className="tag-blue">{s.moat.label} moat</span></Src>
                  <Src s={{ label: `${s.name} market structure`, value: s.moat.structure, tab: "moat", cell: `E${rowOn.moat(s)}`, note: s.moat.structureReason }}><span className="tag-blue">{s.moat.structure}</span></Src>
                </div>
                <p className="small">{s.moat.reason}</p>
                <table className="tbl"><thead><tr><th>Competitor</th><th>30D <span className="tag-gray demo-tag">demo</span></th></tr></thead>
                  <tbody>{s.moat.competitors.map((c, i) => {
                    const ch = s.comp30d?.[i] ?? 0;
                    return (
                      <tr key={c}>
                        <td><Src s={{ label: `${s.name} competitor`, value: c, tab: "moat", cell: `F${rowOn.moat(s)}`, note: s.moat!.structureReason }}>{c}</Src></td>
                        <td><Src s={{ label: `${c} 30-day move`, value: `${ch}%`, demo: true, note: "The Sheet doesn't track competitor prices yet." }}><span className={`mono ${ch >= 0 ? "pos" : "neg"}`}>{ch >= 0 ? "+" : ""}{ch}%</span></Src></td>
                      </tr>
                    );
                  })}</tbody></table>
              </>}
            </div>
            <div className="panel">
              <h4>Congress Trades <span className="muted small">last 3 months · via Bargo</span></h4>
              {s.congress && (() => {
                const c = s.congress, r = rowOn.congress(s);
                return <>
                  <div className="gd-top">
                    <Src s={{ label: `${s.name} Congress buys`, value: String(c.buys), tab: "congress", cell: `B${r}` }}><div><div className="big mono pos">{c.buys}</div><div className="muted small">Buys</div></div></Src>
                    <Src s={{ label: `${s.name} Congress sales`, value: String(c.sales), tab: "congress", cell: `C${r}` }}><div><div className="big mono neg">{c.sales}</div><div className="muted small">Sales</div></div></Src>
                    <Src s={{ label: `${s.name} Congress signal`, value: c.signal, tab: "congress", cell: `K${r}` }}><div><div className="big signal">{c.signal}</div><div className="muted small">Signal</div></div></Src>
                  </div>
                  <div className="kv"><span>Members buying</span><b className="mono">{c.membersBuying}</b></div>
                  <div className="kv"><span>Members selling</span><b className="mono">{c.membersSelling}</b></div>
                  <Src s={{ label: `${s.name} latest Congress trade`, value: c.latest, tab: "congress", cell: `F${r}` }} className="kv"><span>Latest trade</span><b className="mono">{c.latest}</b></Src>
                </>;
              })()}
            </div>
          </div>

          <div className="d-grid two">
            <div className="panel">
              <h4>Headlines <span className="muted small">AI-labeled, last 7 days</span></h4>
              <ul className="news">{s.news?.headlines.map((h) => (
                <li key={h.row}>
                  <span className={`dot dot-${h.tone}`} />
                  <Src s={{ label: `${h.publisher} headline`, value: h.tone, tab: "news", cell: `B${h.row}`, note: `${h.title}. AI label reason: ${h.reason} The article link is in column G of that row.` }}>
                    <div>{h.title}</div><div className="muted small">{h.publisher} · {h.date} · {h.tone}</div>
                  </Src>
                </li>
              ))}</ul>
            </div>
            <div className="panel">
              <h4>Company Feedback <span className="muted small">Glassdoor · {s.glassdoor?.reviews.toLocaleString()} reviews</span></h4>
              {s.glassdoor && (() => {
                const gd = s.glassdoor, r = rowOn.feedback(s);
                return <>
                  <div className="gd-top">
                    <Src s={{ label: `${s.name} Glassdoor rating`, value: `${gd.rating} / 5`, tab: "feedback", cell: `E${r}`, url: gd.url, urlLabel: "Glassdoor page" }}><div><div className="big mono">{gd.rating}</div><div className="muted small">Overall / 5</div></div></Src>
                    <Src s={{ label: `${s.name} CEO approval`, value: gd.approval !== null ? `${gd.approval}%` : "Not shown", tab: "feedback", cell: `D${r}`, url: gd.url, urlLabel: "Glassdoor page", note: gd.note }}><div><div className="big mono">{gd.approval !== null ? `${gd.approval}%` : "—"}</div><div className="muted small">CEO approval</div></div></Src>
                    <Src s={{ label: `${s.name} Glassdoor reviews`, value: gd.reviews.toLocaleString(), tab: "feedback", cell: `F${r}`, url: gd.url, urlLabel: "Glassdoor page" }}><div><div className="big mono">{gd.reviews >= 1000 ? `${(gd.reviews / 1000).toFixed(1)}k` : gd.reviews}</div><div className="muted small">Reviews</div></div></Src>
                  </div>
                  <div className="ceo"><span className="avatar">{gd.approval !== null ? initials(gd.ceo) : "—"}</span><div><b>{gd.ceo}</b><div className="muted small">CEO rated on Glassdoor · collected 2026-11-21</div>{gd.note && <div className="small warn">{gd.note}</div>}</div></div>
                  <button className="btn ghost wide-btn" onClick={() => onSurvey(s.ticker)}>Survey employees (simulation) →</button>
                </>;
              })()}
            </div>
          </div>

          <div className="panel future">
            <h4>CEO Promises <span className="badge">Coming soon</span> <span className="tag-gray demo-tag">demo</span></h4>
            <div className="promises">{(["Delivered", "Behind", "Over achieved"] as const).map((p) => (
              <span key={p} className={`pill ${s.ceoPromise === p ? (p === "Behind" ? "tone-bad" : "tone-good") : "tone-none"}`}>{p}</span>
            ))}</div>
          </div>
          {s.gap && <p className="small muted gap-note">What we don't know: {s.gap}</p>}
        </>
      )}

      <div className="d-foot">
        <button className="btn danger" onClick={() => onRemove(s.ticker)}>Remove {s.ticker}</button>
        <button className="btn ghost" onClick={() => onAsk(`What was ${s.name}'s net income in its latest annual report?`)}>Ask the analyst about {s.ticker}</button>
        <a className="btn ghost" href={sheetUrl("results", `A${s.row}:X${s.row}`)} target="_blank" rel="noreferrer">Open row in Sheet</a>
      </div>
    </Modal>
  );
}

function RowDetail({ s, k }: { s: Stock; k: (typeof SECTIONS)[number]["key"] }) {
  if (k === "buffett") return <div className="rd"><span>Price <b className="mono">{usd(s.price)}</b></span><span>Intrinsic <b className={`mono ${ivClass(s)}`}>{s.intrinsicValue ? usd(s.intrinsicValue) : "N/A"}</b></span><ValueGap s={s} /></div>;
  if (k === "moat" && s.moat) return <div className="rd"><span className="tag-blue">{s.moat.label}</span><span>{s.moat.reason}</span></div>;
  if (k === "competition" && s.moat) return (
    <div className="rd"><span className="tag-blue">{s.moat.structure}</span><span className="muted">{s.moat.structureReason}</span>
      <div className="chips">{s.moat.competitors.map((c) => <span key={c} className="chip">{c}</span>)}</div></div>);
  if (k === "congress" && s.congress) return <div className="rd"><span className="pos">{s.congress.buys} buys</span><span className="neg">{s.congress.sales} sales</span><span>{s.congress.signal}</span><span className="muted">latest {s.congress.latest}</span></div>;
  if (k === "feedback" && s.glassdoor) return <div className="rd"><span>Glassdoor <b className="mono">{s.glassdoor.rating}/5</b></span><span>CEO approval <b className="mono">{s.glassdoor.approval ?? "—"}{s.glassdoor.approval !== null ? "%" : ""}</b></span><span>CEO <b>{s.glassdoor.ceo}</b></span></div>;
  if (k === "news" && s.news) return <div className="rd"><span className="pos">{s.news.positive} positive</span><span>{s.news.neutral} neutral</span><span className="neg">{s.news.negative} negative</span><span className="muted">7 days</span></div>;
  if (k === "trend") return <div className="rd"><span><b className="mono">{s.trendOdds}%</b> chance of +10% in 90 days</span><span className="tag-gray demo-tag">demo</span></div>;
  return null;
}

function AddStock({ onClose, onAdd, existing }: { onClose: () => void; onAdd: (s: Stock) => void; existing: string[] }) {
  const [ticker, setTicker] = useState(""); const [name, setName] = useState(""); const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!/^[A-Z.]{1,6}$/.test(t)) return setErr("Enter a valid ticker (e.g. KLAC).");
    if (existing.includes(t)) return setErr(`${t} is already on your watchlist.`);
    onAdd({ ticker: t, name: name.trim() || t, sector: "Awaiting Sheet sync", row: 0, price: null, intrinsicValue: null, aggregate: null, confidence: "Not in the Sheet yet", scores: {}, summary: "", change1d: 0, spark: [], pending: true });
  };
  return (
    <Modal onClose={onClose}>
      <h3>Add a stock</h3>
      <p className="muted small">Add the ticker to the Results tab of your Sheet too; it's scored on the next sync.</p>
      <form onSubmit={submit} className="form">
        <label>Ticker<input autoFocus value={ticker} onChange={(e) => { setTicker(e.target.value); setErr(""); }} placeholder="KLAC" /></label>
        <label>Company name <span className="muted">(optional)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="KLA Corp" /></label>
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
      <p className="muted small">{stocks.map((s) => s.ticker).join(" · ")}</p>
      <h4 className="label">Voice</h4>
      <div className="voices">{VOICES.map((v) => <button key={v.id} className={`voice ${voice === v.id ? "on" : ""}`} onClick={() => setVoice(v.id)}><b>{v.name}</b><span className="muted small">{v.style}</span></button>)}</div>
      <h4 className="label">Script <span className="muted small">editable</span></h4>
      <textarea className="script" value={script} onChange={(e) => setScript(e.target.value)} rows={10} />
      {audio && <audio controls src={audio} className="player" autoPlay />}
      {msg && <div className="neg small">{msg}</div>}
      <div className="row">
        {audio && <a className="btn ghost" href={audio} download="sift-podcast.mp3">Download MP3</a>}
        <button className="btn primary" onClick={generate} disabled={state === "loading"}>{state === "loading" ? "Generating…" : audio ? "Regenerate" : "Generate audio"}</button>
      </div>
    </Modal>
  );
}

// ---------- Ask Sift ----------
const LEVELS = [
  { id: "quick", label: "Quick", hint: "Fastest, short answers" },
  { id: "balanced", label: "Balanced", hint: "Good mix of speed and depth" },
  { id: "deep", label: "Deep", hint: "Slowest, most thorough" },
] as const;
const SUGGESTED = [
  "Which stocks are below their Buffett value?",
  "Compare CEO approval across my list",
  "Who has the widest moat and who are their competitors?",
  "Where is Congress net buying?",
];
type AiResult = { answer?: string; model?: string; level?: string; ms?: number; prism_trace?: string; error?: string };
function AskBar({ stocks }: { stocks: Stock[] }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("balanced");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiResult | null>(null);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ(question); setBusy(true); setRes(null);
    const dashboard = stocks.map(({ spark, demoScores, change1d, trendOdds, ceoPromise, comp30d, ...s }) => ({ ...s, note: "From the Google Sheet (real). Demo-only fields removed." }));
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, level, dashboard }) });
      setRes(await r.json());
    } catch { setRes({ error: "Sift didn't respond. Try again." }); }
    setBusy(false);
  };
  return (
    <section className="askbar">
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="ask-form">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Sift anything about your watchlist" aria-label="Ask Sift" />
        <div className="levels" role="radiogroup" aria-label="Answer depth">
          {LEVELS.map((l) => <button type="button" key={l.id} role="radio" aria-checked={level === l.id} title={l.hint} className={level === l.id ? "on" : ""} onClick={() => setLevel(l.id)}>{l.label}</button>)}
        </div>
        <button className="btn primary" disabled={busy}>{busy ? "Thinking…" : "Ask"}</button>
      </form>
      {!res && !busy && <div className="suggest">{SUGGESTED.map((x) => <button key={x} onClick={() => ask(x)}>{x}</button>)}</div>}
      {busy && <div className="answer muted">Working on it at {LEVELS.find((l) => l.id === level)?.label} depth…</div>}
      {res && (
        <div className="answer">
          {res.error ? <span className="neg">{res.error}</span> : <>
            <div className="md" dangerouslySetInnerHTML={{ __html: md(res.answer ?? "") }} />
            <div className="muted small">{res.level && LEVELS.find((l) => l.id === res.level)?.label} · {res.model} · {res.ms ? (res.ms / 1000).toFixed(1) + "s" : ""} · PRISM trace: <b className={res.prism_trace === "sent" ? "pos" : ""}>{res.prism_trace}</b> · Information, not investment advice.</div>
          </>}
          <button className="btn ghost clear" onClick={() => { setRes(null); setQ(""); }}>Clear</button>
        </div>
      )}
    </section>
  );
}

// ---------- PRISM ----------
type AskResult = { answer?: string; prism_trace?: string; model?: string; error?: string };
function Prism({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setQ(question); setBusy(true); setRes(null);
    try { const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }); setRes(await r.json()); }
    catch { setRes({ error: "The analyst didn't respond. Try again." }); }
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
        <div className="panel"><h4>Guardrails</h4>
          <ul className="news">{GUARDRAILS.map((g) => <li key={g.rule}><span className={`dot dot-${g.status === "pass" ? "Positive" : "Neutral"}`} /><div>{g.rule}<div className="muted small">{g.status === "pass" ? "Passing" : "1 open fix"}</div></div></li>)}</ul>
        </div>
        <div className="panel"><h4>Test history</h4>
          <table className="tbl"><thead><tr><th>Run</th><th>Passed</th><th>Flagged / fix</th></tr></thead>
            <tbody>{PRISM_RUNS.map((r) => <tr key={r.run}><td className="mono">{r.run}</td><td className="mono">{r.passed}/{r.total}</td><td className="small">{r.flagged}<div className="muted">{r.fixed}</div></td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="panel future">
        <h4>Ask the analyst <span className="muted small">answers from SEC filings, traced to PRISM</span></h4>
        <form className="askrow" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What was Micron's revenue in its latest fiscal year?" />
          <button className="btn primary" disabled={busy}>{busy ? "Asking…" : "Ask"}</button>
        </form>
        {res && <div className="answer">{res.error ? <span className="neg">{res.error}</span> : <>
          <div className="md" dangerouslySetInnerHTML={{ __html: md(res.answer ?? "") }} />
          <div className="muted small">PRISM trace: <b className={res.prism_trace === "sent" ? "pos" : ""}>{res.prism_trace ?? "—"}</b>{res.model ? ` · ${res.model}` : ""} · Information, not investment advice.</div>
        </>}</div>}
        <h4 className="label">Test questions</h4>
        <div className="checks">{CHECKLIST.map((c) => <button key={c.q} className="check-q" onClick={() => ask(c.q)}><span>{c.q}</span><span className="muted small">Expect: {c.expect}</span></button>)}</div>
      </div>
      <div className="d-foot"><span className="muted small">PRISM by Block Convey</span></div>
    </Modal>
  );
}

// ---------- Survey employees (simulation) ----------
type SQ = { id: string; type?: string; text: string; safe: boolean; rule_check?: string; ai_review?: string; reason?: string };
type Recipient = { id: string; name: string; email: string; former_role: string; left_company_in: number; email_status: string; survey_status: string; payout_status: string; payout_amount: number };
type SurveyRes = {
  mode?: string; notice?: string; error?: string;
  request?: { ticker: string; company: string; count: number; payment_usd: number };
  questions?: { source: string; model?: string; prism_trace?: string; approved: SQ[]; all_generated?: SQ[] };
  email_preview?: { subject: string; body: string };
  recipients?: Recipient[];
  totals?: { invited: number; completed: number; response_rate: number; payout_total: number; max_cost_if_all_complete: number };
  steps?: { step: number; name: string; status: string; detail: string }[];
};
const NOTICE = "Sample data. No real person was contacted and no money moved.";

function Survey({ stocks, ticker, setTicker }: { stocks: Stock[]; ticker: string; setTicker: (t: string) => void }) {
  const [count, setCount] = useState<20 | 50 | 200>(20);
  const [payment, setPayment] = useState(50);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SurveyRes | null>(null);
  const [page, setPage] = useState(0);
  const company = stocks.find((s) => s.ticker === ticker)?.name;
  const pay = Math.min(500, Math.max(0, Number.isFinite(payment) ? payment : 0));
  const run = async () => {
    setBusy(true); setRes(null); setPage(0);
    try {
      const qs = new URLSearchParams({ ticker, count: String(count), payment: String(pay), ...(company ? { company } : {}) });
      const r = await fetch(`/api/survey?${qs}`);
      setRes(await r.json());
    } catch { setRes({ error: "The survey service didn't respond. Try again." }); }
    setBusy(false);
  };
  const blocked = res?.questions?.all_generated?.filter((q) => q.safe === false) ?? [];
  const per = 20, rows = res?.recipients ?? [], pages = Math.ceil(rows.length / per);
  const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="survey">
      <div className="sim-banner" role="status">{res?.notice ?? NOTICE}</div>
      <div className="survey-head">
        <h2>Survey employees <span className="tag-gray demo-tag">simulation</span></h2>
        <p className="muted small">Asks former employees about their own past experience: culture, management, tools, workload, growth. Never current employees, never financials, customers, plans or the stock.</p>
      </div>

      <div className="panel setup">
        <div className="setup-grid">
          <label className="field">Company
            <select value={ticker} onChange={(e) => { setTicker(e.target.value); setRes(null); }}>
              {stocks.filter((s) => !s.pending).map((s) => <option key={s.ticker} value={s.ticker}>{s.name} ({s.ticker})</option>)}
            </select>
          </label>
          <div className="field">People to survey
            <div className="seg">{([20, 50, 200] as const).map((n) => <button key={n} type="button" className={count === n ? "on" : ""} onClick={() => setCount(n)}>{n}</button>)}</div>
          </div>
          <label className="field">Thank-you payment per completed survey ($)
            <input type="number" min={0} max={500} value={payment} onChange={(e) => setPayment(Number(e.target.value))} />
            <span className="muted small">If everyone completes it: {usd0(count * pay)}</span>
          </label>
          <button className="btn primary run" onClick={run} disabled={busy}>{busy ? "Running…" : "Run survey (simulation)"}</button>
        </div>
      </div>

      {busy && <div className="answer muted">Writing questions, running safety checks and building the sample list. This takes 3 to 10 seconds…</div>}
      {res?.error && <div className="answer neg">{res.error}</div>}

      {res && !res.error && <>
        {res.steps && (
          <div className="steps">{res.steps.map((s) => (
            <div key={s.step} className="step">
              <div className="step-top"><span className="mono muted">{s.step}</span><b>{s.name}</b><span className={`tag-${s.status === "done" ? "green" : s.status === "fallback" ? "yellow" : "gray"}`}>{s.status}</span></div>
              <div className="muted small">{s.detail}</div>
            </div>
          ))}</div>
        )}

        <div className="d-grid two">
          <div className="panel">
            <h4>Questions <span className="muted small">{res.questions?.approved.length ?? 0} approved</span></h4>
            {res.questions?.source?.startsWith("fallback") && <div className="small warn">AI was unavailable or its questions did not pass, so the hand-written safe set is shown.</div>}
            <ul className="qlist">{res.questions?.approved.map((q) => (
              <li key={q.id}><div className="q-top"><span>{q.text}</span><span className="tag-green">Passed</span></div>
                <div className="muted small">Rules: {q.rule_check ?? "passed"} · AI review: {q.ai_review ?? "—"}</div></li>
            ))}</ul>
            {blocked.length > 0 && <>
              <h4 className="label">Blocked</h4>
              <ul className="qlist">{blocked.map((q) => (
                <li key={q.id} className="blocked"><div className="q-top"><s>{q.text}</s><span className="tag-red">Blocked</span></div>
                  <div className="muted small">Rules: {q.rule_check ?? "—"} · AI review: {q.ai_review ?? q.reason ?? "—"}</div></li>
              ))}</ul>
            </>}
            <p className="muted small q-foot">Written by AI through Nicrron ({res.questions?.model ?? "model"}). Checked by code rules and a second AI review. Both AI calls are recorded in PRISM. PRISM trace: <b className={res.questions?.prism_trace === "sent" ? "pos" : ""}>{res.questions?.prism_trace ?? "—"}</b></p>
          </div>
          <div className="panel">
            <h4>Email preview <span className="muted small">would be sent, not sent</span></h4>
            {res.email_preview && <div className="mailbox"><div className="mail-subj"><span className="muted small">Subject</span><b>{res.email_preview.subject}</b></div><pre className="mail-body">{res.email_preview.body}</pre></div>}
          </div>
        </div>

        {res.totals && (
          <div className="summary totals">
            <div className="stat"><label>Invited</label><b>{res.totals.invited}</b></div>
            <div className="stat"><label>Completed</label><b>{res.totals.completed}</b></div>
            <div className="stat"><label>Response rate</label><b>{Math.round(res.totals.response_rate * 100)}%</b></div>
            <div className="stat"><label>Payout total (simulated)</label><b>{usd0(res.totals.payout_total)}</b></div>
            <div className="stat"><label>Maximum cost</label><b>{usd0(res.totals.max_cost_if_all_complete)}</b></div>
          </div>
        )}

        <div className="panel">
          <h4>Recipients <span className="muted small">{rows.length} sample people · emails end in .example and can't receive mail</span></h4>
          <div className="scroll">
            <table className="tbl rtbl"><thead><tr><th>Name</th><th>Email</th><th>Former role</th><th>Left in</th><th>Email</th><th>Survey</th><th>Payout (simulated)</th></tr></thead>
              <tbody>{rows.slice(page * per, page * per + per).map((r) => (
                <tr key={r.id}><td>{r.name} <span className="tag-gray demo-tag">Sample</span></td><td className="mono small">{r.email}</td><td>{r.former_role}</td><td className="mono">{r.left_company_in}</td>
                  <td className="small">{r.email_status}</td><td className="small">{r.survey_status}</td><td className="small">Meow payout, simulated · {usd0(r.payout_amount)}</td></tr>
              ))}</tbody></table>
          </div>
          {pages > 1 && <div className="pager"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="muted small">Page {page + 1} of {pages}</span><button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>}
        </div>
      </>}
    </section>
  );
}
