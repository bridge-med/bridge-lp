# Geometric audit (no rendering): run AFTER build_p2.py in the same Blender process.
#   flock /tmp/claude-0/render.lock blender -b -P build_p2.py -P audit.py -- cfg.json
# cfg: "times": [] (build only), "audit_times": [...], "audit_step": 8, "audit_out": dir
# For each audit time, casts one camera ray per step x step pixel block of the 1920x1080 frame, then one ray
# toward the sun from the first hit. Reports what the upper band / mark box / lockup boxes are made of and
# whether each part is in sun, plus which objects cast the shadows. Writes a class map PNG per time.
import bpy, json, math, os, sys, collections
from mathutils import Vector
cfg = json.load(open(sys.argv[sys.argv.index('--') + 1]))
S = json.load(open(cfg['scene']))
W, H = S['W'], S['H']; FOC = (W / 2) / math.tan(math.radians(S['FOV_H'] / 2)); PPY = H / 2 + S['SHIFT_Y']
def B(p): return Vector((p[0], -p[2], p[1]))
sun = Vector(cfg['sun']['dir']).normalized(); sunB = B(sun)
PC = S.get('p2court', {}); TW = set(PC.get('twins', []))
BL = set(PC.get('blades') or [i for i, m in enumerate(S['meshes']) if m['kind'] == 'plain' and abs(max(m['pos'][1::3]) - 4.2) < 1e-3 and abs(min(m['pos'][1::3]) + 1.2) < 1e-3])
M = S['mark']; s = M['s']
pts = [p for k in ('N', 'S1', 'S2') for p in M[k]]
mx0 = min(M['cx'] + s * (u - 120) for u, v in pts) - 15; mx1 = max(M['cx'] + s * (u - 120) for u, v in pts) + 15
my0 = min(M['cy'] + s * (v - 50) for u, v in pts) - 15; my1 = max(M['cy'] + s * (v - 50) for u, v in pts) + 15
LK = json.load(open(os.path.join(os.path.dirname(cfg['scene']), 'lockup.json')))
COURT_Z = S['frames']['FC'][2] + cfg.get('court_fc_z', -21.3)
dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
cut_names = {o.name for o in bpy.data.objects if o.type == 'MESH' and o.hide_render}
nopass = {o.name for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('plate')}
def cast(o, d, skip):
    o = o.copy()
    for _ in range(12):
        hit, loc, nrm, idx, ob, mat = sc.ray_cast(dg, o, d)
        if not hit: return None
        if ob.name in skip: o = loc + d * 1e-3; continue
        return loc, nrm, ob
    return None
def mesh_index(name):
    for p in ('plain', 'col', 'auto', 'floor', 'ceil', 'plate'):
        if name.startswith(p) and name[len(p):].isdigit(): return int(name[len(p):])
    return None
def classify(ob, loc, nrm):
    n3 = (nrm[0], nrm[2], -nrm[1]); z3 = -loc[1]
    i = mesh_index(ob.name)
    if ob.name.startswith('plate'): return 'plate'
    if ob.name.startswith('sandplate'): return 'sandplate'
    face = 'front' if n3[2] > 0.85 else ('back' if n3[2] < -0.85 else ('top' if abs(n3[1]) > 0.85 else 'side'))
    if i in BL: return 'blade-' + face
    if i in TW: return 'twin-' + face
    if i == 57: return 'parapet'
    if z3 < COURT_Z: return 'court-' + ('back' if n3[2] > 0.85 else ('floor' if n3[1] > 0.85 else ('left' if n3[0] > 0.85 else ('right' if n3[0] < -0.85 else 'other'))))
    return 'hall'
COL = {'blade-front': (230, 200, 120), 'blade-side': (120, 90, 200), 'blade-top': (120, 90, 200), 'blade-back': (120, 90, 200),
       'twin-front': (200, 80, 80), 'twin-side': (200, 80, 80), 'twin-back': (200, 80, 80), 'twin-top': (200, 80, 80),
       'court-back': (90, 170, 230), 'court-left': (40, 120, 120), 'court-right': (60, 200, 200), 'court-floor': (0, 90, 255), 'court-other': (0, 0, 255), 'parapet': (120, 200, 120), 'hall': (170, 170, 170), 'plate': (255, 0, 255), 'sandplate': (255, 140, 0), 'sky': (255, 0, 0)}
co = sc.camera
out = cfg.get('audit_out', cfg['out']); os.makedirs(out, exist_ok=True)
step = cfg.get('audit_step', 8)
report = {}
for t in cfg['audit_times']:
    f = min(len(S['cams']) - 1, t * 60); fi = int(math.floor(f))
    if co.animation_data: sc.frame_set(fi, subframe=f - fi)
    else:
        x, y, z, yaw = S['cams'][round(f)]; co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    cam = co.matrix_world; org = cam.translation.copy(); R = cam.to_3x3()
    fwd = R @ Vector((0, 0, -1)); rgt = R @ Vector((1, 0, 0)); up = R @ Vector((0, 1, 0))
    gw, gh = W // step, H // step
    img = bytearray(gw * gh * 3)
    tally = collections.Counter(); occ = collections.Counter(); ns = collections.defaultdict(list)
    for gy in range(gh):
        py = gy * step + step / 2
        for gx in range(gw):
            px = gx * step + step / 2
            d = (fwd + rgt * ((px - W / 2) / FOC) + up * ((PPY - py) / FOC)).normalized()
            h = cast(org, d, cut_names)
            if h is None: cls, lit = 'sky', True
            else:
                loc, nrm, ob = h
                if nrm.dot(d) > 0: nrm = -nrm
                cls = classify(ob, loc, nrm)
                cosi = nrm.dot(sunB)
                if cls == 'plate': lit = None
                elif cosi <= 0: lit = False; occ_name = 'self(n.s<0)'
                else:
                    sh = cast(loc + nrm * 2e-3, sunB, cut_names | nopass)
                    lit = sh is None; occ_name = None if lit else sh[2].name
                if lit is False:
                    zone = 'mark' if (mx0 <= px <= mx1 and my0 <= py <= my1) else ('upper' if py < 0.52 * H else 'lower')
                    occ[(zone, cls, occ_name)] += 1
                if lit: ns[cls + ('@mark' if (mx0 <= px <= mx1 and my0 <= py <= my1) else '')].append(cosi)
            zones = ['all']
            if py < 0.52 * H: zones.append('upper')
            if mx0 <= px <= mx1 and my0 <= py <= my1: zones.append('mark')
            for j, l in enumerate(LK):
                if l['x'] <= px <= l['x'] + l['w'] and l['y'] <= py <= l['y'] + l['h']: zones.append(f'lockup{j}')
            for zn in zones: tally[(zn, cls, lit)] += 1
            c = COL.get(cls, (0, 0, 0))
            k = 1.0 if lit or lit is None else 0.45
            o3 = ((gh - 1 - gy) * gw + gx) * 3
            o3 = (gy * gw + gx) * 3
            img[o3:o3 + 3] = bytes(int(v * k) for v in c)
    im = bpy.data.images.new(f'aud{t}', gw, gh)
    pix = []
    for gy in range(gh - 1, -1, -1):
        for gx in range(gw):
            o3 = (gy * gw + gx) * 3; pix += [img[o3] / 255, img[o3 + 1] / 255, img[o3 + 2] / 255, 1.0]
    im.pixels = pix; im.filepath_raw = os.path.join(out, f'audit-t{t:06.3f}.png'); im.file_format = 'PNG'; im.save()
    rep = {}
    for zn in ('upper', 'mark', 'lockup0', 'lockup1'):
        tot = sum(v for (z, c, l), v in tally.items() if z == zn) or 1
        rep[zn] = {f'{c}|{"sun" if l else ("shade" if l is False else "-")}': round(v / tot, 3) for (z, c, l), v in sorted(tally.items(), key=lambda kv: -kv[1]) if z == zn}
    rep['shadow_casters'] = {f'{z}|{c}|{o}': v for (z, c, o), v in occ.most_common(14)}
    rep['mean_n.s_sunlit'] = {k: round(sum(v) / len(v), 3) for k, v in ns.items() if len(v) > 20}
    report[t] = rep
    print('AUDIT', t, json.dumps(rep, ensure_ascii=False), flush=True)
json.dump(report, open(os.path.join(out, 'audit.json'), 'w'), indent=1, ensure_ascii=False)
# ---- stroke check at V: every sample of the mark polylines must land on a surface in direct sun ----
t = S['T_ARRIVE']; f = min(len(S['cams']) - 1, t * 60); fi = int(math.floor(f))
if co.animation_data: sc.frame_set(fi, subframe=f - fi)
else:
    x, y, z, yaw = S['cams'][round(f)]; co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
cam = co.matrix_world; org = cam.translation.copy(); R = cam.to_3x3()
fwd = R @ Vector((0, 0, -1)); rgt = R @ Vector((1, 0, 0)); up = R @ Vector((0, 1, 0))
res = {}
for key in ('N', 'S1', 'S2'):
    P = M[key]; cnt = collections.Counter(); bad = []
    for a_, b_ in zip(P[:-1], P[1:]):
        for k in range(4):
            u = a_[0] + (b_[0] - a_[0]) * k / 4; v = a_[1] + (b_[1] - a_[1]) * k / 4
            for off in (-0.8, 0.0, 0.8):                     # across the stroke (in logo units, hw = 3)
                px = M['cx'] + s * (u - 120); py = M['cy'] + s * (v - 50) + off * M['hw'] * s / 3
                d = (fwd + rgt * ((px - W / 2) / FOC) + up * ((PPY - py) / FOC)).normalized()
                h = cast(org, d, cut_names)
                if h is None: cnt['sky'] += 1; continue
                loc, nrm, ob = h
                if nrm.dot(d) > 0: nrm = -nrm
                cls = classify(ob, loc, nrm)
                sh = cast(loc + nrm * 2e-3, sunB, cut_names | nopass) if nrm.dot(sunB) > 0 else 'self'
                lit = sh is None
                cnt[(cls, 'sun' if lit else 'shade')] += 1
                if not lit and len(bad) < 6: bad.append((round(px), round(py), cls, 'self' if sh == 'self' else sh[2].name))
    res[key] = {'counts': {f'{c[0]}|{c[1]}' if isinstance(c, tuple) else c: n for c, n in cnt.items()}, 'shade_examples': bad}
print('STROKES', json.dumps(res, ensure_ascii=False), flush=True)
report['strokes'] = res
json.dump(report, open(os.path.join(out, 'audit.json'), 'w'), indent=1, ensure_ascii=False)
