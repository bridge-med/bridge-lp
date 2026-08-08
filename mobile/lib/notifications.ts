// Daily reminder notifications — the habit loop. A single local notification
// fires every day at the user's chosen time, nudging them to log (which keeps
// the streak alive and grows the companion). Local-only: no server / push.
// Web has no scheduled local notifications, so everything no-ops there.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL = 'daily-reminder';

// Show reminders even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const REMINDERS = [
  { title: '今日のひとことログ📝', body: '相棒が待ってるよ。1行でも書いて連続記録をつなげよう。' },
  { title: 'おつかれさま🌱', body: '今日の出来事・判断・学び、ひとつだけでも残しておこう。' },
  { title: 'コツコツ育てよう', body: '記録すると相棒が育つよ。単語も貯まって、ながら勉強に。' },
];

export function isNotifSupported(): boolean {
  return Platform.OS !== 'web';
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: '毎日のリマインダー',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestPermission(): Promise<boolean> {
  if (!isNotifSupported()) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** (Re)schedule the daily reminder. Returns true if scheduled. */
export async function scheduleDaily(hour: number, minute: number): Promise<boolean> {
  if (!isNotifSupported()) return false;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const pick = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
  await Notifications.scheduleNotificationAsync({
    content: { title: pick.title, body: pick.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL,
    },
  });
  return true;
}

export async function cancelDaily(): Promise<void> {
  if (!isNotifSupported()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
