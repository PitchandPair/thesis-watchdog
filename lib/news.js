// Raw news and Reddit feeds. No scoring here: the Sheet (and later the AI) does that.
const UA = "StockScorecard/1.0 (hackathon research tool)";

const decode = (s = "") =>
  s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();

const pick = (xml, tag) => decode((xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]);

// Latest headlines from Google News (public RSS feed, no key needed).
export async function headlines(ticker, name, limit = 5) {
  const q = encodeURIComponent(`${name || ticker} stock`);
  const url = `https://news.google.com/rss/search?q=${q}+when:7d&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News returned ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map((m) => ({
    title: pick(m[1], "title"),
    source: pick(m[1], "source"),
    published: (pick(m[1], "pubDate") || "").replace(/,/g, ""),
    url: pick(m[1], "link"),
  }));
}

// Latest Reddit posts that mention the ticker (public search feed, no key needed).
export async function redditPosts(ticker, limit = 5) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent("$" + ticker + " OR " + ticker + " stock")}&sort=new&t=week&limit=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Reddit returned ${res.status}`);
  const json = await res.json();
  return (json?.data?.children || []).map((c) => ({
    title: c.data.title,
    subreddit: c.data.subreddit,
    upvotes: c.data.score,
    comments: c.data.num_comments,
    published: new Date(c.data.created_utc * 1000).toISOString().slice(0, 10),
    url: "https://www.reddit.com" + c.data.permalink,
  }));
}
