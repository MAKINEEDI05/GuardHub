// Centralized leave-deduction policy — the SINGLE source of truth for how a
// leave's days are funded (req 4/5/6/7/10). Every leave EXCEPT "Others" draws
// from Casual Leave (CL) first, then Comp Off (COMP). Any remainder beyond both
// is an unfunded "negative balance" (LOP) — it is recorded but never pushes a
// bucket below zero. Comp Off is earned from OT (see leaveBalanceController).
//
// The frontend mirrors this exact algorithm in GuardHub_Next/src/utils/
// leaveDeduction.js for the live pre-submit breakdown — keep the two in lock-step.

const CL_CODE = "CL";
const COMP_CODE = "COMP";
const OTHERS_CODE = "OTHERS";

// Round to 2 dp so 0.5-step math never drifts on floats.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Split `days` across CL then Comp Off given each bucket's current remaining.
// Neither bucket is driven below 0; the leftover is the negative/LOP figure.
//   -> { clUsed, compUsed, lopDays, remainingCl, remainingComp, negativeBalance }
function computeDeduction(days, clRemaining, compRemaining) {
  const d = round2(days);
  const clAvail = Math.max(0, round2(clRemaining));
  const compAvail = Math.max(0, round2(compRemaining));

  const clUsed = round2(Math.min(d, clAvail));
  const afterCl = round2(d - clUsed);
  const compUsed = round2(Math.min(afterCl, compAvail));
  const lopDays = round2(afterCl - compUsed); // unfunded days (>= 0)

  return {
    clUsed,
    compUsed,
    lopDays,
    remainingCl: round2(clAvail - clUsed),
    remainingComp: round2(compAvail - compUsed),
    negativeBalance: lopDays > 0 ? round2(-lopDays) : 0,
  };
}

// Trim + collapse whitespace + Title-Case a custom "Others" leave name.
//   "  marriage leave " -> "Marriage Leave"
function normalizeCustomLeaveName(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// Validate + normalize a custom leave name. Returns { ok, value?, message? }.
// Rules (req 2): required, not only whitespace, max 100 chars, auto Title-Case.
function validateCustomLeaveName(raw) {
  const value = normalizeCustomLeaveName(raw);
  if (!value) return { ok: false, message: "Leave name is required." };
  if (value.length > 100) {
    return { ok: false, message: "Leave name must be 100 characters or fewer." };
  }
  return { ok: true, value };
}

module.exports = {
  CL_CODE,
  COMP_CODE,
  OTHERS_CODE,
  round2,
  computeDeduction,
  normalizeCustomLeaveName,
  validateCustomLeaveName,
};
