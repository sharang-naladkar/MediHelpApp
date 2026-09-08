"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ApiError, createEmergency, type EmergencyCreatePayload } from "@/lib/api";
import { GeoError, getCurrentPosition, type GeoFix } from "@/lib/geolocation";
import { loadProfile, type UserProfile } from "@/lib/profile";

type Flow =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "submitting"; fix: GeoFix; attempt?: number; backoffMs?: number }
  | {
      phase: "error";
      kind: "geo" | "network" | "api" | "config";
      message: string;
      fix?: GeoFix;
    };

/** Network-level failures: auto-retry with exponential backoff (1s,2s,4s). */
const NETWORK_RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
const MAX_NETWORK_RETRIES = NETWORK_RETRY_BACKOFF_MS.length + 1;

function isRetryableNetworkFailure(err: unknown): boolean {
  return err instanceof ApiError && (err.kind === "network" || err.kind === "timeout");
}

const EMERGENCY_FALLBACK_PHONE = "112";

function describeApiError(err: unknown): {
  kind: "network" | "api" | "config";
  message: string;
} {
  if (err instanceof ApiError) {
    return {
      kind: err.kind === "config" ? "config" : err.kind === "api" || err.kind === "bad-response" ? "api" : "network",
      message: err.message,
    };
  }
  return {
    kind: "network",
    message: "Unexpected error while sending your SOS.",
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [flow, setFlow] = useState<Flow>({ phase: "idle" });
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    const p = loadProfile();
    setProfile(p);
    setProfileChecked(true);
    if (!p) router.replace("/");
    return () => {
      mounted.current = false;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [router]);

  const submit = useCallback(
    async (fix: GeoFix, attempt = 1) => {
      if (!profile) return;
      const payload: EmergencyCreatePayload = {
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        timestamp: new Date(fix.timestampMs).toISOString(),
        name: profile.name,
        phone: profile.phone,
        aadhaar_last4: profile.aadhaar_last4,
      };
      setFlow({ phase: "submitting", fix, attempt });
      try {
        const { emergency_id } = await createEmergency(payload);
        if (!mounted.current) return;
        const qs = new URLSearchParams({
          lat: String(fix.lat),
          lng: String(fix.lng),
          accuracy: String(fix.accuracy),
        });
        router.replace(`/emergency/${encodeURIComponent(emergency_id)}?${qs.toString()}`);
      } catch (err) {
        if (!mounted.current) return;
        // Network/timeout failures: visible auto-retry with exponential backoff.
        if (isRetryableNetworkFailure(err) && attempt <= MAX_NETWORK_RETRIES - 1) {
          const backoffMs = NETWORK_RETRY_BACKOFF_MS[attempt - 1] ?? 4_000;
          setFlow({ phase: "submitting", fix, attempt: attempt + 1, backoffMs });
          retryTimer.current = window.setTimeout(() => {
            if (mounted.current) void submit(fix, attempt + 1);
          }, backoffMs);
          return;
        }
        const { kind, message } = describeApiError(err);
        setFlow({ phase: "error", kind, message, fix });
      }
    },
    [profile, router]
  );

  /**
   * One tap: locate → POST directly. No confirmation dialogs, no extra taps.
   */
  const handleSOS = useCallback(async () => {
    if (flow.phase !== "idle") return; // already in flight — ignore double taps
    setAttempt((n) => n + 1);
    setFlow({ phase: "locating" });
    try {
      const fix = await getCurrentPosition();
      if (!mounted.current) return;
      await submit(fix);
    } catch (err) {
      if (!mounted.current) return;
      const message =
        err instanceof GeoError
          ? err.message
          : "Unexpected error while getting your location.";
      setFlow({ phase: "error", kind: "geo", message });
    }
  }, [flow.phase, submit]);

  const handleRetry = useCallback(() => {
    const current = flow;
    if (current.phase === "error" && current.fix) {
      setFlow({ phase: "submitting", fix: current.fix, attempt: 1 });
      void submit(current.fix);
      return;
    }
    setFlow({ phase: "idle" });
    // give the button a fresh mount then trigger immediately
    setTimeout(() => {
      setAttempt((n) => n + 1);
      setFlow({ phase: "locating" });
      void (async () => {
        try {
          const fix = await getCurrentPosition();
          if (mounted.current) await submit(fix);
        } catch (err) {
          if (!mounted.current) return;
          setFlow({
            phase: "error",
            kind: "geo",
            message:
              err instanceof GeoError
                ? err.message
                : "Unexpected error while getting your location.",
          });
        }
      })();
    }, 0);
  }, [flow, submit]);

  if (!profileChecked || !profile) {
    return (
      <AppShell>
        <p className="m-auto text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  const busy = flow.phase === "locating" || flow.phase === "submitting";

  return (
    <AppShell>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-lg font-bold text-white">
            +
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">MediDrone</h1>
            <p className="text-xs text-slate-400">SOS — cardiac arrest</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/setup")}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
        >
          Edit profile
        </button>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-6">
        <div className="text-center">
          <p className="text-sm text-slate-400">
            Emergency dispatch <span className="text-slate-200">for {profile.name}</span>
          </p>
        </div>

        <button
          type="button"
          data-testid="sos-button"
          disabled={busy}
          onPointerDown={(e) => {
            // Immediate press response; let click still fire for the action.
            e.currentTarget.classList.add("scale-[0.985]");
          }}
          onPointerUp={(e) => e.currentTarget.classList.remove("scale-[0.985]")}
          onClick={() => {
            void handleSOS();
          }}
          className="relative mx-auto aspect-square w-full max-w-[22rem] touch-manipulation select-none rounded-full bg-red-600 text-white shadow-[0_0_60px_rgba(220,38,38,0.45)] outline-none transition-[transform,background-color,filter] duration-75 active:scale-[0.985] active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-80"
          aria-label="Trigger emergency SOS now"
        >
          <span className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="text-[4.2rem] font-black leading-none tracking-tight">
              {flow.phase === "locating" ? (
                <span className="text-4xl">Locating…</span>
              ) : flow.phase === "submitting" && flow.backoffMs ? (
                <span className="text-3xl">
                  Retrying {flow.attempt}/{MAX_NETWORK_RETRIES}
                </span>
              ) : flow.phase === "submitting" ? (
                <span className="text-4xl">Sending…</span>
              ) : (
                <span className="animate-pulse">SOS</span>
              )}
            </span>
            <span className="px-6 text-sm font-medium text-red-100">
              {flow.phase === "locating"
                ? "Getting your live location"
                : flow.phase === "submitting" && flow.backoffMs
                  ? `Connection lost — retrying in ${Math.max(1, Math.round(flow.backoffMs / 1000))}s`
                  : flow.phase === "submitting"
                    ? `Sending your emergency (${flow.attempt}/${MAX_NETWORK_RETRIES})`
                    : "Tap to dispatch an AED drone"}
            </span>
          </span>
        </button>

        <p className="text-center text-xs leading-relaxed text-slate-500">
          One tap — no confirmation. Your live location is sent to the MediDrone
          dispatch service. This app is not a substitute for calling emergency
          services.
        </p>

        {flow.phase === "submitting" && flow.fix && (
          <p
            className="mx-auto max-w-sm rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-center text-xs text-emerald-300"
            role="status"
          >
            Live location captured ({flow.fix.lat.toFixed(5)}, {flow.fix.lng.toFixed(5)}, ±
            {Math.round(flow.fix.accuracy)} m) — sending your emergency now…
          </p>
        )}

        {flow.phase === "error" && (
          <div
            role="alert"
            className="mx-auto w-full max-w-sm rounded-2xl border border-red-500/40 bg-red-950/40 p-4"
          >
            <h2 className="text-sm font-bold text-red-200">
              {flow.kind === "geo"
                ? "Couldn't get your location"
                : flow.kind === "config"
                  ? "Dispatch service not configured"
                  : flow.kind === "api"
                    ? "Dispatch service error"
                    : "Network error"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-red-100/90">{flow.message}</p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white active:bg-red-700"
              >
                Retry
              </button>
              <a
                href={`tel:${EMERGENCY_FALLBACK_PHONE}`}
                className="rounded-xl border border-red-500/60 bg-slate-900 py-2.5 text-center text-sm font-semibold text-red-300 active:bg-slate-800"
              >
                Call emergency services — {EMERGENCY_FALLBACK_PHONE}
              </a>
            </div>
          </div>
        )}
      </div>

      <footer className="pb-2 text-center text-[11px] text-slate-600">
        <a href={`tel:${EMERGENCY_FALLBACK_PHONE}`} className="underline underline-offset-2">
          {EMERGENCY_FALLBACK_PHONE}
        </a>{" "}
        for help at any time · attempt #{attempt}
      </footer>
    </AppShell>
  );
}
