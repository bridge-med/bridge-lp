import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../ship-tier.mjs';

const F = (path, status = 'M', text) => ({ path, status, text });
const tier = (...files) => decide(files).tier;

test('変更なしは light', () => assert.equal(tier(), 'light'));
test('文書・記録・テストだけは light', () => {
  assert.equal(tier(F('cockpit-76a805/shiplog.jsonl'), F('docs/analytics.md'), F('clinic-flow-3d/tests/kasan.test.mjs'), F('scripts/update-ledger.mjs'), F('notes/feed.json'), F('README.md')), 'light');
});
test('審査する側の規程は standard で、pm を呼ぶ(light に落ちない)', () => {
  for (const p of ['CLAUDE.md', '.claude/skills/ship/SKILL.md', '.claude/agents/qa.md', '.claude/agents/pm.md']) {
    assert.equal(tier(F(p)), 'standard', p);
  }
  const d = decide([F('.claude/agents/qa.md'), F('cockpit-76a805/shiplog.jsonl')]);
  assert.match(d.hints[0], /pm を呼ぶ/);
  assert.ok(!d.hints.some(h => /公開物に触れた/.test(h)), '規程だけの変更に「公開物に触れた」と案内しない');
  const mixed = decide([F('CLAUDE.md'), F('scripts/check-site.mjs')]);
  assert.ok(mixed.hints.some(h => /pm を呼ぶ/.test(h)) && mixed.hints.some(h => /ゲートが落ちることを実地で/.test(h)));
});
test('配信前の変換は critical', () => assert.equal(tier(F('scripts/prepare-pages.mjs')), 'critical'));
test('既存のページ・プロダクトの変更は standard', () => {
  assert.equal(tier(F('philosophy/index.html')), 'standard');
  assert.equal(tier(F('clinic-flow-3d/app/main.js'), F('clinic-flow-3d/style.css')), 'standard');
  assert.equal(tier(F('medical-kb/data/kb/r08/items.json')), 'standard');
  assert.equal(tier(F('proto/top-ad/x.html')), 'standard');
});
test('品質ゲート・CI の変更は standard(light に落ちない)', () => {
  for (const p of ['scripts/check-site.mjs', 'scripts/check-shiplog.mjs', 'scripts/ship-tier.mjs', 'scripts/shiplog-stats.mjs', 'scripts/check-site.allowlist.json', '.github/workflows/check.yml', '.github/workflows/weekly-ledger.yml', '.github/scripts/rss-to-json.py']) {
    assert.equal(tier(F(p)), 'standard', p);
  }
  const d = decide([F('scripts/check-site.mjs')]);
  assert.match(d.hints[0], /ゲートが落ちることを実地で/);
});
test('hook・配信・秘密・骨格は critical', () => {
  for (const p of ['.claude/settings.json', 'scripts/pre-commit-gate.mjs', '.github/workflows/deploy.yml', 'shared/bridge.css', 'CONSTITUTION.md', 'docs/design-system.md', 'index.html', 'town/data.js', 'products/index.html', 'sitemap.xml', 'legal/site-privacy.html', 'yawagaeshi/sw.js', 'mobile/.env.example', 'app/secrets.json', 'config/api-key.txt']) {
    assert.equal(tier(F(p)), 'critical', p);
  }
});
test('workflow は中身で上がる: 権限・秘密に触れたら critical、触れなければ standard', () => {
  assert.equal(tier(F('.github/workflows/check.yml', 'M', '+      - run: node scripts/check-site.mjs\n')), 'standard');
  assert.equal(tier(F('.github/workflows/check.yml', 'M', '+permissions:\n+  contents: write\n')), 'critical');
  assert.equal(tier(F('.github/workflows/check.yml', 'A', '+permissions:\n+  contents: read\n+jobs:\n')), 'standard', 'read だけの permissions は standard');
  assert.equal(tier(F('.github/workflows/x.yml', 'M', '+      id-token: write\n')), 'critical');
  assert.equal(tier(F('.github/workflows/x.yml', 'M', '+on:\n+  pull_request_target:\n')), 'critical');
  assert.equal(tier(F('.github/workflows/weekly-ledger.yml', 'M', '+          GH_TOKEN: ${{ secrets.X }}\n')), 'critical');
  assert.equal(tier(F('.github/workflows/weekly-ledger.yml', 'M', '-permissions:\n-  contents: write\n')), 'standard', '消した行(-)だけなら中身の昇格はしない(名前の規則で standard)');
});
test('ページの追加・削除は critical、既存ページの変更は standard', () => {
  assert.equal(tier(F('karte/new.html', 'A')), 'critical');
  assert.equal(tier(F('karte/old.html', 'D')), 'critical');
  assert.equal(tier(F('karte/index.html', 'M')), 'standard');
});
test('混ざれば最も重い段階。理由は段階ごとに分かれる', () => {
  const d = decide([F('docs/x.md'), F('karte/index.html'), F('shared/bridge.js')]);
  assert.equal(d.tier, 'critical');
  assert.equal(d.reasons.light.length, 1);
  assert.equal(d.reasons.standard.length, 1);
  assert.equal(d.reasons.critical.length, 1);
});
test('内部ディレクトリの中の公開拡張子は light(docs の画像・.claude の json)', () => {
  assert.equal(tier(F('docs/hero.png'), F('cockpit-76a805/ledger.json')), 'light');
});
