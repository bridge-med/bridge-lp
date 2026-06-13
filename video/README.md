# 動画作成 (Video Creation)

ショート動画の自動生成パイプライン。第一弾は **Veo 3 による試作1本** から。

## なぜこの構成か
- **Veo 3** は音声・効果音込みの完成MP4を返すため、これ単体でショート動画が成立する（編集・結合工程が不要）。
- **Gemini REST API を直接利用**するため、`google-genai` SDK や `ffmpeg` のインストールが不要。依存は `requests` のみ。

## セットアップ
```bash
export GEMINI_API_KEY="あなたのGoogle APIキー"   # または GOOGLE_API_KEY
```
> 🔑 キーはコミットしないこと。環境変数で渡す。

## 試作1本を生成
```bash
# デフォルト（縦9:16・医療リクルート向けサンプルプロンプト）
python3 video/veo_trial.py

# プロンプト・縦横比・モデルを指定
python3 video/veo_trial.py "白衣の医師が朝の診療所で微笑む、シネマティック、8秒" \
    --aspect 9:16 --model veo-3.0-fast-generate-001 --out video/out.mp4
```

### モデル選択
| モデル | 特徴 |
|--------|------|
| `veo-3.0-fast-generate-001` | 速い・安い（試作向け / デフォルト） |
| `veo-3.0-generate-001` | 高品質 |
| `veo-2.0-generate-001` | 旧世代・低コスト |

## 今後の拡張（予定）
- 既存記事（daily/notes/worklog）→ 台本自動生成 → 連続動画化
- TTSナレーション・字幕焼き込み（ffmpeg導入後）
- 複数クリップの結合・BGM合成
