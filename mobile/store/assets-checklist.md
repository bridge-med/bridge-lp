# Store assets checklist

What you need to upload (sizes as of 2026; verify in the consoles).

## Icon
- [ ] App icon 1024×1024 PNG (no alpha) — replace `assets/icon.png`
- [ ] Android adaptive icon foreground/background — `assets/android-icon-*.png`
- [ ] Keep style consistent with the BRIDGE brand (white base, blue-grey).

## Screenshots (capture from a real build or simulator)
iOS (App Store Connect):
- [ ] 6.7" (1290×2796) — at least 3, up to 10
- [ ] 6.5" (1242×2688) — optional but recommended
- [ ] iPad 12.9" only if you mark iPad support

Android (Play Console):
- [ ] Phone screenshots 1080×1920 (or similar 9:16) — at least 2, up to 8
- [ ] Feature graphic 1024×500 PNG/JPG

Suggested screens to show: Home, Work-log entry, Timeline, Reflection, Career output.

## Text
- [ ] Name, subtitle/short description, full description (see listing-ja.md / listing-en.md)
- [ ] Keywords (App Store)
- [ ] Support URL + Marketing URL
- [ ] Privacy policy URL (host store/privacy-policy.md, e.g. on GitHub Pages)

## Compliance
- [ ] App Store: Privacy "Nutrition Label" — data collected by AdMob (identifiers)
      if ads enabled; otherwise "not collected".
- [ ] iOS App Tracking Transparency prompt if AdMob personalized ads are used.
- [ ] Google Play Data safety form.
- [ ] Age rating questionnaire.
- [ ] Export compliance (uses standard encryption only).
