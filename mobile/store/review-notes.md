# Reviewer notes (App Store / Google Play)

- **No account / login required.** The app works fully offline on first launch.
- **No sign-up to test any feature.** Just complete the short onboarding
  (profession / role / purpose — all skippable) and you reach the home screen.
- **AI features are optional and bring-your-own-key.** They only work if the
  user pastes their own Gemini / OpenAI / Anthropic API key in Settings → AI.
  Without a key, reflection/career features fall back to a local mock (no
  network). So no test credentials are needed; AI can be left untested. Keys are
  stored in the device secure store (Keychain/Keystore), never on our servers.
- **In-app purchase:** consumable "coins" (coins_10 / coins_30 / coins_100) used
  to run AI generations. No subscription, no auto-renew. All non-AI features are
  free, and new users receive free coins, so purchases are not required to test.
  A "Restore purchases" affordance is on the Coins screen.
- **No ads.** The app shows no advertising and uses no ad SDK or tracking.
- **Data & privacy:** all user content is stored locally (AsyncStorage) by
  default and is not sent to our servers. See store/privacy-policy.md.
- **Account deletion / data deletion:** Settings → Delete all data.

## How to test core flow
1. Launch → finish onboarding (or skip).
2. Home → "仕事ログ" → fill a couple of fields → save.
3. Tasks → add a task, mark done.
4. Reflection → "今週" → a summary is generated from logs (mock without a key).
5. Coins screen → tap a pack to see the in-app purchase flow (sandbox).
