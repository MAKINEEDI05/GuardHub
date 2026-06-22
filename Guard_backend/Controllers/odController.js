const od = require("../models/odScheme");
const {
  resolveActiveEmployee,
  getActiveEmployeeIds,
} = require("../utils/employeeRef");

// Add new od request
const addOd = async (req, res) => {
  console.log("Received body:", req.body);
  try {
    const {
      empId,
      empFromDate,
      empToDate,
      empShiftType,
      empOdType,
      empPurpose,
      odLocation,
    } = req.body;

    // An OD can only be filed for a valid, active employee (req 7/14).
    const check = await resolveActiveEmployee(empId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const newOd = new od({
      empId,
      empFromDate,
      empToDate,
      empShiftType,
      empOdType,
      empPurpose,
      odLocation: odLocation || "Not Specified",
    });

    await newOd.save();
    res.status(201).json({ message: "od added successfully" });
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
    const updatedOd = await od.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedOd) {
      return res
        .status(404)
        .json({ message: "Leave record not found for this employee" });
    }

    res
      .status(200)
      .json({ message: "Leave updated successfully", data: updatedOd });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ message: "Failed to update leave", error });
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
