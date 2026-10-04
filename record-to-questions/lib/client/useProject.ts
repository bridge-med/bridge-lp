"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectRepository } from "@/lib/storage";
import type { Project } from "@/types/project";

export type SaveState = "saved" | "saving" | "error";

const SAVE_DELAY_MS = 600;

/** 問題集を読み込み、変更を少し待ってから自動で保存する */
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const pending = useRef<Project | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getProjectRepository()
      .get(id)
      .then((p) => {
        if (!alive) return;
        if (p) setProject(p);
        else setLoadError("この問題集は見つかりませんでした。別の端末・ブラウザで作ったものは開けません");
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    try {
      await getProjectRepository().save(p);
      if (!pending.current) setSaveState("saved");
    } catch (e) {
      console.error("保存に失敗しました", e);
      setSaveState("error");
    }
  }, []);

  // 画面を離れる前に、まだ保存していない変更を書き込む
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (fn: (p: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = { ...fn(prev), updatedAt: new Date().toISOString() };
        pending.current = next;
        return next;
      });
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  return { project, loadError, saveState, update };
}
