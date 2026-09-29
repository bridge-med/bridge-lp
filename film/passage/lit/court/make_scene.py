# P2 SUN COURT: write a modified PASSAGE scene.json (scene-big base) for build_p2.py.
#   python3 make_scene.py [--no-square] [--no-twins] [--plate-d 4.95] [--twin-r0 12.0 --twin-r1 14.4 --twin-shrink 0.97]
# Geometry ops (three.js world coords, x right, y up, z toward camera; V looks along -z):
#   1. square: move each louver blade's two front corners along their own V-ray onto one plane z = zfront
#      (the corner nearest V), so every front faces +z like the court wall. Silhouette from V unchanged.
#   2. twins: for each blade, a wedge prism exactly inside the V-cone of its front, at r0..r1 from V,
#      angular span shrunk by twin-shrink, y -1.2..12. Hidden at V; closes the gaps for every other viewpoint.
#   3. plate: move the sand crossing plate radially from V to distance plate-d (default: leave).
# The blade tops are raised 4.2 -> 12.0 by build_p2.py's "extend" option (idx list printed below).
import json, math, os, sys, argparse
ap = argparse.ArgumentParser()
ap.add_argument('--src', default='/tmp/claude-0/blender/scene-big/scene.json')
ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scene', 'scene.json'))
ap.add_argument('--no-square', action='store_true'); ap.add_argument('--no-twins', action='store_true')
ap.add_argument('--twin-r0', type=float, default=12.0); ap.add_argument('--twin-r1', type=float, default=14.4)
ap.add_argument('--twin-shrink', type=float, default=0.97); ap.add_argument('--twin-top', type=float, default=12.0)
ap.add_argument('--plate-d', type=float, default=0.0)
a = ap.parse_args()
S = json.load(open(a.src)); V = S['V']['pos']; vx, vz = V[0], V[2]
blades = [i for i, m in enumerate(S['meshes']) if m['kind'] == 'plain' and abs(max(m['pos'][1::3]) - 4.2) < 1e-3 and abs(min(m['pos'][1::3]) + 1.2) < 1e-3]
plate = [i for i, m in enumerate(S['meshes']) if m['kind'] == 'sandplate']
print('blades', blades[0], '..', blades[-1], len(blades), ' plate', plate)
def dist(x, z): return math.hypot(x - vx, z - vz)
twins = []
for i in blades:
    P = S['meshes'][i]['pos']
    xz = sorted({(round(P[j], 6), round(P[j + 2], 6)) for j in range(0, len(P), 3)}, key=lambda q: dist(*q))
    front = xz[:2]                                   # two front corners (nearest V)
    if not a.no_square:
        zf = max(q[1] for q in front)               # plane through the corner nearest V (fronts face +z)
        new = {}
        for (x, z) in front:
            t = (zf - vz) / (z - vz); new[(x, z)] = (vx + (x - vx) * t, zf)
        for j in range(0, len(P), 3):
            k = (round(P[j], 6), round(P[j + 2], 6))
            if k in new: P[j], P[j + 2] = new[k]
    ang = sorted(math.atan2(x - vx, -(z - vz)) for (x, z) in front)   # angle right of -z
    am, hw = (ang[0] + ang[1]) / 2, (ang[1] - ang[0]) / 2 * a.twin_shrink
    if not a.no_twins:
        pts = []
        for r in (a.twin_r0, a.twin_r1):
            for g in (am - hw, am + hw):
                pts.append((vx + r * math.sin(g), vz - r * math.cos(g)))
        # prism: 8 verts, 12 tris (outward winding not required by Cycles)
        (p0, p1, p2, p3) = pts            # r0-left, r0-right, r1-left, r1-right
        y0, y1 = -1.2, a.twin_top
        ring = [p0, p1, p3, p2]
        pos = []
        for (x, z) in ring: pos += [x, y0, z]
        for (x, z) in ring: pos += [x, y1, z]
        idx = []
        for k in range(4):
            k2 = (k + 1) % 4; idx += [k, k2, 4 + k2, k, 4 + k2, 4 + k]
        idx += [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7]
        m0 = S['meshes'][i]
        twins.append({'kind': 'plain', 'fy': 0, 'fa': m0['fa'], 'fo': m0['fo'], 'pos': pos, 'idx': idx, 'twin': True})
if a.plate_d > 0:
    for i in plate:
        P = S['meshes'][i]['pos']
        d0 = sum(vz - P[j + 2] for j in range(0, len(P), 3)) / (len(P) // 3)
        k = a.plate_d / d0
        for j in range(0, len(P), 3):
            P[j] = vx + (P[j] - vx) * k; P[j + 1] = V[1] + (P[j + 1] - V[1]) * k; P[j + 2] = vz + (P[j + 2] - vz) * k
        print('plate moved', round(d0, 3), '->', a.plate_d, 'scale', round(k, 4))
S['meshes'] += twins
S['p2court'] = {'blades': blades, 'twins': list(range(len(S['meshes']) - len(twins), len(S['meshes']))), 'plate': plate, 'args': vars(a)}
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump(S, open(a.out, 'w'))
print('wrote', a.out, 'meshes', len(S['meshes']), 'twins', len(twins))
