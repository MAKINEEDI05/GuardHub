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
