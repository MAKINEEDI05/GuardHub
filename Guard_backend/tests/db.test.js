const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
require("dotenv").config();

test("Database Connectivity Tests", async (t) => {
  t.after(() => {
    return mongoose.disconnect();
  });

  await t.test("Should connect successfully to MongoDB cluster using MONGO_URI", async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI env variable is missing or empty");
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check state is connected (1 = connected)
    assert.strictEqual(mongoose.connection.readyState, 1, "Mongoose connection state should be 1 (connected)");
  });

  await t.test("Should list databases in cluster and find active databases", async () => {
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const dbsInfo = await admin.listDatabases();
    
    assert.ok(dbsInfo.databases && dbsInfo.databases.length > 0, "No databases found in cluster");
    
    const dbNames = dbsInfo.databases.map(d => d.name);
    console.log("   Found Databases:", dbNames.join(", "));
    
    // Validate that test database is listed
    assert.ok(dbNames.includes("test") || dbNames.includes("Empdata"), "Required databases (test/Empdata) not found in cluster");
  });

  await t.test("Should list collections in the active database", async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const colNames = collections.map(c => c.name);
    console.log("   Found Collections:", colNames.join(", "));
    
    // Must contain some standard collections
    assert.ok(colNames.includes("roster_mgmt"), "roster_mgmt collection is missing");
    assert.ok(colNames.includes("securitydetails"), "securitydetails collection is missing");
  });
});
