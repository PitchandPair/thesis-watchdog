import { test } from "node:test";
import assert from "node:assert/strict";
import { buffett, graham, piotroski } from "../lib/calc.js";

const f = (value) => ({ value, sourceUrl: "https://example.test/filing" });

const sample = {
  status: "ok",
  latestEnd: "2025-12-31",
  latest: {
    netIncome: f(100), dna: f(20), capex: f(30), dilutedShares: f(10), epsDiluted: f(10),
    equity: f(500), sharesOutstanding: f(10), assets: f(1000), cfo: f(140), revenue: f(800),
    grossProfit: f(400), assetsCurrent: f(300), liabilitiesCurrent: f(100), longTermDebt: f(100),
  },
  prior: {
    netIncome: f(80), assets: f(1000), cfo: f(90), revenue: f(700), grossProfit: f(300),
    assetsCurrent: f(200), liabilitiesCurrent: f(100), longTermDebt: f(150), sharesOutstanding: f(10),
  },
};

test("buffett: owner earnings and intrinsic value match a hand calculation", () => {
  const b = buffett(sample, { growth: 0, discount: 0.1, terminalGrowth: 0, years: 10 });
  assert.equal(b.ownerEarnings, 90);
  // Zero growth: value is a perpetuity of 90 at 10% = 900 total, 90 per share.
  assert.equal(b.intrinsicValuePerShare, 90);
});

test("buffett: reports a gap instead of guessing when data is missing", () => {
  const broken = { ...sample, latest: { ...sample.latest, capex: null } };
  const b = buffett(broken);
  assert.equal(b.status, "no data");
  assert.match(b.gap, /capex/);
});

test("buffett: negative owner earnings gives no value", () => {
  const neg = { ...sample, latest: { ...sample.latest, netIncome: f(-200) } };
  assert.equal(buffett(neg).status, "negative");
});

test("graham number", () => {
  const g = graham(sample);
  // sqrt(22.5 * 10 * 50) = sqrt(11250) = 106.07
  assert.equal(g.grahamNumber, 106.07);
});

test("piotroski: all nine tests pass on the sample", () => {
  const p = piotroski(sample);
  assert.equal(p.testsComputable, 9);
  assert.equal(p.fScore, 9);
});

test("piotroski: counts only computable tests", () => {
  const p = piotroski({ ...sample, prior: {} });
  assert.equal(p.testsComputable, 3);
  assert.match(p.gap, /6 of 9/);
});

test("companies with no SEC data pass the gap through", () => {
  const none = { status: "no data", gap: "Does not file with the SEC." };
  assert.equal(buffett(none).gap, none.gap);
  assert.equal(graham(none).status, "no data");
  assert.equal(piotroski(none).status, "no data");
});
