const express = require("express");
const router = express.Router();

const {
  updateRoster,
  getAllgurds,
  getGurdByEmpId,
  deleteGurd,
  addEmployeShift,
  bulkUpsertRoster,
} = require("../Controllers/rosterController");

router.post("/add-emp-shift", addEmployeShift);
router.post("/bulk-upload", bulkUpsertRoster);
router.put("/update-emp-roster/:empId", updateRoster);
router.get("/get-emp-data", getAllgurds);
router.get("/get-guard-shift/:empId", getGurdByEmpId);
router.delete("/guard-delete-byid/:empId", deleteGurd);

module.exports = router;
