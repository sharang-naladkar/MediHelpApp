"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import SetupForm from "@/components/SetupForm";
import {
  clearProfile,
  isProfileStorageAvailable,
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile";

/**
 * Root app gateway: first launch → Setup screen, otherwise straight to Home.
 * Also listens for the "profile cleared" event so resetting from Settings
 * lands back here without a hard reload.
 */
export default function AppGateway() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isProfileStorageAvailable()) {
      setStorageError(
        "This browser is blocking local storage (or runs in private mode). Setup can't be saved — enable site storage and reload."
      );
      setReady(true);
      return;
    }
    setHasProfile(loadProfile() !== null);
    setReady(true);

    const onClear = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "medidrone") {
        setHasProfile(false);
        router.replace("/");
      }
    };
    window.addEventListener("medidrone:profile-cleared", onClear);
    return () => window.removeEventListener("medidrone:profile-cleared", onClear);
  }, [router]);

  useEffect(() => {
    if (ready && hasProfile) router.replace("/home");
  }, [ready, hasProfile, router]);

  const handleSetup = useCallback(
    (profile: UserProfile) => {
      saveProfile(profile);
      setHasProfile(true);
      router.push("/home");
    },
    [router]
  );

  if (!ready) {
    return (
      <AppShell>
        <p className="m-auto text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (storageError) {
    return (
      <AppShell>
        <div className="m-auto w-full rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5 text-sm text-amber-200">
          <h2 className="mb-2 text-base font-semibold text-amber-100">
            Storage unavailable
          </h2>
          {storageError}
        </div>
      </AppShell>
    );
  }

  if (hasProfile) {
    // Profile exists → skip setup entirely (effect redirects to /home).
    return (
      <AppShell>
        <p className="m-auto text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-2xl font-bold text-white">
            +
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">MediDrone</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
            Emergency AED drone dispatch for out-of-hospital cardiac arrest.
            Saved details are used to identify you when you trigger an SOS.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            One-time setup
          </h2>
          <SetupForm onSubmit={handleSetup} />
        </div>

        <button
          type="button"
          onClick={() => {
            clearProfile();
            window.dispatchEvent(
              new CustomEvent("medidrone:profile-cleared", { detail: "medidrone" })
            );
          }}
          className="mx-auto text-xs text-slate-600 underline underline-offset-2"
        >
          Reset local profile (used for testing)
        </button>
      </div>
    </AppShell>
  );
}
