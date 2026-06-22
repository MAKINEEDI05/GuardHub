const Leave = require("../models/leaveScheme");
const {
  resolveActiveEmployee,
  getActiveEmployeeIds,
} = require("../utils/employeeRef");

// Add new leave request
const addLeave = async (req, res) => {
  try {
    const {
      empId,
      empLeaveType,
      empFromDate,
      empToDate,
      empShiftType,
      empOdType,
      empReason,
    } = req.body;

    // A leave can only be filed for a valid, active employee (req 7/14).
    const check = await resolveActiveEmployee(empId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const newLeave = new Leave({
      empId,
      empLeaveType,
      empFromDate,
      empToDate,
      empShiftType,
      empOdType,
      empReason,
    });

    await newLeave.save();
    res.status(201).json({ message: "Leave added successfully" });
  } catch (error) {
    console.error("Error adding leave:", error);
    res.status(500).json({ message: "Error adding leave", error });
  }
};

// Get all leave records
// const getAllLeaves = async (req, res) => {
//   try {
//     const leaves = await Leave.find();
//     res.json(leaves);
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching leaves", error });
//   }
// };

// Get leave by empId
const getLeaveByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const leave = await Leave.find({ empId: empId });

    if (!leave || leave.length === 0) {
      return res
        .status(404)
        .json({ message: "Leave not found for this employee" });
    }

    res.json(leave);
  } catch (error) {
    console.error("Error fetching leave:", error);
    res.status(500).json({ message: "Error fetching leave", error });
  }
};
// update leave by object id
const updateLeaveById = async (req, res) => {
  console.log("id", req.params.id);
  try {
    const updatedLeave = await Leave.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    console.log(updatedLeave);
    if (!updatedLeave) {
      return res
        .status(404)
        .json({ message: "Leave record not found for this employee" });
    }

    res.json({ message: "Leave updated successfully", data: updatedLeave });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ message: "Failed to update leave", error });
  }
};

// Delete leave by empId
const deleteLeaveById = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLeave = await Leave.findByIdAndDelete(id);

    if (!deletedLeave) {
      return res
        .status(404)
        .json({ message: "No leave records found for this employee" });
    }

    res.json({
      message: "Leave deleted successfully",
      deletedCount: deletedLeave.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting leave:", error);
    res.status(500).json({ message: "Error deleting leave", error });
  }
};

//get leave count by empId

const getMonthwiseReport = async (req, res) => {
  const { empId } = req.params;
  try {
    const monthwiseData = await Leave.aggregate([
      {
        $match: {
          empId: parseInt(empId), // Ensure it's a number if empId is stored as Number
        },
      },
      {
        $group: {
          _id: {
            // empId: "$empId",
            year: { $year: "$empFromDate" },
            month: { $month: "$empFromDate" },
          },
          totalLeaves: { $sum: 1 },
        },
      },
      {
        $sort: {
          // "_id.empId": 1,
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

//get leaves By from date to date

const getMonthwiseLeaves = async (req, res) => {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res
      .status(400)
      .json({ message: "fromDate and toDate are required." });
  }

  try {
    // Only surface leaves that belong to an active employee — a deleted
    // employee's historical records stay in the DB but never show in the view.
    const { numbers: activeIds } = await getActiveEmployeeIds();
    const leaves = await Leave.find({
      empId: { $in: activeIds },
      empFromDate: {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)), // include end of day
      },
    });

    res.status(200).json({ message: "Leaves between dates", data: leaves });
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({ message: "Failed to get leaves", error });
  }
};

// export the functions
module.exports = {
  addLeave,
  getLeaveByEmpId,
  deleteLeaveById,
  getMonthwiseReport,
  updateLeaveById,
  getMonthwiseLeaves,
};
