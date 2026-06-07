"""
仕事日記ダッシュボード /worklog 用に、GitHub Issues に放り込んだ「雑メモ」を
AI で整形し、日次・月次の成果記録として worklog/feed.json にまとめる。

入力(どこに打つか):
  - ラベル `worklog` を付けた GitHub Issue 本文 = 1 件のメモ。
    スマホの GitHub アプリ等から New Issue → テンプレ選択 → 雑に打って submit で完結。
  - Issue の作成日時(JST)がその日付。本文/タイトル先頭に `日付: YYYY-MM-DD`
    (または `date: YYYY-MM-DD`)があればそれを優先(後から前日分を書く用)。

整形(どう整形するか):
  - 各メモを Gemini で構造化: 一行見出し / 整形本文(敬体) / カテゴリ / タグ / 成果。
  - Issue 番号 + 本文ハッシュでキャッシュ。編集すると作り直し、未変更なら再呼び出ししない。

まとめ(どうまとめるか):
  - 日次: その日のエントリ + Gemini の「今日の総括」。
  - 月次: その月の成果を Gemini が巻き取った「成果レポート」。

GEMINI_API_KEY が無くてもキャッシュのみで動く。GitHub API は GITHUB_TOKEN を使う
(Actions では自動付与)。失敗しても部分的に動くよう個別 try/except。
"""
from __future__ import annotations
import json
import os
import re
import time
import hashlib
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

USER_AGENT = 'bridge-lp-worklog-refresher (+https://github.com/bridge-med/bridge-lp)'
TIMEOUT = 40
JST = timezone(timedelta(hours=9))
WEEKDAYS_JP = ['月', '火', '水', '木', '金', '土', '日']

REPO = (os.environ.get('GITHUB_REPOSITORY') or 'bridge-med/bridge-lp').strip()
WORKLOG_LABEL = (os.environ.get('WORKLOG_LABEL') or 'worklog').strip()


# ============================================================
# GitHub Issues 取得
# ============================================================
def gh_get(url: str, token: str) -> bytes:
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def fetch_issues(token: str) -> list[dict]:
    """label=worklog の Issue を全件取得。PR は除外。古い順に返す。"""
    items: list[dict] = []
    page = 1
    while True:
        q = urllib.parse.urlencode({
            'state': 'all',
            'labels': WORKLOG_LABEL,
            'per_page': 100,
            'page': page,
            'sort': 'created',
            'direction': 'asc',
        })
        url = f'https://api.github.com/repos/{REPO}/issues?{q}'
        try:
            raw = gh_get(url, token)
        except urllib.error.HTTPError as e:
            print(f'[github] HTTP {e.code} on page {page}: {e.reason}')
            break
        except Exception as e:
            print(f'[github] error on page {page}: {e}')
            break
        batch = json.loads(raw.decode('utf-8'))
        if not isinstance(batch, list) or not batch:
            break
        # PR は issues API にも混ざるので除外
        items.extend(it for it in batch if 'pull_request' not in it)
        if len(batch) < 100:
            break
        page += 1
    print(f'[github] fetched {len(items)} issue(s) with label "{WORKLOG_LABEL}"')
    return items


DATE_RE = re.compile(r'(?:日付|date)\s*[:：]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})', re.IGNORECASE)


def memo_date(issue: dict) -> str:
    """メモの日付(JST, YYYY-MM-DD)。本文/タイトルの明示指定を優先、なければ作成日時。"""
    text = (issue.get('title') or '') + '\n' + (issue.get('body') or '')
    m = DATE_RE.search(text)
    if m:
        try:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return f'{y:04d}-{mo:02d}-{d:02d}'
        except ValueError:
            pass
    created = issue.get('created_at', '')
    try:
        dt = datetime.fromisoformat(created.replace('Z', '+00:00')).astimezone(JST)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return datetime.now(JST).strftime('%Y-%m-%d')


def strip_date_directive(text: str) -> str:
    """本文先頭等の `日付: YYYY-MM-DD` 指定行を除去(表示・整形には不要)。"""
    return DATE_RE.sub('', text or '').strip()


def memo_time(issue: dict) -> str:
    created = issue.get('created_at', '')
    try:
        dt = datetime.fromisoformat(created.replace('Z', '+00:00')).astimezone(JST)
        return dt.strftime('%H:%M')
    except Exception:
        return ''


# ============================================================
# Gemini
# ============================================================
GEMINI_MODEL = 'gemini-2.5-flash'  # Free tier 250 RPD
GEMINI_ENDPOINT = (
    f'https://generativelanguage.googleapis.com/v1beta/models/'
    f'{GEMINI_MODEL}:generateContent'
)
SUMMARY_CACHE_PATH = Path('worklog/summary_cache.json')
SUMMARY_CACHE_MAX = 2000

GEMINI_RETRY_CODES = {429, 500, 502, 503, 504}
GEMINI_BACKOFF_SECS = [30, 90, 180]


def load_summary_cache() -> dict:
    if not SUMMARY_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(SUMMARY_CACHE_PATH.read_text(encoding='utf-8'))
    except Exception:
        return {}


def save_summary_cache(cache: dict) -> None:
    if len(cache) > SUMMARY_CACHE_MAX:
        keys = list(cache.keys())
        for k in keys[: len(cache) - SUMMARY_CACHE_MAX]:
            cache.pop(k, None)
    SUMMARY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def call_gemini(prompt: str, api_key: str, json_schema: dict | None = None,
                max_output_tokens: int = 8000) -> str | None:
    """Gemini に prompt を投げて応答テキストを返す。失敗時 None。
    json_schema を渡すと structured output mode。503/429 等は自動リトライ。"""
    gen_cfg: dict = {'temperature': 0.3, 'maxOutputTokens': max_output_tokens}
    if json_schema:
        gen_cfg['responseMimeType'] = 'application/json'
        gen_cfg['responseSchema'] = json_schema
    body = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': gen_cfg,
    }
    attempts = [0] + list(GEMINI_BACKOFF_SECS)
    for i, delay in enumerate(attempts):
        if delay:
            print(f'[gemini] retry {i}/{len(attempts)-1} after {delay}s')
            time.sleep(delay)
        req = urllib.request.Request(
            f'{GEMINI_ENDPOINT}?key={api_key}',
            data=json.dumps(body).encode('utf-8'),
            headers={'User-Agent': USER_AGENT, 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode('utf-8'))
            candidates = data.get('candidates', [])
            if not candidates:
                return None
            parts = candidates[0].get('content', {}).get('parts', [])
            if not parts:
                return None
            return parts[0].get('text', '').strip()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', errors='replace') if hasattr(e, 'read') else str(e)
            print(f'[gemini] HTTP {e.code}: {msg[:200]}')
            if e.code not in GEMINI_RETRY_CODES:
                return None
            continue
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'[gemini] network error: {e}')
            continue
        except Exception as e:
            print(f'[gemini] unexpected error: {e}')
            return None
    print('[gemini] all retries exhausted')
    return None


def _hash(s: str) -> str:
    return hashlib.md5(s.encode('utf-8')).hexdigest()[:8]


def entry_key(num: int, title: str, raw: str) -> str:
    return f'entry:{num}:{_hash(title.strip() + chr(10) + raw.strip())}'


# ============================================================
# 1) メモ → 整形エントリ
# ============================================================
ENTRY_SCHEMA = {
    'type': 'array',
    'items': {
        'type': 'object',
        'properties': {
            'headline': {'type': 'string'},
            'body':     {'type': 'string'},
            'category': {'type': 'string'},
            'tags':     {'type': 'array', 'items': {'type': 'string'}},
            'outcomes': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': ['headline', 'body', 'category', 'tags', 'outcomes'],
    },
}

ENTRY_INTRO = """あなたは優秀なビジネス秘書です。
利用者が打ち込んだ「その日の仕事の雑なメモ」を、後から成果として読み返せる業務日誌に整形します。

各メモについて、次を JSON で返してください:
- headline: そのメモを一言で表す見出し(20〜35字程度、体言止め可)
- body: 整形した本文(敬体・です/ます調、2〜4文)。事実ベースで、メモに無い情報や誇張は足さない。
        箇条書きの羅列ではなく、自然な文章にする
- category: 次から最も近いものを1つ選ぶ(営業/開発/制作/採用/会議/運営/学習/調査/サポート/その他)
- tags: メモから拾える短いタグ(2〜4個、各6字以内目安。固有名詞・案件名・テーマなど)
- outcomes: そのメモから読み取れる「具体的な成果・前進」を短い箇条書きで(0〜3個)。
            まだ着手段階で成果が無ければ空配列でよい

要件:
- 入力が短くても丁寧に整える。意味が取れない場合は原文を尊重し最小限の整形にとどめる
- 数字・固有名詞は原文どおり。勝手に増やさない"""


def build_entries(issues: list[dict], api_key: str, cache: dict) -> dict[int, dict]:
    """issue番号 -> 整形エントリ。キャッシュ優先、未整形分のみ Gemini にまとめて投げる。"""
    entries: dict[int, dict] = {}
    pending: list[tuple[int, dict]] = []  # (issue_number, issue)
    for it in issues:
        num = it.get('number')
        raw = strip_date_directive(it.get('body') or '')
        title = (it.get('title') or '').strip()
        key = entry_key(num, title, raw)
        if key in cache:
            entries[num] = cache[key]
            continue
        # API キーが無く未キャッシュなら、最低限のフォールバック(原文そのまま)
        if not api_key:
            entries[num] = _fallback_entry(title, raw)
            continue
        pending.append((num, it))

    if pending:
        bullets = []
        for i, (num, it) in enumerate(pending, 1):
            title = (it.get('title') or '').strip() or '(無題)'
            raw = strip_date_directive(it.get('body') or '') or '(本文なし)'
            bullets.append(f'### メモ {i}\nタイトル: {title}\n本文: {raw}')
        full = ENTRY_INTRO + '\n\n' + '\n\n'.join(bullets) + (
            f'\n\n上記 {len(pending)} 件を、メモ 1 から順に対応する JSON 配列で返してください。'
            f' 配列の長さは必ず {len(pending)} にすること。'
        )
        text = call_gemini(full, api_key, json_schema=ENTRY_SCHEMA, max_output_tokens=16000)
        parsed = []
        if text:
            try:
                parsed = json.loads(text)
            except Exception as e:
                print(f'[gemini entries] parse failed: {e}; preview: {text[:200]}')
        ok = 0
        for i, (num, it) in enumerate(pending):
            obj = parsed[i] if i < len(parsed) and isinstance(parsed[i], dict) else None
            if obj and obj.get('headline') and obj.get('body'):
                entry = {
                    'headline': str(obj.get('headline', '')).strip(),
                    'body':     str(obj.get('body', '')).strip(),
                    'category': str(obj.get('category', 'その他')).strip() or 'その他',
                    'tags':     [str(t).strip() for t in (obj.get('tags') or []) if str(t).strip()],
                    'outcomes': [str(o).strip() for o in (obj.get('outcomes') or []) if str(o).strip()],
                }
                ok += 1
            else:
                entry = _fallback_entry((it.get('title') or '').strip(), strip_date_directive(it.get('body') or ''))
            entries[num] = entry
            cache[entry_key(num, it.get('title') or '', strip_date_directive(it.get('body') or ''))] = entry
        print(f'[gemini entries] {ok}/{len(pending)} formatted')
    else:
        print('[gemini entries] all cached')
    return entries


def _fallback_entry(title: str, raw: str) -> dict:
    """Gemini を使えないときの素朴な整形(原文尊重)。"""
    headline = title or (raw.splitlines()[0][:35] if raw else '(無題のメモ)')
    return {
        'headline': headline,
        'body': raw or title,
        'category': 'その他',
        'tags': [],
        'outcomes': [],
    }


# ============================================================
# 2) 日次の総括
# ============================================================
DAY_SCHEMA = {'type': 'array', 'items': {'type': 'string'}}


def build_day_summaries(days: list[dict], api_key: str, cache: dict) -> None:
    """各 day に 'summary' を付与(破壊的)。キャッシュ優先、未生成分のみまとめて生成。"""
    pending: list[tuple[int, dict]] = []  # (index in days, day)
    for idx, day in enumerate(days):
        sig = _hash('|'.join(e['headline'] for e in day['entries']))
        key = f'day:{day["date"]}:{sig}'
        if key in cache:
            day['summary'] = cache[key]
        elif api_key:
            pending.append((idx, day))
        else:
            day['summary'] = ''

    if not pending:
        if days:
            print('[gemini days] all cached')
        return

    bullets = []
    for i, (idx, day) in enumerate(pending, 1):
        lines = []
        for e in day['entries']:
            oc = (' / 成果: ' + '、'.join(e['outcomes'])) if e['outcomes'] else ''
            lines.append(f'- [{e["category"]}] {e["headline"]}{oc}')
        bullets.append(f'### 日 {i}({day["date"]})\n' + '\n'.join(lines))
    full = (
        'あなたは利用者の業務を見守る上司です。以下は各日の業務エントリ一覧です。\n'
        'それぞれの日について、その日1日の「今日の総括」を 80〜140 字の日本語1段落で書いてください。\n'
        '要件:\n'
        '- その日に何を前進させたかを、淡々と、しかし手応えが伝わるトーンで\n'
        '- エントリに無いことは書かない。数字は原文どおり\n'
        '- 「〜しました」調。励ましの定型句で締めない\n\n'
        + '\n\n'.join(bullets)
        + f'\n\n上記 {len(pending)} 日を、日 1 から順に対応する文字列の JSON 配列で返してください。'
        f' 配列の長さは必ず {len(pending)}。'
    )
    text = call_gemini(full, api_key, json_schema=DAY_SCHEMA, max_output_tokens=8000)
    parsed = []
    if text:
        try:
            parsed = json.loads(text)
        except Exception as e:
            print(f'[gemini days] parse failed: {e}')
    ok = 0
    for i, (idx, day) in enumerate(pending):
        s = parsed[i] if i < len(parsed) and isinstance(parsed[i], str) else ''
        day['summary'] = s.strip()
        if s.strip():
            ok += 1
        sig = _hash('|'.join(e['headline'] for e in day['entries']))
        cache[f'day:{day["date"]}:{sig}'] = day['summary']
    print(f'[gemini days] {ok}/{len(pending)} summarized')


# ============================================================
# 3) 月次の成果レポート
# ============================================================
MONTH_SCHEMA = {'type': 'array', 'items': {'type': 'string'}}


def build_months(days: list[dict], api_key: str, cache: dict) -> list[dict]:
    """days(新しい順) から月次レポートを生成して返す(新しい順)。"""
    # 月ごとに集約
    buckets: dict[str, list[dict]] = {}
    for day in days:
        ym = day['date'][:7]
        buckets.setdefault(ym, []).append(day)

    months: list[dict] = []
    pending: list[tuple[int, str, list[dict]]] = []  # (index, ym, day_list)
    for ym in sorted(buckets.keys(), reverse=True):
        day_list = buckets[ym]
        entry_count = sum(len(d['entries']) for d in day_list)
        m = {
            'ym': ym,
            'label': f'{ym[:4]}年{int(ym[5:7])}月',
            'day_count': len(day_list),
            'entry_count': entry_count,
            'report': '',
        }
        sig = _hash('|'.join(
            d['date'] + ':' + e['headline'] for d in day_list for e in d['entries']
        ))
        key = f'month:{ym}:{sig}'
        if key in cache:
            m['report'] = cache[key]
        elif api_key:
            pending.append((len(months), ym, day_list))
        months.append(m)

    if pending:
        bullets = []
        for i, (idx, ym, day_list) in enumerate(pending, 1):
            lines = [f'### 月 {i}({ym})']
            for d in day_list:
                heads = '、'.join(e['headline'] for e in d['entries'])
                lines.append(f'- {d["date"]}: {heads}')
            bullets.append('\n'.join(lines))
        full = (
            'あなたは利用者の業務成果をまとめる秘書です。以下は各月の日次エントリ一覧です。\n'
            'それぞれの月について、評価面談や振り返りにそのまま使える「成果レポート」を書いてください。\n'
            '構成(各見出しは付けず、段落で):\n'
            '1) その月の主な成果(2〜3文)\n'
            '2) 動いた領域・テーマ(2〜3文、カテゴリの偏りや注力点)\n'
            '3) 所感・次に向けて(1〜2文)\n'
            '要件:\n'
            '- 合計 250〜400 字程度。エントリに無いことは書かない。数字は原文どおり\n'
            '- 「です/ます」調。誇張しない\n\n'
            + '\n\n'.join(bullets)
            + f'\n\n上記 {len(pending)} 月を、月 1 から順に対応する文字列の JSON 配列で返してください。'
            f' 配列の長さは必ず {len(pending)}。'
        )
        text = call_gemini(full, api_key, json_schema=MONTH_SCHEMA, max_output_tokens=10000)
        parsed = []
        if text:
            try:
                parsed = json.loads(text)
            except Exception as e:
                print(f'[gemini months] parse failed: {e}')
        ok = 0
        for i, (idx, ym, day_list) in enumerate(pending):
            s = parsed[i] if i < len(parsed) and isinstance(parsed[i], str) else ''
            months[idx]['report'] = s.strip()
            if s.strip():
                ok += 1
            sig = _hash('|'.join(
                d['date'] + ':' + e['headline'] for d in day_list for e in d['entries']
            ))
            cache[f'month:{ym}:{sig}'] = months[idx]['report']
        print(f'[gemini months] {ok}/{len(pending)} reported')
    elif months:
        print('[gemini months] all cached')
    return months


# ============================================================
# main
# ============================================================
def main(out_path: str) -> None:
    token = (os.environ.get('GITHUB_TOKEN') or '').strip()
    api_key = (os.environ.get('GEMINI_API_KEY') or '').strip()
    if not api_key:
        print('GEMINI_API_KEY not set; using existing cache / fallback only')

    print(f'--- GitHub Issues ({REPO}, label={WORKLOG_LABEL}) ---')
    issues = fetch_issues(token)

    cache = load_summary_cache()

    print('--- Gemini: メモ整形 ---')
    entries = build_entries(issues, api_key, cache)

    # 日付ごとに集約(エントリは時刻昇順、日は新しい順)
    by_date: dict[str, list[dict]] = {}
    for it in issues:
        num = it.get('number')
        entry = dict(entries.get(num) or {})
        if not entry:
            continue
        entry['issue'] = num
        entry['url'] = it.get('html_url', '')
        entry['created_jst'] = memo_time(it)
        by_date.setdefault(memo_date(it), []).append(entry)

    days: list[dict] = []
    for date in sorted(by_date.keys(), reverse=True):
        ents = sorted(by_date[date], key=lambda e: e.get('created_jst', ''))
        try:
            wd = WEEKDAYS_JP[datetime.strptime(date, '%Y-%m-%d').weekday()]
        except Exception:
            wd = ''
        days.append({'date': date, 'weekday': wd, 'summary': '', 'entries': ents})

    print('--- Gemini: 日次総括 ---')
    if api_key and days:
        time.sleep(4)
    build_day_summaries(days, api_key, cache)

    print('--- Gemini: 月次レポート ---')
    if api_key and days:
        time.sleep(4)
    months = build_months(days, api_key, cache)

    if api_key:
        save_summary_cache(cache)

    out = {
        'updated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'updated_jst': datetime.now(JST).isoformat(timespec='minutes'),
        'source': f'GitHub Issues (label: {WORKLOG_LABEL})',
        'repo': REPO,
        'issue_count': len(issues),
        'days': days,
        'months': months,
    }
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'wrote {out_path} (issues {len(issues)} / days {len(days)} / months {len(months)})')


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'worklog/feed.json'
    main(out)
