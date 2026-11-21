import test from "node:test";
import assert from "node:assert/strict";
import { toRow } from "../lib/glassdoor.js";

test("toRow reads the rating fields", () => {
  const r = toRow({ company: "Acme", ratings_overall: 4.1, ratings_ceo_approval: 0.9, url: "https://www.glassdoor.com/Overview/x" });
  assert.equal(r.company, "Acme");
  assert.equal(r.overall, 4.1);
  assert.equal(r.ceoApproval, 0.9);
});

test("toRow leaves missing fields blank instead of guessing", () => {
  const r = toRow({ company: "Acme" });
  assert.equal(r.overall, "");
  assert.equal(r.ceoApproval, "");
});
