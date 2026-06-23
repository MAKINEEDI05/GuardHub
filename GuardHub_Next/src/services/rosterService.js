import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Roster records. empId stored as String. weeklyShifts is an object keyed by
// lowercase weekday (sunday..saturday). Bulk upload upserts on empId
// (exists -> update, else create) and expects a flat { rows: [...] } payload
// where each row has weekday columns at the top level.
export const rosterService = {
  async list() {
    const { data } = await apiClient.get(ENDPOINTS.rosters);
    return Array.isArray(data) ? data : [];
  },

  // Server-side paginated + filtered list. Returns
  // { records, totalRecords, totalPages, currentPage }.
  async listPaged({ page = 1, limit = 20, search = "", shift = "", department = "" } = {}) {
    const params = { page, limit };
    if (search) params.search = search;
    if (shift) params.shift = shift;
    if (department) params.department = department;
    const { data } = await apiClient.get(ENDPOINTS.rosters, { params });
    // Be tolerant if the backend returns a bare array (legacy).
    if (Array.isArray(data)) {
      return {
        records: data,
        totalRecords: data.length,
        totalPages: 1,
        currentPage: 1,
      };
    }
    return {
      records: data.records || [],
      totalRecords: data.totalRecords || 0,
      totalPages: data.totalPages || 1,
      currentPage: data.currentPage || page,
    };
  },

  // Full roster list with the SAME filters as the table but no pagination —
  // used by Export so the CSV reflects the active search/shift/department
  // filters across all pages. Omitting page/limit makes the backend return the
  // complete filtered array.
  async listAllFiltered({ search = "", shift = "", department = "" } = {}) {
    const params = {};
    if (search) params.search = search;
    if (shift) params.shift = shift;
    if (department) params.department = department;
    const { data } = await apiClient.get(ENDPOINTS.rosters, { params });
    if (Array.isArray(data)) return data;
    return data?.records || [];
  },

  async byEmp(empId) {
    const { data } = await apiClient.get(ENDPOINTS.rosterByEmp(empId));
    return Array.isArray(data) ? data : [];
  },

  async add(payload) {
    const { data } = await apiClient.post(ENDPOINTS.addRoster, payload);
    return data;
  },

  async update(empId, payload) {
    const { data } = await apiClient.put(ENDPOINTS.updateRoster(empId), payload);
    return data;
  },

  async remove(empId) {
    const { data } = await apiClient.delete(ENDPOINTS.deleteRoster(empId));
    return data;
  },

  async bulkUpload(rows, uploadedBy = "admin") {
    const { data } = await apiClient.post(ENDPOINTS.bulkUploadRoster, {
      rows,
      uploadedBy,
    });
    return data;
  },
};
