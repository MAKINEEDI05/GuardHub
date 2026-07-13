import { useQuery } from "@tanstack/react-query";
import { leaveService } from "../services/leaveService";
import { QK } from "../api/queryClient";

const WIDE = { from: "2000-01-01", to: "2100-01-01" };

// Legacy leave range list — used only by the Dashboard's recent-leaves card.
// Create/edit/delete now goes through the Leave v2 hooks (useLeaveV2).
export function useLeaves(fromDate = WIDE.from, toDate = WIDE.to) {
  return useQuery({
    queryKey: QK.leavesRange(fromDate, toDate),
    queryFn: () => leaveService.byRange(fromDate, toDate),
  });
}
