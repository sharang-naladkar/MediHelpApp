"use client";

/** Client-only storage for the local user profile (no backend involved). */

export interface UserProfile {
  name: string;
  phone: string;
  /** Last 4 digits of Aadhaar number — used for identification only. */
  aadhaar_last4: string;
}

export const PROFILE_STORAGE_KEY = "medidrone.user-profile.v1";

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile> | null;
    if (!parsed) return null;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const phone = typeof parsed.phone === "string" ? parsed.phone.trim() : "";
    const aadhaar_last4 =
      typeof parsed.aadhaar_last4 === "string" ? parsed.aadhaar_last4.trim() : "";
    if (!name || !phone || !/^\d{4}$/.test(aadhaar_last4)) return null;
    return { name, phone, aadhaar_last4 };
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Wipes everything this app stores locally. Used from Settings on the Home
 * screen; the SOS flow itself never calls this.
 */
export function clearProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // best effort — nothing else to clean up
  }
}

/** Storage health check so a locked/absent localStorage is visible, not silent. */
export function isProfileStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, "{}");
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
