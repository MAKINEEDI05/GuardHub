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
  employee: (id) => ["employee", String(id)],
  rosters: ["rosters"],
  leavesRange: (from, to) => ["leaves", from, to],
  odsRange: (from, to) => ["ods", from, to],
  ot: ["ot"],
  attendanceByDate: (date) => ["attendance", date],
  monthwise: (id, from, to) => ["monthwise", String(id), from, to],
};
