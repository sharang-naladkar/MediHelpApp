"use client";

import { useEffect } from "react";

/**
 * Registers the installable-PWA service worker.
 *
 * Production only, by design: in dev we let Next.js handle its own HMR and the
 * worker would only interfere. The worker caches the app shell (same-origin
 * static assets) and never touches the external API origin, so API responses
 * are never cached or replayed offline.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Visible failures matter everywhere else in this app; a failed SW
      // registration must never block the SOS flow, hence warn-only here.
      console.error("[MediDrone] service worker registration failed", err);
    });
  }, []);

  return null;
}
