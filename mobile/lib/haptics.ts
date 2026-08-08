// Thin wrapper around expo-haptics so screens don't need try/catch and it
// silently no-ops where haptics aren't available (web, simulators).

import * as Haptics from 'expo-haptics';

export function tapLight() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op
  }
}

export function tapSuccess() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // no-op
  }
}
