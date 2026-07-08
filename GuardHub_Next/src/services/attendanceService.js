import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Day-wise attendance is sourced from the REAL biometric collection
// (secattendancelogs) via /attendance/get-attendace-bydate/:date. The backend
// returns { message, data: [...] }. The alternative `today-attendance-data`
// depends on an external biometric HTTP API (ATTENDANCE_LOG_API) that is not
// reliably reachable, so it is intentionally NOT used for the report grid.
export const attendanceService = {
  async byDate(date) {
    const { data } = await apiClient.get(ENDPOINTS.attendanceByDate(date));
    return Array.isArray(data?.data) ? data.data : [];
  },

  async byEmp(empId) {
    const { data } = await apiClient.get(ENDPOINTS.attendanceByEmp(empId));
    return Array.isArray(data) ? data : [];
  },

  // Attendance Muster Roll (per-day grid + monthly summary). All filtering is
  // server-side. -> { year, month, monthName, dim, dayColumns, data:[...] }
  async musterRoll(filters = {}) {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) params[k] = v;
    });
    const { data } = await apiClient.get(ENDPOINTS.musterRoll, { params });
    return {
      year: data?.year,
      month: data?.month,
      monthName: data?.monthName || "",
      dim: data?.dim || 0,
      dayColumns: Array.isArray(data?.dayColumns) ? data.dayColumns : [],
      data: Array.isArray(data?.data) ? data.data : [],
      filters: data?.filters || {},
    };
  },
};
