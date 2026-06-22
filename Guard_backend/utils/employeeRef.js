// Centralized employee-relationship strategy.
//
// Employee Management (securitydetails) is the SINGLE SOURCE OF TRUTH. Every
// other collection references an employee by `empId` (a Number) — leave/od use
// `empId`, ot uses `employeeId`, roster/attendance-logs use the same id as a
// String. That id is the foreign key; this module is the one place that knows
// what "a valid, active employee" means so every module stays consistent.
//
// Soft delete: a removed employee is flagged `isActive: false` rather than
// deleted, so historical records survive for audit. A missing `isActive` field
// means active (back-compat with documents created before the flag existed).
const employe = require("../models/profileScheme");

// Mongo filter fragment for "active" — spread into any employee query.
const ACTIVE_FILTER = { isActive: { $ne: false } };

// Resolve an employee for a create/validation flow. Distinguishes the three
// cases the apply/roster endpoints need to report (req 14):
//   { ok:false, status:400, message:"Invalid employee id." }
//   { ok:false, status:404, message:"Employee not found." }
//   { ok:false, status:400, message:"Cannot create record for inactive (deleted) employee." }
//   { ok:true, employee }
async function resolveActiveEmployee(empId) {
  const id = parseInt(empId, 10);
  if (Number.isNaN(id)) {
    return { ok: false, status: 400, message: "Invalid employee id." };
  }
  const employee = await employe.findOne({ empId: id });
  if (!employee) {
    return { ok: false, status: 404, message: "Employee not found." };
  }
  if (employee.isActive === false) {
    return {
      ok: false,
      status: 400,
      message: "Cannot create record for inactive (deleted) employee.",
    };
  }
  return { ok: true, employee };
}

// Ids of every active employee, as both numbers (leave/od/ot keys) and strings
// (roster/attendance-log keys). Used to exclude deleted employees' orphaned
// records from list/report queries in one constant-cost lookup.
async function getActiveEmployeeIds() {
  const docs = await employe.find(ACTIVE_FILTER, { empId: 1 }).lean();
  const numbers = docs
    .map((e) => e.empId)
    .filter((v) => v !== undefined && v !== null);
  const strings = numbers.map((n) => String(n));
  return { numbers, strings, stringSet: new Set(strings) };
}

module.exports = {
  ACTIVE_FILTER,
  resolveActiveEmployee,
  getActiveEmployeeIds,
};
