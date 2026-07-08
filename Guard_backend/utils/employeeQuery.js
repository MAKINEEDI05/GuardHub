// Shared employee-scope filter for report endpoints. Builds the Mongo filter
// for the active-employee master from the common query params: a free-text
// search (Employee ID / Name / Mobile), plus exact department / designation /
// employee-id. Used by the Leave report/manage endpoints and the Attendance
// Muster Roll so the "who" filtering lives in one place.
const { ACTIVE_FILTER } = require("./employeeRef");

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function employeeScopeFilter(query) {
  const f = { ...ACTIVE_FILTER };
  const exactCI = (v) => new RegExp(`^${escapeRx(String(v).trim())}$`, "i");

  if (query.empId !== undefined && query.empId !== "" && !Number.isNaN(parseInt(query.empId, 10)))
    f.empId = parseInt(query.empId, 10);
  if (query.department && String(query.department).trim())
    f.empDepartment = exactCI(query.department);
  if (query.designation && String(query.designation).trim())
    f.empDesignation = exactCI(query.designation);

  const search = query.search && String(query.search).trim();
  if (search) {
    const rx = new RegExp(escapeRx(search), "i");
    const asNum = parseInt(search, 10);
    const or = [
      { empName: rx },
      // mobile is a Number — match on its string form for partials
      { $expr: { $regexMatch: { input: { $toString: "$empMobileNo" }, regex: search, options: "i" } } },
    ];
    if (!Number.isNaN(asNum)) or.push({ empId: asNum });
    f.$and = [{ $or: or }];
  }
  return f;
}

module.exports = { employeeScopeFilter, escapeRx };
