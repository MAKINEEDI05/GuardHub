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
