"use client";

/**
 * Real device geolocation only.
 *
 * Hard requirements: enableHighAccuracy + maximumAge 0 (never reuse a stale
 * cached fix). There is deliberately no fallback coordinate anywhere in the
 * codebase — if the device cannot produce a fix, the user sees an error with
 * a retry and a manual "call emergency services" fallback.
 */

export interface GeoFix {
  lat: number;
  lng: number;
  /** Meters, from the device */
  accuracy: number;
  /** Device timestamp of the fix (ms since epoch) */
  timestampMs: number;
}

export type GeoErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export class GeoError extends Error {
  constructor(
    message: string,
    readonly kind: GeoErrorKind,
    readonly code?: number
  ) {
    super(message);
    this.name = "GeoError";
  }
}

function toGeoError(err: GeolocationPositionError): GeoError {
  // Codes 1/2/3 are the spec values; use literals so the mapping is robust
  // even if the constants are missing from a partially mocked object.
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return new GeoError(
        "Location permission was denied. MediDrone needs your live location to dispatch the nearest AED drone.",
        "denied",
        err.code
      );
    case 2: // POSITION_UNAVAILABLE
      return new GeoError(
        "Your device could not determine a position. Try again in an open area (away from buildings/trees) with GPS on.",
        "unavailable",
        err.code
      );
    case 3: // TIMEOUT
      return new GeoError(
        "Getting your location timed out. Try again in an open area with GPS and a data connection.",
        "timeout",
        err.code
      );
    default:
      return new GeoError(
        "An unknown error occurred while getting your location.",
        "unavailable",
        err.code
      );
  }
}

/** How long we wait for the platform before surfacing a timeout ourselves. */
const WATCHDOG_MS = 15_000;

export function getCurrentPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(
        new GeoError(
          "This browser does not support geolocation. Use the call-emergency-services option below.",
          "unsupported"
        )
      );
      return;
    }

    // Watchdog: some platforms never invoke either callback (e.g. a stuck
    // permission dialog). We refuse to hang silently — the user always sees a
    // timeout and the manual emergency-services fallback.
    const watchdog = setTimeout(() => {
      reject(
        new GeoError(
          "Getting your location timed out. Try again in an open area with GPS and a data connection.",
          "timeout"
        )
      );
    }, WATCHDOG_MS);

    const settled = () => clearTimeout(watchdog);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          settled();
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestampMs: position.timestamp,
          });
        },
        (err) => {
          settled();
          reject(toGeoError(err));
        },
        {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 0, // never reuse a cached/stale position
        }
      );
    } catch {
      settled();
      reject(
        new GeoError(
          "The browser blocked the location request. Try again or call emergency services below.",
          "unavailable"
        )
      );
    }
  });
}
