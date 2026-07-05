const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveType = require("../models/leaveTypeScheme");
const Leave = require("../models/leaveScheme"); // legacy leave_mgmt (compat)
const { resolveActiveEmployee, getActiveEmployeeIds } = require("../utils/employeeRef");
const { computeLeaveDays } = require("../utils/leaveDays");
const { adjustBalanceUsed } = require("./leaveBalanceController");

// POST /leave/transactions
// Records ONE leave: creates the transaction, debits the balance, and mirrors a
// legacy leave_mgmt row so the existing attendance cron + month-wise report keep
// flagging the day as "Leave" with no change to those modules.
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

    // 2. Leave type must exist and be active.
    if (!leaveTypeCode) return res.status(400).json({ message: "leaveTypeCode is required" });
    const type = await LeaveType.findOne({
      code: String(leaveTypeCode).toUpperCase(),
      active: true,
    });
    if (!type) return res.status(400).json({ message: "Unknown or inactive leave type" });

    // 3. Dates + day count.
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }
    const days = computeLeaveDays(fromDate, toDate, dayType);
    if (days === null || days <= 0) {
      return res.status(400).json({ message: "Invalid date range (toDate must be on/after fromDate)" });
    }

    const from = new Date(`${String(fromDate).slice(0, 10)}T00:00:00.000Z`);
    const month = from.getUTCMonth() + 1;
    const year = from.getUTCFullYear();

    // 4. Legacy mirror (keeps attendance/reporting working).
    legacy = await Leave.create({
      empId: empIdNum,
      empLeaveType: type.name,
      empFromDate: from,
      empToDate: new Date(`${String(toDate).slice(0, 10)}T00:00:00.000Z`),
      empShiftType: shiftType,
      empOdType: dayType,
      empReason: reason || "Leave",
    });

    // 5. The authoritative transaction.
    txn = await LeaveTransaction.create({
      empId: empIdNum,
      leaveTypeCode: type.code,
      leaveTypeName: type.name,
      isPaid: type.isPaid,
      fromDate: legacy.empFromDate,
      toDate: legacy.empToDate,
      days,
      month,
      year,
      dayType,
      shiftType,
      reason,
      legacyLeaveId: legacy._id,
    });

    // 6. Debit the balance (auto-creates the row, seeding allocation from the
    //    type's default quota if no formal allocation has been run yet).
    await adjustBalanceUsed({
      empId: empIdNum,
      year,
      leaveTypeCode: type.code,
      days,
      defaultQuota: type.defaultAnnualQuota || 0,
    });

    return res.status(201).json({ message: "Leave recorded", data: txn });
  } catch (error) {
    // Best-effort compensation so we never leave a half-written leave behind.
    if (txn) await LeaveTransaction.deleteOne({ _id: txn._id }).catch(() => {});
    if (legacy) await Leave.deleteOne({ _id: legacy._id }).catch(() => {});
    console.error("Error recording leave:", error);
    return res.status(500).json({ message: "Failed to record leave", error: error.message });
  }
};

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

// DELETE /leave/transactions/:id — reverses the balance debit and removes the
// mirrored legacy row so nothing drifts.
const deleteTransaction = async (req, res) => {
  try {
    const txn = await LeaveTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: "Leave transaction not found" });

    await adjustBalanceUsed({
      empId: txn.empId,
      year: txn.year,
      leaveTypeCode: txn.leaveTypeCode,
      days: -txn.days,
    });
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

module.exports = { recordLeave, listTransactions, deleteTransaction };
