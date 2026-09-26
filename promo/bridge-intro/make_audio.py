"""音楽を計算で作る。拍は timeline.js と同じ番号を使うので、映像とずれない。

静かだが、強い(憲法第17条)。クラブ音楽のうねりではなく、やわらかい和音と、言葉が出るたびの小さな音。
"""
import json
import os
import re
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000

src = open(os.path.join(HERE, "timeline.js"), encoding="utf-8").read()
src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
TL = json.loads(src[src.index("{"): src.rindex("}") + 1])
BEAT = 60 / TL["bpm"]
DUR = TL["beats"] * BEAT
N = int(DUR * SR)
t_all = np.arange(N) / SR

NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(note):
    m = re.match(r"([A-G]#?)(-?\d)", note)
    midi = NAMES[m.group(1)] + (int(m.group(2)) + 1) * 12
    return 440.0 * 2 ** ((midi - 69) / 12)


def at(beat):
    return int(beat * BEAT * SR)


def onepole_lp(x, cutoff):
    """1次のローパス。cutoff は定数か、サンプルごとの配列。"""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def saw(f, n, phase=0.0):
    ph = (phase + f * np.arange(n) / SR) % 1.0
    return 2 * ph - 1


rng = np.random.default_rng(11)
L = np.zeros(N)
R = np.zeros(N)
pad_bus = np.zeros((2, N))

# ---- 和音(ノコギリ波を少しずつ音程をずらして重ね、丸く削る) ----
chords = TL["chords"]
for ci, ch in enumerate(chords):
    s0 = at(ch["beat"])
    s1 = at(chords[ci + 1]["beat"]) if ci + 1 < len(chords) else N
    rel = int(0.9 * SR)
    atk = int(0.5 * SR)
    n = min(N, s1 + rel) - s0
    env = np.ones(n)
    env[:atk] = np.linspace(0, 1, atk) ** 1.5
    tail = n - (s1 - s0)
    if tail > 0:
        env[-tail:] *= np.linspace(1, 0, tail) ** 2
    last = ci == len(chords) - 1
    for note in ch["notes"]:
        f = hz(note)
        for side, cents in ((0, -6), (1, 6), (0, 11), (1, -11)):
            v = saw(f * 2 ** (cents / 1200), n, rng.random())
            pad_bus[side, s0:s0 + n] += v * env * (0.050 if last else 0.040)

# 明るさ:言葉を置き換える場面から少しずつ開き、考え方の場面でいちばん開く
beats_all = t_all / BEAT
SEC = TL["sections"]
cut = np.interp(beats_all,
                [0, SEC["compass"] - 1, SEC["montage"], SEC["idea"], SEC["breath"], SEC["end"], TL["beats"]],
                [700, 900, 1500, 2600, 2600, 1400, 1800])
pad_bus[0] = onepole_lp(pad_bus[0], cut)
pad_bus[1] = onepole_lp(pad_bus[1], cut)

# ---- 低音(和音の根音。キックと一緒に入る) ----
bass = np.zeros(N)
for ci, ch in enumerate(chords):
    s0 = at(ch["beat"])
    s1 = at(chords[ci + 1]["beat"]) if ci + 1 < len(chords) else N
    f = hz(ch["notes"][0]) / 2
    n = s1 - s0
    e = np.minimum(1, np.arange(n) / (0.05 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.08 * SR))
    bass[s0:s1] += np.sin(2 * np.pi * f * np.arange(n) / SR) * e
bass_gate = np.interp(beats_all,
                      [0, SEC["compass"] - 0.4, SEC["compass"], SEC["breath"] - 0.35, SEC["breath"],
                       SEC["end"], SEC["end"] + 1, TL["beats"]],
                      [0, 0, 1, 1, 0, 0, 0.6, 0.4])
bass *= 0.16 * bass_gate

# ---- キック(低い音が一瞬で下がっていく波) ----
kick = np.zeros(N)
kick_hits = []
for seg in TL["kick"]:
    b = seg["from"]
    while b < seg["to"] - 1e-6:
        kick_hits.append(b)
        b += seg["every"]
kn = int(0.45 * SR)
kt = np.arange(kn) / SR
kf = 42 + 68 * np.exp(-kt / 0.035)
kwave = np.sin(2 * np.pi * np.cumsum(kf) / SR) * np.exp(-kt / 0.16)
kwave[:48] *= np.linspace(0, 1, 48)
for b in kick_hits:
    s = at(b)
    n = min(kn, N - s)
    kick[s:s + n] += kwave[:n] * 0.42

# キックが鳴るたびに、和音と低音をほんの少しだけ引く(控えめなうねり)
duck = np.ones(N)
dn = int(0.28 * SR)
dcurve = 1 - 0.28 * np.exp(-np.arange(dn) / SR / 0.09)
for b in kick_hits:
    s = at(b)
    n = min(dn, N - s)
    duck[s:s + n] = np.minimum(duck[s:s + n], dcurve[:n])

# ---- ハット(ザーッという雑音を削った短い音) ----
hat = np.zeros(N)
hn = int(0.06 * SR)
h = TL["hat"]
b = h["from"] + h["offset"]
while b < h["to"]:
    s = at(b)
    nz = np.diff(rng.standard_normal(hn + 1))
    hat[s:s + hn] += nz * np.exp(-np.arange(hn) / SR / 0.018) * 0.03
    b += h["every"]

# ---- 立ち上がり(藍の場へ入る前の、ふくらむ雑音) ----
sw = TL["swell"]
s0, s1 = at(sw["from"]), at(sw["to"])
n = s1 - s0
noise = rng.standard_normal(n)
sweep = onepole_lp(noise, np.linspace(300, 5000, n))
swell = np.zeros(N)
swell[s0:s1] = sweep * np.linspace(0, 1, n) ** 2.2 * 0.12

# ---- 言葉が出るたびの音(やわらかい鍵盤) ----
pl = np.zeros((2, N))
for i, c in enumerate(TL["plucks"]):
    f = hz(c["note"])
    s = at(c["beat"])
    n = min(int(2.2 * SR), N - s)
    tt = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.25)
            + 0.12 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt / 0.12))
    env = np.exp(-tt / 0.55) * np.minimum(1, tt / 0.004)
    pan = 0.5 + 0.28 * np.sin(i * 2.1)
    amp = 0.13 if c["beat"] < SEC["end"] else 0.15
    pl[0, s:s + n] += tone * env * amp * (1 - pan) * 2
    pl[1, s:s + n] += tone * env * amp * pan * 2

# ---- 残響(減衰する雑音を畳み込む) ----
def reverb(x, seconds=2.4, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR / (seconds / 5))
    ir = onepole_lp(ir, 4000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return y

wetL = reverb(pl[0] + 0.4 * pad_bus[0], seed=3)
wetR = reverb(pl[1] + 0.4 * pad_bus[1], seed=4)

L = (pad_bus[0] + bass) * duck + kick + hat + swell + pl[0] + 0.32 * wetL
R = (pad_bus[1] + bass) * duck + kick + hat + swell + pl[1] + 0.32 * wetR

# ---- 決めの直前の無音(爆発ではなく、ひと呼吸) ----
si = TL["silence"]
g0, g1 = at(si["from"]), at(si["to"])
gate = np.ones(N)
fade = int(0.012 * SR)
gate[g0 - fade:g0] = np.linspace(1, 0, fade)
gate[g0:g1] = 0
gate[g1:g1 + fade] = np.linspace(0, 1, fade)

# 頭と終わりのフェード
master = np.minimum(1, t_all / 0.03) * np.minimum(1, (DUR - t_all) / 1.4)
L *= gate * master
R *= gate * master
music_peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / music_peak, R / music_peak


# ---- 声(make_voice.py が作った WAV を、台本の拍に置く。無ければ音楽だけ) ----
def load_voice(path):
    with wave.open(path) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch).mean(axis=1) / 32768
    if sr != SR:  # 24kHz → 48kHz(周波数領域で引き伸ばす)
        n = int(round(len(x) * SR / sr))
        spec = np.fft.rfft(x)
        x = np.fft.irfft(spec, n) * (n / len(x))
    return x / (np.abs(x).max() + 1e-9)


voice = np.zeros(N)
manifest_path = os.path.join(HERE, "voice", "manifest.json")
if os.path.exists(manifest_path):
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    for line in TL["voice"]["lines"]:
        m = manifest.get(line["id"])
        if not m:
            continue
        v = load_voice(os.path.join(HERE, "voice", m["file"]))
        s = at(line["beat"])
        n = min(len(v), N - s)
        voice[s:s + n] += v[:n]

# 声が鳴っているあいだは音楽を下げる(立ち上がり 15ms・戻り 350ms で追う)
env = np.abs(voice)
follow = np.empty(N)
acc = 0.0
up, down = 1 - np.exp(-1 / (0.015 * SR)), 1 - np.exp(-1 / (0.35 * SR))
for i in range(N):
    acc += (up if env[i] > acc else down) * (env[i] - acc)
    follow[i] = acc
music_gain = 1 - 0.5 * np.clip(follow / 0.12, 0, 1)

L = 0.55 * L * music_gain + 0.9 * voice
R = 0.55 * R * music_gain + 0.9 * voice

peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.89, R / peak * 0.89

pcm = (np.stack([L, R], axis=1) * 32767).astype(np.int16)
with wave.open(os.path.join(HERE, "audio.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"audio.wav {DUR:.2f}s peak-normalized")
