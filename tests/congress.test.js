import { test } from "node:test";
import assert from "node:assert/strict";
import { buyOrSell, rowsPerTicker, toRow } from "../lib/congress.js";

test("congress: trade types map to buy, sell or other, never guessed", () => {
  assert.equal(buyOrSell("purchase"), "buy");
  assert.equal(buyOrSell("sale"), "sell");
  assert.equal(buyOrSell("sale_partial"), "sell");
  assert.equal(buyOrSell("exchange"), "other");
  assert.equal(buyOrSell(undefined), "other");
});

test("congress: a full refresh stays inside the free daily row budget", () => {
  assert.ok(rowsPerTicker(12, false) * 12 <= 100);
  assert.ok(rowsPerTicker(19, false) * 19 <= 100);
  assert.ok(rowsPerTicker(12, true) * 12 <= 250);
  assert.equal(rowsPerTicker(30, false), 3);
});

test("congress: a source record becomes a sheet row with its link", () => {
  const r = toRow("NVDA", { member: "Jane Doe", chamber: "house", type: "purchase", amount_range: "$1,001 - $15,000", transaction_date: "2026-10-23", disclosure_date: "2026-11-05", filing_portal: "https://example.test/portal" });
  assert.deepEqual(r, { ticker: "NVDA", member: "Jane Doe", chamber: "house", buyOrSell: "buy", amountRange: "$1,001 - $15,000", tradeDate: "2026-10-23", filedDate: "2026-11-05", sourceUrl: "https://example.test/portal" });
});
