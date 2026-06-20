# BRIDGE Focus — 公開ランブック（実装の手前 → 公開）

このリポジトリには **あなたのアカウント/認証が不要な範囲は全部** 用意してあります。
残りは「あなたのアカウントで鍵を入れてビルド＆提出」だけ。所要は概ね半日〜1日（審査待ち除く）。

## いま出来ていること（コード側）
- アプリ本体（Focus / Log / Settings / 没入モード）。ローカル保存で完全動作・初回サンプルデータあり
- **課金なし・広告なし・トラッキングなし・アカウント不要**
- アプリアイコン／スプラッシュ一式（`assets/`、再生成は `node scripts/gen-icons.mjs`）
- `eas.json` / `app.config.ts`（env対応）
- ストア掲載文・プライバシーポリシー・審査メモ・素材チェックリスト（`store/`）
- 公開プライバシーページ：`legal/focus-privacy.html`（リポジトリ側、GitHub Pagesで配信）
- Web プレビュー：`https://bridge-med.github.io/bridge-lp/pomodoro-app/`

## あなたがやること（要アカウント/支払い）
0. アカウント：Expo（無料）/ Apple Developer（$99/年）/ Google Play（$25 買い切り）
1. **EAS 初期化**
   ```bash
   cd mobile-pomodoro && npm install --legacy-peer-deps
   npm i -g eas-cli && eas login && eas init    # projectId が作られる
   export EAS_PROJECT_ID=...  EAS_OWNER=...      # app.config.ts が読む
   ```
2. **実機で確認（開発ビルド）**
   ```bash
   eas build --profile development --platform ios   # または android
   ```
3. **本番ビルド → 提出**
   ```bash
   eas build --platform ios|android --profile production
   # eas.json の submit に Apple/Google の値を入れてから:
   eas submit --platform ios|android --latest
   ```
4. ストア掲載（`store/` の文面・スクショ・プライバシーURL）→ 審査提出
5. 以降の修正は `eas update --branch production`（OTA・審査不要）

詳しい手順は `RELEASE-RUNBOOK.md`、素材は `store/assets-checklist.md`。
