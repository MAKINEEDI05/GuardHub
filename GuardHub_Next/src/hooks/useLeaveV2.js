import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  leaveTypeService,
  leaveBalanceService,
  leaveTxnService,
  leaveReportService,
} from "../services/leaveV2Service";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

// Recording/deleting a leave touches types (usage), balances and transactions,
// so mutations invalidate all three prefixes plus the legacy "leaves" cache
// (kept in sync by the backend dual-write).
function invalidateLeave(qc) {
  ["leave-types", "leave-balances", "leave-transactions", "leave-report", "leaves"].forEach(
    (key) => qc.invalidateQueries({ queryKey: [key] })
  );
}

/* ---- Leave Types ---- */
export function useLeaveTypes(activeOnly = false) {
  return useQuery({
    queryKey: [...QK.leaveTypes, activeOnly],
    queryFn: () => leaveTypeService.list(activeOnly),
    staleTime: 5 * 60_000,
  });
}
export function useSaveLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) =>
      id ? leaveTypeService.update(id, payload) : leaveTypeService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.leaveTypes });
      toast.success("Leave type saved.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to save leave type."),
  });
}
export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leaveTypeService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.leaveTypes });
      toast.success("Leave type deactivated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to deactivate."),
  });
}

/* ---- Balances ---- */
export function useLeaveBalances(year, empId, opts = {}) {
  return useQuery({
    queryKey: QK.leaveBalances(year, empId),
    queryFn: () => leaveBalanceService.list(year, empId),
    placeholderData: keepPreviousData,
    ...opts,
  });
}
export function useAllocateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => leaveBalanceService.allocate(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success(`Allocated to ${res?.employees ?? 0} employee(s).`);
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to allocate."),
  });
}

/* ---- Transactions ---- */
export function useLeaveTransactions(filters = {}, opts = {}) {
  return useQuery({
    queryKey: QK.leaveTransactions(filters),
    queryFn: () => leaveTxnService.list(filters),
    placeholderData: keepPreviousData,
    ...opts,
  });
}
export function useRecordLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => leaveTxnService.record(payload),
    onSuccess: () => {
      invalidateLeave(qc);
      toast.success("Leave recorded.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to record leave."),
  });
}
export function useDeleteLeaveTxn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leaveTxnService.remove(id),
    onSuccess: () => {
      invalidateLeave(qc);
      toast.success("Leave deleted.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to delete leave."),
  });
}

/* ---- Report ---- */
export function useLeaveReport(filters = {}) {
  return useQuery({
    queryKey: QK.leaveReport(filters),
    queryFn: () => leaveReportService.summary(filters),
    placeholderData: keepPreviousData,
  });
}

/* ---- Dashboard overview (on-leave-today + low-balance) ---- */
export function useLeaveDashboardOverview(year, threshold) {
  return useQuery({
    queryKey: QK.leaveDashboard(year, threshold),
    queryFn: () => leaveReportService.dashboardOverview(year, threshold),
    staleTime: 60_000,
  });
}
