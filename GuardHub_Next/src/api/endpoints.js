// Central registry of the backend routes the app actually calls. Keeping them
// here means a backend path change is a one-line edit. (Legacy backend routes
// that the frontend no longer calls are intentionally not listed.)
export const ENDPOINTS = {
  // Auth
  login: "/login",

  // Employees (profile) — mounted at /emp
  employees: "/emp/get-emp-details",
  addEmployee: "/emp/add-employee", // multipart, field: empImage
  bulkUploadEmployees: "/emp/bulk-upload", // JSON { rows: [...] }, upsert by empId
  updateEmployee: (empId) => `/emp/update-emp-byid/${empId}`,
  deleteEmployee: (empId) => `/emp/delete-emp-byid/${empId}`,
  empImageBase: "/emp/uploads",

  // Attendance — mounted at /attendance
  attendanceByDate: (date) => `/attendance/get-attendace-bydate/${date}`,
  musterRoll: "/attendance/muster-roll", // ?year&month&department&designation&shift&search

  // Month-wise report — mounted at /month
  monthwiseSummary: "/month/monthwise-summary", // ?startDate&endDate&empId&search&page&limit

  // Leave (legacy) — mounted at /leave. Only the range list is still called
  // (Dashboard recent-leaves); all CRUD goes through the Leave v2 API below.
  leavesByRange: "/leave/get-month-wise-leaves", // ?fromDate&toDate

  // Leave Management v2 — mounted at /leave
  leaveTypes: "/leave/types", // ?activeOnly=true ; POST create
  leaveType: (id) => `/leave/types/${id}`, // PUT / DELETE(deactivate)
  leaveBalances: "/leave/balances", // ?year&empId
  leaveAllocate: "/leave/balances/allocate", // POST { year, allocations[], empIds? }
  leaveReset: "/leave/balances/reset", // POST { year? } — academic reset (Comp Off carries forward)
  leaveTransactions: "/leave/transactions", // GET(filters) / POST record
  leaveTransaction: (id) => `/leave/transactions/${id}`, // PUT edit / DELETE
  leaveManage: "/leave/manage", // unified filtered summary (search/dept/desig/year/month/date/type)
  leaveDashboardOverview: "/leave/dashboard-overview", // ?year&threshold — on-leave-today + low-balance

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
  rosterByEmp: (empId) => `/roster/get-guard-shift/${empId}`, // one employee's weekly roster
  addRoster: "/roster/add-emp-shift",
  updateRoster: (empId) => `/roster/update-emp-roster/${empId}`,
  deleteRoster: (empId) => `/roster/guard-delete-byid/${empId}`,
  bulkUploadRoster: "/roster/bulk-upload",
};
