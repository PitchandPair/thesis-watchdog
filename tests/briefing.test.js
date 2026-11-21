import test from "node:test";
import assert from "node:assert/strict";
import { parseRows, tableText, BRIEFING_RULES } from "../lib/briefing.js";
import { parseMoat } from "../lib/moat.js";

test("parseRows reads what the Sheet sends", () => {
  const rows = parseRows("NVDA~125.53~101.55~0.24~4.3~Medium~4~5~5~wide~oligopoly_INTC~51.28~no data~no data~5.2~Low~3~~6~~");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ticker, "NVDA");
  assert.equal(rows[0].moat, "wide");
  assert.equal(rows[1].congress_score, "no data");
});

test("tableText says above or below value, and admits a missing estimate", () => {
  const t = tableText(parseRows("MU~594~1188~-0.5~7~Medium~6~4~6~narrow~oligopoly_INTC~51~no data~no data~5~Low~3~5~6~narrow~oligopoly"));
  assert.match(t, /MU: price 594, -?50% below its Buffett-style value/);
  assert.match(t, /INTC: price 51, no value estimate/);
});

test("briefing rules forbid advice words", () => {
  assert.match(BRIEFING_RULES, /Never say buy, sell, hold/);
});

test("parseMoat falls back to unsure on an unreadable reply", () => {
  const m = parseMoat("sorry, I cannot");
  assert.equal(m.moat, "unsure");
  assert.equal(m.structure, "unsure");
  assert.equal(m.confidence, "low");
});

test("parseMoat keeps valid labels", () => {
  const m = parseMoat('{"moat":"wide","moat_reason":"x","market_structure":"duopoly","main_competitors":"A, B","structure_reason":"y","confidence":"high"}');
  assert.equal(m.moat, "wide");
  assert.equal(m.structure, "duopoly");
});
