import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPreview } from '@/components/MapPreview';
import { useColors } from '@/hooks/useColors';
import { useMediHelp } from '@/context/MediHelpContext';
import { AppMode, Incident } from '@/services/medihelpRepository';

const steps = ['Trigger', 'Location', 'Processing', 'Dispatch', 'Takeoff', 'Delivery', 'Confirmation'];

function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon} size={19} color="#fff" />
    </Pressable>
  );
}

function BrandHeader({ onProfile }: { onProfile: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: colors.destructive }]}>
          <Feather name="plus" size={17} color="#fff" />
        </View>
        <View>
          <Text style={[styles.brand, { color: colors.foreground }]}>MediHelp</Text>
          <Text style={[styles.byline, { color: colors.mutedForeground }]}>by team Dronuts</Text>
        </View>
      </View>
      <IconButton icon="user" label="Open profile" onPress={onProfile} color={colors.secondaryForeground} />
    </View>
  );
}

function PrimaryNav({ active, onChange }: { active: string; onChange: (value: 'home' | 'history' | 'profile') => void }) {
  const colors = useColors();
  return (
    <View style={[styles.nav, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {[
        ['home', 'home', 'Home'],
        ['history', 'clock', 'History'],
        ['profile', 'settings', 'Profile'],
      ].map(([key, icon, label]) => (
        <Pressable
          key={key}
          accessibilityRole="tab"
          accessibilityLabel={label}
          onPress={() => onChange(key as 'home' | 'history' | 'profile')}
          style={styles.navItem}
        >
          <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={active === key ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.navLabel, { color: active === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, mode } = useMediHelp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.auth, { paddingTop: insets.top + 36, backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <StatusBar style={colors.background === '#0a1423' ? 'light' : 'dark'} />
      <View style={[styles.authLogo, { backgroundColor: colors.destructive }]}>
        <Feather name="plus" size={38} color="#fff" />
      </View>
      <Text style={[styles.authTitle, { color: colors.foreground }]}>Help is on the way.</Text>
      <Text style={[styles.authSubtitle, { color: colors.mutedForeground }]}>Emergency medical delivery, designed for the moments that matter.</Text>
      <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Phone or email</Text>
        <TextInput
          testID="auth-identifier"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
        />
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Password</Text>
        <TextInput
          testID="auth-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 4 characters"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
        />
        {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
        <Pressable
          testID="auth-submit"
          accessibilityRole="button"
          onPress={() => void submit()}
          disabled={busy}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.75 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === 'demo' ? 'Enter demo' : 'Sign in securely'}</Text>}
        </Pressable>
        <View style={styles.secureRow}>
          <Feather name="shield" size={14} color={colors.primary} />
          <Text style={[styles.secureText, { color: colors.mutedForeground }]}>Your account is protected with encrypted session tokens</Text>
        </View>
      </View>
      <Text style={[styles.authFooter, { color: colors.mutedForeground }]}>Team Dronuts · Smart India Hackathon 2026</Text>
    </ScrollView>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (screen: 'home' | 'history' | 'profile') => void }) {
  const colors = useColors();
  const { history, activeIncident, setScreen, error, triggerEmergency } = useMediHelp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const trigger = async () => {
    setBusy(true);
    try {
      await triggerEmergency();
      setConfirming(false);
    } catch (caught) {
      Alert.alert('Could not dispatch', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.background === '#0a1423' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <BrandHeader onProfile={() => onNavigate('profile')} />
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.onlineText, { color: colors.primary }]}>MediHelp network online</Text>
          <Text style={[styles.locationText, { color: colors.mutedForeground }]}>Bengaluru</Text>
        </View>
        <View style={[styles.greeting, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>GOOD MORNING</Text>
            <Text style={[styles.greetingTitle, { color: colors.foreground }]}>Aarav, stay safe.</Text>
            <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>One tap connects you to care.</Text>
          </View>
          <View style={[styles.signal, { backgroundColor: colors.accent }]}>
            <Feather name="radio" size={20} color={colors.destructive} />
          </View>
        </View>
        {error ? (
          <View style={[styles.notice, { backgroundColor: colors.accent }]}>
            <Feather name="info" size={16} color={colors.destructive} />
            <Text style={[styles.noticeText, { color: colors.accentForeground }]}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.sosWrap}>
          <Pressable
            testID="sos-button"
            accessibilityRole="button"
            accessibilityLabel="Trigger emergency SOS"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setConfirming(true);
            }}
            style={({ pressed }) => [styles.sosButton, { backgroundColor: colors.destructive, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          >
            <View style={styles.sosInner}>
              <Feather name="plus" size={42} color="#fff" />
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosCaption}>Tap for medical help</Text>
            </View>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Call emergency services"
          onPress={() => void Linking.openURL('tel:112')}
          style={({ pressed }) => [styles.callButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="phone-call" size={18} color={colors.destructive} />
          <Text style={[styles.callText, { color: colors.foreground }]}>Call emergency services</Text>
          <Text style={[styles.callNumber, { color: colors.mutedForeground }]}>112</Text>
        </Pressable>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your location</Text>
          <View style={[styles.readyPill, { backgroundColor: colors.secondary }]}>
            <Feather name="check" size={12} color={colors.primary} />
            <Text style={[styles.readyText, { color: colors.primary }]}>Ready</Text>
          </View>
        </View>
        <MapPreview compact={true} incident={activeIncident} />
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent activity</Text>
          <Pressable onPress={() => onNavigate('history')} accessibilityRole="button">
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        {history.slice(0, 2).map((item) => <IncidentRow key={item.incidentId} incident={item} />)}
      </ScrollView>
      <PrimaryNav active="home" onChange={onNavigate} />
      <Modal visible={confirming} transparent animationType="slide" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.confirmIcon, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={22} color={colors.destructive} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Confirm emergency</Text>
            <Text style={[styles.sheetCopy, { color: colors.mutedForeground }]}>We’ll locate the nearest medical drone and dispatch it to your current location.</Text>
            <View style={[styles.addressCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="navigation" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addressTitle, { color: colors.foreground }]}>Current location</Text>
                <Text style={[styles.addressText, { color: colors.mutedForeground }]}>Koramangala 5th Block, Bengaluru</Text>
              </View>
            </View>
            <Pressable testID="confirm-emergency" onPress={() => void trigger()} disabled={busy} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.destructive, opacity: pressed || busy ? 0.72 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirm and dispatch</Text>}
            </Pressable>
            <Pressable onPress={() => setConfirming(false)} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function IncidentRow({ incident, onPress }: { incident: Incident; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.incidentRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.incidentIcon, { backgroundColor: incident.status === 'delivered' ? colors.secondary : colors.accent }]}>
        <Feather name={incident.status === 'delivered' ? 'check' : 'navigation'} size={16} color={incident.status === 'delivered' ? colors.primary : colors.destructive} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.incidentTitle, { color: colors.foreground }]}>{incident.delivery ?? incident.emergencyType}</Text>
        <Text style={[styles.incidentSub, { color: colors.mutedForeground }]}>{incident.address}</Text>
      </View>
      <View style={styles.incidentMeta}>
        <Text style={[styles.incidentStatus, { color: incident.status === 'delivered' ? colors.primary : colors.destructive }]}>{incident.status === 'delivered' ? 'Delivered' : 'In progress'}</Text>
        <Text style={[styles.incidentDate, { color: colors.mutedForeground }]}>{new Date(incident.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
      </View>
    </Pressable>
  );
}

function TrackingScreen() {
  const colors = useColors();
  const { activeIncident, setScreen, confirmReceipt } = useMediHelp();
  const incident = activeIncident;
  const progress = incident?.status === 'delivered' ? 7 : incident?.status === 'en_route' ? 5 : 3;
  if (!incident) return null;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trackingHeader}>
          <IconButton icon="arrow-left" label="Back to home" onPress={() => setScreen('home')} color={colors.secondaryForeground} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.trackingTitle, { color: colors.foreground }]}>Live tracking</Text>
            <Text style={[styles.trackingId, { color: colors.mutedForeground }]}>{incident.incidentId}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <MapPreview incident={incident} />
        <View style={[styles.liveBadge, { backgroundColor: colors.secondary }]}>
          <View style={[styles.onlineDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.liveText, { color: colors.primary }]}>{incident.status === 'delivered' ? 'Delivery complete' : 'Drone telemetry live'}</Text>
          <Text style={[styles.liveData, { color: colors.mutedForeground }]}>{incident.droneId} · {incident.battery}% battery</Text>
        </View>
        <View style={styles.etaRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ESTIMATED ARRIVAL</Text>
            <Text style={[styles.eta, { color: colors.foreground }]}>{incident.status === 'delivered' ? 'Arrived' : `${incident.etaMinutes} min`}</Text>
          </View>
          <View style={styles.telemetry}>
            <Text style={[styles.telemetryValue, { color: colors.foreground }]}>{incident.altitude}m</Text>
            <Text style={[styles.telemetryLabel, { color: colors.mutedForeground }]}>altitude</Text>
          </View>
          <View style={styles.telemetry}>
            <Text style={[styles.telemetryValue, { color: colors.foreground }]}>{incident.battery}%</Text>
            <Text style={[styles.telemetryLabel, { color: colors.mutedForeground }]}>battery</Text>
          </View>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 14 }]}>Dispatch progress</Text>
        <View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {steps.map((step, index) => {
            const done = index < progress;
            const current = index === progress - 1;
            return (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepCircle, { backgroundColor: done ? colors.primary : colors.muted, borderColor: done ? colors.primary : colors.border }]}>
                  {done && !current ? <Feather name="check" size={13} color="#fff" /> : <Text style={[styles.stepNumber, { color: done ? '#fff' : colors.mutedForeground }]}>{index + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, { color: done ? colors.foreground : colors.mutedForeground, fontFamily: current ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{step}</Text>
                {current ? <View style={[styles.nowPill, { backgroundColor: colors.accent }]}><Text style={[styles.nowText, { color: colors.destructive }]}>NOW</Text></View> : null}
              </View>
            );
          })}
        </View>
        {incident.status === 'delivered' ? (
          <Pressable onPress={() => void confirmReceipt()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Confirm receipt</Text>
          </Pressable>
        ) : (
          <View style={[styles.statusNotice, { backgroundColor: colors.accent }]}>
            <ActivityIndicator size="small" color={colors.destructive} />
            <Text style={[styles.statusNoticeText, { color: colors.accentForeground }]}>Finding the safest route to you…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HistoryScreen() {
  const colors = useColors();
  const { history, retryHistory, error, setScreen } = useMediHelp();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR CARE LOG</Text>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>History</Text>
          </View>
          <IconButton icon="refresh-cw" label="Refresh history" onPress={() => void retryHistory()} color={colors.secondaryForeground} />
        </View>
        {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
        <View style={[styles.syncBanner, { backgroundColor: colors.secondary }]}>
          <Feather name="database" size={16} color={colors.primary} />
          <Text style={[styles.syncText, { color: colors.secondaryForeground }]}>Cached securely for offline access</Text>
        </View>
        {history.map((incident) => <IncidentRow key={incident.incidentId} incident={incident} onPress={() => Alert.alert('Delivery detail', `${incident.delivery ?? incident.emergencyType}\n${incident.address}\nDrone ${incident.droneId}`)} />)}
        {history.length === 0 ? <View style={styles.empty}><Feather name="inbox" size={28} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No deliveries yet</Text><Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Your emergency delivery history will appear here.</Text></View> : null}
      </ScrollView>
      <PrimaryNav active="history" onChange={setScreen} />
    </View>
  );
}

function ProfileScreen() {
  const colors = useColors();
  const { mode, setMode, logout, setScreen } = useMediHelp();
  const [notifications, setNotifications] = useState(true);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ACCOUNT</Text>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Profile</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>AM</Text></View>
        </View>
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>Aarav Mehta</Text>
          <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>MediHelp member · Bengaluru</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Preferences</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="bell" label="Emergency notifications" color={colors.primary} right={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.muted, true: colors.primary }} />} />
          <SettingRow icon="map-pin" label="Saved addresses" color={colors.destructive} right={<Feather name="chevron-right" size={18} color={colors.mutedForeground} />} />
          <SettingRow icon="users" label="Emergency contacts" color={colors.primary} right={<Feather name="chevron-right" size={18} color={colors.mutedForeground} />} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12, marginTop: 24 }]}>Demo controls</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="wifi" label="Connection mode" color={colors.primary} right={<ModeSwitch mode={mode} setMode={setMode} />} />
          <Text style={[styles.settingHelp, { color: colors.mutedForeground }]}>Demo mode simulates telemetry locally. Production mode uses EXPO_PUBLIC_API_BASE_URL and the live REST contract.</Text>
        </View>
        <Pressable onPress={() => void logout()} style={({ pressed }) => [styles.logoutButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="log-out" size={17} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign out</Text>
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>MediHelp v1.0 · Team Dronuts</Text>
      </ScrollView>
      <PrimaryNav active="profile" onChange={setScreen} />
    </View>
  );
}

function SettingRow({ icon, label, color, right }: { icon: keyof typeof Feather.glyphMap; label: string; color: string; right: React.ReactNode }) {
  const colors = useColors();
  return <View style={[styles.settingRow, { borderBottomColor: colors.border }]}><View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Feather name={icon} size={16} color={color} /></View><Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>{right}</View>;
}

function ModeSwitch({ mode, setMode }: { mode: AppMode; setMode: (mode: AppMode) => Promise<void> }) {
  const colors = useColors();
  return <View style={[styles.modeSwitch, { backgroundColor: colors.secondary }]}>{(['demo', 'prod'] as AppMode[]).map((item) => <Pressable key={item} onPress={() => void setMode(item)} style={[styles.modeOption, mode === item && { backgroundColor: colors.card }]}><Text style={[styles.modeText, { color: mode === item ? colors.primary : colors.mutedForeground }]}>{item === 'demo' ? 'Demo' : 'Live'}</Text></Pressable>)}</View>;
}

export default function Index() {
  const { session, screen, isLoading, setScreen } = useMediHelp();
  if (isLoading) return <View style={styles.loading}><ActivityIndicator size="large" color="#1464d2" /></View>;
  if (!session) return <AuthScreen />;
  if (screen === 'tracking') return <TrackingScreen />;
  if (screen === 'history') return <HistoryScreen />;
  if (screen === 'profile') return <ProfileScreen />;
  if (screen === 'delivered') return <TrackingScreen />;
  return <HomeScreen onNavigate={setScreen} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8fc' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5 },
  byline: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  onlineText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  locationText: { marginLeft: 'auto', fontFamily: 'Inter_500Medium', fontSize: 12 },
  greeting: { padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  greetingTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, marginTop: 6, letterSpacing: -0.5 },
  greetingSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  signal: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 12, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  sosWrap: { alignItems: 'center', paddingVertical: 4 },
  sosButton: { width: 184, height: 184, borderRadius: 92, alignItems: 'center', justifyContent: 'center', shadowColor: '#e74b36', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 8 },
  sosInner: { width: 155, height: 155, borderRadius: 78, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  sosText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 33, letterSpacing: 1 },
  sosCaption: { color: 'rgba(255,255,255,0.86)', fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 1 },
  callButton: { height: 54, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 18, marginBottom: 22 },
  callText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginLeft: 10 },
  callNumber: { marginLeft: 'auto', fontFamily: 'Inter_700Bold', fontSize: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  readyPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  readyText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  seeAll: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  incidentRow: { minHeight: 76, borderRadius: 17, borderWidth: 1, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  incidentIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  incidentTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  incidentSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  incidentMeta: { alignItems: 'flex-end' },
  incidentStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  incidentDate: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5 },
  nav: { position: 'absolute', bottom: 14, left: 20, right: 20, borderRadius: 21, borderWidth: 1, height: 68, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#10253f', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(6, 16, 29, 0.5)', justifyContent: 'flex-end' },
  confirmSheet: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  confirmIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.6 },
  sheetCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 17 },
  addressCard: { padding: 13, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 },
  addressTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  addressText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  primaryButton: { height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  cancelButton: { alignItems: 'center', justifyContent: 'center', height: 44 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  trackingTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  trackingId: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  headerSpacer: { width: 40 },
  liveBadge: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  liveText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  liveData: { marginLeft: 'auto', fontFamily: 'Inter_500Medium', fontSize: 10 },
  etaRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 20 },
  eta: { fontFamily: 'Inter_700Bold', fontSize: 32, marginTop: 3, letterSpacing: -1 },
  telemetry: { marginLeft: 25 },
  telemetryValue: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  telemetryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  stepper: { borderWidth: 1, borderRadius: 17, padding: 14, marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', height: 34 },
  stepCircle: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  stepNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  stepLabel: { fontSize: 12 },
  nowPill: { marginLeft: 'auto', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  nowText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.5 },
  statusNotice: { minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  statusNoticeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.8, marginTop: 4 },
  syncBanner: { padding: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  syncText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 65 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 12 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5, textAlign: 'center' },
  profileCard: { borderWidth: 1, borderRadius: 19, padding: 18, marginBottom: 26 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  profileSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 },
  avatar: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  settingsCard: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 14 },
  settingRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  settingIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  settingLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  settingHelp: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, paddingVertical: 12 },
  modeSwitch: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  modeOption: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  modeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  logoutButton: { height: 50, borderRadius: 14, borderWidth: 1, marginTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 20 },
  auth: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 34 },
  authLogo: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 27 },
  authTitle: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.2, maxWidth: 280 },
  authSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, maxWidth: 300, marginTop: 10 },
  authCard: { borderRadius: 22, borderWidth: 1, padding: 18, marginTop: 30 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 18 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 7, marginTop: 11 },
  input: { borderWidth: 1, borderRadius: 13, height: 48, paddingHorizontal: 13, fontFamily: 'Inter_400Regular', fontSize: 13 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, marginTop: 10 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  secureText: { fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1 },
  authFooter: { fontFamily: 'Inter_500Medium', fontSize: 10, textAlign: 'center', marginTop: 'auto', paddingTop: 32 },
});