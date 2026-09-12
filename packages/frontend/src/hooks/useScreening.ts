import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ScreeningAggregate } from "@/types/screening";

export function screeningQueryKey(vendorId: string | undefined) {
  return ["screening", vendorId] as const;
}

export function useScreening(vendorId: string | undefined) {
  return useQuery({
    queryKey: screeningQueryKey(vendorId),
    queryFn: () => apiGet<ScreeningAggregate>(`/api/vendors/${vendorId}/screening`),
    enabled: Boolean(vendorId),
  });
}
