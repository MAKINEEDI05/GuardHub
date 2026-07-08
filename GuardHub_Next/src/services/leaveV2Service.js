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
  async update(id, payload) {
    const { data } = await apiClient.put(ENDPOINTS.leaveTransaction(id), payload);
    return data?.data;
  },
  async remove(id) {
    const { data } = await apiClient.delete(ENDPOINTS.leaveTransaction(id));
    return data;
  },
};

// Unified Employee Leave Management dataset (filtered, server-side).
// -> { year, types:[...], data:[{empId,empName,empDepartment,empDesignation,
//      allocated,taken,remaining,byType:[...]}], totals:{...} }
export const leaveManageService = {
  async list(filters = {}) {
    const { data } = await apiClient.get(ENDPOINTS.leaveManage, { params: clean(filters) });
    return {
      data: Array.isArray(data?.data) ? data.data : [],
      totals: data?.totals || { employees: 0, allocated: 0, taken: 0, remaining: 0 },
      types: Array.isArray(data?.types) ? data.types : [],
    };
  },
};

export const leaveReportService = {
  // -> { onLeaveToday:[...], onLeaveTodayCount, lowBalance:[...], lowBalanceCount }
  async dashboardOverview(year, threshold) {
    const { data } = await apiClient.get(ENDPOINTS.leaveDashboardOverview, {
      params: clean({ year, threshold }),
    });
    return {
      onLeaveToday: Array.isArray(data?.onLeaveToday) ? data.onLeaveToday : [],
      onLeaveTodayCount: data?.onLeaveTodayCount || 0,
      lowBalance: Array.isArray(data?.lowBalance) ? data.lowBalance : [],
      lowBalanceCount: data?.lowBalanceCount || 0,
    };
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
