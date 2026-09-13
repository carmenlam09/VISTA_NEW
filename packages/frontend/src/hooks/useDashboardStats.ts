import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { DashboardStats } from "@/types/dashboard";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiGet<DashboardStats>("/api/dashboard/stats"),
  });
}
