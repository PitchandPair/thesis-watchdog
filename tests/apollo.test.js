import { test } from "node:test";
import assert from "node:assert/strict";
import { formerEmployeeFacts, COMPANY_DOMAINS } from "../lib/apollo.js";

const co = COMPANY_DOMAINS.NVDA;
const today = new Date("2026-11-21");

test("apollo: someone who left over 12 months ago is marked yes, with the year", () => {
  const p = { organization: { name: "Other Co" }, employment_history: [{ organization_name: "NVIDIA", title: "Engineer", start_date: "2019-01-01", end_date: "2024-06-01", current: false }, { organization_name: "Other Co", title: "Lead", start_date: "2024-06-01", end_date: null, current: true }] };
  const f = formerEmployeeFacts(p, co, today);
  assert.deepEqual([f.worked, f.stillThere, f.leftDate, f.lastTitle, f.over12Months], [true, false, "2024-06-01", "Engineer", "yes"]);
});

test("apollo: a recent leaver or a current employee is marked no", () => {
  const recent = { organization: { name: "Other Co" }, employment_history: [{ organization_name: "NVIDIA", title: "PM", end_date: "2026-05-01", current: false }] };
  assert.equal(formerEmployeeFacts(recent, co, today).over12Months, "no");
  const current = { organization: { name: "NVIDIA" }, employment_history: [{ organization_name: "NVIDIA", title: "PM", end_date: null, current: true }] };
  assert.equal(formerEmployeeFacts(current, co, today).over12Months, "no");
});

test("apollo: a missing leave date stays unknown, never guessed", () => {
  const p = { organization: { name: "Other Co" }, employment_history: [{ organization_name: "NVIDIA", title: "PM", end_date: null, current: false }] };
  assert.equal(formerEmployeeFacts(p, co, today).over12Months, "unknown");
  assert.equal(formerEmployeeFacts({ employment_history: [] }, co, today).worked, false);
});
