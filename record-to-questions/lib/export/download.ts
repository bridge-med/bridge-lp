/** ブラウザでファイルとして保存させる */
export function downloadBlob(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ファイル名に使えない文字を除く */
export function safeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|\n\r]+/g, "_").trim().slice(0, 80) || "questions";
}
