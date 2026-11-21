import test from "node:test";
import assert from "node:assert/strict";
import { parseSift, storyFacts, SIFT_RULES } from "../lib/sift.js";

test("parseSift keeps at most three stocks", () => {
  const rows = parseSift("A~Aa~1_B~Bb~2_C~Cc~3_D~Dd~4");
  assert.equal(rows.length, 3);
  assert.equal(rows[2].ticker, "C");
});

test("storyFacts skips lines that have no data", () => {
  const s = parseSift("INTC~Intel Corp~51.28~-0.012~no data~~~narrow~6~x86 ecosystem~duopoly~AMD")[0];
  const t = storyFacts(s, {});
  assert.match(t, /Price: \\$51.28, down 1.2% in the last trading session/);
  assert.doesNotMatch(t, /Buffett/);
  assert.doesNotMatch(t, /Congress/);
  assert.match(t, /Moat: narrow, score 6 out of 10/);
});

test("storyFacts says under or over the value estimate", () => {
  const s = parseSift("MU~Micron~595~0.02~1188~-593~-0.5~narrow~6~r~oligopoly~Samsung")[0];
  assert.match(storyFacts(s), /Price is under the estimate by \\$593 \\(50%\\)/);
});

test("rules forbid advice words and fix the outro", () => {
  assert.match(SIFT_RULES, /Never say buy, sell, hold/);
  assert.match(SIFT_RULES, /information only, not investment advice/);
});
