// Moat and competitor structure. This is one-time research: the answer rarely changes,
// so it is run once on a stronger model through Nicrron and the result is stored in the Sheet.
// The AI only gives labels and reasons. The Sheet turns labels into scores with editable rules.
import { ask } from "./llm.js";
import { resolveCompany } from "./sec.js";

export const MOAT_MODEL = () => process.env.NICRRON_RESEARCH_MODEL || "anthropic/claude-opus-5-5";

export const MOAT_RULES = `You classify one public company's competitive position for a personal research sheet.
Use your general knowledge of the industry. Be conservative.
Rules:
1. moat = how hard the core business is to copy: "wide" (very hard, lasting advantage), "narrow" (some advantage), "none" (easily copied).
2. market_structure = for the company's MAIN product line: "monopoly" (one real supplier), "duopoly" (two), "oligopoly" (three to five), "many competitors" (more than five).
3. main_competitors = up to 4 real company names, or "none" for a monopoly.
4. If you do not know the company well enough, use "unsure" for both labels and say why. Never guess.
5. confidence = "high", "medium" or "low" in your own answer.
6. Never give investment advice and never mention the share price.
Reply with JSON only:
{"moat":"wide|narrow|none|unsure","moat_reason":"max 22 words","market_structure":"monopoly|duopoly|oligopoly|many competitors|unsure","main_competitors":"names","structure_reason":"max 22 words","confidence":"high|medium|low"}`;

const MOATS = ["wide", "narrow", "none", "unsure"];
const STRUCTURES = ["monopoly", "duopoly", "oligopoly", "many competitors", "unsure"];

// Turns the model's reply into a clean row. Anything unreadable becomes "unsure". Exported for tests.
export function parseMoat(text) {
  let p = {};
  try {
    p = JSON.parse(String(text).slice(String(text).indexOf("{"), String(text).lastIndexOf("}") + 1));
  } catch {
    p = {};
  }
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  return {
    moat: MOATS.includes(p.moat) ? p.moat : "unsure",
    moatReason: clean(p.moat_reason) || "The model reply could not be read.",
    structure: STRUCTURES.includes(p.market_structure) ? p.market_structure : "unsure",
    competitors: clean(p.main_competitors),
    structureReason: clean(p.structure_reason),
    confidence: ["high", "medium", "low"].includes(p.confidence) ? p.confidence : "low",
  };
}

export async function researchMoat(ticker) {
  const co = await resolveCompany(ticker).catch(() => null);
  const name = co?.name || ticker;
  const { text, model, prism } = await ask({
    system: MOAT_RULES,
    user: `Company: ${name} (ticker ${ticker})`,
    model: MOAT_MODEL(),
    sessionId: `moat-${ticker}`,
    traceInput: `Classify the moat and market structure of ${name} (${ticker}).`,
  });
  return { ticker, name, ...parseMoat(text), model, prism };
}
