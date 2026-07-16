const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveType = require("../models/leaveTypeScheme");
const Leave = require("../models/leaveScheme"); // legacy leave_mgmt (compat)
const Roster = require("../models/rosterScheme");
const { resolveActiveEmployee, getActiveEmployeeIds } = require("../utils/employeeRef");
const {
  computeApplicableDays,
  weeklyOffIndexesFromRoster,
} = require("../utils/workingDays");
const {
  computeDeduction,
  validateCustomLeaveName,
  CL_CODE,
  COMP_CODE,
  OTHERS_CODE,
  round2,
} = require("../utils/leaveDeduction");
const {
  adjustBalanceUsed,
  getClCompRemaining,
} = require("./leaveBalanceController");

// The employee's weekly-off weekday indexes (from their roster). Excluded from
// every leave/OD day count so a range that spans a week-off charges fewer days.
async function weeklyOffForEmp(empId) {
  const roster = await Roster.findOne({ empId: String(empId) }).lean();
  return weeklyOffIndexesFromRoster(roster?.weeklyShifts);
}

// Message shown when a range collapses to zero applicable days (all weekly off).
const ALL_WEEKOFF_MSG =
  "The selected dates fall entirely on the employee's weekly off day(s) — there are no leave days to apply.";

// Debit CL then Comp Off for one leave's split (seeding CL's allocation from its
// default quota on first touch so a fresh balance row still reflects the real
// entitlement). Pass negated used values to reverse a leave. The single place a
// leave mutates the ledger — Comp Off's `defaultQuota` is 0 because its
// allocation is derived from OT, never stored.
async function applyDeductionToBalance(empId, year, { clUsed, compUsed }, clQuota) {
  if (clUsed) {
    await adjustBalanceUsed({ empId, year, leaveTypeCode: CL_CODE, days: clUsed, defaultQuota: clQuota });
  }
  if (compUsed) {
    await adjustBalanceUsed({ empId, year, leaveTypeCode: COMP_CODE, days: compUsed, defaultQuota: 0 });
  }
}

// POST /leave/transactions
// Records ONE leave: resolves the deduction (CL → Comp Off, req 4), creates the
// transaction with its breakdown, debits CL/Comp Off, and mirrors a legacy
// leave_mgmt row so the existing attendance + month-wise report keep flagging the
// day as "Leave". "Others" (req 2) stores a custom name + explicit day count and
// touches NO balance. Negative balances are allowed — an over-draw is recorded
// as the leave's `lopDays`, never blocked (req 6).
const recordLeave = async (req, res) => {
  let legacy = null;
  let txn = null;
  try {
    const { empId, leaveTypeCode, fromDate, toDate } = req.body;
    const dayType = req.body.dayType || "FULL DAY";
    const shiftType = req.body.shiftType || "General";
    const reason = (req.body.reason || "").trim();

    // 1. Employee must be valid + active.
    const check = await resolveActiveEmployee(empId);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const empIdNum = check.employee.empId;

    if (!leaveTypeCode) return res.status(400).json({ message: "leaveTypeCode is required" });
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }
    const from = new Date(`${String(fromDate).slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(`${String(toDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return res.status(400).json({ message: "Invalid date range (toDate must be on/after fromDate)" });
    }
    const month = from.getUTCMonth() + 1;
    const year = from.getUTCFullYear();

    const isOthers = String(leaveTypeCode).toUpperCase() === OTHERS_CODE;

    // 2. Resolve the leave's category, day count and deduction split.
    let leaveTypeName, isPaid, days, customLeaveName = "";
    let split = { clUsed: 0, compUsed: 0, lopDays: 0, remainingCl: 0, remainingComp: 0 };

    if (isOthers) {
      const nameCheck = validateCustomLeaveName(req.body.customLeaveName);
      if (!nameCheck.ok) return res.status(400).json({ message: nameCheck.message });
      customLeaveName = nameCheck.value;
      days = round2(req.body.days);
      if (!days || days <= 0) {
        return res.status(400).json({ message: "Number of days must be greater than 0." });
      }
      leaveTypeName = customLeaveName; // shown wherever the leave type appears
      isPaid = true; // informational leave; no balance impact
    } else {
      const type = await LeaveType.findOne({ code: String(leaveTypeCode).toUpperCase(), active: true });
      if (!type) return res.status(400).json({ message: "Unknown or inactive leave type" });
      // Applicable days = calendar days minus the employee's weekly offs.
      const weeklyOff = await weeklyOffForEmp(empIdNum);
      const calc = computeApplicableDays(fromDate, toDate, { weeklyOff, halfDay: /HALF/i.test(dayType) });
      if (!calc) {
        return res.status(400).json({ message: "Invalid date range (toDate must be on/after fromDate)" });
      }
      if (calc.actualDays <= 0) {
        return res.status(400).json({ message: ALL_WEEKOFF_MSG });
      }
      days = calc.actualDays;
      leaveTypeName = type.name;
      isPaid = type.isPaid;
      // Fund CL first, then Comp Off, against the live remaining (same source as
      // every balance read). Any overflow becomes lopDays — never blocked.
      const { cl, comp } = await getClCompRemaining(empIdNum, year);
      split = computeDeduction(days, cl, comp);
    }

    // 3. Legacy mirror (keeps attendance/reporting working). For Others the
    //    custom name is the leave label the month-wise report reads.
    legacy = await Leave.create({
      empId: empIdNum,
      empLeaveType: leaveTypeName,
      empFromDate: from,
      empToDate: to,
      empShiftType: shiftType,
      empOdType: dayType,
      empReason: reason || "Leave",
    });

    // 4. The authoritative transaction (carries the breakdown snapshot).
    txn = await LeaveTransaction.create({
      empId: empIdNum,
      leaveTypeCode: isOthers ? OTHERS_CODE : String(leaveTypeCode).toUpperCase(),
      leaveTypeName,
      customLeaveName,
      isPaid,
      fromDate: from,
      toDate: to,
      days,
      month,
      year,
      dayType,
      shiftType,
      reason,
      clUsed: split.clUsed,
      compUsed: split.compUsed,
      lopDays: split.lopDays,
      remainingCl: split.remainingCl,
      remainingComp: split.remainingComp,
      legacyLeaveId: legacy._id,
    });

    // 5. Debit CL/Comp Off (nothing for Others).
    if (!isOthers) {
      const clQuota = await clDefaultQuota();
      await applyDeductionToBalance(empIdNum, year, split, clQuota);
    }

    return res.status(201).json({ message: "Leave recorded", data: txn });
  } catch (error) {
    // Best-effort compensation so we never leave a half-written leave behind.
    if (txn) await LeaveTransaction.deleteOne({ _id: txn._id }).catch(() => {});
    if (legacy) await Leave.deleteOne({ _id: legacy._id }).catch(() => {});
    console.error("Error recording leave:", error);
    return res.status(500).json({ message: "Failed to record leave", error: error.message });
  }
};

// CL's configured annual quota, used to seed a fresh balance row's CL allocation
// so the deduction sees the real entitlement even before any allocation run.
async function clDefaultQuota() {
  const cl = await LeaveType.findOne({ code: CL_CODE }).lean();
  return cl?.defaultAnnualQuota || 0;
}

// GET /leave/transactions?empId&month&year&leaveTypeCode&fromDate&toDate
// Leave history / list. Only surfaces active employees' records.
const listTransactions = async (req, res) => {
  try {
    const { numbers: activeIds } = await getActiveEmployeeIds();
    const q = { empId: { $in: activeIds } };

    if (req.query.empId) q.empId = parseInt(req.query.empId, 10);
    if (req.query.year) q.year = parseInt(req.query.year, 10);
    if (req.query.month) q.month = parseInt(req.query.month, 10);
    if (req.query.leaveTypeCode)
      q.leaveTypeCode = String(req.query.leaveTypeCode).toUpperCase();
    if (req.query.fromDate || req.query.toDate) {
      q.fromDate = {};
      if (req.query.fromDate)
        q.fromDate.$gte = new Date(`${req.query.fromDate.slice(0, 10)}T00:00:00.000Z`);
      if (req.query.toDate)
        q.fromDate.$lte = new Date(`${req.query.toDate.slice(0, 10)}T23:59:59.999Z`);
    }

    const records = await LeaveTransaction.find(q).sort({ fromDate: -1, createdAt: -1 });
    return res.status(200).json({ message: "Leave transactions", data: records });
  } catch (error) {
    console.error("Error listing transactions:", error);
    return res.status(500).json({ message: "Failed to list transactions" });
  }
};

// PUT /leave/transactions/:id — edit a finalized leave (single-admin, no
// approval). Editable: leaveTypeCode (incl. Others), customLeaveName, shiftType,
// fromDate, toDate, dayType, days (Others), reason. Rebalances by REVERSING this
// transaction's own CL/Comp Off debit first, then recomputing the split against
// the fresh remaining and re-debiting — so a changed type/year/day-count stays
// consistent. Negative balances allowed. The employee is NOT changed here.
const updateLeave = async (req, res) => {
  try {
    const txn = await LeaveTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: "Leave transaction not found" });

    // Merge incoming changes over the existing record.
    const nextCode = (req.body.leaveTypeCode || txn.leaveTypeCode).toUpperCase();
    const shiftType = req.body.shiftType !== undefined ? req.body.shiftType : txn.shiftType;
    const dayType = req.body.dayType !== undefined ? req.body.dayType : txn.dayType;
    const reason = req.body.reason !== undefined ? String(req.body.reason).trim() : txn.reason;
    const fromRaw = req.body.fromDate || txn.fromDate;
    const toRaw = req.body.toDate || txn.toDate;

    const from = new Date(`${String(fromRaw).slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(`${String(toRaw).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return res.status(400).json({ message: "Invalid date range (toDate must be on/after fromDate)" });
    }
    const month = from.getUTCMonth() + 1;
    const year = from.getUTCFullYear();

    const isOthers = nextCode === OTHERS_CODE;

    let leaveTypeName, isPaid, days, customLeaveName = "";
    if (isOthers) {
      const nameCheck = validateCustomLeaveName(
        req.body.customLeaveName !== undefined ? req.body.customLeaveName : txn.customLeaveName
      );
      if (!nameCheck.ok) return res.status(400).json({ message: nameCheck.message });
      customLeaveName = nameCheck.value;
      days = round2(req.body.days !== undefined ? req.body.days : txn.days);
      if (!days || days <= 0) {
        return res.status(400).json({ message: "Number of days must be greater than 0." });
      }
      leaveTypeName = customLeaveName;
      isPaid = true;
    } else {
      const type = await LeaveType.findOne({ code: nextCode, active: true });
      if (!type) return res.status(400).json({ message: "Unknown or inactive leave type" });
      const weeklyOff = await weeklyOffForEmp(txn.empId);
      const calc = computeApplicableDays(fromRaw, toRaw, { weeklyOff, halfDay: /HALF/i.test(dayType) });
      if (!calc) {
        return res.status(400).json({ message: "Invalid date range (toDate must be on/after fromDate)" });
      }
      if (calc.actualDays <= 0) {
        return res.status(400).json({ message: ALL_WEEKOFF_MSG });
      }
      days = calc.actualDays;
      leaveTypeName = type.name;
      isPaid = type.isPaid;
    }

    // Rebalance step 1: reverse THIS transaction's existing CL/Comp Off debit
    // (using its original year) so the recompute sees the balance without it.
    await applyDeductionToBalance(txn.empId, txn.year, { clUsed: -txn.clUsed, compUsed: -txn.compUsed });

    // Step 2: recompute the split for the new value against the fresh remaining.
    let split = { clUsed: 0, compUsed: 0, lopDays: 0, remainingCl: 0, remainingComp: 0 };
    if (!isOthers) {
      const { cl, comp } = await getClCompRemaining(txn.empId, year);
      split = computeDeduction(days, cl, comp);
      const clQuota = await clDefaultQuota();
      await applyDeductionToBalance(txn.empId, year, split, clQuota);
    }

    // Update the authoritative transaction (snapshots refreshed).
    txn.set({
      leaveTypeCode: isOthers ? OTHERS_CODE : nextCode,
      leaveTypeName,
      customLeaveName,
      isPaid,
      shiftType,
      dayType,
      reason,
      fromDate: from,
      toDate: to,
      days,
      month,
      year,
      clUsed: split.clUsed,
      compUsed: split.compUsed,
      lopDays: split.lopDays,
      remainingCl: split.remainingCl,
      remainingComp: split.remainingComp,
    });
    await txn.save();

    // Keep the legacy mirror in sync (attendance/month-wise report read it).
    if (txn.legacyLeaveId) {
      await Leave.updateOne(
        { _id: txn.legacyLeaveId },
        {
          $set: {
            empLeaveType: leaveTypeName,
            empFromDate: from,
            empToDate: to,
            empShiftType: shiftType,
            empOdType: dayType,
            empReason: reason || "Leave",
          },
        }
      ).catch(() => {});
    }

    return res.status(200).json({ message: "Leave updated", data: txn });
  } catch (error) {
    console.error("Error updating leave:", error);
    return res.status(500).json({ message: "Failed to update leave", error: error.message });
  }
};

// DELETE /leave/transactions/:id — reverses this leave's CL/Comp Off debit and
// removes the mirrored legacy row so nothing drifts. (Others debited nothing.)
const deleteTransaction = async (req, res) => {
  try {
    const txn = await LeaveTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: "Leave transaction not found" });

    await applyDeductionToBalance(txn.empId, txn.year, { clUsed: -txn.clUsed, compUsed: -txn.compUsed });
    if (txn.legacyLeaveId) {
      await Leave.deleteOne({ _id: txn.legacyLeaveId }).catch(() => {});
    }
    await LeaveTransaction.deleteOne({ _id: txn._id });

    return res.status(200).json({ message: "Leave deleted" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return res.status(500).json({ message: "Failed to delete leave" });
  }
};

module.exports = { recordLeave, listTransactions, updateLeave, deleteTransaction };
