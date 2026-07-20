# アンビエントBGM生成 — 依存なし(標準ライブラリのみ)で30秒のコードパッドを合成する
# 使い方: python3 make-bgm.py <出力wav> [長さ秒]
import math
import struct
import sys
import wave

OUT = sys.argv[1] if len(sys.argv) > 1 else 'bgm.wav'
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 30.0
SR = 44100

# Am7 - Fmaj7 - Cmaj7 - G
chords = [
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 329.63],
    [130.81, 196.0, 261.63, 329.63],
    [196.0, 246.94, 293.66, 392.0],
]
seg = DUR / len(chords)
frames = []
for i in range(int(SR * DUR)):
    t = i / SR
    ci = min(int(t // seg), len(chords) - 1)
    ct = t - ci * seg
    env = max(min(ct / 0.8, 1.0, (seg - ct) / 0.8), 0.0)  # コード間クロスフェード
    s = 0.0
    for j, f in enumerate(chords[ci]):
        vib = 1.0 + 0.0015 * math.sin(2 * math.pi * 0.7 * t + j)
        s += 0.22 * math.sin(2 * math.pi * f * vib * t + j * 1.3)
        s += 0.05 * math.sin(2 * math.pi * f * 2 * t + j)
    master = min(t / 2.0, 1.0, (DUR - t) / 3.0)  # 全体フェードイン/アウト
    s *= env * master * (0.85 + 0.15 * math.sin(2 * math.pi * 0.11 * t))
    frames.append(int(max(-1, min(1, s * 0.5)) * 32767))

with wave.open(OUT, 'w') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(struct.pack('<%dh' % len(frames), *frames))
print(OUT, 'ok')
