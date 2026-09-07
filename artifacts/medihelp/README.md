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

The repository boundary is intentionally isolated so a Retrofit/MQTT-backed native build can use the same contract later. Demo mode never requires a backend or venue Wi-Fi.

## Google Maps and device services

The first demo build uses a lightweight native map preview so it renders reliably in Expo Go. For the Android release build, add the Google Maps Android key to the Expo app configuration and replace `components/MapPreview.tsx` with `react-native-maps` using the same `Incident.location` and telemetry data. Foreground location permission is already requested through `expo-location`; Android notification and dialer permissions are declared in `app.json`.

## Run

```bash
pnpm install
pnpm --filter @workspace/medihelp run dev
```

Preview on a physical device with Expo Go or use the Replit mobile preview.

## Build flavors

Use the Profile screen's Connection mode control:

- **Demo** — local repository, seeded history, simulated dispatch telemetry
- **Live** — calls `EXPO_PUBLIC_API_BASE_URL` and surfaces network failures with retry affordances

Android's final Gradle product flavors (`demo` and `prod`) should be added in the native Android project generated for the release build; the repository mode switch keeps the demo behavior available in Expo Go today.