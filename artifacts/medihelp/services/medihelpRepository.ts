import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type AppMode = 'demo' | 'prod';

export type LocationPoint = {
  lat: number;
  lng: number;
};

export type Incident = {
  incidentId: string;
  status: 'dispatching' | 'en_route' | 'delivered' | 'timeout';
  emergencyType: string;
  timestamp: string;
  address: string;
  location: LocationPoint;
  droneId: string;
  etaMinutes: number;
  battery: number;
  altitude: number;
  delivery?: string;
  stage?: number;
  offlineQueued?: boolean;
};

const HISTORY_KEY = '@medihelp/history';
const TOKEN_KEY = '@medihelp/token';
const PENDING_QUEUE_KEY = '@medihelp/pending-emergencies';

const demoHistory: Incident[] = [
  {
    incidentId: 'INC-2026-038',
    status: 'delivered',
    emergencyType: 'First aid',
    timestamp: '2026-09-04T09:18:00.000Z',
    address: 'Koramangala 5th Block, Bengaluru',
    location: { lat: 12.9352, lng: 77.6245 },
    droneId: 'DR-12',
    etaMinutes: 0,
    battery: 82,
    altitude: 0,
    delivery: 'Trauma care kit',
  },
  {
    incidentId: 'INC-2026-031',
    status: 'delivered',
    emergencyType: 'Medication',
    timestamp: '2026-08-26T16:42:00.000Z',
    address: 'Indiranagar 100 Feet Road, Bengaluru',
    location: { lat: 12.9719, lng: 77.6412 },
    droneId: 'DR-09',
    etaMinutes: 0,
    battery: 76,
    altitude: 0,
    delivery: 'Insulin cold pack',
  },
];

async function getToken() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, value);
}

async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string | null,
): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('No production API base URL configured.');
  }
  const token = tokenOverride === undefined ? await getToken() : tokenOverride;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return (await response.json()) as T;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(401)')) throw error;
    const refresh = await rawRequest<{ accessToken: string }>(
      '/auth/refresh',
      { method: 'POST' },
      null,
    );
    await setToken(refresh.accessToken);
    return rawRequest<T>(path, init, refresh.accessToken);
  }
}

async function readPendingQueue() {
  const stored = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
  return stored ? (JSON.parse(stored) as Incident[]) : [];
}

export const repository = {
  async loadHistory(mode: AppMode): Promise<Incident[]> {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    const cached = stored ? (JSON.parse(stored) as Incident[]) : demoHistory;
    if (mode === 'demo') return cached;
    const remote = await request<Incident[]>('/user/history');
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(remote));
    return remote;
  },

  async login(identifier: string, password: string, mode: AppMode) {
    if (mode === 'demo') {
      await AsyncStorage.setItem(TOKEN_KEY, 'demo-session');
      return { displayName: 'Aarav Mehta', identifier };
    }
    const response = await request<{ accessToken: string; displayName?: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ identifier, password }) },
    );
    await setToken(response.accessToken);
    return { displayName: response.displayName ?? 'MediHelp member', identifier };
  },

  async triggerEmergency(
    incident: Incident,
    mode: AppMode,
  ): Promise<Incident> {
    if (mode === 'prod') {
      const response = await request<{ incidentId: string; status: string }>(
        '/emergency/trigger',
        {
          method: 'POST',
          body: JSON.stringify({
            lat: incident.location.lat,
            lng: incident.location.lng,
            userId: 'current-user',
            timestamp: incident.timestamp,
            emergencyType: incident.emergencyType,
          }),
        },
      );
      return { ...incident, incidentId: response.incidentId };
    }
    return incident;
  },

  async getIncidentStatus(incidentId: string) {
    return request<Partial<Incident> & { status: Incident['status']; step?: number }>(
      `/emergency/${incidentId}/status`,
    );
  },

  async queueEmergency(incident: Incident) {
    const queue = await readPendingQueue();
    await AsyncStorage.setItem(
      PENDING_QUEUE_KEY,
      JSON.stringify([...queue.filter((item) => item.incidentId !== incident.incidentId), incident]),
    );
  },

  async pendingEmergencyCount() {
    return (await readPendingQueue()).length;
  },

  async drainEmergencyQueue(mode: AppMode) {
    if (mode !== 'prod') return 0;
    const queue = await readPendingQueue();
    if (!queue.length) return 0;
    const remaining: Incident[] = [];
    for (const incident of queue) {
      try {
        await this.triggerEmergency(incident, mode);
      } catch {
        remaining.push(incident);
      }
    }
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
    return queue.length - remaining.length;
  },

  subscribeToIncident(
    incidentId: string,
    onMessage: (message: Partial<Incident> & { status?: Incident['status']; step?: number }) => void,
  ) {
    const configuredUrl = process.env.EXPO_PUBLIC_TELEMETRY_WS_URL;
    const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    const websocketUrl = configuredUrl
      ? `${configuredUrl.replace(/\/$/, '')}/incident/${incidentId}/status`
      : apiUrl
        ? `${apiUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/incident/${incidentId}/status`
        : '';
    if (!websocketUrl) return () => undefined;
    const socket = new WebSocket(websocketUrl);
    socket.onopen = () => {
      socket.send(JSON.stringify({ action: 'subscribe', incidentId }));
    };
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data as string) as Partial<Incident> & { status?: Incident['status']; step?: number });
      } catch {
        // Ignore malformed telemetry frames; REST polling remains active as fallback.
      }
    };
    return () => socket.close();
  },

  async saveIncident(incident: Incident) {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    const history = stored ? (JSON.parse(stored) as Incident[]) : demoHistory;
    const next = [
      incident,
      ...history.filter((item) => item.incidentId !== incident.incidentId),
    ];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  },

  async confirmDelivery(incidentId: string, mode: AppMode) {
    if (mode === 'prod') {
      await request(`/emergency/${incidentId}/confirm`, { method: 'POST' });
    }
  },
};

export { demoHistory };