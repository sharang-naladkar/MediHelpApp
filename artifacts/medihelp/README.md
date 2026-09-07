# MediHelp

MediHelp is Team Dronuts' emergency medical drone delivery demo for Smart India Hackathon 2026.

## Current demo flow

- Demo sign-in with a phone/email and any password with 4+ characters
- Large SOS trigger with confirmation sheet and real foreground location permission
- Seven-stage dispatch flow with simulated drone telemetry, ETA, altitude, battery, and delivery completion
- Offline-friendly incident history persisted with AsyncStorage
- Emergency dialer action for 112
- Profile preferences for notifications and Demo / Live connection mode
- Dark mode support through the device appearance setting
- Secure token storage on Android with refresh-token retry after a 401
- Live WebSocket telemetry subscription with 5-second REST status polling fallback
- Offline emergency queue that retries automatically while Live mode is selected

## Live backend configuration

Set the Expo public variable before starting the app:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.medihelp.dronuts.io/v1/
```

Live mode uses these REST calls from `services/medihelpRepository.ts`:

- `POST /auth/login`
- `POST /emergency/trigger`
- `GET /user/history`
- `POST /emergency/{incidentId}/confirm`

Optional live environment variables:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.medihelp.dronuts.io/v1/
EXPO_PUBLIC_TELEMETRY_WS_URL=wss://api.medihelp.dronuts.io/v1/ws
```

The telemetry adapter subscribes to `incident/{incidentId}/status` over WebSocket. If `EXPO_PUBLIC_TELEMETRY_WS_URL` is not provided, it derives a WebSocket URL from the API base URL and still keeps REST polling active as a fallback. Demo mode never requires a backend or venue Wi-Fi.

## Google Maps and device services

`components/MapPreview.tsx` now uses Google Maps on Android and a web-safe preview in the browser. Replace `REPLACE_WITH_GOOGLE_MAPS_ANDROID_KEY` in `app.json` with the Android-restricted Maps SDK key before creating the release build. The map renders the user marker, drone marker, and route polyline from telemetry.

Foreground location permission is requested through `expo-location`. The Profile screen requests notification permission and registers an Android `Emergency updates` channel. Notification payloads should include:

```json
{
  "data": {
    "incidentId": "INC-2026-042",
    "screen": "tracking"
  }
}
```

The app deep-links notification taps to tracking or delivery confirmation. Android notification, location, and dialer permissions are declared in `app.json`.

On a native Android build, `registerForPushNotificationsAsync()` also requests the device token exposed by Android Firebase Cloud Messaging (`getDevicePushTokenAsync`). Send that token to the backend's notification registration endpoint when the server contract exposes it; Expo Go may only return an Expo token.

## Run

```bash
pnpm install
pnpm --filter @workspace/medihelp run dev
```

Preview on a physical device with Expo Go or use the Replit mobile preview.

## Build flavors

Use the Profile screen's Connection mode control:

- **Demo** — local repository, seeded history, simulated dispatch telemetry
- **Live** — calls `EXPO_PUBLIC_API_BASE_URL`, opens the telemetry WebSocket, falls back to REST polling, and queues failed emergency triggers for retry

Android's final Gradle product flavors (`demo` and `prod`) should be added in the native Android project generated for the release build; the repository mode switch keeps the demo behavior available in Expo Go today.