const express = require("express");
const router = express.Router();

const {
  addOd,

  getOdByEmpId,
  deleteOdById,
  updateOdById,
  getMonthwiseOdReport,
  getMonthwiseOds,
} = require("../Controllers/odController");
const { route } = require("./leaveRoutes");

// Leave APIs
router.post("/apply-od", addOd); // Add od entry
router.get("/get-ods", getMonthwiseOds); // Get all leaves
router.get("/get-od-byid/:empId", getOdByEmpId); // Get leaves by employee ID
router.delete("/delete-od-byid/:id", deleteOdById); // Delete leaves by object id
router.put("/update-od-byid/:id", updateOdById); // update leaves by object id
router.get("/month-wise-od-report/:empId", getMonthwiseOdReport);
module.exports = router;
