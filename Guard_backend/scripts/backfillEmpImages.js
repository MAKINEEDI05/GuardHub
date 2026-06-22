/**
 * Guards Hub – one-time repair for employee photos.
 *
 * Some records have a photo file on disk (uploads/<empId>.<ext>) but a NULL
 * `empImage` in the database — typically because an image was added via Edit
 * before updateEmp was fixed to persist req.file. The UI then can't find the
 * photo (it falls back to guessing <empId>.jpg) and shows the default avatar.
 *
 * This script sets empImage = "<empId><ext>" for every employee that has a
 * matching file but an empty empImage. It only fills blanks; it never overwrites
 * an existing empImage.
 *
 * Run from the backend folder (where .env with MONGO_URI lives):
 *     node scripts/backfillEmpImages.js
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const employe = require("../models/profileScheme");

const uploadDir = path.join(__dirname, "..", "uploads");

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Scanning uploads/ and employee records…\n");

  // Map empId -> filename for every file on disk (prefer the most-recently
  // modified when several extensions exist for the same id).
  const fileByEmpId = new Map();
  for (const name of fs.readdirSync(uploadDir)) {
    const empId = name.slice(0, name.lastIndexOf("."));
    if (!empId || empId === "0000") continue; // skip the fallback avatar
    const full = path.join(uploadDir, name);
    const prev = fileByEmpId.get(empId);
    if (!prev || fs.statSync(full).mtimeMs > fs.statSync(path.join(uploadDir, prev)).mtimeMs) {
      fileByEmpId.set(empId, name);
    }
  }

  const employees = await employe.find(
    { $or: [{ empImage: null }, { empImage: "" }, { empImage: { $exists: false } }] },
    { empId: 1, empImage: 1 }
  );

  let fixed = 0;
  for (const emp of employees) {
    const file = fileByEmpId.get(String(emp.empId));
    if (!file) continue;
    emp.empImage = file;
    await emp.save();
    fixed += 1;
    console.log(`  ${emp.empId} -> empImage = "${file}"`);
  }

  console.log(
    `\nDone. Updated ${fixed} record(s) out of ${employees.length} with a blank empImage.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
