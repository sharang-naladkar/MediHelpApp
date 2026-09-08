/**
 * DEVELOPMENT/TEST-ONLY mock of the MediDrone backend.
 *
 * This file is never imported by the app: the app ships with no stub, no demo
 * mode and no fallback. It exists so the e2e suite can exercise the real UI +
 * real HTTP flow against http://localhost:8000 (the documented dev placeholder
 * for NEXT_PUBLIC_API_BASE_URL). Grep the codebase for "mock-backend" — the
 * only hits are in tests/scripts.
 *
 * Run: node e2e/mock-backend.mjs [port]
 * Control (tests only): POST /__test/mode {"mode":"ok"|"fail-post-503"|"fail-poll-500"|"fail-poll-404"}
 * Observability (tests only): POST /__test/reset, GET /__test/requests
 */
import http from "node:http";

const PORT = Number(process.argv[2] || 8000);

const STATUS_SEQUENCE = [
  "RECEIVED",
  "DRONE_ASSIGNED",
  "MISSION_GENERATED",
  "DISPATCHED",
  "EN_ROUTE",
  "APPROACHING",
  "ARRIVED",
  "AED_DELIVERED",
  "COMPLETED",
];

const state = {
  mode: "ok",
  counter: 0,
  emergencies: new Map(), // id -> { statusIndex, polls }
  requests: [], // { method, path, body, status }
};

function record(method, path, body, status) {
  state.requests.push({ method, path, body: body ?? null, status, at: Date.now() });
  if (state.requests.length > 500) state.requests.shift();
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function validateEmergency(body) {
  if (!body || typeof body !== "object") return "body is not an object";
  const required = ["lat", "lng", "accuracy", "timestamp", "name", "phone", "aadhaar_last4"];
  for (const key of required) {
    if (!(key in body)) return `missing field: ${key}`;
  }
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) return "lat/lng must be numbers";
  if (Number.isNaN(Date.parse(body.timestamp))) return "timestamp must be ISO 8601";
  if (typeof body.name !== "string" || !body.name) return "name must be a non-empty string";
  if (!/^\d+$/.test(String(body.phone))) return "phone must be digits";
  if (!/^\d{4}$/.test(String(body.aadhaar_last4))) return "aadhaar_last4 must be 4 digits";
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "POST" && path === "/__test/mode") {
    const body = await readBody(req);
    state.mode = body && typeof body.mode === "string" ? body.mode : "ok";
    record(req.method, path, body, 200);
    return json(res, 200, { mode: state.mode });
  }
  if (req.method === "POST" && path === "/__test/reset") {
    state.counter = 0;
    state.emergencies.clear();
    state.requests = [];
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && path === "/__test/requests") {
    return json(res, 200, state.requests);
  }

  if (req.method === "POST" && path === "/api/v1/emergencies") {
    const body = await readBody(req);
    if (state.mode === "fail-post-503") {
      record(req.method, path, body, 503);
      return json(res, 503, { detail: "dispatch temporarily unavailable (simulated)" });
    }
    const invalid = validateEmergency(body);
    if (invalid) {
      record(req.method, path, body, 422);
      return json(res, 422, { detail: invalid });
    }
    state.counter += 1;
    const id = `mock-em-${state.counter}`;
    state.emergencies.set(id, { statusIndex: 0, polls: 0 });
    record(req.method, path, body, 201);
    return json(res, 201, { emergency_id: id });
  }

  const getMatch = path.match(/^\/api\/v1\/emergencies\/([^/]+)$/);
  if (req.method === "GET" && getMatch) {
    const id = decodeURIComponent(getMatch[1]);
    const emergency = state.emergencies.get(id);
    if (!emergency) {
      record(req.method, path, null, 404);
      return json(res, 404, { detail: "emergency not found" });
    }
    if (state.mode === "fail-poll-500") {
      record(req.method, path, null, 500);
      return json(res, 500, { detail: "status lookup failed (simulated)" });
    }
    if (state.mode === "fail-poll-404") {
      record(req.method, path, null, 404);
      return json(res, 404, { detail: "emergency vanished (simulated)" });
    }
    emergency.polls += 1;
    // First poll → RECEIVED; subsequent polls march through the sequence.
    // Mode "fast" (e2e) lands on COMPLETED on the 2nd poll so terminal-state
    // handling is verified quickly without waiting ~45 s.
    const status =
      emergency.polls === 1
        ? STATUS_SEQUENCE[0]
        : state.mode === "fast"
          ? STATUS_SEQUENCE[STATUS_SEQUENCE.length - 1]
          : STATUS_SEQUENCE[Math.min(1 + emergency.polls - 2, STATUS_SEQUENCE.length - 1)];
    const seq = STATUS_SEQUENCE;
    record(req.method, path, { status }, 200);
    return json(res, 200, {
      emergency_id: id,
      status,
      poll: emergency.polls,
      sequence_length: seq.length,
    });
  }

  record(req.method, path, null, 404);
  json(res, 404, { detail: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-backend] listening on http://localhost:${PORT}`);
});
