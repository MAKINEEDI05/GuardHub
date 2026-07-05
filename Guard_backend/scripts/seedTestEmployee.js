// Seed a complete TEST ENVIRONMENT for one employee named "Test Employee".
//
// Design goals (per the task brief):
//  - Do NOT assume the schema — uses the real models.
//  - Do NOT hardcode the employee id — picks max(empId)+1 (empId is client-
//    supplied in addEmpData, there is no server-side generator).
//  - Reuse "Test Employee" if it already exists; never create a duplicate.
//  - Follow the SAME business logic the controllers use (leave recording reuses
//    utils/leaveDays + the balance ledger helper, so balances stay correct and
//    the legacy leave_mgmt mirror is written for attendance/report compatibility).
//  - Idempotent: on re-run it clears ONLY this test employee's generated child
//    records, then regenerates — so counts never balloon.
//
// Populates: securitydetails, roster_mgmt, empattendances (Day-Wise source),
// secattendancelogs (Month-Wise "present" source), leave_transactions +
// leave_mgmts + leave_balances, od_mgmt, ot_mgmt.
//
//   node scripts/seedTestEmployee.js
//
require("dotenv").config();
const mongoose = require("mongoose");

const employe = require("../models/profileScheme");
const Roster = require("../models/rosterScheme");
const EmpAttendance = require("../models/attendanceScheme");
const SecLogs = require("../models/secMainAttendaceScheme");
const Leave = require("../models/leaveScheme");
const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveType = require("../models/leaveTypeScheme");
const LeaveBalance = require("../models/leaveBalanceScheme");
const Od = require("../models/odScheme");
const Ot = require("../models/otScheme");

const { computeLeaveDays } = require("../utils/leaveDays");
const { adjustBalanceUsed } = require("../Controllers/leaveBalanceController");

// ---------- date helpers (UTC, matching how the app stores/queries) ----------
const ymd = (d) => d.toISOString().slice(0, 10);
const utcDay = (s) => new Date(`${s}T00:00:00.000Z`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const at = (d, h, m = 0) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0));

// nth <weekday> of a month (weekday: 0=Sun..6=Sat) as a UTC-midnight Date.
function nthWeekday(year, month /*1-12*/, weekday, n) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) break;
    if (d.getUTCDay() === weekday && ++count === n) return d;
  }
  return null;
}

// Weekly roster: rotates General / Morning(A) / Evening(B) / Night(C) + WEEK OFF.
const WEEKLY = {
  sunday: "WEEK OFF",
  monday: "General",
  tuesday: "A Shift",
  wednesday: "B Shift",
  thursday: "C Shift",
  friday: "General",
  saturday: "A Shift",
};
const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const shiftFor = (d) => WEEKLY[WEEKDAY_KEYS[d.getUTCDay()]];
// In/out clock per shift (for the Day-Wise display + biometric punch time).
const SHIFT_TIME = {
  General: [9, 17],
  "A Shift": [6, 14],
  "B Shift": [14, 22],
  "C Shift": [22, 6],
  "WEEK OFF": [0, 0],
};

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI in Guard_backend/.env");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  const YEAR = new Date().getUTCFullYear();
  const summary = {};

  // ---- 1. Employee (reuse or create with next free numeric id) --------------
  let emp = await employe.findOne({ empName: "Test Employee" });
  if (emp) {
    if (emp.isActive === false) { emp.isActive = true; emp.deletedAt = null; await emp.save(); }
    console.log(`Reusing existing Test Employee (empId ${emp.empId}).`);
  } else {
    const top = await employe.find({}, { empId: 1 }).sort({ empId: -1 }).limit(1).lean();
    const nextId = (top[0]?.empId || 0) + 1;
    emp = await employe.create({
      empId: nextId,
      empName: "Test Employee",
      empDesignation: "Security Guard", // from the app's DESIGNATIONS master
      empDepartment: "Security", // from the app's DEPARTMENTS master
      empMobileNo: 9800000001, // 10 digits (bulk-upload validation rule)
      empAadharNo: 999900001234, // 12 digits
      empPanNo: "TESTP1234Z", // ^[A-Z]{5}[0-9]{4}[A-Z]$
      bankAccountNo: 123456789012, // 9–18 digits
      epfNo: "EPFTEST0001",
      esiNo: "ESITEST0001",
      empDob: utcDay("1992-05-15"),
      empDoj: "2024-01-10", // stored as String in the schema
      address: "Test Barracks, MG Road, Bengaluru 560001",
      emergencyContactName: "Test Kin",
      emergencyContactNumber: "9800000002",
      emergencyContactRelation: "Sibling",
      isActive: true,
    });
    console.log(`Created Test Employee (empId ${emp.empId}).`);
  }
  const ID = emp.empId; // Number
  const CODE = String(ID); // String (roster / attendance / logs)
  summary.empId = ID;

  // ---- 2. Idempotency: clear THIS employee's generated child records ---------
  const cleared = {};
  cleared.empattendances = (await EmpAttendance.deleteMany({ empId: CODE })).deletedCount;
  cleared.secattendancelogs = (await SecLogs.deleteMany({ EmployeeCode: CODE })).deletedCount;
  cleared.leave_transactions = (await LeaveTransaction.deleteMany({ empId: ID })).deletedCount;
  cleared.leave_mgmts = (await Leave.deleteMany({ empId: ID })).deletedCount;
  cleared.leave_balances = (await LeaveBalance.deleteMany({ empId: ID })).deletedCount;
  cleared.od_mgmt = (await Od.deleteMany({ empId: ID })).deletedCount;
  cleared.ot_mgmt = (await Ot.deleteMany({ employeeId: ID })).deletedCount;
  cleared.roster_mgmt = (await Roster.deleteMany({ empId: CODE })).deletedCount;
  console.log("Cleared prior test data:", cleared, "\n");

  // ---- 3. Roster (weekly rotation incl. WEEK OFF) ---------------------------
  await Roster.create({
    empId: CODE,
    empName: emp.empName,
    mobileNo: String(emp.empMobileNo || ""),
    department: emp.empDepartment,
    designation: emp.empDesignation,
    weeklyShifts: WEEKLY,
    shiftFromDate: utcDay(`${YEAR}-01-01`),
    shiftToDate: utcDay(`${YEAR}-12-31`),
  });
  summary.roster = { ...WEEKLY };

  // ---- 4. Leave types + yearly allocation -----------------------------------
  const DEFAULT_TYPES = [
    { code: "CL", name: "Casual Leave", defaultAnnualQuota: 12, isPaid: true, sortOrder: 1 },
    { code: "SPL", name: "Special Leave", defaultAnnualQuota: 6, isPaid: true, sortOrder: 2 },
    { code: "SUM", name: "Summer Leave", defaultAnnualQuota: 4, isPaid: true, sortOrder: 3 },
    { code: "HOL", name: "Holiday Leave", defaultAnnualQuota: 2, isPaid: true, sortOrder: 4 },
  ];
  for (const t of DEFAULT_TYPES) {
    await LeaveType.updateOne({ code: t.code }, { $setOnInsert: t }, { upsert: true });
  }
  const types = Object.fromEntries((await LeaveType.find().lean()).map((t) => [t.code, t]));
  // Allocate this employee's yearly balances (allocated set; used starts 0).
  for (const t of DEFAULT_TYPES) {
    await LeaveBalance.updateOne(
      { empId: ID, year: YEAR, leaveTypeCode: t.code },
      { $set: { allocated: t.defaultAnnualQuota }, $setOnInsert: { used: 0 } },
      { upsert: true }
    );
  }

  // ---- 5. Leave history — record via the SAME logic as the controller -------
  // (creates transaction + legacy mirror + debits the balance). Ranges are
  // Tue-based so they never overlap the Sunday WEEK OFF.
  const t2 = (m) => nthWeekday(YEAR, m, 2, 2); // 2nd Tuesday of month m
  const leavePlan = [
    { code: "CL", from: t2(3), days: 3 }, // Casual, March, 3 days (Tue-Thu)
    { code: "SUM", from: t2(4), days: 2 }, // Summer, April, 2 days (Tue-Wed)
    { code: "SPL", from: t2(5), days: 1 }, // Special, May, 1 day
    { code: "HOL", from: t2(6), days: 1 }, // Holiday, June, 1 day
  ];
  const leaveDates = new Set();
  const leavesCreated = [];
  for (const L of leavePlan) {
    const from = L.from;
    const to = addDays(from, L.days - 1);
    const type = types[L.code];
    const days = computeLeaveDays(ymd(from), ymd(to), "FULL DAY");
    const legacy = await Leave.create({
      empId: ID,
      empLeaveType: type.name,
      empFromDate: from,
      empToDate: to,
      empShiftType: "General",
      empOdType: "FULL DAY",
      empReason: `${type.name} (test data)`,
    });
    await LeaveTransaction.create({
      empId: ID, leaveTypeCode: type.code, leaveTypeName: type.name, isPaid: type.isPaid,
      fromDate: from, toDate: to, days, month: from.getUTCMonth() + 1, year: from.getUTCFullYear(),
      dayType: "FULL DAY", shiftType: "General", reason: `${type.name} (test data)`,
      legacyLeaveId: legacy._id,
    });
    await adjustBalanceUsed({ empId: ID, year: from.getUTCFullYear(), leaveTypeCode: type.code, days, defaultQuota: type.defaultAnnualQuota });
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) leaveDates.add(ymd(d));
    leavesCreated.push({ type: type.name, from: ymd(from), to: ymd(to), days });
  }
  summary.leaves = leavesCreated;

  // ---- 6. OD records ---------------------------------------------------------
  const odPlan = [
    { from: nthWeekday(YEAR, 5, 3, 1), purpose: "Court duty escort", location: "City Civil Court" }, // 1st Wed May
    { from: nthWeekday(YEAR, 6, 3, 3), purpose: "VIP event security", location: "Convention Centre" }, // 3rd Wed June
  ];
  const odDates = new Set();
  const odsCreated = [];
  for (const O of odPlan) {
    await Od.create({
      empId: ID, empFromDate: O.from, empToDate: O.from, empShiftType: "General",
      empOdType: "FULL DAY", empPurpose: O.purpose, odLocation: O.location,
    });
    odDates.add(ymd(O.from));
    odsCreated.push({ date: ymd(O.from), purpose: O.purpose, location: O.location });
  }
  summary.ods = odsCreated;

  // ---- 7. OT records (varied shifts/durations/status; distinct dates) -------
  const otPlan = [
    { date: `${YEAR}-03-05`, cur: "General", add: "A Shift", dur: "4 Hours (Half Day)", status: "Approved" },
    { date: `${YEAR}-04-08`, cur: "A Shift", add: "B Shift", dur: "8 Hours (Full Day)", status: "Approved" },
    { date: `${YEAR}-05-12`, cur: "B Shift", add: "C Shift", dur: "Double Shift", status: "Approved" },
    { date: `${YEAR}-06-03`, cur: "C Shift", add: "General", dur: "8 Hours (Full Day)", status: "Pending" },
    { date: `${YEAR}-06-20`, cur: "General", add: "C Shift", dur: "4 Hours (Half Day)", status: "Rejected" },
  ];
  const otsCreated = [];
  for (const O of otPlan) {
    await Ot.create({
      employeeId: ID, employeeName: emp.empName, designation: emp.empDesignation, department: emp.empDepartment,
      currentShift: O.cur, additionalShift: O.add, workingDuration: O.dur,
      fromDate: utcDay(O.date), toDate: utcDay(O.date),
      location: "Main Gate", reason: "Extra cover (test data)", status: O.status,
    });
    otsCreated.push({ date: O.date, shift: `${O.cur}→${O.add}`, duration: O.dur, status: O.status });
  }
  summary.ots = otsCreated;

  // ---- 8. Daily attendance (last ~5 months) ---------------------------------
  // empattendances = Day-Wise source; secattendancelogs punch = Month-Wise
  // "present" source. Kept consistent: a Present day gets exactly one punch.
  const today = new Date();
  const todayMid = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = addDays(todayMid, -150);
  const attnRows = [];
  const punches = [];
  const tally = { Present: 0, Leave: 0, "Week Off": 0, Absent: 0, OD: 0 };

  for (let d = new Date(start); d <= todayMid; d = addDays(d, 1)) {
    const key = ymd(d);
    const shift = shiftFor(d);
    let action;
    let inT = "", outT = "";
    if (shift === "WEEK OFF") {
      action = "Week Off";
    } else if (leaveDates.has(key)) {
      action = "Leave";
    } else if (odDates.has(key)) {
      action = "OD";
    } else if (d.getUTCDate() % 12 === 0) {
      action = "Absent"; // deterministic sprinkling of absences
    } else {
      action = "Present";
      const [h1, h2] = SHIFT_TIME[shift];
      inT = `${String(h1).padStart(2, "0")}:00:00`;
      outT = `${String(h2).padStart(2, "0")}:00:00`;
      // one biometric punch => this date counts as a present day in Month-Wise
      punches.push({ EmployeeCode: CODE, LogDateTime: at(d, h1, 0) });
    }
    attnRows.push({
      empId: CODE,
      empShift: shift,
      empWeekOff: action === "Week Off" ? "WEEK OFF" : "",
      empInTime: inT,
      empOutTime: outT,
      empAction: action,
      empDate: d,
    });
    tally[action] += 1;
  }
  await EmpAttendance.insertMany(attnRows, { ordered: false });
  if (punches.length) await SecLogs.insertMany(punches, { ordered: false });
  summary.attendance = { totalDays: attnRows.length, ...tally, biometricPunches: punches.length, range: `${ymd(start)} … ${ymd(todayMid)}` };

  // ---- 9. Verify (mirror the report logic) ----------------------------------
  const activeNow = await employe.findOne({ empId: ID, isActive: { $ne: false } }).lean();
  const balances = await LeaveBalance.find({ empId: ID, year: YEAR }).lean();
  const balView = balances.map((b) => ({ type: b.leaveTypeCode, allocated: b.allocated, used: b.used, remaining: b.allocated - b.used }));
  const approvedOt = await Ot.countDocuments({ employeeId: ID, status: "Approved" });

  // Present days = unique dates with a punch in range (Month-Wise definition).
  const presentAgg = await SecLogs.aggregate([
    { $match: { EmployeeCode: CODE, LogDateTime: { $gte: start, $lte: new Date(todayMid.getTime() + 86400000 - 1) } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$LogDateTime", timezone: "UTC" } } } },
  ]);

  summary.verification = {
    appearsInEmployeeManagement: !!activeNow,
    dayWiseRows: await EmpAttendance.countDocuments({ empId: CODE }),
    monthWisePresentDays: presentAgg.length,
    leaveTransactions: await LeaveTransaction.countDocuments({ empId: ID }),
    legacyLeaveMirror: await Leave.countDocuments({ empId: ID }),
    leaveBalances: balView,
    odRecords: await Od.countDocuments({ empId: ID }),
    otRecords: await Ot.countDocuments({ employeeId: ID }),
    otApproved: approvedOt,
    rosterExists: !!(await Roster.findOne({ empId: CODE })),
  };

  console.log("\n================= SEED SUMMARY =================");
  console.log(JSON.stringify({ empId: ID, empName: emp.empName, ...summary }, null, 2));
  console.log("===============================================\n");

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
