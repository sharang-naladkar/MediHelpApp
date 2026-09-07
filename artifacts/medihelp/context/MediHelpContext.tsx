import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  AppMode,
  demoHistory,
  Incident,
  repository,
} from '@/services/medihelpRepository';

type Session = { displayName: string; identifier: string };
type AppScreen = 'home' | 'tracking' | 'delivered' | 'history' | 'profile';

type MediHelpContextValue = {
  session: Session | null;
  mode: AppMode;
  setMode: (mode: AppMode) => Promise<void>;
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  history: Incident[];
  activeIncident: Incident | null;
  isLoading: boolean;
  error: string | null;
  offlineQueueCount: number;
  telemetryLive: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  triggerEmergency: () => Promise<Incident>;
  confirmReceipt: () => Promise<void>;
  retryHistory: () => Promise<void>;
};

const STORAGE_KEY = '@medihelp/session';
const MODE_KEY = '@medihelp/mode';

const MediHelpContext = createContext<MediHelpContextValue | null>(null);

function getDemoLocation() {
  return { lat: 12.9352, lng: 77.6245 };
}

export function MediHelpProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setModeState] = useState<AppMode>('demo');
  const [screen, setScreen] = useState<AppScreen>('home');
  const [history, setHistory] = useState<Incident[]>(demoHistory);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [telemetryLive, setTelemetryLive] = useState(false);

  useEffect(() => {
    void (async () => {
      const [storedSession, storedMode] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(MODE_KEY),
      ]);
      if (storedSession) setSession(JSON.parse(storedSession) as Session);
      if (storedMode === 'prod' || storedMode === 'demo') setModeState(storedMode);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    void repository.loadHistory(mode).then(setHistory).catch(() => {
      setHistory(demoHistory);
      setError('Showing cached history. Pull to retry when you are online.');
    });
    void repository.pendingEmergencyCount().then(setOfflineQueueCount);
  }, [mode, session]);

  useEffect(() => {
    if (!activeIncident || activeIncident.status === 'delivered' || mode !== 'demo') return;
    const timer = setInterval(() => {
      setActiveIncident((current) => {
        if (!current) return current;
        const elapsed = Math.floor(
          (Date.now() - new Date(current.timestamp).getTime()) / 1500,
        );
        const stages = Math.min(7, Math.max(1, elapsed));
        const nextStatus = stages >= 7 ? 'delivered' : stages >= 4 ? 'en_route' : 'dispatching';
        const next = {
          ...current,
          status: nextStatus as Incident['status'],
          etaMinutes: Math.max(1, 8 - stages),
          battery: Math.max(48, 96 - stages * 5),
          altitude: stages >= 4 ? 118 : stages * 20,
          stage: stages,
        };
        if (next.status === 'delivered') {
          void repository.saveIncident(next);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [activeIncident?.incidentId, activeIncident?.status]);

  useEffect(() => {
    if (!activeIncident || activeIncident.status === 'delivered' || mode === 'demo') {
      setTelemetryLive(false);
      return;
    }
    let disposed = false;
    const applyStatus = (update: Partial<Incident> & { status?: Incident['status']; step?: number }) => {
      if (disposed) return;
      setActiveIncident((current) =>
        current
          ? {
              ...current,
              ...update,
              stage: update.step ?? update.stage ?? current.stage,
            }
          : current,
      );
    };
    const unsubscribe = repository.subscribeToIncident(activeIncident.incidentId, applyStatus);
    setTelemetryLive(true);
    const poll = setInterval(() => {
      void repository
        .getIncidentStatus(activeIncident.incidentId)
        .then(applyStatus)
        .catch(() => setTelemetryLive(false));
    }, 5000);
    return () => {
      disposed = true;
      unsubscribe();
      clearInterval(poll);
      setTelemetryLive(false);
    };
  }, [activeIncident?.incidentId, activeIncident?.status, mode]);

  useEffect(() => {
    if (!session || mode !== 'prod') return;
    const drain = () => {
      void repository.drainEmergencyQueue(mode).then(() => {
        void repository.pendingEmergencyCount().then(setOfflineQueueCount);
      });
    };
    drain();
    const timer = setInterval(drain, 15000);
    return () => clearInterval(timer);
  }, [session, mode]);

  const setMode = async (nextMode: AppMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(MODE_KEY, nextMode);
  };

  const login = async (identifier: string, password: string) => {
    setError(null);
    if (!identifier.trim() || password.length < 4) {
      throw new Error('Enter a valid phone or email and a 4+ character password.');
    }
    const nextSession = await repository.login(identifier.trim(), password, mode);
    setSession(nextSession);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  };

  const logout = async () => {
    setSession(null);
    setActiveIncident(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const triggerEmergency = async () => {
    setError(null);
    let location = getDemoLocation();
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        location = { lat: current.coords.latitude, lng: current.coords.longitude };
      }
    } catch {
      setError('Location was unavailable, so the demo location is being used.');
    }
    const incident: Incident = {
      incidentId: `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      status: 'dispatching',
      emergencyType: 'Medical emergency',
      timestamp: new Date().toISOString(),
      address: 'Koramangala 5th Block, Bengaluru',
      location,
      droneId: 'DR-17',
      etaMinutes: 8,
      battery: 96,
      altitude: 0,
      delivery: 'Emergency medical kit',
    };
    let submitted = incident;
    try {
      submitted = await repository.triggerEmergency(incident, mode);
    } catch (caught) {
      if (mode !== 'prod') throw caught;
      await repository.queueEmergency(incident);
      setOfflineQueueCount((count) => count + 1);
      setError('You are offline. The emergency is queued and will retry automatically.');
      submitted = { ...incident, offlineQueued: true };
    }
    setActiveIncident(submitted);
    setScreen('tracking');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    return submitted;
  };

  const confirmReceipt = async () => {
    if (!activeIncident) return;
    await repository.confirmDelivery(activeIncident.incidentId, mode);
    await repository.saveIncident(activeIncident);
    setHistory((items) => [
      activeIncident,
      ...items.filter((item) => item.incidentId !== activeIncident.incidentId),
    ]);
    setScreen('delivered');
  };

  const retryHistory = async () => {
    setError(null);
    try {
      setHistory(await repository.loadHistory(mode));
    } catch {
      setError('Could not reach MediHelp services. Your cached history is safe.');
    }
  };

  const value = useMemo(
    () => ({
      session,
      mode,
      setMode,
      screen,
      setScreen,
      history,
      activeIncident,
      isLoading,
      error,
      offlineQueueCount,
      telemetryLive,
      login,
      logout,
      triggerEmergency,
      confirmReceipt,
      retryHistory,
    }),
    [session, mode, screen, history, activeIncident, isLoading, error, offlineQueueCount, telemetryLive],
  );

  return <MediHelpContext.Provider value={value}>{children}</MediHelpContext.Provider>;
}

export function useMediHelp() {
  const context = useContext(MediHelpContext);
  if (!context) throw new Error('useMediHelp must be used inside MediHelpProvider');
  return context;
}