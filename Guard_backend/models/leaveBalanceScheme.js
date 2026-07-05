const mongoose = require("mongoose");

// Leave Balances (collection: leave_balances).
//
// One row per (employee, year, leaveType). This is the running ledger head:
//   allocated  – granted for the year (yearly allocation / policy)
//   used       – consumed so far (auto-maintained by the transaction controller)
//   remaining  – VIRTUAL, always allocated - used (never stored, never stale)
//
// Relationship: `empId` is the same Number identifier used by the employee
// master (securitydetails.empId) — we do NOT copy any employee attributes here,
// names/departments are always resolved from the master at read time.
//
// Yearly tracking falls out naturally from the `year` field: querying a year
// gives that year's allocation/usage; a new year simply gets new rows. Summing
// a year's rows for an employee yields the "Allocated 24 / Used 9 / Remaining
// 15" headline.
const leaveBalanceSchema = new mongoose.Schema(
  {
    empId: { type: Number, required: true, index: true },
    year: { type: Number, required: true, index: true },
    leaveTypeCode: { type: String, required: true, uppercase: true, trim: true },

    allocated: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0, min: 0 },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Remaining is derived, never persisted — so it can never drift from used.
leaveBalanceSchema.virtual("remaining").get(function () {
  return (this.allocated || 0) - (this.used || 0);
});

// One balance row per employee/year/type — makes upserts safe and prevents
// duplicate ledgers (a gap called out in the audit).
leaveBalanceSchema.index(
  { empId: 1, year: 1, leaveTypeCode: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "leaveBalance",
  leaveBalanceSchema,
  "leave_balances"
);
