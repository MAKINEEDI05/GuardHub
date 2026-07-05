import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Leave Management v2 API. All responses use the { message, data } envelope, so
// each method unwraps `data` (falling back to []/{}) — pages never see axios
// shapes. empId is a Number in the backend leave model; callers pass Numbers.

export const leaveTypeService = {
  async list(activeOnly = false) {
    const { data } = await apiClient.get(ENDPOINTS.leaveTypes, {
      params: activeOnly ? { activeOnly: true } : {},
    });
    return Array.isArray(data?.data) ? data.data : [];
  },
  async create(payload) {
    const { data } = await apiClient.post(ENDPOINTS.leaveTypes, payload);
    return data?.data;
  },
  async update(id, payload) {
    const { data } = await apiClient.put(ENDPOINTS.leaveType(id), payload);
    return data?.data;
  },
  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.leaveType(id));
    return data?.data;
  },
};

export const leaveBalanceService = {
  // -> { year, types:[...], data:[{empId,empName,byType,totals}] }
  async list(year, empId) {
    const { data } = await apiClient.get(ENDPOINTS.leaveBalances, {
      params: { year, ...(empId ? { empId } : {}) },
    });
    return { types: data?.types || [], data: Array.isArray(data?.data) ? data.data : [] };
  },
  async allocate(payload) {
    const { data } = await apiClient.post(ENDPOINTS.leaveAllocate, payload);
    return data;
  },
};

export const leaveTxnService = {
  async list(filters = {}) {
    const { data } = await apiClient.get(ENDPOINTS.leaveTransactions, {
      params: clean(filters),
    });
    return Array.isArray(data?.data) ? data.data : [];
  },
  async record(payload) {
    const { data } = await apiClient.post(ENDPOINTS.leaveTransactions, payload);
    return data?.data;
  },
  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.leaveTransaction(id));
    return data;
  },
};

export const leaveReportService = {
  // -> { year, data:[...rows], summary:{...} }
  async summary(filters = {}) {
    const { data } = await apiClient.get(ENDPOINTS.leaveReport, {
      params: clean(filters),
    });
    return { data: Array.isArray(data?.data) ? data.data : [], summary: data?.summary || {} };
  },
  async monthly(filters = {}) {
    const { data } = await apiClient.get(ENDPOINTS.leaveMonthlySummary, {
      params: clean(filters),
    });
    return Array.isArray(data?.data) ? data.data : [];
  },
};

// Drop empty/blank params so a cleared filter doesn't send "".
function clean(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) out[k] = v;
  });
  return out;
}
