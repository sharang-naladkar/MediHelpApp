"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import SetupForm from "@/components/SetupForm";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/profile";

export default function SetupPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setChecked(true);
  }, []);

  const handleSubmit = (next: UserProfile) => {
    saveProfile(next);
    router.replace("/home");
  };

  const isEdit = profile !== null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {checked && isEdit ? "Edit profile" : "One-time setup"}
          </h1>
          {checked && isEdit && (
            <Link href="/home" className="text-xs text-slate-400 underline underline-offset-2">
              Cancel
            </Link>
          )}
        </div>
        {checked && (
          <SetupForm
            key={isEdit ? "edit" : "setup"}
            initialProfile={profile}
            onSubmit={handleSubmit}
            submitLabel={isEdit ? "Save changes" : "Save & continue"}
          />
        )}
        <p className="text-center text-xs text-slate-600">
          These details are stored on this device only and are sent to the
          dispatch service only when you press SOS.
        </p>
      </div>
    </AppShell>
  );
}
