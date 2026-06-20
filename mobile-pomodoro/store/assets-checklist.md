# Store assets checklist — BRIDGE Focus

What you need to upload (sizes as of 2026; verify in the consoles).

## Icon
- [x] App icon 1024×1024 PNG — `assets/icon.png` (navy focus-ring mark)
- [x] Android adaptive icon foreground/background — `assets/android-icon-*.png`
- [ ] Confirm the icon has no alpha for App Store (Expo flattens on build).

## Screenshots (capture from a real build or simulator)
iOS (App Store Connect):
- [ ] 6.7" (1290×2796) — at least 3, up to 10
- [ ] 6.5" (1242×2688) — optional but recommended
- [ ] iPad 12.9" only if you keep `supportsTablet` and want iPad listing

Android (Play Console):
- [ ] Phone screenshots 1080×1920 (or similar 9:16) — at least 2, up to 8
- [ ] Feature graphic 1024×500 PNG/JPG

Suggested screens to show: Focus, Immersive mode, the wrap-up sheet, Log.

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
