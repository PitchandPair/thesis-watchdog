// Reddit: trending posts about a company. Needs a free Reddit API app (client id + secret).
import { ask, hasModelKey } from "./llm.js";

const UA = "web:stock-scorecard:1.0 (hackathon research tool)";
export const hasRedditKey = () => Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

let token = null;
async function getToken() {
  if (token && Date.now() < token.expires) return token.value;
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Reddit login failed (${res.status})`);
  token = { value: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return token.value;
}

async function api(path) {
  const res = await fetch("https://oauth.reddit.com" + path, {
    headers: { Authorization: `Bearer ${await getToken()}`, "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Reddit returned ${res.status}`);
  return res.json();
}

const subCache = new Map();

// The AI suggests subreddits for the company. Each suggestion is then checked against Reddit
// itself, so a made-up name is never used.
export async function findSubreddit(ticker, name) {
  if (subCache.has(ticker)) return subCache.get(ticker);
  let result = { subreddit: null, foundBy: "No company subreddit found. Searched r/stocks, r/wallstreetbets and r/investing instead." };
  if (hasModelKey()) {
    try {
      const { text } = await ask({
        system:
          'You name Reddit communities. Reply with JSON only: an array of up to 3 subreddit names (no "r/") that are dedicated to the given company or its stock. If you are not sure one exists, reply [].',
        user: `Company: ${name || ticker} (ticker ${ticker})`,
        sessionId: `subreddit-${ticker}`,
      });
      const names = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)).slice(0, 3);
      let best = null;
      for (const n of names) {
        if (!/^[A-Za-z0-9_]{2,21}$/.test(String(n))) continue;
        try {
          const about = (await api(`/r/${n}/about`))?.data;
          if (about && !about.over18 && about.subscribers >= 2000 && (!best || about.subscribers > best.subscribers)) {
            best = { name: about.display_name, subscribers: about.subscribers };
          }
        } catch {
          // suggestion does not exist: skip it
        }
      }
      if (best) {
        result = { subreddit: best.name, foundBy: `AI suggested, confirmed on Reddit (${best.subscribers.toLocaleString("en-US")} members)` };
      }
    } catch {
      // fall back to the general search below
    }
  }
  subCache.set(ticker, result);
  return result;
}

// Trending ("hot") posts only, to keep the number of data pulls small.
export async function trendingPosts(ticker, name, limit = 5) {
  const { subreddit, foundBy } = await findSubreddit(ticker, name);
  const path = subreddit
    ? `/r/${subreddit}/hot?limit=${limit + 3}`
    : `/r/stocks+wallstreetbets+investing/search?q=${encodeURIComponent(`${ticker} OR "${name || ticker}"`)}&restrict_sr=1&sort=hot&t=week&limit=${limit}`;
  const json = await api(path);
  const posts = (json?.data?.children || [])
    .map((c) => c.data)
    .filter((p) => !p.stickied)
    .slice(0, limit)
    .map((p) => ({
      title: p.title,
      subreddit: p.subreddit,
      upvotes: p.score,
      comments: p.num_comments,
      published: new Date(p.created_utc * 1000).toISOString().slice(0, 10),
      url: "https://www.reddit.com" + p.permalink,
    }));
  return { posts, foundBy };
}
