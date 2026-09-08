"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/profile";

/** Strict phone normalization. Returns digits (11-15 chars) or null. */
function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // +91 → 91…
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1); // leading trunk 0
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

interface Props {
  onSubmit: (profile: UserProfile) => void;
  /** Prefill for edit mode (Setup page). */
  initialProfile?: UserProfile | null;
  submitLabel?: string;
}

export default function SetupForm({
  onSubmit,
  initialProfile,
  submitLabel = "Save & continue",
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [aadhaar, setAadhaar] = useState(initialProfile?.aadhaar_last4 ?? "");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    aadhaar?: string;
  }>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (name.trim().length < 2) errors.name = "Enter your full name.";
    const normalized = normalizePhone(phone);
    if (!normalized) errors.phone = "Enter a valid phone number (11–15 digits).";
    if (!/^\d{4}$/.test(aadhaar.trim()))
      errors.aadhaar = "Enter the last 4 digits only.";
    setFieldErrors(errors);
    return { errors, normalized };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { errors, normalized } = validate();
    if (Object.keys(errors).length > 0 || !normalized) return;
    try {
      onSubmit({
        name: name.trim(),
        phone: normalized,
        aadhaar_last4: aadhaar.trim(),
      });
      // Profile is now on disk locally — skip straight to Home on this launch.
      router.push("/home");
    } catch {
      setSaveError(
        "Couldn't save your profile on this device. Check that site data / storage is allowed, then try again."
      );
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border bg-slate-900 px-4 py-3.5 text-base text-white placeholder:text-slate-500 outline-none transition focus:ring-2 ${
      hasError
        ? "border-red-500/70 focus:ring-red-500/50"
        : "border-slate-700 focus:border-red-500 focus:ring-red-500/30"
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-300">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
          }}
          placeholder="e.g. Ananya Sharma"
          className={inputClass(Boolean(fieldErrors.name))}
        />
        {fieldErrors.name && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-300">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: undefined }));
          }}
          placeholder="e.g. +91 98765 43210"
          className={inputClass(Boolean(fieldErrors.phone))}
        />
        {fieldErrors.phone && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="aadhaar" className="mb-1.5 block text-sm font-medium text-slate-300">
          Aadhaar last 4 digits
        </label>
        <input
          id="aadhaar"
          name="aadhaar_last4"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          autoComplete="off"
          required
          value={aadhaar}
          onChange={(e) => {
            setAadhaar(e.target.value.replace(/[^\d]/g, ""));
            if (fieldErrors.aadhaar)
              setFieldErrors((f) => ({ ...f, aadhaar: undefined }));
          }}
          placeholder="••••"
          className={inputClass(Boolean(fieldErrors.aadhaar))}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          For identification only. Stored on this device; never sent anywhere until
          you press SOS.
        </p>
        {fieldErrors.aadhaar && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {fieldErrors.aadhaar}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="mt-2 w-full rounded-xl bg-red-600 py-3.5 text-base font-semibold text-white active:bg-red-700"
      >
        {submitLabel}
      </button>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        Your details stay on this device only. If you clear browser data you&apos;ll
        be asked again. No account, no login.
      </p>

      {saveError && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300"
        >
          {saveError}
        </p>
      )}
    </form>
  );
}
