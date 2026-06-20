/**
 * Guards Hub – read-only database audit (v2).
 *
 * Writes NOTHING. Run from the backend folder:
 *     node scripts/dbAudit.js
 *
 * Reports, for the app DB (MONGO_URI) and the external biometric DB
 * (MONGO_URI1): collections, counts, sample docs, empId/field types, and the
 * distinct empAction values in attendance.
 */
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const line = (c = "─") => console.log(c.repeat(64));

// Collections we care about in the app DB, with the field that holds the
// employee id (for type checks). Names are the ACTUAL Mongo collection names.
const APP_COLLECTIONS = {
  securitydetails: "empId",
  empattendances: "empId",
  leave_mgmts: "empId", // mongoose pluralised model "leave_mgmt"
  od_mgmt: "empId",
  roster_mgmt: "empId",
  secattendancelogs: "EmployeeCode",
  securityattendancelogs: "EmployeeCode",
  logins: "userName",
};

async function dumpCollection(db, name, idField) {
  console.log(`\n### ${name}  (id field: ${idField})`);
  const exists = (await db.listCollections({ name }).toArray()).length > 0;
  if (!exists) {
    console.log("  -> collection MISSING");
    return;
  }
  const coll = db.collection(name);
  const count = await coll.countDocuments();
  console.log("  documents:", count);
  if (count === 0) return;

  const sample = await coll.findOne();
  console.log("  sample doc:", JSON.stringify(sample, null, 2));

  const types = await coll
    .aggregate([
      { $group: { _id: { $type: `$${idField}` }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray();
  console.log(
    `  ${idField} types:`,
    types.map((t) => `${t._id}=${t.n}`).join(", ")
  );

  // For the log collections, show the date range so we can see if data is fresh.
  if (name.includes("attendancelogs")) {
    const range = await coll
      .aggregate([
        {
          $group: {
            _id: null,
            min: { $min: "$LogDateTime" },
            max: { $max: "$LogDateTime" },
          },
        },
      ])
      .toArray();
    if (range[0]) console.log("  LogDateTime range:", range[0].min, "->", range[0].max);
  }
}

async function auditAppDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) return console.error("MONGO_URI not set");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  line("=");
  console.log("APP DB:", db.databaseName, "  (URI has no db name => defaults to 'test')");
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log("Collections:", names.join(", "));
  line("=");

  for (const [name, idField] of Object.entries(APP_COLLECTIONS)) {
    await dumpCollection(db, name, idField);
  }

  line("=");
  console.log("\n### empAction distinct values + counts (empattendances)");
  const actions = await db
    .collection("empattendances")
    .aggregate([
      { $group: { _id: "$empAction", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray();
  if (!actions.length) console.log("  (empattendances is EMPTY — no attendance generated)");
  else actions.forEach((a) => console.log(`  ${JSON.stringify(a._id)} -> ${a.n}`));

  await mongoose.disconnect();
}

async function auditBiometricDb() {
  const uri = process.env.MONGO_URI1;
  line("=");
  console.log("\nEXTERNAL BIOMETRIC SOURCE (MONGO_URI1)");
  if (!uri) {
    console.log("  MONGO_URI1 not set — biometric source unconfigured.");
    return;
  }
  const dbName = process.env.BIOMETRIC_DB_NAME || "technicalhub";
  const collName = process.env.BIOMETRIC_COLLECTION || "attendancelogs";
  const serial = process.env.BIOMETRIC_DEVICE_SERIAL || "0426141300425";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log("  connected to", dbName);
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    console.log("  collections:", names.join(", ") || "(none)");
    if (names.includes(collName)) {
      const coll = db.collection(collName);
      console.log(`  ${collName} count:`, await coll.countDocuments());
      const sample = await coll.findOne();
      console.log(`  ${collName} sample:`, JSON.stringify(sample, null, 2));
      const serialCount = await coll.countDocuments({
        "after.Serialnumber": serial,
      });
      console.log(`  docs matching device serial ${serial}:`, serialCount);
    }
  } catch (e) {
    console.log("  EXTERNAL DB UNREACHABLE:", e.message);
  } finally {
    await client.close().catch(() => {});
  }
}

(async () => {
  try {
    await auditAppDb();
    await auditBiometricDb();
    line("=");
    console.log("\nDone (read-only, nothing modified).");
    process.exit(0);
  } catch (err) {
    console.error("Audit failed:", err.message);
    process.exit(1);
  }
})();
