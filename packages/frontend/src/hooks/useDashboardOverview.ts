import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { DashboardOverview } from "@/types/overview";

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => apiGet<DashboardOverview>("/api/dashboard/overview"),
  });
}
