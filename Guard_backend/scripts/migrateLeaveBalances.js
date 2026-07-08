// Migration: consolidate leave_balances from one-document-per-type to
// ONE document per (employee, year) with a `types` object.
//
//   OLD:  { empId, year, leaveTypeCode:"CL",  allocated, used }   (many per emp/year)
//   NEW:  { empId, year, types: { CL:{allocated,used}, SUM:{...}, ... } }  (one per emp/year)
//
// Idempotent & non-destructive to values: every allocated/used figure is
// carried over. Safe to re-run (already-migrated docs are left alone). Operates
// on the raw collection so it never trips the new {empId,year} unique index
// mid-migration; it (re)creates that index at the end.
//
//   node scripts/migrateLeaveBalances.js
//
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI in Guard_backend/.env");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection("leave_balances");

  const all = await coll.find({}).toArray();
  const oldDocs = all.filter((d) => d.leaveTypeCode !== undefined); // per-type shape
  const newDocs = all.filter((d) => d.types !== undefined && d.leaveTypeCode === undefined);
  console.log(`Found ${all.length} balance docs: ${oldDocs.length} old (per-type), ${newDocs.length} already-new.`);

  if (oldDocs.length === 0) {
    console.log("Nothing to consolidate.");
  } else {
    // Group old per-type docs by empId|year -> types object.
    const groups = new Map();
    for (const d of oldDocs) {
      const key = `${d.empId}|${d.year}`;
      if (!groups.has(key)) groups.set(key, { empId: d.empId, year: d.year, types: {} });
      groups.get(key).types[String(d.leaveTypeCode).toUpperCase()] = {
        allocated: d.allocated || 0,
        used: d.used || 0,
      };
    }

    // IMPORTANT: delete the old per-type docs FIRST. If we upserted first, the
    // filter { empId, year } would match an existing per-type doc (they carry
    // empId+year too) and write onto it — which the later delete would then
    // remove, destroying the consolidated data. Delete, then insert clean.
    const del = await coll.deleteMany({ leaveTypeCode: { $exists: true } });
    console.log(`Removed ${del.deletedCount} old per-type document(s).`);

    const inserts = [...groups.values()].map((g) => ({
      empId: g.empId,
      year: g.year,
      types: g.types,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    if (inserts.length) await coll.insertMany(inserts, { ordered: false });
    console.log(`Consolidated into ${inserts.length} employee/year document(s).`);
  }

  // Swap indexes: drop the old per-type unique index if present, ensure the new one.
  try {
    const idx = await coll.indexes();
    const oldIdx = idx.find((i) => i.name === "empId_1_year_1_leaveTypeCode_1");
    if (oldIdx) {
      await coll.dropIndex(oldIdx.name);
      console.log("Dropped old index empId_1_year_1_leaveTypeCode_1.");
    }
  } catch (e) {
    console.warn("Index cleanup note:", e.message);
  }
  await coll.createIndex({ empId: 1, year: 1 }, { unique: true });
  console.log("Ensured unique index { empId: 1, year: 1 }.");

  // Show a sample.
  const sample = await coll.findOne({});
  console.log("Sample consolidated doc:", JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("Migration failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
