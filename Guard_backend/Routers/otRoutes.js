const express = require("express");
const router = express.Router();

const {
  applyOt,
  getAllOt,
  getOtByEmpId,
  updateOt,
  deleteOt,
} = require("../Controllers/otController");

router.post("/apply-ot", applyOt); // Create an OT record
router.get("/get-ot", getAllOt); // All OT records
router.get("/get-ot-by-empid/:empId", getOtByEmpId); // OT for one employee
router.put("/update-ot/:id", updateOt); // Update by _id
router.delete("/delete-ot/:id", deleteOt); // Delete by _id

module.exports = router;
