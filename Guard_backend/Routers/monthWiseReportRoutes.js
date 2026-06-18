const express = require("express");
const router = express.Router();
const {
  getMonthwiseReport,
} = require("../Controllers/monthWiseRportController");

router.get("/monthwise-report/:empId", getMonthwiseReport);
module.exports = router;
