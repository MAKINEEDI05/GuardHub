const express = require("express");
const router = express.Router();
const {
  getAllEmpData,
  addEmpData,
  getEmpById,
  deleteEmpById,
  restoreEmpById,
  updateEmp,
  bulkUpsertEmployees,
  getFilterOptions,
} = require("../Controllers/profileController");

const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Upload directory
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // const empId = req.body.empId || req.params.empId;
    const empId = req.body.empId;
    if (!empId) return cb(new Error("empId is required for image filename"));

    const ext = path.extname(file.originalname);
    const filename = `${empId}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only .jpg, .jpeg, .png allowed"), false);
  },
});

// Routes
router.get("/get-emp-details", getAllEmpData);
// Live distinct designation/department values for the filter dropdowns.
// Declared before the :empId route so "filter-options" isn't read as an empId.
router.get("/filter-options", getFilterOptions);
router.post("/add-employee", upload.single("empImage"), addEmpData);
router.post("/bulk-upload", bulkUpsertEmployees);
router.get("/get-emp-byid/:empId", getEmpById);
router.put("/update-emp-byid/:empId", upload.single("empImage"), updateEmp);
router.delete("/delete-emp-byid/:empId", deleteEmpById);
router.put("/restore-emp-byid/:empId", restoreEmpById);

module.exports = router;
