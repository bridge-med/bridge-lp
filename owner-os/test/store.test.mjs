/* =========================================================================
 * OWNER OS — store.js / ai.js のロジックテスト
 * 実行: node --test owner-os/test/
 * ブラウザなし(localStorageなし)でも動くことを前提にした純ロジックの検証。
 * ========================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../app/store.js');
await import('../app/ai.js');

const Store = globalThis.Store;
const AI = globalThis.AI;

function reseed() {
  Store.resetAll();
  Store.seed('テスト太郎', 'プロジェクト責任者');
}

test('seed: プロジェクト・関係者・タスクが投入される', () => {
  reseed();
  assert.equal(Store.projects().length, 1);
  assert.equal(Store.projects()[0].name, '医療法人統合プロジェクト');
  assert.equal(Store.people().length, 8);
  assert.ok(Store.tasks().length >= 9);
  assert.equal(Store.user().name, 'テスト太郎');
});

test('seed: 主要な状態(超過・待ち・未担当・保留・完了)が揃っている', () => {
  reseed();
  const ts = Store.tasks();
  assert.ok(ts.some(t => Store.isOverdue(t)), '期限超過タスクがある');
  assert.ok(ts.some(t => Store.isWaiting(t)), '回答待ちタスクがある');
  assert.ok(ts.some(t => Store.isWaitingLong(t)), '長く待っているタスクがある');
  assert.ok(ts.some(t => Store.noExecutor(t)), '担当者未設定タスクがある');
  assert.ok(ts.some(t => Store.checkDue(t)), '確認日が来ているタスクがある');
  assert.ok(ts.some(t => Store.isInactive(t)), '動いていないタスクがある');
  assert.ok(ts.some(t => t.status === 'hold'), '保留タスクがある');
  assert.ok(ts.some(t => t.status === 'done'), '完了タスクがある');
  assert.ok(ts.some(t => t.ball === 'me' && Store.isOpen(t)), '自分ボールのタスクがある');
  assert.ok(ts.some(t => t.ball === 'owner'), '委任済みタスクがある');
});

test('addTask: 初期値は自分ボール・未分類', () => {
  reseed();
  const t = Store.addTask({ title: 'テストタスク', projectId: Store.projects()[0].id });
  assert.equal(t.ball, 'me');
  assert.equal(t.classification, 'none');
  assert.equal(t.finalOwnerId, Store.ME);
  assert.equal(t.status, 'active');
});

test('classifyTask: 保留にすると状態とボールも保留になる', () => {
  reseed();
  const t = Store.addTask({ title: '保留テスト' });
  Store.classifyTask(t.id, 'hold');
  const after = Store.task(t.id);
  assert.equal(after.status, 'hold');
  assert.equal(after.ball, 'hold');
  Store.classifyTask(t.id, 'decide');
  assert.equal(Store.task(t.id).status, 'active');
  assert.equal(Store.task(t.id).ball, 'me');
});

test('passBall: 待ち状態で waitingSince が入り、自分に戻すと消える', () => {
  reseed();
  const t = Store.addTask({ title: 'ボールテスト' });
  const pid = Store.people()[0].id;
  Store.passBall(t.id, 'waiting_answer', pid);
  let after = Store.task(t.id);
  assert.ok(after.waitingSince, 'waitingSinceが入る');
  assert.equal(after.ballHolderId, pid);
  assert.equal(after.nextActorId, pid);
  Store.passBall(t.id, 'me', null);
  after = Store.task(t.id);
  assert.equal(after.waitingSince, null);
  assert.equal(after.ballHolderId, Store.ME);
});

test('passBall: 完了で completedAt が入り、isOpen が false になる', () => {
  reseed();
  const t = Store.addTask({ title: '完了テスト' });
  Store.completeTask(t.id);
  const after = Store.task(t.id);
  assert.equal(after.status, 'done');
  assert.ok(after.completedAt);
  assert.equal(Store.isOpen(after), false);
});

test('morning: 4区分が意図どおりに埋まる', () => {
  reseed();
  const m = Store.morning();
  // 決める: 自分ボール×decide(行政届出一覧の確認 など)
  assert.ok(m.decide.some(t => t.title === '行政届出一覧の確認'));
  // 振る: delegateなのに担当者なし(看護師配置の調整)
  assert.ok(m.hand.some(t => t.title === '看護師配置の調整'));
  // 催促: 確認日が来ている待ちタスク(麻薬関連手続きの確認)
  assert.ok(m.remind.some(t => t.title === '麻薬関連手続きの確認'));
  // 止まる: 期限超過(契約書巻き直しの実施体制決定)
  assert.ok(m.blocked.some(t => t.title === '契約書巻き直しの実施体制決定'));
});

test('alerts: 各シグナルが検知される', () => {
  reseed();
  const al = Store.alerts();
  assert.ok(al.overdue.length >= 1);
  assert.ok(al.waitingLong.length >= 1);
  assert.ok(al.noExecutor.length >= 1);
  assert.ok(al.checkDue.length >= 1);
  assert.ok(al.noNextCheck.length >= 1);
  assert.ok(al.noCriteria.length >= 1);
  assert.ok(al.inactive.length >= 1);
});

test('projectWarnings: 停滞要因が文章で返る', () => {
  reseed();
  const warns = Store.projectWarnings(Store.projects()[0].id);
  assert.ok(warns.length >= 2);
  assert.ok(warns.every(w => typeof w.label === 'string' && w.label.length > 0));
});

test('ballBoard: ボール別に分かれる', () => {
  reseed();
  const b = Store.ballBoard(Store.projects()[0].id);
  assert.ok(b.me.length >= 1);
  assert.ok(b.owner.length >= 1);
  assert.ok(b.wait.length >= 1);
  assert.ok(b.hold.length >= 1);
});

test('weeklyReview: 集計と改善提案が返る', () => {
  reseed();
  const r = Store.weeklyReview();
  assert.ok(r.completed.length >= 1, '直近の完了がある');
  assert.ok(r.delegated >= 1, '委任の記録がある');
  assert.ok(r.myBall.length >= 1);
  assert.ok(r.tips.length >= 1);
});

test('sortTasks: 期限超過が先頭に来る', () => {
  reseed();
  const sorted = Store.sortTasks(Store.tasks().filter(Store.isOpen));
  assert.ok(Store.isOverdue(sorted[0]), '先頭は期限超過');
});

// ---- AI(モック) ------------------------------------------------------------

test('AI.suggest: 麻薬関連は「誰かに聞く」+行政系の論点', async () => {
  const s = await AI._mock.suggest({ title: '統合後の麻薬関係について確認が必要', description: '' });
  assert.equal(s.classification, 'ask');
  assert.ok(s.suggestedRole.includes('麻薬') || s.suggestedRole.includes('行政'));
  assert.ok(s.discussionPoints.length >= 4);
  assert.ok(s.completionCriteria.length > 0);
  assert.ok(s.note.length > 0, '下書きである旨の注記がある');
});

test('AI.suggest: 契約は「誰かに任せる」', async () => {
  const s = await AI._mock.suggest({ title: '契約書の巻き直し方法を決める', description: '' });
  assert.equal(s.classification, 'delegate');
});

test('AI.suggest: 辞書外でも分類候補が返る', async () => {
  const s = await AI._mock.suggest({ title: '新しい備品の購入を検討', description: '内容を確認したい' });
  assert.ok(['decide', 'ask', 'delegate', 'hold'].includes(s.classification));
  assert.ok(s.nextStep.length > 0);
});

test('AI.composeRequest: 全文体で名前・期限・完了条件が入る', () => {
  const o = {
    personName: '鈴木', title: '麻薬関連手続きの確認',
    background: '統合に伴う確認', points: ['免許の手続き要否'],
    criteria: '手続き一覧が明確', due: '2026-08-20', userName: '橋本', askOnly: true
  };
  for (const tone of Object.keys(AI.TONES)) {
    const text = AI.composeRequest(o, tone);
    assert.ok(text.includes('鈴木さん'), tone + ': 宛名');
    assert.ok(text.includes('麻薬関連手続きの確認'), tone + ': タスク名');
    assert.ok(text.includes('8月20日'), tone + ': 期限');
  }
});

test('AI.composeReminder: 進捗確認の文になる', () => {
  const text = AI.composeReminder({ personName: '鈴木', title: '麻薬関連手続きの確認', due: '2026-08-20', userName: '橋本' }, 'polite');
  assert.ok(text.includes('鈴木さん'));
  assert.ok(text.includes('いまの状況'));
  assert.ok(text.includes('8月20日'));
});

test('AI.reflect: 例文が事実・感情・次の行動に分かれる', async () => {
  const r = await AI._mock.reflect('オーナーシップが足りないと言われた。期待に応えられていない気がする。不安だ。');
  assert.ok(r.fact.includes('言われた'));
  assert.ok(r.emotion.includes('不安'));
  assert.ok(r.actualIssue.length > 0);
  assert.ok(r.nextAction.length > 0);
  assert.ok(r.prevention.length > 0);
});

test('AI.reflect: 手がかりがない入力では書き込み用の促しを返す', async () => {
  const r = await AI._mock.reflect('もやもやする');
  assert.ok(r.fact.includes('書いてみて'));
});

test('AI.composeCareerLog: 実績の行と自記入欄が入る', () => {
  const text = AI.composeCareerLog({
    from: '7/30(木)', to: '8/6(木)',
    decided: 3, delegated: 2, reminded: 1,
    completedTitles: ['統合キックオフの開催'],
    projects: ['医療法人統合プロジェクト']
  });
  assert.ok(text.includes('意思決定・分類: 3件'));
  assert.ok(text.includes('委任・依頼: 2件'));
  assert.ok(text.includes('「統合キックオフの開催」'));
  assert.ok(text.includes('医療法人統合プロジェクト'));
  assert.ok(text.includes('気づき(自分の言葉で):'));
});

test('AI.composeCareerLog: 完了ゼロの週でも破綻しない', () => {
  const text = AI.composeCareerLog({
    from: '7/30(木)', to: '8/6(木)',
    decided: 0, delegated: 0, reminded: 0,
    completedTitles: [], projects: []
  });
  assert.ok(text.includes('意思決定・分類: 0件'));
  assert.ok(!text.includes('完了:'));
  assert.ok(!text.includes('動かしたプロジェクト:'));
});
