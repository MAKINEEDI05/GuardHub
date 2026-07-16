const od = require("../models/odScheme");
const Roster = require("../models/rosterScheme");
const {
  resolveActiveEmployee,
  getActiveEmployeeIds,
} = require("../utils/employeeRef");
const {
  computeApplicableDays,
  weeklyOffIndexesFromRoster,
} = require("../utils/workingDays");

// The employee's weekly-off weekday indexes (from their roster) — the same
// exclusion Leave uses, so both count applicable days identically.
async function weeklyOffForEmp(empId) {
  const roster = await Roster.findOne({ empId: String(empId) }).lean();
  return weeklyOffIndexesFromRoster(roster?.weeklyShifts);
}

const ALL_WEEKOFF_MSG =
  "The selected dates fall entirely on the employee's weekly off day(s) — there are no OD days to apply.";

// Add new od request
const addOd = async (req, res) => {
  try {
    const {
      empId,
      empFromDate,
      empToDate,
      empShiftType,
      additionalShift,
      workingDuration,
      empOdType,
      empPurpose,
      odLocation,
    } = req.body;

    // An OD can only be filed for a valid, active employee (req 7/14).
    const check = await resolveActiveEmployee(empId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }
    const empIdNum = check.employee.empId;

    // Applicable OD days = calendar days minus the employee's weekly offs.
    const weeklyOff = await weeklyOffForEmp(empIdNum);
    const calc = computeApplicableDays(empFromDate, empToDate, {
      weeklyOff,
      halfDay: /half/i.test(workingDuration || ""),
    });
    if (!calc) {
      return res.status(400).json({ message: "Invalid date range (To date must be on/after From date)." });
    }
    if (calc.actualDays <= 0) {
      return res.status(400).json({ message: ALL_WEEKOFF_MSG });
    }

    const newOd = new od({
      empId: empIdNum,
      empFromDate,
      empToDate,
      empShiftType,
      additionalShift: additionalShift || "",
      workingDuration: workingDuration || "",
      empOdType: empOdType || "",
      empPurpose,
      odLocation: odLocation || "Not Specified",
      days: calc.actualDays,
    });

    await newOd.save();
    res.status(201).json({ message: "od added successfully", data: newOd });
  } catch (error) {
    console.error("Error adding od:", error);
    res.status(500).json({ message: "Error adding od", error });
  }
};

// Get all od records
// const getAllOds = async (req, res) => {
//   try {
//     const ods = await od.find();
//     res.json(ods);
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching ods", error });
//   }
// };

// Get od by empId
const getOdByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const odRecords = await od.find({ empId: empId });

    if (!odRecords || odRecords.length === 0) {
      return res
        .status(404)
        .json({ message: "od not found for this employee" });
    }

    res.json(odRecords);
  } catch (error) {
    console.error("Error fetching od:", error);
    res.status(500).json({ message: "Error fetching od", error });
  }
};

// Delete od by empId
const deleteOdById = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOd = await od.findByIdAndDelete(id);

    if (!deletedOd) {
      return res
        .status(404)
        .json({ message: "No Od records found for this employee" });
    }

    res.json({
      message: "Od deleted successfully",
      deletedCount: deletedOd.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting Od:", error);
    res.status(500).json({ message: "Error deleting Od", error });
  }
};

//update od by empId
const updateOdById = async (req, res) => {
  try {
    const existing = await od.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "OD record not found for this employee" });
    }

    const update = { ...req.body };

    // Recompute applicable days from the effective range + duration + roster so
    // the stored day count stays consistent with an edit (same engine as Apply).
    const from = update.empFromDate || existing.empFromDate;
    const to = update.empToDate || existing.empToDate;
    const duration = update.workingDuration !== undefined ? update.workingDuration : existing.workingDuration;
    const weeklyOff = await weeklyOffForEmp(existing.empId);
    const calc = computeApplicableDays(from, to, {
      weeklyOff,
      halfDay: /half/i.test(duration || ""),
    });
    if (!calc) {
      return res.status(400).json({ message: "Invalid date range (To date must be on/after From date)." });
    }
    if (calc.actualDays <= 0) {
      return res.status(400).json({ message: ALL_WEEKOFF_MSG });
    }
    update.days = calc.actualDays;

    const updatedOd = await od.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ message: "OD updated successfully", data: updatedOd });
  } catch (error) {
    console.error("Error updating OD:", error);
    res.status(500).json({ message: "Failed to update OD", error });
  }
};
// get number count no of od

const getMonthwiseOdReport = async (req, res) => {
  const { empId } = req.params;
  try {
    const monthwiseData = await od.aggregate([
      {
        $match: {
          empId: parseInt(empId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$empFromDate" },
            month: { $month: "$empFromDate" },
          },
          totalOds: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
    ]);

    res.status(200).json({ message: "Monthwise report", data: monthwiseData });
  } catch (error) {
    console.error("Error fetching monthwise report:", error);
    res.status(500).json({ message: "Failed to get monthwise report", error });
  }
};

//get ods by mont wise
const getMonthwiseOds = async (req, res) => {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res
      .status(400)
      .json({ message: "fromDate and toDate are required." });
  }

  try {
    // Only surface ODs that belong to an active employee.
    const { numbers: activeIds } = await getActiveEmployeeIds();
    const ods = await od.find({
      empId: { $in: activeIds },
      empFromDate: {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
      },
    });

    res.status(200).json({ message: "ODs between dates", data: ods });
  } catch (error) {
    console.error("Error fetching ods:", error);
    res.status(500).json({ message: "Failed to get ods", error });
  }
};

// export the functions
module.exports = {
  addOd,
  getMonthwiseOds,
  getOdByEmpId,
  deleteOdById,
  updateOdById,
  getMonthwiseOdReport,
};
