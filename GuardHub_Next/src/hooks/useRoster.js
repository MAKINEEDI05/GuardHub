import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rosterService } from "../services/rosterService";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

export function useRosters() {
  return useQuery({ queryKey: QK.rosters, queryFn: rosterService.list });
}

export function useAddRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => rosterService.add(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rosters });
      toast.success("Roster entry added.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to add roster."),
  });
}

export function useUpdateRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, payload }) => rosterService.update(empId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rosters });
      toast.success("Roster updated.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to update roster."),
  });
}

export function useDeleteRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (empId) => rosterService.remove(empId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rosters });
      toast.success("Roster entry deleted.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to delete roster."),
  });
}

export function useBulkUploadRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, uploadedBy }) =>
      rosterService.bulkUpload(rows, uploadedBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.rosters }),
    onError: (e) => toast.error(e.friendlyMessage || "Bulk upload failed."),
  });
}
