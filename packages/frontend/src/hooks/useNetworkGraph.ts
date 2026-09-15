import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { NetworkGraphData } from "@/types/network";

export function useNetworkGraph() {
  return useQuery({
    queryKey: ["dashboard-network"],
    queryFn: () => apiGet<NetworkGraphData>("/api/dashboard/network"),
  });
}
