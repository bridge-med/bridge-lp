# Reviewer notes (App Store / Google Play)

- **No account / login required.** The app works fully offline on first launch.
- **No sign-up to test any feature.** Just complete the short onboarding
  (profession / role / purpose — all skippable) and you reach the home screen.
- **AI features are optional and bring-your-own-key.** They only work if the
  user pastes their own Google Gemini API key in Settings → AI. Without a key,
  reflection/career features fall back to a local mock (no network). So no test
  credentials are needed; AI can be left untested.
- **In-app purchase:** a single non-consumable, "Remove ads" (no subscription,
  no auto-renew). All app features are free; the purchase only hides banner ads.
- **Ads:** Google AdMob banner shown on list screens in the free version
  (not in the work-log detail). Removed by the purchase above.
- **Data & privacy:** all user content is stored locally (AsyncStorage) by
  default and is not sent to our servers. See store/privacy-policy.md.
- **Account deletion / data deletion:** Settings → Delete all data.

## How to test core flow
1. Launch → finish onboarding (or skip).
2. Home → "仕事ログ" → fill a couple of fields → save.
3. Tasks → add a task, mark done.
4. Reflection → "今週" → a summary is generated from logs (mock without a key).
5. Settings → "広告を消す" shows the purchase screen.
