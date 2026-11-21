import test from "node:test";
import assert from "node:assert/strict";
import { ruleCheck, sampleEmployees, simulateRun, FALLBACK_QUESTIONS, emailPreview } from "../lib/survey.js";

test("rule check blocks non-public topics", () => {
  assert.match(ruleCheck("What was revenue last quarter?"), /financial results/);
  assert.match(ruleCheck("Which customers were about to sign a contract?"), /customers and deals/);
  assert.match(ruleCheck("What unreleased products were on the roadmap?"), /unreleased/);
  assert.match(ruleCheck("Were layoffs planned?"), /corporate actions/);
});

test("every hand-written fallback question passes the rule check", () => {
  for (const q of FALLBACK_QUESTIONS) assert.equal(ruleCheck(q.text), "", q.text);
});

test("sample employees are synthetic, repeatable and use a domain that cannot receive mail", () => {
  const a = sampleEmployees("NVDA", 20);
  const b = sampleEmployees("NVDA", 20);
  assert.equal(a.length, 20);
  assert.deepEqual(a, b);
  for (const p of a) {
    assert.ok(p.email.endsWith(".example"), p.email);
    assert.equal(p.synthetic, true);
  }
  assert.equal(sampleEmployees("NVDA", 200).length, 200);
  assert.equal(sampleEmployees("NVDA", 5000).length, 200);
});

test("simulated run never marks an email as sent or money as moved", () => {
  const run = simulateRun(sampleEmployees("AMD", 50), 25);
  assert.equal(run.totals.invited, 50);
  assert.equal(run.totals.payout_total, run.totals.completed * 25);
  for (const r of run.rows) {
    assert.match(r.email_status, /simulated/);
    if (r.payout_amount) assert.match(r.payout_status, /no money moved/);
  }
});

test("the email warns against sharing confidential information", () => {
  assert.match(emailPreview("Acme", FALLBACK_QUESTIONS, 50).body, /do not share anything confidential/);
});
