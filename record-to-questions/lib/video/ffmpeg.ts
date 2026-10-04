import { spawn } from "node:child_process";

export class FfmpegError extends Error {
  constructor(message: string, readonly stderr: string) {
    super(message);
    this.name = "FfmpegError";
  }
}

type RunOptions = { signal?: AbortSignal };

/** コマンドを実行し、標準出力をバイト列で返す。失敗時は stderr の末尾を付けて投げる */
export function run(cmd: "ffmpeg" | "ffprobe", args: string[], { signal }: RunOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { signal, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    child.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        reject(new FfmpegError(`${cmd} が見つかりません。ffmpeg をインストールしてください`, ""));
      } else {
        reject(e);
      }
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out));
        return;
      }
      // 画面に出す文には、ffmpeg の生の出力(サーバーの一時パスを含む)を入れない。詳細は stderr に持たせてログへ
      reject(
        new FfmpegError("動画を読み取れませんでした。ファイルが壊れていないか確認してください", `${cmd} exit ${code}: ${err}`),
      );
    });
  });
}
