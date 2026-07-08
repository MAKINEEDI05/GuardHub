import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  leaveTypeService,
  leaveBalanceService,
  leaveTxnService,
  leaveReportService,
  leaveManageService,
} from "../services/leaveV2Service";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

// Recording/deleting a leave touches types (usage), balances and transactions,
// so mutations invalidate all three prefixes plus the legacy "leaves" cache
// (kept in sync by the backend dual-write).
function invalidateLeave(qc) {
  // Every cache that reads leave balances/types, so a change (incl. a quota edit
  // that syncs allocations) refreshes Leave Management, Apply Leave, the drawer,
  // View Leaves, reports and the dashboard cards.
  ["leave-types", "leave-balances", "leave-transactions", "leave-manage", "leave-report", "leave-dashboard", "leaves"].forEach(
    (key) => qc.invalidateQueries({ queryKey: [key] })
  );
}

/* ---- Unified Employee Leave Management ---- */
export function useLeaveManage(filters = {}) {
  return useQuery({
    queryKey: QK.leaveManage(filters),
    queryFn: () => leaveManageService.list(filters),
    placeholderData: keepPreviousData,
  });
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
      // A quota change syncs allocations, so refresh every leave-balance cache.
      invalidateLeave(qc);
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
      invalidateLeave(qc);
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
export function useUpdateLeaveTxn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => leaveTxnService.update(id, payload),
    onSuccess: () => {
      invalidateLeave(qc);
      toast.success("Leave updated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to update leave."),
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
