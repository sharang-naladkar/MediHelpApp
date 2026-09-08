"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  ApiError,
  getEmergency,
  isTerminalStatus,
  readStatus,
  type EmergencyStatus,
} from "@/lib/api";
import { loadProfile, type UserProfile } from "@/lib/profile";

const POLL_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;

interface StatusRecord {
  status: EmergencyStatus;
  at: string; // HH:MM:SS local
}

interface PollError {
  message: string;
  retryable: boolean;
}

function describeError(err: unknown): PollError {
  if (err instanceof ApiError) {
    if (err.kind === "config") {
      return { message: err.message, retryable: false };
    }
    if (err.kind === "bad-response") {
      return { message: err.message, retryable: true };
    }
    return { message: err.message, retryable: true };
  }
  return { message: "Unexpected error while contacting the dispatch service.", retryable: true };
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

export default function StatusScreen({ emergencyId }: { emergencyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const accuracy = searchParams.get("accuracy");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [history, setHistory] = useState<StatusRecord[]>([]);
  const [current, setCurrent] = useState<EmergencyStatus | null>(null);
  const [terminal, setTerminal] = useState<EmergencyStatus | null>(null);
  const [pollError, setPollError] = useState<PollError | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const p = loadProfile();
    setProfile(p);
    setProfileChecked(true);
    if (!p) router.replace("/");
    return () => {
      mounted.current = false;
    };
  }, [router]);

  const recordStatus = useCallback((status: EmergencyStatus) => {
    setCurrent(status);
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].status === status) return prev;
      return [...prev, { status, at: timeNow() }];
    });
  }, []);

  useEffect(() => {
    if (!emergencyId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const body = await getEmergency(emergencyId);
        if (cancelled) return;
        failures = 0;
        setPollError(null);
        setNextIn(POLL_INTERVAL_MS / 1000);
        const { status, raw } = readStatus(body);
        if (status) {
          recordStatus(status);
          if (isTerminalStatus(status)) {
            setTerminal(status);
            setCurrent(status);
            return; // stop polling on terminal state
          }
        } else {
          // Backend returned something unrecognized — visible, keep polling.
          const text =
            typeof raw === "string" ? raw : JSON.stringify(raw ?? body) ?? "missing status";
          setPollError({
            message: `Dispatch returned an unexpected state (${text.slice(0, 60)}). Retrying…`,
            retryable: true,
          });
        }
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        const described = describeError(err);
        setPollError(described);
        // Never a silent hang: back off after failures, cap at 30 s.
        const backoff = Math.min(POLL_INTERVAL_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
        setNextIn(Math.max(1, Math.round(backoff / 1000)));
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void poll(), backoff);
        return;
      }
      if (cancelled) return;
      setLastCheckedAt(timeNow());
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [emergencyId, recordStatus, retryTick]);

  if (!profileChecked || !profile) {
    return (
      <AppShell>
        <p className="m-auto text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  const active = !terminal;

  return (
    <AppShell>
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold">Emergency status</h1>
        <Link href="/home" className="text-xs text-slate-400 underline underline-offset-2">
          Home
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-5 py-6">
        <section
          aria-live="polite"
          className={`rounded-3xl border p-6 text-center ${
            terminal === "FAILED"
              ? "border-red-500/50 bg-red-950/40"
              : terminal === "COMPLETED"
                ? "border-emerald-500/50 bg-emerald-950/40"
                : "border-slate-700 bg-slate-900/70"
          }`}
        >
          {active && (
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-red-500" />
          )}
          <p className="text-xs uppercase tracking-widest text-slate-400">Current state</p>
          <p
            data-testid="current-status"
            className={`mt-2 break-words text-3xl font-black ${
              terminal === "FAILED"
                ? "text-red-400"
                : terminal === "COMPLETED"
                  ? "text-emerald-400"
                  : "text-white"
            }`}
          >
            {current ?? "—"}
          </p>
          {terminal === "FAILED" && (
            <p className="mt-3 text-sm text-red-200">
              The dispatch failed. Do not wait — call emergency services now.
            </p>
          )}
          {terminal === "COMPLETED" && (
            <p className="mt-3 text-sm text-emerald-200">
              Mission complete. Stay with the patient and follow the instructions
              of the responder on site.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Emergency ID
          </p>
          <p data-testid="emergency-id" className="mt-1 break-all font-mono text-slate-200">
            {emergencyId}
          </p>
          {lat && lng && (
            <p className="mt-3 text-xs text-slate-400">
              Location sent: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              {accuracy ? ` · ±${Math.round(Number(accuracy))} m` : ""}
            </p>
          )}
        </section>

        {history.length > 1 && (
          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Transitions
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {history.map((entry, index) => (
                <li
                  key={`${entry.status}-${index}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-200">{entry.status}</span>
                  <span className="text-xs text-slate-500">{entry.at}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pollError && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200"
          >
            <p className="font-semibold text-amber-100">Status update interrupted</p>
            <p className="mt-1 break-words">{pollError.message}</p>
            <p className="mt-2 text-xs text-amber-300/80">
              {active
                ? nextIn !== null
                  ? `Retrying automatically in ${nextIn}s…`
                  : "Retrying automatically…"
                : "No further updates will be attempted."}
            </p>
            <button
              type="button"
              onClick={() => {
                // Manual retry: re-run the poll effect in place.
                setPollError(null);
                setNextIn(null);
                setRetryTick((t) => t + 1);
              }}
              className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 active:bg-amber-700"
            >
              Check now
            </button>
          </div>
        )}

        {active && (
          <p className="text-center text-xs text-slate-500">
            Polling every {POLL_INTERVAL_MS / 1000}s
            {lastCheckedAt ? ` · last checked ${lastCheckedAt}` : ""}
          </p>
        )}

        {terminal === "FAILED" && (
          <a
            href="tel:112"
            className="rounded-2xl bg-red-600 py-3.5 text-center text-base font-bold text-white active:bg-red-700"
          >
            Call emergency services — 112
          </a>
        )}
      </div>
    </AppShell>
  );
}
