import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Legacy leave range list (leave_mgmts), used by the Dashboard's recent-leaves
// card. All create/edit/delete now goes through the Leave v2 transaction API
// (leaveV2Service). Range list returns { message, data: [...] }.
export const leaveService = {
  async byRange(fromDate, toDate) {
    const { data } = await apiClient.get(ENDPOINTS.leavesByRange, {
      params: { fromDate, toDate },
    });
    return Array.isArray(data?.data) ? data.data : [];
  },
};
