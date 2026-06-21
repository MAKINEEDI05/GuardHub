import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// OT (Overtime) records. The OT schema uses `employeeId` (Number), not empId.
// Employee name/designation/department are denormalised server-side from the
// employee master — never sent from the client. All list endpoints return
// { message, data: [...] }.
export const otService = {
  async apply(payload) {
    const { data } = await apiClient.post(ENDPOINTS.applyOt, payload);
    return data;
  },

  async all() {
    const { data } = await apiClient.get(ENDPOINTS.allOt);
    return Array.isArray(data?.data) ? data.data : [];
  },

  async byEmp(empId) {
    const { data } = await apiClient.get(ENDPOINTS.otByEmp(empId));
    return Array.isArray(data?.data) ? data.data : [];
  },

  async update(id, payload) {
    const { data } = await apiClient.put(ENDPOINTS.updateOt(id), payload);
    return data;
  },

  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.deleteOt(id));
    return data;
  },
};
