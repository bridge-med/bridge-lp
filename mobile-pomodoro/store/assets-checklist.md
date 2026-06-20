# Store assets checklist — BRIDGE Focus

What you need to upload (sizes as of 2026; verify in the consoles).

## Icon
- [x] App icon 1024×1024 PNG — `assets/icon.png` (navy focus-ring mark)
- [x] Android adaptive icon foreground/background — `assets/android-icon-*.png`
- [ ] Confirm the icon has no alpha for App Store (Expo flattens on build).

## Screenshots
Draft screenshots rendered from the web build at iOS 6.7" size (1290×2796) are in
`store/screenshots/` (focus / log / settings / immerse, light & dark). They are
usable as-is for App Store, or as references for real device captures.

iOS (App Store Connect):
- [x] 6.7" (1290×2796) drafts in store/screenshots/ — at least 3, up to 10
- [ ] (optional) recapture on a real device / simulator for final polish

Android (Play Console):
- [ ] Phone screenshots 1080×1920 (9:16) — the 6.7" drafts are slightly too tall
      for Play's ratio limit; re-render at 1080×1920 (ask, or run scripts).
- [ ] Feature graphic 1024×500 PNG/JPG

Shown: Focus, Log, Settings, Immersive mode. (Wrap-up sheet can be added.)

## Text
- [ ] Name, subtitle/short description, full description (see listing-ja.md / listing-en.md)
- [ ] Keywords (App Store)
- [ ] Support URL + Marketing URL
- [ ] Privacy policy URL — host store/privacy.html (e.g.
      https://bridge-med.github.io/bridge-lp/legal/focus-privacy.html)

## Compliance
- [x] No ads / no tracking SDK → App Store Privacy: "Data not collected".
- [ ] Google Play Data safety form → declare "no data collected / no data shared".
- [x] No in-app purchases (nothing to configure in RevenueCat / store IAP).
- [ ] Age rating questionnaire (no objectionable content).
- [ ] Export compliance (uses standard encryption only / none).

## Config to finish before `eas submit`
- [ ] `eas.json` → submit.production.ios: appleId / ascAppId / appleTeamId
- [ ] `eas.json` → submit.production.android: google-service-account.json
- [ ] `app.config.ts` → set EAS_PROJECT_ID / EAS_OWNER via env (after `eas init`)
