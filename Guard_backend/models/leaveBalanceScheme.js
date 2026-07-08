const mongoose = require("mongoose");

// Leave Balances (collection: leave_balances) — REDESIGNED.
//
// ONE document per (employee, year). All of an employee's per-type balances live
// inside a single `types` object keyed by leave-type code:
//
//   { empId: 309, year: 2026, types: {
//       CL:  { allocated: 12, used: 3 },
//       SUM: { allocated: 4,  used: 2 },
//       HOL: { allocated: 4,  used: 1 },
//       SPL: { allocated: 6,  used: 1 },
//   } }
//
// This replaces the previous one-document-per-type layout (which produced 4+
// docs per employee/year). `remaining` is always derived (allocated - used),
// never stored, so it can't drift.
//
// `types` is a Mixed object (not a typed sub-schema) specifically so atomic
// dotted updates — `$inc: { "types.CL.used": 1 }`, `$set: { "types.CL.allocated"
// : 12 }` — apply cleanly at the Mongo layer without per-key casting. All writes
// go through leaveBalanceController (updateOne/bulkWrite), never doc.save(), so
// no markModified is needed.
const leaveBalanceSchema = new mongoose.Schema(
  {
    empId: { type: Number, required: true, index: true },
    year: { type: Number, required: true, index: true },
    // { <TYPE_CODE>: { allocated: Number, used: Number } }
    types: { type: Object, default: {} },
  },
  {
    versionKey: false,
    timestamps: true,
    minimize: false, // keep an empty {} types object rather than dropping it
  }
);

// One balance document per employee per year (the whole point of the redesign).
leaveBalanceSchema.index({ empId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model(
  "leaveBalance",
  leaveBalanceSchema,
  "leave_balances"
);
