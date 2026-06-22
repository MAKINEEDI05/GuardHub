// Central registry of every backend route used by the app. Mirrors the actual
// Guard_backend Express routers exactly (verified against the controllers).
// Keeping them here means a backend path change is a one-line edit.
export const ENDPOINTS = {
  // Auth
  login: "/login",

  // Employees (profile) — mounted at /emp
  employees: "/emp/get-emp-details",
  employeeFilterOptions: "/emp/filter-options", // live distinct designations/departments
  employeeById: (empId) => `/emp/get-emp-byid/${empId}`,
  addEmployee: "/emp/add-employee", // multipart, field: empImage
  bulkUploadEmployees: "/emp/bulk-upload", // JSON { rows: [...] }, upsert by empId
  updateEmployee: (empId) => `/emp/update-emp-byid/${empId}`,
  deleteEmployee: (empId) => `/emp/delete-emp-byid/${empId}`,
  empImageBase: "/emp/uploads",

  // Attendance — mounted at /attendance
  attendanceByDate: (date) => `/attendance/get-attendace-bydate/${date}`,
  attendanceByEmp: (empId) => `/attendance/get-attendace-byid/${empId}`,
  addAttendance: "/attendance/add-attendace",
  updateAttendance: (empId) => `/attendance/update-attendace-byid/${empId}`,
  todayAttendance: "/attendance/today-attendance-data",

  // Month-wise report — mounted at /month
  monthwiseReport: (empId) => `/month/monthwise-report/${empId}`,
  monthwiseSummary: "/month/monthwise-summary", // ?startDate&endDate&empId&search&page&limit

  // Leave — mounted at /leave
  applyLeave: "/leave/apply-leave",
  leavesByRange: "/leave/get-month-wise-leaves", // ?fromDate&toDate
  leaveByEmp: (empId) => `/leave/get-leave-byid/${empId}`,
  updateLeave: (id) => `/leave/update-leave-byid/${id}`,
  deleteLeave: (id) => `/leave/delete-leave-byid/${id}`,

  // OD — mounted at /od
  applyOd: "/od/apply-od",
  odsByRange: "/od/get-ods", // ?fromDate&toDate
  odByEmp: (empId) => `/od/get-od-byid/${empId}`,
  updateOd: (id) => `/od/update-od-byid/${id}`,
  deleteOd: (id) => `/od/delete-od-byid/${id}`,

  // OT — mounted at /ot
  applyOt: "/ot/apply-ot",
  allOt: "/ot/get-ot",
  otByEmp: (empId) => `/ot/get-ot-by-empid/${empId}`,
  updateOt: (id) => `/ot/update-ot/${id}`,
  deleteOt: (id) => `/ot/delete-ot/${id}`,

  // Roster — mounted at /roster
  rosters: "/roster/get-emp-data",
  rosterByEmp: (empId) => `/roster/get-guard-shift/${empId}`,
  addRoster: "/roster/add-emp-shift",
  updateRoster: (empId) => `/roster/update-emp-roster/${empId}`,
  deleteRoster: (empId) => `/roster/guard-delete-byid/${empId}`,
  bulkUploadRoster: "/roster/bulk-upload",
};
