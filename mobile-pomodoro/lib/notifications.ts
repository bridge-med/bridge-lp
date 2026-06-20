// Local notifications. Two uses:
//  1. A one-shot "alarm" when a focus/break interval ends — so the bell still
//     fires when the app is backgrounded or the screen is off.
//  2. An optional daily reminder to come back and focus.
// Local-only: no server / push. Web has no scheduled local notifications, so
// everything no-ops there.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TIMER_CHANNEL = 'timer';
const REMINDER_CHANNEL = 'daily-reminder';
const DAILY_ID = 'daily-reminder';

// Show notifications (with sound) even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function isNotifSupported(): boolean {
  return Platform.OS !== 'web';
}

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: 'タイマー',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: '毎日のリマインダー',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestPermission(): Promise<boolean> {
  if (!isNotifSupported()) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Schedule a one-shot alarm `seconds` from now. Returns its id (or null). */
export async function scheduleAlarm(seconds: number, title: string, body: string): Promise<string | null> {
  if (!isNotifSupported() || seconds < 1) return null;
  await ensureChannels();
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(seconds),
      channelId: TIMER_CHANNEL,
    },
  });
}

export async function cancelAlarm(id: string | null): Promise<void> {
  if (!isNotifSupported() || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired / unknown id — ignore
  }
}

const REMINDERS = [
  { title: '集中の時間⏳', body: '25分だけ、ひとつのことに。ポモドーロを1本まわそう。' },
  { title: 'おつかれさま🌱', body: '今日もコツコツ。1ポモドーロから始めよう。' },
];

/** (Re)schedule the daily reminder by a stable id. Returns true if scheduled. */
export async function scheduleDaily(hour: number, minute: number): Promise<boolean> {
  if (!isNotifSupported()) return false;
  await ensureChannels();
  await cancelDaily();
  const pick = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: pick.title, body: pick.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: REMINDER_CHANNEL,
    },
  });
  return true;
}

export async function cancelDaily(): Promise<void> {
  if (!isNotifSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // not scheduled — ignore
  }
}
