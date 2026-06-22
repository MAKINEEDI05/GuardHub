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

  // All-employees summary over a date range, computed server-side in one call.
  // Returns { data: rows[], totals, total, startDate, endDate, totalDays }.
  // The page fetches the full filtered set and paginates client-side (the
  // dataset is small), so page/limit are left to the backend default (all).
  async monthwiseSummary(startDate, endDate) {
    const { data } = await apiClient.get(ENDPOINTS.monthwiseSummary, {
      params: { startDate, endDate },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      totals: data?.totals || null,
      totalDays: data?.totalDays ?? 0,
      startDate: data?.startDate,
      endDate: data?.endDate,
    };
  },
};
