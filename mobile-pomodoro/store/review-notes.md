# Reviewer notes (App Store / Google Play) — BRIDGE Focus

- **No account / login required.** The app works fully offline from first launch.
  Sample data is seeded on first run so every screen is populated.
- **No sign-up to test any feature.** Launch and you land on the Focus screen.
- **No in-app purchases. No subscription. Everything is free.**
- **No ads.** No advertising, no ad SDK, no tracking/analytics SDK.
- **Notifications (optional):** a local notification fires when a timer ends (so
  the chime works when backgrounded). Local-only — no push, no server.
- **Data & privacy:** all content (work items, focus sessions, settings) is
  stored locally via AsyncStorage and is not sent to any server. See
  store/privacy-policy.md.
- **Account / data deletion:** Settings → "記録をすべて削除".

## How to test core flow
1. Launch → Focus tab.
2. Tap the work pill → choose a sample work item (or type a new one).
3. Tap START → (optional) it enters the full-screen immersive mode if enabled in
   Settings → Focus.
4. Tap the skip (▶|) control to fast-forward to the end → the wrap-up sheet
   appears → choose 完了 / もう1セット続ける / 中断, optionally add a note.
5. Log tab → see today's total, per-task breakdown and recent sessions.
6. Settings → change durations, pick a chime (tap to preview), toggle theme.
