import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { VendorDetail } from "@/types/vendor";

export function vendorQueryKey(vendorId: string | undefined) {
  return ["vendor", vendorId] as const;
}

export function useVendor(vendorId: string | undefined) {
  return useQuery({
    queryKey: vendorQueryKey(vendorId),
    queryFn: () => apiGet<VendorDetail>(`/api/vendors/${vendorId}`),
    enabled: Boolean(vendorId),
  });
}
