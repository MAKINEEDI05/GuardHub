// Client mirror of the backend leave-deduction policy
// (Guard_backend/utils/leaveDeduction.js) — the SINGLE source of truth for the
// live pre-submit breakdown on Apply/Edit Leave. The backend is authoritative on
// save; this must stay in lock-step with it so the preview matches the result.
//
// Every leave EXCEPT "Others" draws from Casual Leave (CL) first, then Comp Off
// (COMP). Any remainder beyond both is an unfunded "negative balance" (LOP) — it
// is shown/recorded but never pushes a bucket below zero.

export const CL_CODE = "CL";
export const COMP_CODE = "COMP";
export const OTHERS_CODE = "OTHERS";

// Round to 2 dp so 0.5-step math never drifts on floats.
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Split `days` across CL then Comp Off given each bucket's current remaining.
//   -> { clUsed, compUsed, lopDays, remainingCl, remainingComp, negativeBalance }
export function computeDeduction(days, clRemaining, compRemaining) {
  const d = round2(days);
  const clAvail = Math.max(0, round2(clRemaining));
  const compAvail = Math.max(0, round2(compRemaining));

  const clUsed = round2(Math.min(d, clAvail));
  const afterCl = round2(d - clUsed);
  const compUsed = round2(Math.min(afterCl, compAvail));
  const lopDays = round2(afterCl - compUsed);

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
export function normalizeCustomLeaveName(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// Validate + normalize a custom leave name. Returns { ok, value?, message? }.
export function validateCustomLeaveName(raw) {
  const value = normalizeCustomLeaveName(raw);
  if (!value) return { ok: false, message: "Leave name is required." };
  if (value.length > 100) {
    return { ok: false, message: "Leave name must be 100 characters or fewer." };
  }
  return { ok: true, value };
}

// The label to display for a leave record's "Leave Type" everywhere: the custom
// name for an "Others" leave, otherwise the selected category name (req 2).
export function leaveTypeLabel(txn) {
  if (!txn) return "";
  if (String(txn.leaveTypeCode).toUpperCase() === OTHERS_CODE) {
    return txn.customLeaveName || "Others";
  }
  return txn.leaveTypeName || txn.leaveTypeCode || "";
}

// CL / Comp Off remaining read from a leave-balances API payload
// (data[0].byType). remaining = allocated - used. Returns 0 when unknown.
export function balanceRemaining(balData, code) {
  const row = balData?.data?.[0];
  const b = row?.byType?.find((x) => x.leaveTypeCode === code);
  return b ? b.remaining : 0;
}
