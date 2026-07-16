// AUDIT-ONLY seeder: creates employees 90001..90009 (A..I) with varied weekly
// offs, so the final verification can exercise leave/OT/OD/reports against a
// local DB. Idempotent: clears its own employees + their child records first.
// Leave/OT/OD are created via the real API by the audit driver, not here.
require("dotenv").config();
const mongoose = require("mongoose");
const employe = require("../models/profileScheme");
const Roster = require("../models/rosterScheme");
const LeaveTransaction = require("../models/leaveTransactionScheme");
const Leave = require("../models/leaveScheme");
const LeaveBalance = require("../models/leaveBalanceScheme");
const Od = require("../models/odScheme");
const Ot = require("../models/otScheme");

const wk = (off) => {
  const base = { sunday: "General", monday: "General", tuesday: "A Shift", wednesday: "B Shift", thursday: "C Shift", friday: "General", saturday: "General" };
  off.forEach((d) => (base[d] = "WEEK OFF"));
  return base;
};

// A..I — 90001..90009. weeklyOff configs vary to test §Do-not-hardcode-weekday.
const EMPS = [
  { empId: 90001, empName: "AUDIT A NoLeaveNoOtNoOd", off: ["sunday"] },
  { empId: 90002, empName: "AUDIT B ClAndOt", off: ["sunday"] },
  { empId: 90003, empName: "AUDIT C NoClOtAvail", off: ["saturday", "sunday"] },
  { empId: 90004, empName: "AUDIT D NoClNoOt", off: ["friday"] },
  { empId: 90005, empName: "AUDIT E OthersLeave", off: ["sunday"] },
  { empId: 90006, empName: "AUDIT F MultiLeaveTypes", off: ["sunday"] },
  { empId: 90007, empName: "AUDIT G MultiOt", off: ["sunday"] },
  { empId: 90008, empName: "AUDIT H MultiOd", off: ["saturday", "sunday"] },
  { empId: 90009, empName: "AUDIT I LeaveOtOd", off: ["sunday"] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ids = EMPS.map((e) => e.empId);
  const codes = ids.map(String);

  // Clean prior audit data (only our id range).
  await Promise.all([
    employe.deleteMany({ empId: { $in: ids } }),
    Roster.deleteMany({ empId: { $in: codes } }),
    LeaveTransaction.deleteMany({ empId: { $in: ids } }),
    Leave.deleteMany({ empId: { $in: ids } }),
    LeaveBalance.deleteMany({ empId: { $in: ids } }),
    Od.deleteMany({ empId: { $in: ids } }),
    Ot.deleteMany({ employeeId: { $in: ids } }),
  ]);

  for (const e of EMPS) {
    await employe.create({
      empId: e.empId, empName: e.empName,
      empDesignation: "Security Guard", empDepartment: "Security", isActive: true,
    });
    await Roster.create({
      empId: String(e.empId), empName: e.empName,
      department: "Security", designation: "Security Guard",
      weeklyShifts: wk(e.off),
    });
  }

  console.log(`Seeded ${EMPS.length} audit employees: ${ids.join(", ")}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
