// Rebuild leave_balances (one doc per employee/year) from source-of-truth data:
//   allocated  <- leave_types.defaultAnnualQuota (the value the allocation used)
//   used       <- SUM(days) of leave_transactions grouped by empId+type+year
//
// This is both the recovery for the botched migration AND a safe, idempotent way
// to (re)build the consolidated balances at any time. It writes ONE clean
// document per (active employee, year) and never leaves per-type docs behind.
//
//   node scripts/rebuildLeaveBalances.js            # current year
//   node scripts/rebuildLeaveBalances.js 2026 2025  # explicit years
//
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI in Guard_backend/.env");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const years = process.argv.slice(2).map(Number).filter(Boolean);
  const targetYears = years.length ? years : [new Date().getUTCFullYear()];

  const employees = await db
    .collection("securitydetails")
    .find({ isActive: { $ne: false } }, { projection: { empId: 1 } })
    .toArray();
  const types = await db.collection("leave_types").find({}).toArray();
  const activeTypes = types.filter((t) => t.active !== false);
  console.log(`Active employees: ${employees.length}, leave types: ${activeTypes.length}`);
  console.log("Allocations (from leave_types.defaultAnnualQuota):",
    activeTypes.map((t) => `${t.code}=${t.defaultAnnualQuota || 0}`).join(", "));

  const coll = db.collection("leave_balances");
  await coll.createIndex({ empId: 1, year: 1 }, { unique: true }).catch(() => {});

  let written = 0;
  for (const year of targetYears) {
    // used per (empId, code) from transactions
    const usedAgg = await db.collection("leave_transactions").aggregate([
      { $match: { year } },
      { $group: { _id: { empId: "$empId", code: "$leaveTypeCode" }, used: { $sum: "$days" } } },
    ]).toArray();
    const usedMap = new Map(usedAgg.map((u) => [`${u._id.empId}|${String(u._id.code).toUpperCase()}`, u.used]));

    const ops = employees.map((e) => {
      const typesObj = {};
      for (const t of activeTypes) {
        const code = String(t.code).toUpperCase();
        typesObj[code] = {
          allocated: t.defaultAnnualQuota || 0,
          used: usedMap.get(`${e.empId}|${code}`) || 0,
        };
      }
      return {
        updateOne: {
          filter: { empId: e.empId, year },
          update: { $set: { types: typesObj }, $setOnInsert: { empId: e.empId, year } },
          upsert: true,
        },
      };
    });
    if (ops.length) {
      const r = await coll.bulkWrite(ops, { ordered: false });
      written += (r.upsertedCount || 0) + (r.modifiedCount || 0);
      console.log(`Year ${year}: wrote ${employees.length} balance docs (upserted ${r.upsertedCount || 0}, modified ${r.modifiedCount || 0}).`);
    }
  }

  const total = await coll.countDocuments();
  console.log(`\nDone. leave_balances now holds ${total} document(s).`);
  const sample = await coll.findOne({ empId: 6623 });
  if (sample) console.log("Sample (empId 6623):", JSON.stringify(sample.types));

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("Rebuild failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
