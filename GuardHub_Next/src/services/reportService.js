import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Month-wise summary. Backend returns { message, summary: { presentDays,
// absentDays, leaveDays, odDays, weekOffDays, totalDays, ... } }.
// NOTE: the legacy frontend also called /leaves/remaining-cl/:empId — that
// route does NOT exist in the backend, so it is omitted here.
export const reportService = {
  async monthwise(empId, startDate, endDate) {
    const { data } = await apiClient.get(ENDPOINTS.monthwiseReport(empId), {
      params: { startDate, endDate },
    });
    return data?.summary || null;
  },
};
