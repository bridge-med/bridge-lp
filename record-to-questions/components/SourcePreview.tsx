"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { IconClose } from "./ui/icons";
import { cn } from "@/lib/utils";
import type { SourceFrame } from "@/types/project";

type Props = {
  /** この問題を読み取ったフレーム */
  frames: SourceFrame[];
  allFrames: SourceFrame[];
  mergedText: string;
};

function time(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 元の画面(フレーム)と、結合した全文。OCR 結果と見比べて直すためのもの */
export function SourcePreview({ frames, allFrames, mergedText }: Props) {
  const [tab, setTab] = useState<"frames" | "all" | "text">("frames");
  const [zoom, setZoom] = useState<SourceFrame | null>(null);
  const shown = tab === "all" ? allFrames : frames;

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <section aria-label="元の画面" className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["frames", "この問題"],
            ["all", "全フレーム"],
            ["text", "全文"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 flex-auto cursor-pointer whitespace-nowrap rounded-md px-2 pointer-fine:min-h-9",
              tab === key ? "bg-surface font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
            {key === "all" && <span className="ml-1 tabular-nums text-muted-foreground">{allFrames.length}</span>}
          </button>
        ))}
      </div>

      {tab === "text" ? (
        <pre className="max-h-[70dvh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-sans text-sm leading-relaxed">
          {mergedText || "(読み取れた文字がありません)"}
        </pre>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">この問題に対応する画面がありません</p>
      ) : (
        <ul className="flex flex-col gap-3 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setZoom(f)}
                className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted"
                aria-label={`${time(f.timestamp)} の画面を拡大`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL の確認用画像 */}
                <img src={f.image} alt="" className="w-full" />
              </button>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{time(f.timestamp)}</p>
            </li>
          ))}
        </ul>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${time(zoom.timestamp)} の画面`}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <Button
            variant="outline"
            size="icon"
            className="fixed right-4 top-4"
            aria-label="閉じる"
            autoFocus
            onClick={() => setZoom(null)}
          >
            <IconClose />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL の確認用画像 */}
          <img src={zoom.image} alt="" className="max-w-full rounded-lg sm:max-w-xl" />
        </div>
      )}
    </section>
  );
}
