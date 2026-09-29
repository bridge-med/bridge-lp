# P2 光が主役: build spec for "SUN COURT" (日の庭)

Judge's decision, 2026-09-28 night. The spec covers the prototype clip only (10.8 to 12.8 s plus the hold to 15.0 s), matching the existing `clip-p1` / `p2-clip` comparison clips.

- **Winner:** A 日の庭 SUN COURT. The 4.2 m louver becomes a closed 12 m screen of shade in front of an open sunlit court. Only at V do the blades turn edge-on, so the court's sun and the painted mark arrive in the same instant.
- **Runner-up:** B 日の縁 SUN EDGE. This is Varini done with the sun's own shadow boundary; see §10.

Status: the geometry, light, paint and checks below are **already built and measured** in `pat-light/p2court/`. The engineer's job is mostly to render, encode and check, not to design.

All paths below are relative to `S=/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad` unless absolute.

---

## 0. Why this one (short)

**What the stranger feels.** The only bodily change a fixed sun and a moving camera can give is that the frame fills with sunlight because you arrived. The court stays hidden behind a wall of shade until about 11.3 s, then opens to 42 % of the upper frame in the last 1.5 s. At the same moment the mark completes in full sun.

Measured on real renders against the current P1 clip:

| | P1 clip | SUN COURT |
|---|---|---|
| Mark-box mean L*, 10.8 s | 69.0 | 54.6 |
| Mark-box mean L*, 12.8 s | 86.0 | 87.1 |
| Mark-box rise, 10.8 to 12.8 s | **+17** | **+32.5** |
| Sunlit court in the upper band | 4 % → 25 % | 3 % → 42 % |

The mark-box sunlit share (geometric) goes from 0.23 to 1.00.

**Honest.** There is no gimmick. The sun is fixed, nothing switches on, and there is no haze, glow or projector. The screen blades lie on V's rays, and that is the whole trick.

**On-brand.** The mark keeps the exact token colours at V: navy ΔE00 0.7 and sand 0.55 (960 px render). The end stays white-based: the court is at L* 97 and the parapet at 86–88.

**Buildable.** It uses the existing `build_p2.py` pipeline with boxes, booleans and two small shader additions. A 480×270 frame takes 13–17 s. A 640×360 clip frame takes about 20 s.

### Why not the others

- **日の線 / 日の砂** (the sand stroke as sunlight). Every prototype (`p2-architect/runs/j2A`, `j3T`) reads as a white chalk line or a light-sabre. The value inversion is fundamental: light has to be brighter than its ground, but --dawn is L* 61. This breaks the official two-colour mark (第24条; BIBLE §17-2 is still open), and 日の砂 also needs warm sunlight, which BIBLE §2 bans.
- **光で書く** (the whole mark in light, dim hall). This is already rendered (`/tmp/claude-0/blender/runs/p2-clip`). It reads as the stock "logo of light in a dark room" template. The end frame has a mean L* of about 39, against the white base of 第21条 and B-13's "no night scene".
- **ひらく RELEASE.** This is the same idea as SUN COURT with an eave instead of a full screen. It needs more new geometry, and the eave risks reading as a footbridge (橋の図像).
- **SUN EDGE.** This is the most literal "light itself resolves" idea. The pictures are still unproven, the effect can read as "the light got tidy", and it needs design iteration rather than rendering. It is the runner-up (§10).

### Honest limit (tell the owner)

The held end frame is still pale slats (fronts at L* 83) in front of a bright court (L* 97) with the mark on them. It is the P1 composition with real sun and shade. What is new is the **arrival**: the approach sits in real shade, and the court opens exactly at V. At phone size this is a stronger dose of P1, not a new image.

---

## 1. Ready-made files (`$S/pat-light/p2court/`)

| File | What it is |
|---|---|
| `make_scene.py` | Writes the modified scene (§2 items 2–4) from `/tmp/claude-0/blender/scene/scene.json`. The output `scene-base/scene.json` is already written, with symlinks to depth, masks, plates and lockups. |
| `build_court.py` | A copy of `p2-anamorph/build_p2.py` plus two changes: `paint_layers` (per-layer pigment) and `paint_spec` (specular on painted texels). |
| `arch.osl` | A copy of the paint shader with a new `Paint` output (navy/sand coverage, camera rays only). |
| `audit.py` | A geometric audit that casts rays and does not render (§7 A1). Run it after the build in the same Blender process. |
| `measure.py` | Photometric checks (§7 A2). It must run with Blender's python plus the system PIL (command in §8). |
| `solve.py` | The light decomposition: a sun+sky render and a sky-only render give per-unit sun and sky per surface class, which predict L* for any sun/sky strengths. |
| `aud-final.json` | Final geometry, audit times 8.6–12.8 s. |
| `court-clip.json` | Clip: 61 frames, 10.8→12.8 s at 1/30 s, 640×360, 24 spp, adaptive 0.05, motion blur 1.0 (180°). This is the same format as `runs/clip-p1`. |
| `court-hold.json` | 12.8 s hold, 640×360, 256 spp, no motion blur. |
| `court-final-480.json` | Five 480×270 key frames. |
| `court-s28-v960.json` | V frame at 960×540 for the colour checks. |

**Evidence already on disk:**

| File | Content |
|---|---|
| `runs/final/f-t{10.800,11.300,11.800,12.300,12.800}.png` | Final key frames. |
| `runs/final/fv960-t12.800.png` | V frame at 960 px. |
| `runs/final/s28v960-t12.800.png` | V frame at 960 px, sun 2.8. |
| `cmp-p1-vs-court.png` | P1 clip against SUN COURT at the same five times. |
| `cmp-r1-r4.png` | Narrow slit against wide skylight. |
| `aud/final/audit-t*.png` | Class maps. Yellow: sunlit blade front. Blue: sunlit court. Purple: blade side. Dark red: twin. Green: parapet. Dark tint: shade. |
| `aud/final/audit.json` | Audit numbers. |
| `aud/P1f/` | The same audit for P1-final, for comparison. |

---

## 2. Geometry changes relative to P1-final

The base scene is P1-final: `/tmp/claude-0/blender/scene/scene.json` (small mark, s 3.04), with the camera path and V unchanged. The big-mark scene is not used because its stroke ends land on the court's side walls, which are in shade under a hard sun.

**Coordinates.** Hall frame FC as in passage.js: x to the right, y up, z toward the camera, origin at world (−14.092, −28.827), unrotated.

**Landmarks:**

| Landmark | Position |
|---|---|
| V | FC (−0.847, 1.4, −12.219) |
| Terrace floor | y 0 |
| Lower level | y −1.2 (from FC z −17.32) |
| Parapet | front face z −17.02 (4.80 m ahead of V), 0.3 m thick, top 1.1 |
| Louver fronts | z −18.22 (6.00 m), blades 2.4 m deep |
| Back wall | z −42.0 (29.78 m) |
| Hall walls | x ±10.8 (inner faces ±9.6) |
| Ceiling | 12.0 to 12.45 |

Mesh indices refer to the base scene.

| # | Element | Change | Why |
|---|---|---|---|
| 1 | Louver blades 67–91 | Raise the tops from 4.2 to **12.0** (cfg `extend`). | A closed full-height screen, which reaches the terrace ceiling. |
| 2 | Blade fronts | **Square them.** Move each front corner along its own V-ray onto z = the nearer corner's z (at most about 4 cm). All fronts then face +z. | The fronts get the same direct sun as the back wall (n·s = 0.579). The silhouette from V is unchanged, and the paint depth test still passes because surfaces only move toward V. |
| 3 | Twin screen, 25 new meshes (99–123) | For each blade, add a wedge inside the V-cone of its front: r 12.0–14.4 m from V, angular half-width × 0.97, y −1.2 to 12.0 (algorithm §4.1). | It closes the gaps for every viewpoint except V. The court share of the upper band stays ≤ 5 % until 11.3 s, and twins take 0 px at 12.8 s. |
| 4 | Sand crossing plate 98 | Move it radially about V's eye from 4.215 m to **4.95 m** (scale 1.1744). Its new y is 1.447–1.775. | It can now sit in sun, and its shadow clears the parapet (§4.3). |
| 5 | Drop meshes 61, 62, 66 | Remove the court columns and the court beam. | The court is open. The twins would otherwise shade the columns in frame. |
| 6 | Drop mesh 65 | Remove the terrace beam at FC z −12.6, directly above V. | Its shadow on the radially arranged fronts is the **arch-shaped dark band** at the top of P1-final's end frame (confirmed by audit: occluder `auto65`). |
| 7 | Terrace slit | Cutter FC x −9.6..9.6, y 11.9..12.6, **z −6.0..−12.0**. It replaces P1's −9.82..−17.02. | Front edge −12.0: sun on the fronts stops at y 3.55 m, just above V's frame top on the fronts (3.31 m), so the upper fronts are shade during the approach. Rear edge −6.0: the parapet face, the parapet top, the plate and all floor visible from V (≥ 3.45 m) are in sun, with no penumbra in frame (§4.2). |
| 8 | Court roof | Cutter FC x −10.8..10.8, y 11.9..12.6, z −21.3..−42.0. | The court is open to the sky. The terrace ceiling stays from −21.3 toward V. |
| 9 | Court walls to 24 m | Add boxes: back upper x −10.8..10.8, y 12..24, z −43.2..−42.0; right upper x 9.6..10.8, y 12..24, z −42..−21.3. | No sky pixel from any camera position (audit: 0 at 8.6–12.8 s). |
| 10 | Sun-side (left) wall | Notch mesh 46 above **6.0 m** for z −21.3..−41.99: cutter x −10.9..−9.5, y 6.0..12.5, `kinds: ["plain"]`. Add a set-back wall x −17.2..−16.0, y −1.2..24, z −42..−21.3, and a back closure x −17.2..−10.8, y −1.2..24, z −43.2..−42.0. | At 12 m, wall 46's shadow wedge covered the navy arc's left end (61 of 768 samples in shade). At 6 m the wedge stays left of it, with all samples in sun. The set-back wall stops sky over the lowered wall. |
| — | Unchanged | The rooms' FI/FT cutters, all plates, **col63** (V's right column, which gives a natural wipe at 10.9–11.7 s and puts a shadow at the right edge of the end frame), the camera path, `depth.pfm`, `maskN.png` and `maskS.png`. | |

To regenerate the scene:

```
python3 $S/pat-light/p2court/make_scene.py --src /tmp/claude-0/blender/scene/scene.json --plate-d 4.95 --out $S/pat-light/p2court/scene-base/scene.json
```

It is already done.

---

## 3. Light, material and paint

### Sun and sky

**Sun.** Direction toward the sun in three.js axes: (−0.2106, 0.788, 0.5785). This is 20° left of straight behind V at 52° elevation (BIBLE §2). Angle 0.53°, colour (1, 1, 1).

**Strength 2.8.** Calibrated as follows:
- At 2.9, the court back wall median is L* 97.3 and 1.7 % of the frame is > 253.
- At 2.8, the court median is L* 96.5 (#F7F5EF) and clipping drops to 0.8 %, all in the top 90 px of the court wall.
- If the check needs 0 %, step down 0.1 at a time (about 2.6–2.7 expected), then re-derive the pigments.

**Sky.** Constant white **1.0** for the whole clip. There is no `sky_ramp` inside the clip.
- P1 uses sky 3.0–4.0. At that level the open court can only be lit by sky (the solved sun comes out as about 0), so the hard ratio is essential.
- For a full 15 s film, the sky must drop from 3.0 to 1.0 **inside threshold 2 (7.6–8.2 s)**. This deviates from BIBLE §12.3 ("one sky"); P1+ already ramps 3.0→4.0. Disclose it.

**Colour management.** View Standard, Look None, exposure 0, dither 0, PNG 8-bit. Cycles CPU with OIDN, and `plate_denoise_exclude: true` so the 写し stay untouched (Emission 1.0, camera-visible only).

### Materials

Materials follow BIBLE §5 (`style: bible`): plaster #EAE9E6 at roughness 0.9 and specular 0.25, with bump; floor #C5C1BA. There is no fog, bloom, glare, DOF, grain or vignette.

### Painted and lit

- **Painted.** Navy and sand are Varini paint exactly as in P1-final, using the same masks and depth. Layers: blade fronts at 6 m, back wall at 29.78 m, and the plate at 4.95 m.
- **Lit.** The payoff is carried by the light: the shade screen and the sunlit court.
- **New colours.** None. Shade chroma measures b* 2–4.

### Per-layer pigment (BIBLE §7 fallback)

The court sees the open sky, while the fronts sit under the terrace roof, so E differs by layer. The computation:

- E_layer = (linear luminance of the unpainted plaster of that layer at V) / 0.8148, where 0.8148 is #EAE9E6.
- pigment_lin = token_lin / E_layer, per channel. Tokens: navy #16233E, sand #A98F63.

Current values (in `court-*.json`):

| Layer | cfg key | Navy | Sand |
|---|---|---|---|
| Back wall and everything else | `albedo.navy` / `albedo.dawn` | #142039 | #9D855C |
| Blade fronts 67–91 | `paint_layers.front` | #1B2A49 | #C3A573 |
| Plate | `albedo.sandplate` | — | #C6A875 |

Re-derive these only if the sun changes by more than 0.2.

### Specular on paint

`paint_spec: 0.0` sets the specular to 0 on painted texels, through `arch.osl`'s `Paint` output and a Map Range node into Specular IOR Level.
- Without it, the plaster's 0.25 specular lifts navy by about 5 L*: ΔE00 4.4 here, and **4.9 in P1-final's own end frame** (a P1 defect worth porting).
- With it, navy measures ΔE00 0.7 (p90 1.6).

### Measured surface values

Values are L* at sun 2.9 and sky 1.0; values at 2.8 are about 1 L* lower on lit surfaces.

| Surface | 10.8 s | 12.8 s (V) |
|---|---|---|
| Court back wall, sun | 98 | 97.3 |
| Blade fronts, sun (the band 0.6–3.55 m) | 83.4 | 83.5 |
| Parapet, sun (lockup boxes) | 87 | 86.3 ± 0.9 / 87.6 ± 0.7 |
| Court right wall (grazing sun) | — | 86 |
| Court left wall, shade | 76 | 72 |
| Upper fronts, shade | 50 | 50 |
| Blade sides, shade (median, p10) | 26, 18 | — (edge-on) |
| Twins, shade | 32 | — (hidden) |
| Mark-box mean | **54.6** | **87.1** |
| Upper band (y < 0.52H) mean | 55.8 | 83.2 |

### Alternatives measured (use only if the owner asks)

- **Wide terrace skylight** (slit z −2..−12, sun 3.0). The parapet reaches 91, which gives --ink-3 4.7:1, and the fronts reach 88. But the approach brightens and the rise falls to **+20** L*.
- **Softer shade** (sky 1.5, sun 2.3; predicted by `solve.py`). Blade sides about 26–32, fronts 76, court 98.

---

## 4. Algorithms (the anamorphic and sun-projected shapes)

Notation: V eye E = (−14.9394, 1.4, −41.0458) in world coordinates. Sun vector s = (−0.2106, 0.788, 0.5785). k = s_z / s_y = 0.7341: moving along a sun ray, z changes by k per metre of height. The image at 1920 has FOC = 960 / tan(32.75°) = 1490.3 px and principal-point y PPY = 475.2. Frame top elevation at V is 17.66°, frame bottom 22.1°.

### 4.1 Twin wedge (per blade)

This is `make_scene.py`.

1. Take the blade's plan vertices and pick the two nearest E: the front corners F1 and F2.
2. For each, compute a_k = atan2(F_k.x − E.x, −(F_k.z − E.z)), the angle right of −z.
3. Set a_m = (a1 + a2) / 2 and h = 0.97 · |a2 − a1| / 2.
4. Corners: for r ∈ {12.0, 14.4} and a ∈ {a_m − h, a_m + h}, the point is (E.x + r·sin a, E.z − r·cos a). Extrude from y −1.2 to 12.0.
5. Result: the side faces are V-rays inside the front's cone, so the wedge is invisible from V at every height. The V-ray over the 12 m blade top reaches 22.6 m at r = 12. Off V, the wedge fills the gap behind its blade.

The squaring step is in the same script. For each blade:
1. z* = the larger (nearer-V) z of the two front corners.
2. Move the other corner along its V-ray: F ← E + t(F − E), with t = (z* − E.z) / (F.z − E.z).

### 4.2 Terrace slit edges (sun projection of V's frame edges)

**Front edge.** On the front plane (6.0 m ahead of V) the frame top at V is y_top = 1.4 + 6.0·tan 17.66° = 3.31 m. Add a 0.1 m penumbra (0.0093 × D, with D ≈ 10.5 m) and a 0.14 m margin, giving y_s = 3.55. The sun ray from the front plane at y_s crosses the ceiling underside at z = −18.22 + (12 − 3.55)·k = **−12.0**.

**Rear edge.** The nearest floor seen at V is 1.4 / tan 22.1° = 3.45 m ahead, at FC z −15.67. Its sun ray crosses y 12 at −15.67 + 12k = −6.86. Place the edge at **−6.0**, which keeps a margin of 0.86 m, more than the 0.13 m penumbra.

**Check.** With −8.0 the parapet foot showed a soft penumbra band at 840–900 px @1920. That band disappears at −6.0.

### 4.3 Plate relocation (clear its own shadow)

1. Move every plate vertex P ← E + (4.95 / 4.215)(P − E). It stays on V's rays, so it is identical from V.
2. Shadow clearance: from the plate's lower edge (d 4.95, y 1.447), the shadow reaches the parapet top plane y = 1.1 at d = 4.95 + (1.447 − 1.1)·k = 5.205. That is beyond the parapet's back edge (5.10), so it falls behind the parapet.
3. It then lands on the fronts at y = 1.447 − 1.05 / k = 0.02, which is below the parapet sightline at 6 m (1.025) and hidden.
4. The plate sees the sun through the slit: y_c ≈ 1.6 crosses the ceiling at FC z ≈ −17.17 + 10.4k = −9.5, inside −6..−12.

### 4.4 Stroke-in-sun check

This is the sun analogue of the Varini ray and is implemented in `audit.py` (STROKES):

1. For each polyline N, S1, S2 in `scene.json → mark`, take 4 samples per segment and 3 offsets across the stroke (±0.8·hw). The pixel is p = (cx + s(u − 120), cy + s(v − 50)) @1920.
2. Cast the ray from V's eye through p to the first hit P. Skip hidden cutters and 写し.
3. If n·s ≤ 0, mark the sample shade.
4. Otherwise cast from P + 2 mm·n toward s. Any hit means shade; record the occluder. Plates are skipped because their shadow visibility is off.
5. Pass = 100 % of samples in sun. Current result: N 768/768, S1 384/384, S2 384/384.

### 4.5 General sun-stencil slot

This is not used by the winner. It is for the runner-up, or for 日の砂 if the owner approves light-rendered sand.

1. Repeat §4.4 steps 1–2 at half-pixel spacing.
2. March P + t·s to each stencil plane crossed (brow or roof) and record the crossing points. The first stencil gets the exact point, which defines the edge; later ones get a 6 cm margin.
3. Rasterise the points into a 1 cm mask per stencil and dilate by 1 px.
4. Cut the holes as shafts parallel to s: a Transparent BSDF driven by the mask, looked up along s through the slab thickness.
5. Penumbra = 0.0093 × (stencil-to-surface distance). For ≤ 3 px @1920 at distance L, keep D / L ≤ 0.19.

---

## 5. What the frames should look like

Numbers are measured on `runs/final` (sun 2.9); the audit is `aud/final`. At sun 2.8, lit surfaces are about 1 L* lower. See `cmp-p1-vs-court.png`.

**10.8 s.** col63 fills the centre-right.
- To its left: the 12 m screen seen obliquely, with dark blade sides (L* 18–39) and dark twins in the gaps (32).
- The upper fronts are in shade (50). A horizontal sunlit band on the fronts sits just above the parapet (83).
- The parapet is a bright sunlit strip (87). The terrace floor is in shade with sun patches near the parapet.
- The court shows ≤ 3 % of the upper band, as hairline slits. Paint fragments are scattered small at the left.
- Mark-box mean 54.6; mark-box sunlit share 0.23.

**11.8 s.** col63 is leaving to the right (a wipe).
- The screen's shaded sides are narrowing, and sunlit court slivers appear (12 % of the upper band).
- Navy and sand fragments slide on the sunlit front band and on court slivers.
- The lockup parapet is nearly all in sun (the tagline box is 89 % sun).
- Mark-box 70.2; sunlit share 0.65.

**12.3 s.** The gaps open to a white court (28 %). Blade sides are almost gone (0.3 %) and twins are at 7 %.
- The fragments are one step from closing.
- The parapet is uniform (86–88), with col63's shadow at its right end.
- Mark-box 83.1; sunlit share 0.92.

**12.8 s (V).** The court makes up 42 % of the upper band at L* 96.5–97.3. The fronts are pale slats (83). The mark is complete and every stroke sample is in sun.
- Colour at 960 px: navy ΔE00 0.7, sand 0.55–1.0.
- Framing: left quarter is the court's side wall in shade (72); right edge is col63's shadow band on the fronts and parapet (about 15 % of the width).
- There is no arch band at the top and no sky pixel.
- The parapet lockup area is uniform: 85.3–86.6 at sun 2.8.
- The terrace floor strip at the bottom is sunlit.

**14.0 s.** The same pixels as the 12.8 s hold: one frame at 256 spp, with nothing moving and no noise crawl.
- BRIDGE appears at 13.1 s and EXPAND CHOICES. at 13.5 s. Both are 2D overlays in --ink #1B1B1E and --ink-3 #63646B, using `lockup0.png` / `lockup1.png` via `lib/clip.py` / `lib/endcard.py`.
- Contrast on L* 86: --ink about 12:1; --ink-3 about 4.1:1. That passes AA for large text (3:1). Reaching 4.5:1 needs parapet L* ≥ 88.7 (the wide-skylight alternative).

---

## 6. Build and run plan (about 2 h, one engineer)

Wrap every Blender and ffmpeg call in `flock /tmp/claude-0/render.lock`.

Setup:

```
cd /tmp/claude-0/blender
H=$S/pat-light/p2court
BL=./blender-4.2.9-linux-x64/blender
PY="env PYTHONPATH=/usr/local/lib/python3.11/dist-packages ./blender-4.2.9-linux-x64/4.2/python/bin/python3.11"
```

| Time | Step |
|---|---|
| 0:00–0:05 | **Audit (A1).** `flock /tmp/claude-0/render.lock $BL -b -P $H/build_court.py -P $H/audit.py -- $H/aud-final.json > $H/aud/final.log 2>&1`, then `grep STROKES $H/aud/final.log`. Takes about 3 min. |
| 0:05–0:10 | **Colour check at sun 2.8.** `$H/runs/final/s28v960-t12.800.png` already exists. Measure it: `$PY $H/measure.py $H/runs/final/s28v960-t12.800.png $H/aud/final/audit-t12.800.png $H/scene-base/scene.json`. |
| 0:10–0:40 | **Clip.** `flock … $BL -b -P $H/build_court.py -- $H/court-clip.json > $H/runs/clip/log.txt 2>&1`. 61 frames at about 20–25 s each. |
| 0:40–0:45 | **Hold.** `flock … $BL -b -P $H/build_court.py -- $H/court-hold.json`. |
| 0:45–0:50 | **Swap in the hold**, as done for clip-p1: `cd $H/runs/clip && mv t12.800.png mb-t12.800.png.bak && cp hold-t12.800.png t12.800.png` |
| 0:50–0:55 | **Encode:** `flock /tmp/claude-0/render.lock python3 /tmp/claude-0/blender/lib/clip.py $H/runs/clip $H/scene-base $H/runs/clip/p2court-clip.mp4 10.8 15.0 30`. Stills: `python3 /tmp/claude-0/blender/lib/endcard.py $H/runs/clip/hold-t12.800.png $H/scene-base $H/runs/clip/t14.000.png` |
| 0:55–1:25 | **Recommended lead-in, 9.5→10.767 s** (38 frames). It shows the wall of shade, which is the payoff's setup. Copy `court-clip.json` with `times = [9.5 + i/30 for i in range(38)]`, then re-encode from 9.5. |
| 1:25–1:45 | **Checks** A2–A4 (§7) and a contact sheet against `runs/clip-p1` at 10.8 / 11.8 / 12.3 / 12.8 / 14.0. |
| 1:45–2:00 | Buffer. Write the numbers into the morning report. |

Do not change the sun strength without re-deriving the pigments (§3). Do not change the camera, V or the masks.

---

## 7. Acceptance checks

### A1: geometry (`audit.py` at 8.6, 9.5, 10.0, 10.4, 10.8, 11.3, 11.8, 12.3, 12.6, 12.8 s)

| Check | Pass | Current |
|---|---|---|
| Sky pixels | 0 at every time | 0 |
| Twin pixels at 12.8 s | 0 | 0 |
| Stroke samples in sun at 12.8 s (§4.4) | 100 % | 100 % |
| Lockup boxes at 12.3 and 12.8 s | 100 % `parapet\|sun` | 100 % |
| Mark-box sunlit share | ≤ 0.35 at 10.8 s; 1.00 at 12.6–12.8 s | 0.23; 1.00 |
| Sunlit court share of the upper band | ≤ 0.05 through 11.3 s; ≥ 0.40 at 12.8 s | 0.01–0.05; 0.42 |

### A2: photometry (`measure.py` on the hold at ≥ 640 px wide; use 960 for the stroke-colour checks)

| Check | Pass | Current (sun 2.8, 960 px) |
|---|---|---|
| Stroke colour, navy and sand | median ΔE00 ≤ 2, p90 ≤ 3 | navy 0.8 / 1.7; sand 1.0 / 2.0 |
| Court back wall, unpainted | median L* 96–98.5 | 96.5 |
| Architecture pixels > 253 | 0 inside the mark bbox; ≤ 0.5 % of the frame (target 0) | 0.8 %, top of court → lower the sun 0.1 at a time |
| Lockup boxes | mean L* ≥ 85, range ≤ ±1.5 | 85.3 / 86.6 |
| Mark-box mean L* rise, 10.8 → 12.8 s | ≥ +28 | +32.5 |
| No arch band | unpainted sunlit-front pixels in the top 12 % of the V frame within ±3 L* of fronts at mid-height | Beam 65 is gone and the audit shows no front shade at the top |

### A3: temporal

Report the largest frame-to-frame change of the mark-box mean at 30 fps. It should be ≤ 1.5 L*. The ramp is monotonic over about 1.5 s; it is not a flash under WCAG 2.3.1.

### A4: rules

- No visible light source or sky.
- The compositor holds only denoise and the ID mask: no glow, fog, bloom, grain, vignette or DOF.
- 写し untouched: Emission 1.0, excluded from denoise.
- No text other than BRIDGE / EXPAND CHOICES., and no "!".
- No people. No cross- or arch-shaped light: the openings are rectangles in 0.6-multiples where practical.

---

## 8. Known deviations and risks (put these in the morning report)

1. **Blade sides L* 18–39 and twins 32–36 during the approach** are below BIBLE §4's architecture floor of 55. This is what makes the shade read as shade. The owner decides. The softer option is in §3 (sky 1.5 / sun 2.3).
2. **End frame ≈ P1 composition.** The novelty is the arrival (shade → sun), not the held image.
3. **Sky 1.0 in the hall versus 3.0 in the rooms.** Tonight's clip is not affected. A full film needs a sky change hidden in threshold 2.
4. **Per-layer pigment and specular 0 on paint.** Both are BIBLE-sanctioned fallbacks, and both should also be applied to P1 (its navy is off by ΔE00 4.9).
5. **--ink-3 is at about 4.1:1** (large-text pass). Full 4.5:1 needs the wide skylight, at the cost of about 12 L* of release.
6. **The hold is 640 or 960 px at 256 spp, not 1920 at 1024 spp.** At 960, 64 spp measured 108 s; 1920 at 1024 spp would take about 2 h.
7. **The Clinic Town 3D plate** is visible before about 10.4 s against terrace shade (L* about 40–57) and would read as a glowing display. It is out of frame in the 10.8 s clip. If the 9.5 s lead-in shows it, check BIBLE §6's +3 L* rule and cut a skylight over its bay (FC x −9.6..−5.4, z −12.4..−17.4).
8. **The left-wall notch also trims the far-left twin** above 6 m (blade 68's twin). It is off-V and at the frame edge only.
9. **Phone-size read.** At 480 px the release is legible as a luminance change (+32 L*). Whether it reads as "すげー" rather than "nicer P1" is the owner's call.

---

## 9. Numbers behind the light choice (`solve.py`, linear luminance per unit strength)

Measured at 12.8 s with the narrow slit:

| Surface | Per unit sun | Per unit sky |
|---|---|---|
| Court back wall | 0.214 | 0.315 |
| Blade fronts | 0.170 | 0.082 |
| Parapet | 0.162 | 0.077 |

The court's sky term is about 4× that of the terrace. With the court open, a P1-level sky (3.0) leaves no room for sun. That is why the ratio is hard and the terrace sits under a slit.

To predict any (sun, sky) pair: L* = f(S·a + K·b).

---

## 10. Runner-up: SUN EDGE (日の縁), and how it could be layered on later

**Why second.** It keeps the tokens and is honest physics, and the light itself forms something at V: a sun/shade boundary whose plane contains V is seen from V as one straight line. Before V it is a staircase (computed 391 → 0 px).

**Why not tonight.** It is unproven in pictures (`p2-anamorph/runs/edge1–5`), the unaligned overhang shadows still have to be removed, and it needs design iteration, not rendering.

**Natural follow-up on this build.** Make the court's sun-side edges (the set-back wall top at 24 m and the notch top at 6 m) lie in one plane through V that contains s. Solve the heading with `p2-anamorph/edge.py` and predict the staircase with `stair.py`. The court's shade boundary would then close to a straight edge at V, in step with the mark. Keep that edge ≥ 100 px from the strokes.

**Third, conditional.** 日の砂 becomes the pick only if the owner rules (BIBLE §17-2) that a light-rendered sand line is the official mark.
