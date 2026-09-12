import type { NetrevealRecord } from "@/types/screening";

import { NetrevealCard } from "./NetrevealCard";

export function NetrevealWatchlistSection({
  vendorId,
  records,
}: {
  vendorId: string;
  records: NetrevealRecord[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">NetReveal Watchlist</h2>
      {records.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No NetReveal searches yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {records.map((record) => (
            <NetrevealCard key={record.id} vendorId={vendorId} record={record} />
          ))}
        </div>
      )}
    </section>
  );
}
