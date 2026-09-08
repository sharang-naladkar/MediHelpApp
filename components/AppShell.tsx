"use client";

import type { ReactNode } from "react";

/** Shared centered mobile shell used by both screens. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      {children}
    </main>
  );
}
