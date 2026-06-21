import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// OD (On-Duty) records. empId stored as Number. Range list returns
// { message, data: [...] }.
export const odService = {
  async apply(payload) {
    const { data } = await apiClient.post(ENDPOINTS.applyOd, payload);
    return data;
  },

  async byRange(fromDate, toDate) {
    const { data } = await apiClient.get(ENDPOINTS.odsByRange, {
      params: { fromDate, toDate },
    });
    return Array.isArray(data?.data) ? data.data : [];
  },

  async byEmp(empId) {
    try {
      const { data } = await apiClient.get(ENDPOINTS.odByEmp(empId));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e.response?.status === 404) return [];
      throw e;
    }
  },

  async update(id, payload) {
    const { data } = await apiClient.put(ENDPOINTS.updateOd(id), payload);
    return data;
  },

  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.deleteOd(id));
    return data;
  },
};
