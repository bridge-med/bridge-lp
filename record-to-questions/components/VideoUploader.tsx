"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "./ui/button";
import { IconUpload } from "./ui/icons";
import { UPLOAD } from "@/lib/config";
import { cn } from "@/lib/utils";

type Props = { onStart: (file: File) => void };

function validate(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!(UPLOAD.acceptedExtensions as readonly string[]).includes(ext)) return "MP4 または MOV の動画を選んでください";
  if (file.size > UPLOAD.maxBytes) return "1GB までの動画を選んでください";
  return null;
}

export function VideoUploader({ onStart }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validate(f);
    setError(problem);
    setFile(problem ? null : f);
    if (problem) setPreview(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full">
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 transition-colors",
            dragging && "border-primary bg-accent",
          )}
        >
          <Button variant="primary" onClick={() => input.current?.click()} className="px-6">
            <IconUpload />
            動画を選択
          </Button>
          <p className="text-sm text-muted-foreground">MP4 / MOV</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
          {preview && (
            <video src={preview} controls playsInline className="mx-auto max-h-[50dvh] rounded-lg bg-muted" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm" title={file.name}>
              {file.name}
              <span className="ml-2 text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
              選び直す
            </Button>
            <Button variant="primary" onClick={() => onStart(file)}>
              解析する
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
