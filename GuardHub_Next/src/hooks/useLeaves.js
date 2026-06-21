import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveService } from "../services/leaveService";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

const WIDE = { from: "2000-01-01", to: "2100-01-01" };

export function useLeaves(fromDate = WIDE.from, toDate = WIDE.to) {
  return useQuery({
    queryKey: QK.leavesRange(fromDate, toDate),
    queryFn: () => leaveService.byRange(fromDate, toDate),
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => leaveService.apply(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave applied successfully.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to apply leave."),
  });
}

export function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => leaveService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave updated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to update leave."),
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leaveService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave deleted.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to delete leave."),
  });
}
