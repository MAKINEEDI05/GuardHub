const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
require("dotenv").config();
const EmpAttendance = require("../models/attendanceScheme");
const { getAttendanceByEmpId, addAttendance } = require("../Controllers/attendanceController");

test("Attendance API Logic Tests", async (t) => {
  const TEST_EMP_ID = "TEST_RUNNER_EMP_99";

  t.before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    // Cleanup any orphaned test records
    await EmpAttendance.deleteMany({ empId: TEST_EMP_ID });
  });

  t.after(async () => {
    // Final cleanup and disconnect
    await EmpAttendance.deleteMany({ empId: TEST_EMP_ID });
    await mongoose.disconnect();
  });

  await t.test("getAttendanceByEmpId - should return 404 when employee has no records", async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = {
      params: { empId: TEST_EMP_ID }
    };
    const res = {
      status: function(code) {
        responseStatus = code;
        return this;
      },
      json: function(data) {
        responseJson = data;
        return this;
      }
    };

    await getAttendanceByEmpId(req, res);

    assert.strictEqual(responseStatus, 404);
    assert.ok(responseJson);
    assert.strictEqual(responseJson.message, "No attendance records found for this empId");
  });

  await t.test("addAttendance - should successfully add an attendance record", async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = {
      body: {
        empId: TEST_EMP_ID,
        empShift: "1-General",
        empInTime: "08:40",
        empOutTime: "17:30",
        empAction: "Present",
        empDate: new Date(),
        empLate: false
      }
    };

    const res = {
      status: function(code) {
        responseStatus = code;
        return this;
      },
      json: function(data) {
        responseJson = data;
        return this;
      }
    };

    await addAttendance(req, res);

    assert.strictEqual(responseStatus, 201);
    assert.ok(responseJson);
    assert.strictEqual(responseJson.message, "Attendance added successfully");

    // Check in database
    const records = await EmpAttendance.find({ empId: TEST_EMP_ID });
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].empShift, "1-General");
  });

  await t.test("getAttendanceByEmpId - should return 200 and list of records when employee exists", async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = {
      params: { empId: TEST_EMP_ID }
    };
    const res = {
      status: function(code) {
        responseStatus = code;
        return this;
      },
      json: function(data) {
        responseJson = data;
        return this;
      }
    };

    await getAttendanceByEmpId(req, res);

    assert.strictEqual(responseStatus, 200);
    assert.ok(Array.isArray(responseJson));
    assert.strictEqual(responseJson.length, 1);
    assert.strictEqual(responseJson[0].empId, TEST_EMP_ID);
  });
});
