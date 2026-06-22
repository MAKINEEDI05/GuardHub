import { useQuery } from "@tanstack/react-query";
import { reportService } from "../services/reportService";
import { attendanceService } from "../services/attendanceService";
import { QK } from "../api/queryClient";

export function useAttendanceByDate(date, enabled = true) {
  return useQuery({
    queryKey: QK.attendanceByDate(date),
    queryFn: () => attendanceService.byDate(date),
    enabled: !!date && enabled,
  });
}

export function useMonthwise(empId, startDate, endDate, enabled = true) {
  return useQuery({
    queryKey: QK.monthwise(empId, startDate, endDate),
    queryFn: () => reportService.monthwise(empId, startDate, endDate),
    enabled: !!empId && !!startDate && !!endDate && enabled,
  });
}

// All-employees month-wise summary. No employee selection required — loads
// every employee's attendance for the date range so the page can show the
// full table by default and filter client-side.
export function useMonthwiseSummary(startDate, endDate, enabled = true) {
  return useQuery({
    queryKey: QK.monthwiseSummary(startDate, endDate),
    queryFn: () => reportService.monthwiseSummary(startDate, endDate),
    enabled: !!startDate && !!endDate && enabled,
  });
}
