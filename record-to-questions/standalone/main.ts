/**
 * 1枚のページで完結する版の画面。React を使わず DOM を直接組む(1ファイルに収めるため)。
 * 結果はこのブラウザの localStorage にだけ保存し、書き出しは viewer の downloads 機能で行う。
 */
import { toMarkdown } from "@/lib/export/markdown";
import { toPlainText } from "@/lib/export/text";
import { newId } from "@/lib/id";
import { choiceMarker, nextChoiceLabel, questionTitle } from "@/lib/questions";
import type { ProcessResult, ProcessWarning, SourceFrame } from "@/types/project";
import type { Question } from "@/types/question";
import { processInBrowser, type Progress } from "./browserPipeline";

type State = {
  title: string;
  questions: Question[];
  warnings: ProcessWarning[];
  mergedText: string;
  /** 元画像は容量が大きいので保存せず、解析したその場でだけ持つ */
  frames: SourceFrame[];
};

const STORAGE_KEY = "rtq:last";
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

let state: State | null = null;
let abort: AbortController | null = null;

/* ---------- 保存(このブラウザだけ) ---------- */

function save() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, frames: [] }));
  } catch {
    // 保存できない環境(プライベートブラウズ等)でも、その場では使える
  }
}

function restore(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...(JSON.parse(raw) as Omit<State, "frames">), frames: [] };
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

/* ---------- 小さな DOM ヘルパー ---------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function autoGrow(t: HTMLTextAreaElement) {
  const fit = () => {
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight + 2}px`;
  };
  t.addEventListener("input", fit);
  requestAnimationFrame(fit);
}

function field(label: string, input: HTMLInputElement | HTMLTextAreaElement) {
  const id = `f_${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  return el("div", { class: "field" }, el("label", { for: id, text: label }), input);
}

function toast(message: string) {
  const t = $("#toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout((t as unknown as { timer?: number }).timer);
  (t as unknown as { timer?: number }).timer = window.setTimeout(() => (t.hidden = true), 2600);
}

/* ---------- 進み具合 ---------- */

const STEPS: { key: string; label: string }[] = [
  { key: "load", label: "動画を読み込む" },
  { key: "extract", label: "画面を取り出す" },
  { key: "dedupe", label: "同じ画面をまとめる" },
  { key: "ocr", label: "文字を読み取る" },
  { key: "structure", label: "問題に分ける" },
];

let ocrStartedAt = 0;

function remaining(p: Progress): string {
  if (p.stage !== "ocr" || !p.total || !p.current) return "";
  if (p.current === 1) ocrStartedAt = Date.now();
  if (p.current < 3) return "";
  const perFrame = (Date.now() - ocrStartedAt) / (p.current - 1);
  const sec = Math.round((perFrame * (p.total - p.current)) / 1000);
  return sec >= 60 ? ` ・ 残り約${Math.ceil(sec / 60)}分` : ` ・ 残り約${Math.max(5, Math.ceil(sec / 5) * 5)}秒`;
}

function renderProgress(p: Progress) {
  const key = p.stage === "ocr-init" ? "ocr" : p.stage;
  const active = STEPS.findIndex((s) => s.key === key);
  const list = $("#steps");
  list.replaceChildren(
    ...STEPS.map((s, i) => {
      const status = i < active ? "done" : i === active ? "active" : "pending";
      let detail = "";
      if (i === active && p.total) detail = `${p.current ?? 0} / ${p.total}${remaining(p)}`;
      if (i === active && p.stage === "ocr-init") detail = "準備中";
      return el(
        "li",
        { class: status },
        el("span", { class: "dot", "aria-hidden": "true" }),
        el("span", { text: s.label }),
        el("span", { class: "detail", text: detail }),
      );
    }),
  );
}

/* ---------- 結果の表示と編集 ---------- */

function frameTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderQuestion(q: Question, index: number): HTMLElement {
  const card = el("article", { class: "q", id: `q-${q.id}` });
  const update = (patch: Partial<Question>) => {
    Object.assign(q, patch);
    saveSoon();
  };

  const head = el("header", { class: "q-head" }, el("h3", { text: questionTitle(q, index) }));
  const del = el("button", { type: "button", class: "ghost danger", text: "削除" });
  del.addEventListener("click", () => {
    if (del.dataset.confirm) {
      state!.questions = state!.questions.filter((x) => x.id !== q.id);
      save();
      renderResult();
      return;
    }
    del.dataset.confirm = "1";
    del.textContent = "もう一度押すと削除";
    setTimeout(() => {
      delete del.dataset.confirm;
      del.textContent = "削除";
    }, 3000);
  });
  head.append(del);
  card.append(head);

  const num = el("input", { inputmode: "numeric", class: "num", value: q.questionNumber?.toString() ?? "" });
  num.addEventListener("input", () => {
    const n = Number.parseInt(num.value.normalize("NFKC"), 10);
    update({ questionNumber: Number.isFinite(n) ? n : undefined });
    head.querySelector("h3")!.textContent = questionTitle(q, index);
  });

  const text = el("textarea", { rows: "2" });
  text.value = q.questionText;
  autoGrow(text);
  text.addEventListener("input", () => update({ questionText: text.value }));
  card.append(el("div", { class: "row-num" }, field("番号", num)), field("問題文", text));

  const choices = el("div", { class: "choices" });
  const drawChoices = () => {
    choices.replaceChildren(
      ...q.choices.map((c, ci) => {
        const label = el("input", { class: "label", value: c.label, "aria-label": `選択肢${ci + 1}の記号` });
        label.addEventListener("input", () => {
          c.label = label.value;
          saveSoon();
        });
        const body = el("textarea", { rows: "1", "aria-label": `選択肢${ci + 1}` });
        body.value = c.text;
        autoGrow(body);
        body.addEventListener("input", () => {
          c.text = body.value;
          saveSoon();
        });
        const x = el("button", { type: "button", class: "ghost icon", "aria-label": `選択肢${ci + 1}を削除`, text: "×" });
        x.addEventListener("click", () => {
          q.choices.splice(ci, 1);
          saveSoon();
          drawChoices();
        });
        return el("div", { class: "choice" }, label, body, x);
      }),
    );
  };
  drawChoices();
  const addChoice = el("button", { type: "button", class: "ghost", text: "+ 選択肢を追加" });
  addChoice.addEventListener("click", () => {
    q.choices.push({ label: nextChoiceLabel(q.choices.map((c) => c.label)), text: "" });
    saveSoon();
    drawChoices();
  });
  card.append(el("div", { class: "field" }, el("span", { class: "flabel", text: "選択肢" }), choices, addChoice));

  const answer = el("input", { value: q.answer ?? "" });
  answer.addEventListener("input", () => update({ answer: answer.value || undefined }));
  const expl = el("textarea", { rows: "1" });
  expl.value = q.explanation ?? "";
  autoGrow(expl);
  expl.addEventListener("input", () => update({ explanation: expl.value || undefined }));
  card.append(el("div", { class: "pair" }, field("正解", answer), field("解説", expl)));

  // 元の画面と、読み取った原文
  const frames = (state?.frames ?? []).filter((f) => q.sourceFrameIds?.includes(f.id));
  const more = el("details", { class: "source" }, el("summary", { text: frames.length ? `元の画面(${frames.length})と原文` : "読み取った原文" }));
  for (const f of frames) {
    more.append(el("figure", {}, el("img", { src: f.image, alt: `${frameTime(f.timestamp)} の画面`, loading: "lazy" }), el("figcaption", { text: frameTime(f.timestamp) })));
  }
  more.append(el("pre", { text: q.rawText || "(なし)" }));
  card.append(more);
  return card;
}

function renderResult() {
  if (!state) return;
  $("#start").hidden = true;
  $("#progress").hidden = true;
  $("#result").hidden = false;

  const title = $<HTMLInputElement>("#title");
  title.value = state.title;

  const flagged = state.warnings.filter((w) => w.code !== "no-questions" || state!.questions.length === 0);
  const summary = $("#summary");
  summary.replaceChildren(
    el("strong", { text: `${state.questions.length}問` }),
    flagged.length ? el("span", { class: "warn", text: ` ・ 確認したほうがよい点 ${flagged.length}件` }) : "",
  );
  const warnList = $("#warnings");
  warnList.replaceChildren(...flagged.map((w) => el("li", { text: w.message })));
  warnList.hidden = flagged.length === 0;

  const nav = $("#jump");
  nav.replaceChildren(
    ...state.questions.map((q, i) => {
      const a = el("a", { href: `#q-${q.id}`, text: questionTitle(q, i) });
      if (state!.warnings.some((w) => w.questionId === q.id)) a.classList.add("flag");
      return a;
    }),
  );

  $("#list").replaceChildren(...state.questions.map(renderQuestion));
  $("#merged").textContent = state.mergedText || "(読み取れた文字がありません)";
}

/* ---------- 書き出し ---------- */

type Downloads = { save(req: { filename: string; data: string | Blob | ArrayBuffer | ArrayBufferView }): Promise<unknown> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };
let downloads: Downloads | null = null;

function fileBase() {
  return (state?.title || "問題集").replace(/[\\/:*?"<>|\n\r]+/g, "_").trim().slice(0, 80) || "問題集";
}

function showFallback(text: string) {
  const box = $<HTMLTextAreaElement>("#fallback-text");
  box.value = text;
  $("#fallback").hidden = false;
  box.focus();
  box.select();
}

async function offer(filename: string, data: string | Uint8Array, textForFallback: string) {
  if (!downloads) {
    showFallback(textForFallback);
    toast("この画面ではファイルを保存できません。下の文字をコピーしてください");
    return;
  }
  try {
    await downloads.save({ filename, data });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "declined") return;
    console.error(e);
    showFallback(textForFallback);
    toast("ファイルを保存できませんでした。下の文字をコピーしてください");
  }
}

async function copyAll() {
  if (!state) return;
  const text = toPlainText(state.title, state.questions);
  try {
    await navigator.clipboard.writeText(text);
    toast("コピーしました");
  } catch {
    showFallback(text);
  }
}

async function exportPdf(button: HTMLButtonElement) {
  if (!state) return;
  button.disabled = true;
  const label = button.textContent;
  button.textContent = "作成中";
  try {
    const [{ toPdf }, font] = await Promise.all([
      import("@/lib/export/pdf"),
      fetch(new URL("fonts/BIZUDGothic-Regular.ttf", document.baseURI)).then((r) => {
        if (!r.ok) throw new Error("PDF 用のフォントを読み込めませんでした");
        return r.arrayBuffer();
      }),
    ]);
    const bytes = await toPdf(state.title, state.questions, font);
    await offer(`${fileBase()}.pdf`, bytes, toPlainText(state.title, state.questions));
  } catch (e) {
    console.error(e);
    toast(e instanceof Error ? e.message : "PDF を作れませんでした");
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/* ---------- 解析の開始 ---------- */

/** 解析中に画面が消えると止まるので、画面のスリープを止めておく(使えない環境では何もしない) */
async function keepAwake(): Promise<() => void> {
  try {
    const lock = await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen");
    return () => void lock?.release().catch(() => {});
  } catch {
    return () => {};
  }
}

async function start(file: File) {
  abort = new AbortController();
  const release = await keepAwake();
  $("#start").hidden = true;
  $("#result").hidden = true;
  $("#error").hidden = true;
  $("#progress").hidden = false;
  renderProgress({ stage: "load" });
  try {
    const result: ProcessResult = await processInBrowser(file, renderProgress, abort.signal);
    state = {
      title: file.name.replace(/\.[^.]+$/, "") || "問題集",
      questions: result.questions,
      warnings: result.warnings,
      mergedText: result.mergedText,
      frames: result.frames,
    };
    save();
    renderResult();
    window.scrollTo({ top: 0 });
  } catch (e) {
    $("#progress").hidden = true;
    if (abort.signal.aborted) {
      $("#start").hidden = false;
      return;
    }
    console.error(e);
    $("#error-message").textContent = e instanceof Error ? e.message : String(e);
    $("#error").hidden = false;
  } finally {
    release();
  }
}

function backToStart() {
  $("#result").hidden = true;
  $("#error").hidden = true;
  $("#start").hidden = false;
}

/** ファイル保存の機能は viewer が後から用意することがあるので、少し待ちながら探す */
function connectDownloads(tries = 0) {
  const claude = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!claude?.use) {
    if (tries < 20) setTimeout(() => connectDownloads(tries + 1), 250);
    return;
  }
  claude
    .use("downloads")
    .then((d) => (downloads = (d as Downloads | null) ?? null))
    .catch(() => (downloads = null));
}

/* ---------- 起動 ---------- */

function init() {
  const input = $<HTMLInputElement>("#file");
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    input.value = "";
    if (f) void start(f);
  });
  $("#cancel").addEventListener("click", () => abort?.abort());
  $("#retry").addEventListener("click", backToStart);
  $("#new").addEventListener("click", backToStart);
  $("#copy").addEventListener("click", () => void copyAll());
  $("#dl-txt").addEventListener("click", () => {
    if (!state) return;
    const text = toPlainText(state.title, state.questions);
    void offer(`${fileBase()}.txt`, text, text);
  });
  $("#dl-md").addEventListener("click", () => {
    if (!state) return;
    const md = toMarkdown(state.title, state.questions);
    void offer(`${fileBase()}.md`, md, md);
  });
  $("#dl-pdf").addEventListener("click", (e) => void exportPdf(e.currentTarget as HTMLButtonElement));
  $("#fallback-close").addEventListener("click", () => ($("#fallback").hidden = true));
  $("#add").addEventListener("click", () => {
    if (!state) return;
    const q: Question = {
      id: newId(),
      questionText: "",
      choices: [1, 2, 3, 4, 5].map((n) => ({ label: String(n), text: "" })),
      rawText: "",
      sourceFrameIds: [],
    };
    state.questions.push(q);
    save();
    renderResult();
    document.getElementById(`q-${q.id}`)?.scrollIntoView({ block: "start" });
  });
  $<HTMLInputElement>("#title").addEventListener("input", (e) => {
    if (!state) return;
    state.title = (e.target as HTMLInputElement).value;
    saveSoon();
  });

  const last = restore();
  const resume = $("#resume");
  if (last && last.questions.length) {
    resume.hidden = false;
    $("#resume-label").textContent = `${last.title}(${last.questions.length}問)`;
    resume.addEventListener("click", () => {
      state = last;
      renderResult();
    });
  }

  connectDownloads();

  // 見本の表示用に choiceMarker を参照(書き出しと同じ記号の付け方)
  $("#sample-choices")
    .querySelectorAll("[data-label]")
    .forEach((n) => (n.textContent = choiceMarker((n as HTMLElement).dataset.label ?? "")));
}

init();
