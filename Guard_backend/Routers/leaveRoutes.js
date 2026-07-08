const express = require("express");
const router = express.Router();

// --- Legacy leave endpoints (unchanged — kept for backward compatibility) ----
const {
  addLeave,
  getLeaveByEmpId,
  deleteLeaveById,
  updateLeaveById,
  getMonthwiseReport,
  getMonthwiseLeaves,
} = require("../Controllers/leaveController");

// --- Leave Management v2 controllers -----------------------------------------
const {
  listTypes,
  createType,
  updateType,
  deleteType,
} = require("../Controllers/leaveTypeController");
const {
  getBalances,
  allocateBalances,
} = require("../Controllers/leaveBalanceController");
const {
  recordLeave,
  listTransactions,
  updateLeave,
  deleteTransaction,
} = require("../Controllers/leaveTransactionController");
const {
  getLeaveManagement,
  getLeaveReport,
  getMonthlySummary,
  getYearlySummary,
  getDashboardOverview,
} = require("../Controllers/leaveReportController");

// ---- Leave Types (configurable categories) ----
router.get("/types", listTypes);
router.post("/types", createType);
router.put("/types/:id", updateType);
router.delete("/types/:id", deleteType);

// ---- Leave Balances (yearly allocation + remaining) ----
router.get("/balances", getBalances);
router.post("/balances/allocate", allocateBalances);

// ---- Leave Transactions (record / history / edit / delete) ----
router.get("/transactions", listTransactions);
router.post("/transactions", recordLeave);
router.put("/transactions/:id", updateLeave);
router.delete("/transactions/:id", deleteTransaction);

// ---- Unified Employee Leave Management (filtered summary + drawer + CSV) ----
router.get("/manage", getLeaveManagement);

// ---- Reports & salary-facing summaries ----
router.get("/reports/summary", getLeaveReport);
router.get("/summary/monthly", getMonthlySummary);
router.get("/summary/yearly", getYearlySummary);
router.get("/dashboard-overview", getDashboardOverview);

// ---- Legacy leave APIs (still mounted so existing screens keep working) ----
router.post("/apply-leave", addLeave);
router.get("/get-month-wise-leaves", getMonthwiseLeaves);
router.get("/get-leave-byid/:empId", getLeaveByEmpId);
router.delete("/delete-leave-byid/:id", deleteLeaveById);
router.put("/update-leave-byid/:id", updateLeaveById);
router.get("/monthLeaves-report/:empId", getMonthwiseReport);

module.exports = router;
