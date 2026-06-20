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
- [x] Privacy policy URL — hosted at https://bridge-med.github.io/bridge-lp/legal/privacy.html

## Compliance
- [x] No ads / no tracking SDK → App Store Privacy: "Data not collected"
      (content is on-device; AI is opt-in bring-your-own-key).
- [ ] Google Play Data safety form → declare "no data collected/shared"
      (note: with your own AI key, text goes directly to that provider).
- [ ] In-app purchase products created: coins_10 / coins_30 / coins_100
      (consumable) in App Store Connect, Google Play, and RevenueCat.
- [ ] Age rating questionnaire.
- [ ] Export compliance (uses standard encryption only).
