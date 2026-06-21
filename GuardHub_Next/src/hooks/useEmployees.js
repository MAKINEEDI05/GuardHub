import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeService } from "../services/employeeService";
import { QK } from "../api/queryClient";
import { toast } from "../store/toastStore";

// Employee master list — cached and reused by every page that needs to search
// or resolve an employee (apply forms, reports, roster). Single source.
export function useEmployees() {
  return useQuery({
    queryKey: QK.employees,
    queryFn: employeeService.list,
    staleTime: 5 * 60_000,
  });
}

export function useEmployee(empId, enabled = true) {
  return useQuery({
    queryKey: QK.employee(empId),
    queryFn: () => employeeService.getById(empId),
    enabled: !!empId && enabled,
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ values, imageFile }) =>
      employeeService.add(values, imageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.employees });
      toast.success("Employee added successfully.");
    },
    onError: (e) => toast.error(e.friendlyMessage || "Failed to add employee."),
  });
}

// Bulk upsert a batch of employee rows. The bulk-upload drawer chunks a CSV
// for progress; each chunk is one mutation. Invalidates the list on success.
export function useBulkUploadEmployees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows) => employeeService.bulkUpload(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.employees }),
    onError: (e) => toast.error(e.friendlyMessage || "Bulk upload failed."),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, values, imageFile }) =>
      employeeService.update(empId, values, imageFile),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK.employees });
      qc.invalidateQueries({ queryKey: QK.employee(vars.empId) });
      toast.success("Employee updated successfully.");
    },
    onError: (e) =>
      toast.error(e.friendlyMessage || "Failed to update employee."),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (empId) => employeeService.remove(empId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.employees });
      toast.success("Employee deleted.");
    },
    onError: (e) =>
      toast.error(e.friendlyMessage || "Failed to delete employee."),
  });
}
