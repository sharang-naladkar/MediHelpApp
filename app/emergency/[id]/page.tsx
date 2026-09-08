"use client";

import { Suspense, use } from "react";
import { AppShell } from "@/components/AppShell";
import StatusScreen from "@/components/StatusScreen";

export default function EmergencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="m-auto text-slate-500">Loading…</p>
        </AppShell>
      }
    >
      <StatusScreen emergencyId={id} />
    </Suspense>
  );
}
