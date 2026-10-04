"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { downloadBlob, safeFileName } from "@/lib/export/download";
import { toMarkdown } from "@/lib/export/markdown";
import { toPlainText } from "@/lib/export/text";
import type { Question } from "@/types/question";

const FONT_URL = "/fonts/BIZUDGothic-Regular.ttf";

export function ExportMenu({ title, questions }: { title: string; questions: Question[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = safeFileName(title);
  const empty = questions.length === 0;

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ toPdf }, font] = await Promise.all([
        import("@/lib/export/pdf"),
        fetch(FONT_URL).then((r) => {
          if (!r.ok) throw new Error("PDF 用のフォントを読み込めませんでした(npm run setup を実行してください)");
          return r.arrayBuffer();
        }),
      ]);
      const bytes = await toPdf(title, questions, font);
      downloadBlob(bytes as BlobPart, `${name}.pdf`, "application/pdf");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "PDF を作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button size="sm" disabled={empty} onClick={() => downloadBlob(toMarkdown(title, questions), `${name}.md`, "text/markdown;charset=utf-8")}>
          Markdown
        </Button>
        <Button size="sm" disabled={empty} onClick={() => downloadBlob(toPlainText(title, questions), `${name}.txt`, "text/plain;charset=utf-8")}>
          TXT
        </Button>
        <Button size="sm" disabled={empty || busy} onClick={exportPdf}>
          {busy ? "作成中" : "PDF"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
