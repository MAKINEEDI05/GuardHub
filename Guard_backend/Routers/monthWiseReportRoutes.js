const express = require("express");
const router = express.Router();
const {
  getMonthwiseReport,
  getMonthwiseSummary,
} = require("../Controllers/monthWiseRportController");

// All-employees summary (no employee selection required). Declared before the
// :empId route so "summary" is never captured as an empId param.
router.get("/monthwise-summary", getMonthwiseSummary);
router.get("/monthwise-report/:empId", getMonthwiseReport);
module.exports = router;
