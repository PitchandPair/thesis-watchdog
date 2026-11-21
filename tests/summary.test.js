import test from "node:test";
import assert from "node:assert/strict";
import { factSheet, SUMMARY_RULES } from "../lib/summary.js";

test("fact sheet says so when there is no annual report", () => {
  const s = factSheet("SPCX", { status: "no data", gap: "No annual report in SEC data yet." }, [], []);
  assert.match(s, /Annual report: none in SEC data/);
  assert.match(s, /Recent official 8-K filings: none found/);
  assert.match(s, /Recent headlines: none found/);
});

test("fact sheet lists filings and headlines it was given", () => {
  const s = factSheet("SPCX", { status: "no data" }, [{ filed: "2026-11-01", itemNames: "Earnings results" }], [{ title: "A headline" }]);
  assert.match(s, /2026-11-01: Earnings results/);
  assert.match(s, /A headline/);
});

test("summary rules forbid advice words", () => {
  assert.match(SUMMARY_RULES, /Never say buy, sell, hold/);
});
