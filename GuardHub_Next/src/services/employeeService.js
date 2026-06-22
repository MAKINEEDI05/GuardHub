import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Build a multipart FormData body for add/update. The image field MUST be named
// `empImage` (multer config) and the backend names the stored file `${empId}${ext}`,
// so empId must be present for an image upload to work.
function toFormData(values, imageFile) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, v);
  });
  if (imageFile) fd.append("empImage", imageFile);
  return fd;
}

export const employeeService = {
  async list() {
    const { data } = await apiClient.get(ENDPOINTS.employees);
    return Array.isArray(data) ? data : [];
  },

  // Live distinct designation/department values for the filter dropdowns.
  async filterOptions() {
    const { data } = await apiClient.get(ENDPOINTS.employeeFilterOptions);
    return {
      designations: Array.isArray(data?.designations) ? data.designations : [],
      departments: Array.isArray(data?.departments) ? data.departments : [],
    };
  },

  async getById(empId) {
    const { data } = await apiClient.get(ENDPOINTS.employeeById(empId));
    return data;
  },

  async add(values, imageFile) {
    const { data } = await apiClient.post(
      ENDPOINTS.addEmployee,
      toFormData(values, imageFile),
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  // Bulk add/update employees. The backend upserts on empId (exists -> update,
  // else create) and returns { totalRows, added, updated, skipped, failed,
  // invalidRecords, duplicateRecords, failedRecords }.
  async bulkUpload(rows) {
    const { data } = await apiClient.post(ENDPOINTS.bulkUploadEmployees, {
      rows,
    });
    return data;
  },

  async update(empId, values, imageFile) {
    const { data } = await apiClient.put(
      ENDPOINTS.updateEmployee(empId),
      toFormData(values, imageFile),
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  async remove(empId) {
    const { data } = await apiClient.delete(ENDPOINTS.deleteEmployee(empId));
    return data;
  },
};
