const roster = require("../models/rosterScheme");

// add employee shifts
const addEmployeShift = async (req, res) => {
  try {
    const {
      empId,
      empName,
      mobileNo,
      department,
      designation,
      weeklyShifts: {
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
      },
    } = req.body;
    const newEmployeeShift = new roster({
      empId,
      empName,
      mobileNo,
      department,
      designation,
      weeklyShifts: {
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
      },
    });

    await newEmployeeShift.save();
    res
      .status(201)
      .json({ message: "Employee shift added successfully", newEmployeeShift });
  } catch (error) {
    res.status(500).json({ message: "Failed to add employee shift", error });
  }
};

// update
const updateRoster = async (req, res) => {
  try {
    const updated = await roster.findOneAndUpdate(
      { empId: req.params.empId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Roster not found" });
    }
    res.json({ message: "Roster updated successfully", updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update roster", error });
  }
};

// Get all od records
const getAllgurds = async (req, res) => {
  try {
    const gurds = await roster.find();
    res.json(gurds);
  } catch (error) {
    res.status(500).json({ message: "Error fetching leaves", error });
  }
};

// Get od by empId
const getGurdByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const gurd = await roster.find({ empId: empId });

    if (!gurd || gurd.length === 0) {
      return res
        .status(404)
        .json({ message: "Gurd not found for this employeID" });
    }

    res.json(gurd);
  } catch (error) {
    console.error("Error fetching Gurd:", error);
    res.status(500).json({ message: "Error fetching Gurd", error });
  }
};

const deleteGurd = async (req, res) => {
  try {
    const result = await roster.deleteOne({ empId: req.params.empId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Roster not found" });
    }
    res.json({ message: "Roster deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete roster", error });
  }
};

// export the functions
module.exports = {
  addEmployeShift,
  updateRoster,
  getAllgurds,
  getGurdByEmpId,
  deleteGurd,
};
