const mongoose = require("mongoose");

// Leave Transactions (collection: leave_transactions).
//
// The redesigned leave record. Every approved/recorded leave is ONE immutable
// transaction that (a) debits the matching leave_balances row and (b) — for
// backward compatibility — is mirrored into the legacy `leave_mgmt` collection
// so the existing attendance-marking cron and month-wise report keep working
// untouched (`legacyLeaveId` links the two so a delete can reverse both).
//
// `month` and `year` are denormalised from `fromDate` on purpose: they make the
// monthly/yearly statistics and the FUTURE salary roll-up a single indexed
// group-by, with no date-math in the aggregation. `isPaid` and `leaveTypeName`
// are snapshotted from the leave type at record time so history (and salary)
// stay correct even if the type's policy is edited later — the same immutable-
// history rationale the OT module already uses.
const leaveTransactionSchema = new mongoose.Schema(
  {
    empId: { type: Number, required: true, index: true },

    leaveTypeCode: { type: String, required: true, uppercase: true, trim: true },
    leaveTypeName: { type: String, default: "" }, // snapshot (selected category)
    // "Others" (req 2): a per-record custom leave name that belongs ONLY to this
    // transaction. It is NOT a system leave type and never touches any balance.
    // When set, it is what every view/report/export shows in place of "Others".
    customLeaveName: { type: String, default: "" },
    isPaid: { type: Boolean, default: true }, // snapshot — salary-facing

    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },

    // Number of leave days this transaction consumes. Supports 0.5 for a
    // half-day. Kept as the authoritative count used to debit the balance.
    days: { type: Number, required: true, min: 0 },

    // Deduction breakdown (req 4/5/8) — how `days` was funded, CL first then
    // Comp Off, snapshotted at record time so history/exports are immutable and
    // always agree with what was shown on submit. For "Others" these are all 0
    // (informational leave, no balance impact).
    clUsed: { type: Number, default: 0 },
    compUsed: { type: Number, default: 0 },
    // Days beyond CL + Comp Off — the unfunded "negative balance" (req 6). >= 0.
    lopDays: { type: Number, default: 0 },
    // CL / Comp Off remaining AFTER this deduction (snapshot for the breakdown).
    remainingCl: { type: Number, default: 0 },
    remainingComp: { type: Number, default: 0 },

    // Derived from fromDate — 1..12 and full year. Indexed for stats/salary.
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // FULL DAY / FIRST HALF / SECOND HALF — kept for parity with the legacy
    // form and to explain a 0.5-day transaction.
    dayType: { type: String, default: "FULL DAY" },
    shiftType: { type: String, default: "" },

    reason: { type: String, default: "" },

    // Link back to the mirrored legacy leave_mgmt document (compat bridge).
    legacyLeaveId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { versionKey: false, timestamps: true } // createdAt == "Created Date"
);

// Primary reporting/stats access pattern: an employee's leaves within a period.
leaveTransactionSchema.index({ empId: 1, year: 1, month: 1 });
leaveTransactionSchema.index({ year: 1, month: 1 });

module.exports = mongoose.model(
  "leaveTransaction",
  leaveTransactionSchema,
  "leave_transactions"
);
