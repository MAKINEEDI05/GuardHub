const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const leaveRoutes = require("./Routers/leaveRoutes");
const odRoutes = require("./Routers/odRoutes");
const rosterRoutes = require("./Routers/rosterRoutes");
const otRoutes = require("./Routers/otRoutes");
const attendanceRouter = require("./Routers/empAttendanceRoutes");
const profile = require("./Routers/profileRouters");
const monthLeaves = require("./Routers/monthWiseReportRoutes");
const loginRouter = require("./Routers/loginRouters");
const {attendanceAdding} = require("./Controllers/scheduleController");

const path = require("path");
require("dotenv").config();
// const scheduleControll = require("./Controllers/scheduleController");

// Initialize express
const app = express();

// Connect to MongoDB Atlas
const PORT = process.env.PORT || 9002;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log(" MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Middleware to serve uploaded images
app.use("/emp/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cors());
app.use(express.json());
// app.use(cors({ origin: "http://210.212.210.89:9001" }));
app.use(cors());

// Routes
app.use("/", loginRouter);
app.use("/emp", profile);
app.use("/leave", leaveRoutes);
app.use("/od", odRoutes);
app.use("/roster", rosterRoutes);
app.use("/ot", otRoutes);
app.use("/attendance", attendanceRouter);
app.use("/month", monthLeaves);

// Checking
app.get("/", (req, res) => {
  res.send("server running successfully...!");
});

// Start server
app.listen(PORT, () => {
  // console.log(`Server is running on port ${PORT}`
  //   console.log("Server started on port 8000");

  // Call your scheduling logic here:
  // console.log("Starting cron jobs...");

  // setTimeout(() => {
  //   console.log("calling shiftC out and shiftA in");
  //   attendanceAdding("12:00:00", "13:50:00");
  // }, 4000);

//   cron.schedule("0 35 9 * * *", () => attendanceAdding("8:00:00", "9:30:00"), {
//     timezone: "Asia/Kolkata",
//   });

//   cron.schedule("0 35 18 * * *", () => attendanceAdding("17:40:00", "18:30:00"), {
//     timezone: "Asia/Kolkata",
//   });

//   cron.schedule("0 00 7 * * *", () => attendanceAdding("05:00:00", "06:50:00"), {
//     timezone: "Asia/Kolkata",
//   });

//   cron.schedule("0 02 13 * * *", () => attendanceAdding("12:00:00", "13:50:00"), {
//     timezone: "Asia/Kolkata",
//   });

//   cron.schedule("0 00 22 * * *", () => attendanceAdding("20:00:00", "21:50:00"), {
//     timezone: "Asia/Kolkata",
// });
});
