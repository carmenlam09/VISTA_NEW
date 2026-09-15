import { Outlet } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { VendorHeader } from "./VendorHeader";

export function AppShell() {
  return (
    // The sidebar now runs the full viewport height, so the shell is a plain
    // two-column row - the brand accent lives under the utility bar instead
    // of as a rule across the top edge.
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <VendorHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
