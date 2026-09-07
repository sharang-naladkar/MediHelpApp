import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) {
    throw new Error('Notifications are disabled. You can enable them in Android Settings.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('emergency-updates', {
      name: 'Emergency updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#e74b36',
    });
  }

  let expoToken: string | null = null;
  try {
    expoToken = (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    // A native Android build can still use its FCM device token without an Expo project ID.
  }
  let deviceToken: string | null = null;
  try {
    deviceToken = (await Notifications.getDevicePushTokenAsync()).data;
  } catch {
    // Device tokens are unavailable in some simulator and browser environments.
  }
  return { expoToken, deviceToken };
}

export function getNotificationIncidentId(
  response: Notifications.NotificationResponse,
) {
  const data = response.notification.request.content.data as {
    incidentId?: string;
    screen?: 'tracking' | 'delivered';
  };
  return { incidentId: data.incidentId, screen: data.screen ?? 'tracking' };
}