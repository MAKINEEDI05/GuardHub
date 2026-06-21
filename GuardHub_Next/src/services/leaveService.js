import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Leave records. empId is stored as a Number in the backend leave schema.
// Range list returns { message, data: [...] }.
export const leaveService = {
  async apply(payload) {
    const { data } = await apiClient.post(ENDPOINTS.applyLeave, payload);
    return data;
  },

  async byRange(fromDate, toDate) {
    const { data } = await apiClient.get(ENDPOINTS.leavesByRange, {
      params: { fromDate, toDate },
    });
    return Array.isArray(data?.data) ? data.data : [];
  },

  async byEmp(empId) {
    try {
      const { data } = await apiClient.get(ENDPOINTS.leaveByEmp(empId));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      // Backend returns 404 when an employee has no leaves — treat as empty.
      if (e.response?.status === 404) return [];
      throw e;
    }
  },

  async update(id, payload) {
    const { data } = await apiClient.put(ENDPOINTS.updateLeave(id), payload);
    return data;
  },

  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.deleteLeave(id));
    return data;
  },
};
