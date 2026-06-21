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
};
