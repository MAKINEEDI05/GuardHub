const mongoose = require("mongoose");

// Leave Types master (collection: leave_types).
//
// Configurable leave categories (Casual, Special, Summer, Holiday, ...). The
// whole point of this collection is that new categories can be added later
// WITHOUT touching business logic: the transaction/balance code only ever deals
// with a `code` string that it looks up here. `isPaid` is carried so the future
// Salary module can treat unpaid leave (LOP) as a deduction without any schema
// change — Leave already knows which categories cost pay.
const leaveTypeSchema = new mongoose.Schema(
  {
    // Short, stable, upper-case key used as the foreign key everywhere else
    // (leave_balances.leaveTypeCode, leave_transactions.leaveTypeCode).
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    // Human-readable label shown in the UI and snapshotted onto transactions.
    name: { type: String, required: true, trim: true },

    // Default number of days granted per employee per year when a yearly
    // allocation is run. Individual allocations can override this.
    defaultAnnualQuota: { type: Number, default: 0, min: 0 },

    // Paid vs unpaid (Loss Of Pay). Consumed by the future Salary engine.
    isPaid: { type: Boolean, default: true },

    // Soft toggle. Inactive types are hidden from apply forms but keep working
    // for historical records/reports. Delete = deactivate (see controller).
    active: { type: Boolean, default: true },

    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model("leaveType", leaveTypeSchema, "leave_types");
