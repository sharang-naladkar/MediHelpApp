"use client";

/**
 * MediDrone backend REST client.
 *
 * The base URL comes exclusively from NEXT_PUBLIC_API_BASE_URL (inlined at
 * build time). If it is missing the app surfaces a visible configuration
 * error — it never falls back to a hardcoded URL, a localhost stub or any
 * mock data.
 */

export const API_BASE_URL: string | null =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") || null;

/** Exact status strings returned by the backend. */
export const EMERGENCY_STATUSES = [
  "RECEIVED",
  "DRONE_ASSIGNED",
  "MISSION_GENERATED",
  "DISPATCHED",
  "EN_ROUTE",
  "APPROACHING",
  "ARRIVED",
  "AED_DELIVERED",
  "COMPLETED",
  "FAILED",
] as const;

export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<EmergencyStatus> = new Set([
  "COMPLETED",
  "FAILED",
]);

export interface EmergencyCreatePayload {
  lat: number;
  lng: number;
  accuracy: number;
  /** ISO 8601 */
  timestamp: string;
  name: string;
  phone: string;
  aadhaar_last4: string;
}

export interface EmergencyCreateResponse {
  emergency_id: string;
}

export interface BackendStatusResponse {
  status?: unknown;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "api" | "network" | "timeout" | "config" | "bad-response",
    readonly status?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeErrorBody(body: unknown): string {
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  if (isRecord(body)) {
    const detail =
      body.detail ?? body.message ?? body.error ?? body.error_message ?? body.title;
    if (typeof detail === "string" && detail.trim()) return detail.slice(0, 300);
    try {
      return JSON.stringify(body).slice(0, 300);
    } catch {
      return "Unparseable response body";
    }
  }
  return "Empty response body";
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(
  path: string,
  init: RequestInit
): Promise<{ response: Response; data: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(
        "The dispatch service did not respond in time. Your phone may have a weak or unstable connection.",
        "timeout"
      );
    }
    throw new ApiError(
      "Could not reach the dispatch service. Check your internet/network connection.",
      "network"
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      `The dispatch service rejected the request (HTTP ${response.status})${
        data !== null ? `: ${describeErrorBody(data)}` : ""
      }`,
      "api",
      response.status,
      data
    );
  }
  return { response, data };
}

/**
 * Registers a new emergency. Throws ApiError on any failure — errors are
 * always surfaced to the user by the caller.
 */
export async function createEmergency(
  payload: EmergencyCreatePayload
): Promise<EmergencyCreateResponse> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "The app is not configured with a dispatch service URL (NEXT_PUBLIC_API_BASE_URL is not set at build time). Configure it and redeploy.",
      "config"
    );
  }
  const { data } = await requestJson("/api/v1/emergencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!isRecord(data) || typeof data.emergency_id !== "string" || !data.emergency_id) {
    throw new ApiError(
      "The dispatch service returned an unexpected response (missing emergency_id).",
      "bad-response"
    );
  }
  return { emergency_id: data.emergency_id };
}

/**
 * Fetches the current status of an emergency.
 * Never caches anything: the service worker also never intercepts this origin.
 */
export async function getEmergency(id: string): Promise<BackendStatusResponse> {
  if (!API_BASE_URL) {
    throw new ApiError("Dispatch service is not configured.", "config");
  }
  const encoded = encodeURIComponent(id);
  const { data } = await requestJson(`/api/v1/emergencies/${encoded}`, {
    method: "GET",
  });
  if (!isRecord(data)) {
    throw new ApiError(
      "The dispatch service returned an unexpected status response.",
      "bad-response"
    );
  }
  return data as BackendStatusResponse;
}

export function readStatus(body: BackendStatusResponse): {
  status: EmergencyStatus | null;
  raw: unknown;
} {
  const raw = body.status;
  if (typeof raw === "string") {
    const status = EMERGENCY_STATUSES.find((s) => s === raw);
    if (status) return { status, raw };
  }
  return { status: null, raw };
}

export function isTerminalStatus(status: EmergencyStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
