import { QueryClient } from "@tanstack/react-query";

// Shared React Query client. Conservative defaults tuned for a small (<500
// employee) dataset: cache aggressively, avoid refetch storms, retry once.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — data rarely changes within a view
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Stable query keys so caches are shared and invalidations are precise.
export const QK = {
  employees: ["employees"],
  rosters: ["rosters"],
  rosterByEmp: (empId) => ["roster-by-emp", empId],
  leavesRange: (from, to) => ["leaves", from, to],
  // Leave Management v2
  leaveTypes: ["leave-types"],
  leaveBalances: (year, empId) => ["leave-balances", year, empId || "all"],
  leaveTransactions: (filters = {}) => ["leave-transactions", filters],
  leaveManage: (filters = {}) => ["leave-manage", filters],
  leaveDashboard: (year, threshold) => ["leave-dashboard", year, threshold],
  odsRange: (from, to) => ["ods", from, to],
  ot: ["ot"],
  attendanceByDate: (date) => ["attendance", date],
  monthwiseSummary: (from, to) => ["monthwise-summary", from, to],
  musterRoll: (filters = {}) => ["muster-roll", filters],
};
