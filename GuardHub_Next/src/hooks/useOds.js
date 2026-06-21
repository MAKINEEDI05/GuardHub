import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { odService } from "../services/odService";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

const WIDE = { from: "2000-01-01", to: "2100-01-01" };

export function useOds(fromDate = WIDE.from, toDate = WIDE.to) {
  return useQuery({
    queryKey: QK.odsRange(fromDate, toDate),
    queryFn: () => odService.byRange(fromDate, toDate),
  });
}

export function useApplyOd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => odService.apply(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ods"] });
      toast.success("OD applied successfully.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to apply OD."),
  });
}

export function useUpdateOd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => odService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ods"] });
      toast.success("OD updated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to update OD."),
  });
}

export function useDeleteOd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => odService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ods"] });
      toast.success("OD deleted.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to delete OD."),
  });
}
