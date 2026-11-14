import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { DashboardError, DashboardSkeleton, DashboardView } from "@/components/dashboard/DashboardView";
import type { FinancialData } from "@/data/mockTransactions";
import { getCurrentUser } from "@/lib/auth/session";
import { getFinancialData } from "@/lib/server/transactions";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Loads the logged-in user's own transactions from MongoDB (per request, so it streams in
// inside <Suspense> while the rest of the app frame shows immediately).
async function UserDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fdashboard");

  let data: FinancialData;
  try {
    data = await getFinancialData(user.id);
  } catch (err) {
    unstable_rethrow(err); // never swallow Next.js internal signals
    console.error("[dashboard] Could not load data:", err instanceof Error ? err.message : err);
    return <DashboardError />;
  }
  return <DashboardView data={data} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UserDashboard />
    </Suspense>
  );
}
