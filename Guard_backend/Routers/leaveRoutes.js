const express = require("express");
const router = express.Router();

const {
  addLeave,

  getLeaveByEmpId,
  deleteLeaveById,
  updateLeaveById,
  getMonthwiseReport,
  getMonthwiseLeaves,
} = require("../Controllers/leaveController");

// Leave APIs
router.post("/apply-leave", addLeave); // Add leave entry
router.get("/get-month-wise-leaves", getMonthwiseLeaves); // Get  leaves
router.get("/get-leave-byid/:empId", getLeaveByEmpId); // Get leaves by employee ID
router.delete("/delete-leave-byid/:id", deleteLeaveById); // Delete leaves by  object id
router.put("/update-leave-byid/:id", updateLeaveById); // Delete leaves by object id
router.get("/monthLeaves-report/:empId", getMonthwiseReport);

module.exports = router;
