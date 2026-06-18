const axios = require("axios");

const getMonthwiseReport = async (req, res) => {
  const empId = req.params.empId;
  console.log("empId:", empId);

  try {
    const [leaves, attendance, ods] = await axios.all([
      axios.get(`http://117.250.198.88:9002/leave/monthLeaves/${empId}`),
      axios.get(`http://117.250.198.88:9002/attendance/monthwise/${empId}`),
      axios.get(`http://117.250.198.88:9002/od/month/ods/${empId}`),
    ]);
    const leavedata = leaves.data;
    const attendancedata = attendance.data;
    const oddata = ods.data;
    // console.log(attendancedata);
    const combinedReport = {
      leaves: leavedata.data,
      attendance: attendancedata.data,
      ods: oddata.data,
    };

    res.json({ monthwiseReport: "calculated values here", combinedReport });
  } catch (err) {
    res.status(500).json({ error: "Failed to get data" });
  }
};
module.exports = { getMonthwiseReport };
