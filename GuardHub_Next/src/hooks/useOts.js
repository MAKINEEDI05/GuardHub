import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { otService } from "../services/otService";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

export function useOts() {
  return useQuery({ queryKey: QK.ot, queryFn: otService.all });
}

export function useApplyOt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => otService.apply(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.ot });
      toast.success("OT applied successfully.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to apply OT."),
  });
}

export function useUpdateOt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => otService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.ot });
      toast.success("OT updated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to update OT."),
  });
}

export function useDeleteOt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => otService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.ot });
      toast.success("OT deleted.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to delete OT."),
  });
}
