// One-off: seed the default leave-type master. Idempotent — upserts by `code`,
// so re-running never duplicates and never clobbers an admin's edits to names/
// quotas (it only fills in missing rows).
//
//   node scripts/seedLeaveTypes.js
//
// (The API also lazy-seeds these on the first GET /leave/types, so this script
// is only for initialising a fresh database up front.)
require("dotenv").config();
const mongoose = require("mongoose");
const LeaveType = require("../models/leaveTypeScheme");

const DEFAULTS = [
  { code: "CL", name: "Casual Leave", defaultAnnualQuota: 12, isPaid: true, sortOrder: 1 },
  { code: "SPL", name: "Special Leave", defaultAnnualQuota: 6, isPaid: true, sortOrder: 2 },
  { code: "SUM", name: "Summer Leave", defaultAnnualQuota: 4, isPaid: true, sortOrder: 3 },
  { code: "HOL", name: "Holiday Leave", defaultAnnualQuota: 2, isPaid: true, sortOrder: 4 },
];

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in Guard_backend/.env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected. Seeding leave types...");

  const ops = DEFAULTS.map((t) => ({
    updateOne: {
      filter: { code: t.code },
      update: { $setOnInsert: t },
      upsert: true,
    },
  }));
  const res = await LeaveType.bulkWrite(ops, { ordered: false });
  console.log(`Inserted ${res.upsertedCount || 0} new type(s); existing left untouched.`);

  const all = await LeaveType.find().sort({ sortOrder: 1 }).lean();
  console.table(all.map((t) => ({ code: t.code, name: t.name, quota: t.defaultAnnualQuota, paid: t.isPaid })));

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
