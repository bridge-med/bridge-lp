# blender -b -P p2proto.py -- cfg.json
# P2 prototype: the hall ceiling becomes a stencil slab; sun holes are cut so that the lit patches on the
# receiving surfaces line up, from V only, into the chosen strokes of the BRIDGE mark.
# Based on /tmp/claude-0/blender/lib/build.py (read-only), extended.
import bpy, bmesh, json, math, os, sys, time
import numpy as np
from mathutils import Vector
cfg = json.load(open(sys.argv[sys.argv.index('--') + 1]))
S = json.load(open(cfg['scene']))
SD = os.path.dirname(cfg['scene'])
LIB = '/tmp/claude-0/blender/lib'
OUT = cfg['out']; os.makedirs(OUT, exist_ok=True)
def B(p): return Vector((p[0], -p[2], p[1]))
def srgb2lin1(x): return ((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92
def srgb2lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(srgb2lin1(x) for x in c) + (1.0,)
TOK = S['TOK']; W, H = S['W'], S['H']

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.shading_system = not cfg.get('nosl', False)
sc.cycles.samples = cfg.get('samples', 64); sc.cycles.use_denoising = True
sc.cycles.max_bounces = cfg.get('bounces', 6); sc.cycles.diffuse_bounces = cfg.get('diffuse_bounces', 3)
sc.cycles.glossy_bounces = 1; sc.cycles.transmission_bounces = 0; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 8
sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.render.resolution_x, sc.render.resolution_y = cfg.get('res', [960, 540]); sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0
sc.render.fps = 60
sc.render.threads_mode = 'FIXED'; sc.render.threads = 4

# ---- masks of the two strokes in V's image (1920x1080), full strokes including the crossing ----
LOGO_N = [[8, 74], [62, 16], [118, 24], [176, 84]]
LOGO_S = [[58, 94], [118, 60], [158, 22], [232, 12]]
MK = S['mark']
def bez(p, u):
    a = 1 - u
    return (a**3 * p[0][0] + 3*a*a*u * p[1][0] + 3*a*u*u * p[2][0] + u**3 * p[3][0],
            a**3 * p[0][1] + 3*a*a*u * p[1][1] + 3*a*u*u * p[2][1] + u**3 * p[3][1])
def poly(ctrl, n=200):
    P = np.array([bez(ctrl, i / n) for i in range(n + 1)])
    return np.stack([MK['cx'] + (P[:, 0] - 120) * MK['s'], MK['cy'] + (P[:, 1] - 53) * MK['s']], 1)
HWPX = MK['hw'] * MK['s']
def stroke_dist(pts, P):   # pts (M,2) px, P (n+1,2) polyline -> min distance
    A = P[:-1][None]; Bv = P[1:][None]; X = pts[:, None]
    AB = Bv - A; t = np.clip(((X - A) * AB).sum(-1) / (AB * AB).sum(-1), 0, 1)
    return np.sqrt((((A + AB * t[..., None]) - X) ** 2).sum(-1)).min(1)
SS = cfg.get('ss', 2)                     # samples per px (per axis)
def stroke_samples(ctrl, grow=0.0):
    P = poly(ctrl)
    x0, y0 = np.floor(P.min(0) - HWPX - 4); x1, y1 = np.ceil(P.max(0) + HWPX + 4)
    xs = np.arange(x0, x1, 1 / SS) + 0.5 / SS; ys = np.arange(y0, y1, 1 / SS) + 0.5 / SS
    X, Y = np.meshgrid(xs, ys); pts = np.stack([X.ravel(), Y.ravel()], 1)
    out = []
    for k in range(0, len(pts), 20000):
        d = stroke_dist(pts[k:k + 20000], P); out.append(pts[k:k + 20000][d <= HWPX + grow])
    return np.concatenate(out)
FOC = (W / 2) / math.tan(math.radians(S['FOV_H'] / 2)); PPY = H / 2 + S['SHIFT_Y']   # principal point y (px) = 0.44H
VP = B(S['V']['pos'])
def vdir(px, py): return Vector(((px - W / 2) / FOC, 1.0, (PPY - py) / FOC)).normalized()   # V looks along +Y in blender

# ---- materials (as build.py; paint masks chosen per variant) ----
osl = bpy.data.texts.load(os.path.join(LIB, 'arch.osl'))
e = S['vp']; eye = S['V']['pos']
A = cfg.get('albedo', {})
def col(key, default): return srgb2lin(A.get(key, default))
def arch_mat(key, m, maskN, maskS):
    if cfg.get('nosl'):
        mat = bpy.data.materials.new(key); mat.use_nodes = True; b_ = mat.node_tree.nodes['Principled BSDF']
        b_.inputs['Base Color'].default_value = col('floor', '#C5C1BA') if m['kind'] == 'floor' else col('wall', '#EAE9E6')
        b_.inputs['Roughness'].default_value = 0.9; b_.inputs['Specular IOR Level'].default_value = 0.25
        return mat
    mat = bpy.data.materials.new(key); mat.use_nodes = True; nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Specular IOR Level'].default_value = 0.25
    sn = nt.nodes.new('ShaderNodeScript'); sn.mode = 'INTERNAL'; sn.script = osl
    kind = m['kind']
    base = col('floor', '#C5C1BA') if kind == 'floor' else col('wall', '#EAE9E6')
    I = sn.inputs
    I['albedo'].default_value = base
    I['jointCol'].default_value = base; I['skirtCol'].default_value = base
    I['joints'].default_value = 0; I['isFloor'].default_value = 1 if kind == 'floor' else 0
    I['fY'].default_value = m.get('fy', 0) or 0; I['fA'].default_value = m.get('fa', 0); I['fOx'].default_value = m['fo'][0]; I['fOz'].default_value = m['fo'][1]
    I['jointAmt'].default_value = 0
    I['maskN'].default_value = maskN; I['maskS'].default_value = maskS; I['depth'].default_value = os.path.join(SD, 'depth.pfm')
    I['r0'].default_value = (e[0], e[4], e[8]); I['r1'].default_value = (e[1], e[5], e[9]); I['r3'].default_value = (e[3], e[7], e[11])
    I['w0'].default_value = e[12]; I['w1'].default_value = e[13]; I['w3'].default_value = e[15]
    I['eyeT'].default_value = eye
    I['navy'].default_value = col('navy', TOK['navy']); I['dawn'].default_value = col('sandPig', TOK['dawn'])
    I['paint'].default_value = 1
    I['dW'].default_value = W * 2; I['dH'].default_value = H * 2
    nt.links.new(sn.outputs['Col'], bsdf.inputs['Base Color'])
    return mat

# paint masks written for this variant (2W x 2H, white = paint): navy with a gap under the sand band; sand pigment band
def write_mask(path, ctrl_list, minus=None, grow_px=0.0, minus_grow=0.0):
    img = np.zeros((H * 2, W * 2), np.float32)
    for ctrl in ctrl_list:
        P = poly(ctrl)
        x0, y0 = np.floor(P.min(0) - HWPX - 12); x1, y1 = np.ceil(P.max(0) + HWPX + 12)
        xs = np.arange(int(x0) * 2, int(x1) * 2); ys = np.arange(int(y0) * 2, int(y1) * 2)
        X, Y = np.meshgrid(xs, ys); pts = np.stack([(X.ravel() + 0.5) / 2, (Y.ravel() + 0.5) / 2], 1)
        d = np.concatenate([stroke_dist(pts[k:k + 20000], P) for k in range(0, len(pts), 20000)])
        cov = np.clip(HWPX + grow_px + 0.5 - d, 0, 1)
        if minus is not None:
            d2 = np.concatenate([stroke_dist(pts[k:k + 20000], poly(minus)) for k in range(0, len(pts), 20000)])
            cov = cov * (1 - np.clip(HWPX + minus_grow + 0.5 - d2, 0, 1))
        sub = img[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
        np.maximum(sub, cov.reshape(sub.shape), out=sub)
    im = bpy.data.images.new(os.path.basename(path), W * 2, H * 2, alpha=False, float_buffer=False)
    rgba = np.zeros((H * 2, W * 2, 4), np.float32); rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = img; rgba[..., 3] = 1
    im.pixels.foreach_set(rgba[::-1].ravel())      # blender images are bottom-up
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    return path
V = cfg['variant']
empty = write_mask(os.path.join(OUT, 'mask-empty.png'), [])
if V == 'A':      # navy = paint (with a gap under the sand band), sand = light only
    mN = write_mask(os.path.join(OUT, 'mask-Ngap.png'), [LOGO_N], minus=LOGO_S, minus_grow=cfg.get('gapGrow', 1.5)); mS = empty
    lightStrokes = [LOGO_S]
else:             # B: both strokes = light; sand pigment under the sand light (wider band)
    mN = empty; mS = write_mask(os.path.join(OUT, 'mask-Swide.png'), [LOGO_S], grow_px=cfg.get('pigGrow', 3.0))
    lightStrokes = [LOGO_N, LOGO_S]

mats = {}
objs = []
def make_mesh(name, m, mat):
    P = m['pos']; verts = [B(P[i:i + 3]) for i in range(0, len(P), 3)]; I = m['idx']
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], [tuple(I[i:i + 3]) for i in range(0, len(I), 3)])
    if m.get('uv'):
        uvl = me.uv_layers.new(); U = m['uv']
        for poly_ in me.polygons:
            for li in poly_.loop_indices:
                vi = me.loops[li].vertex_index; uvl.data[li].uv = (U[vi * 2], U[vi * 2 + 1])
    me.update(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat)
    if m['kind'] != 'plate':
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4); bm.to_mesh(me); bm.free()
    return ob
def plate_mat(m):
    img = bpy.data.images.load(m['file']); img.colorspace_settings.name = 'sRGB'
    mat = bpy.data.materials.new('plate-' + os.path.basename(m['file'])); mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    tx.interpolation = 'Linear'; em.inputs['Strength'].default_value = 1.0
    nt.links.new(tx.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat, img
fc = S['frames']['FC']
DROP = set(cfg.get('drop', [43, 64, 65, 66]))   # hall ceiling and its beams -> replaced by the stencil slab
for i, m in enumerate(S['meshes']):
    k = m['kind']
    if i in DROP: continue
    if k == 'plate':
        mat, img = plate_mat(m)
        if m.get('region'):
            r = m['region']; iw, ih = img.size; U = m['uv']
            m['uv'] = [v for j in range(0, len(U), 2) for v in (U[j] * r['w'] / iw + r['x'] / iw, U[j + 1] * r['h'] / ih + 1 - (r['y'] + r['h']) / ih)]
        ob = make_mesh(f'plate{i}', m, mat)
        ob.visible_diffuse = False; ob.visible_glossy = False; ob.visible_shadow = True
    elif k == 'sandplate':
        if not cfg.get('keepPlate', False): continue
        mat = bpy.data.materials.new('sandplate'); mat.use_nodes = True
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col('wall', '#EAE9E6')
        ob = make_mesh('sandplate', m, mat)
    else:
        key = f"{k}|{m.get('fy', 0)}|{m['fa']:.5f}|{m['fo'][0]:.3f}|{m['fo'][1]:.3f}"
        if key not in mats: mats[key] = arch_mat(key, m, mN, mS)
        ob = make_mesh(f'{k}{i}', m, mats[key])
    ob['kind'] = k; objs.append(ob)

# ---- extra openings (boolean cutters, frame coords as build.py) ----
def fr_w(F, x, z):
    a, ox, oz = S['frames'][F]; c, s = math.cos(a), math.sin(a)
    return (ox + c * x + s * z, oz - s * x + c * z)
for cu in cfg.get('cutters', []):
    F = cu['frame']; x0, x1, y0, y1, z0, z1 = cu['box']
    cx, cz = fr_w(F, (x0 + x1) / 2, (z0 + z1) / 2); a = S['frames'][F][0]
    bpy.ops.mesh.primitive_cube_add(location=B((cx, (y0 + y1) / 2, cz)))
    cut = bpy.context.object; cut.scale = ((x1 - x0) / 2, (z1 - z0) / 2, (y1 - y0) / 2); cut.rotation_euler = (0, 0, a); cut.hide_render = True
    bpy.context.view_layer.update()
    corners = [cut.matrix_world @ Vector((sx, sy, sz)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    cmin = [min(v[k] for v in corners) for k in range(3)]; cmax = [max(v[k] for v in corners) for k in range(3)]
    for ob in objs:
        if ob['kind'] in ('plate', 'sandplate'): continue
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        omin = [min(v[k] for v in bb) for k in range(3)]; omax = [max(v[k] for v in bb) for k in range(3)]
        if all(omin[k] < cmax[k] and omax[k] > cmin[k] for k in range(3)):
            md = ob.modifiers.new('cut', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cut; md.solver = 'EXACT'

# ---- stencils: horizontal slabs (world, blender coords) pierced by shafts parallel to the sun ----
HX0, HX1 = fc[1] - 9.6 - 1.2, fc[1] + 9.6 + 1.2
HY0, HY1 = -(fc[2] + 1.2), -(fc[2] - 42.0)     # blender y = -z(three)
VPL = S['hall']['vpl']                          # V in hall coords (x, z)
def hall2b(xl, zl): return (fc[1] + xl, -(fc[2] + zl))
STEN = [{'name': 'roof', 'x0': HX0, 'x1': HX1, 'y0': HY0, 'y1': HY1, 'z': cfg.get('stencilZ', 10.8), 'th': cfg.get('stencilTh', 0.3)}]
if cfg.get('brow'):
    bw = cfg['brow']   # {'y':3.4,'th':0.3,'front':4.2,'back':6.0,'half':3.0}  distances from V along the axis, half width (m)
    bx0, by1 = hall2b(VPL[0] - bw['half'], VPL[1] - bw['front']); bx1, by0 = hall2b(VPL[0] + bw['half'], VPL[1] - bw['back'])
    STEN.append({'name': 'brow', 'x0': min(bx0, bx1), 'x1': max(bx0, bx1), 'y0': min(by0, by1), 'y1': max(by0, by1), 'z': bw['y'], 'th': bw['th']})
RES = cfg.get('texel', 0.01)
for s_ in STEN:
    bpy.ops.mesh.primitive_cube_add(location=((s_['x0'] + s_['x1']) / 2, (s_['y0'] + s_['y1']) / 2, s_['z'] + s_['th'] / 2))
    o = bpy.context.object; o.name = 'sten_' + s_['name']; o.scale = ((s_['x1'] - s_['x0']) / 2, (s_['y1'] - s_['y0']) / 2, s_['th'] / 2)
    bpy.ops.object.transform_apply(scale=True); s_['ob'] = o
    s_['NX'] = int(math.ceil((s_['x1'] - s_['x0']) / RES)); s_['NY'] = int(math.ceil((s_['y1'] - s_['y0']) / RES))
    s_['exact'] = np.zeros((s_['NY'], s_['NX']), np.uint8); s_['margin'] = np.zeros((s_['NY'], s_['NX']), np.uint8)

# ---- the crossing blade: a thin plate at BLADE_D from V whose outline from V is the sand stroke within +-70px of the crossing ----
if cfg.get('bladeD'):
    BD = cfg['bladeD']; GAPX = 70
    PS = poly(LOGO_S, 800); PN = poly(LOGO_N, 800)
    dd = np.sqrt(((PS[:, None] - PN[None]) ** 2).sum(-1)); i0 = np.unravel_index(dd.argmin(), dd.shape)[0]
    XC = PS[i0, 0]; seg = PS[np.abs(PS[:, 0] - XC) <= GAPX]
    tng = np.gradient(seg, axis=0); tng /= np.linalg.norm(tng, axis=1)[:, None]; nrm = np.stack([-tng[:, 1], tng[:, 0]], 1)
    outline = [tuple(p + n * HWPX) for p, n in zip(seg, nrm)]
    def cap(p, t, sgn):
        return [tuple(p + (np.array([-t[1], t[0]]) * math.cos(a) + t * sgn * math.sin(a)) * HWPX) for a in np.linspace(0, math.pi, 13)[1:-1]]
    outline += cap(seg[-1], tng[-1], 1)[::1]
    outline += [tuple(p - n * HWPX) for p, n in zip(seg[::-1], nrm[::-1])]
    outline += cap(seg[0], -tng[0], 1)
    def onplane(px, py, dist):
        d = vdir(px, py); return VP + d * (dist / d.y)
    import bmesh as _bm
    me = bpy.data.meshes.new('blade'); bm = _bm.new()
    front = [bm.verts.new(onplane(x, y, BD)) for x, y in outline]; back = [bm.verts.new(onplane(x, y, BD + 0.03)) for x, y in outline]
    bm.faces.new(front[::-1]); bm.faces.new(back)
    n_ = len(outline)
    for i in range(n_):
        j = (i + 1) % n_; bm.faces.new([front[i], front[j], back[j], back[i]])
    _bm.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='EAR_CLIP'); bm.to_mesh(me); bm.free()
    bo = bpy.data.objects.new('blade', me); bpy.context.collection.objects.link(bo)
    bkey = f"auto|0|{fc[0]:.5f}|{fc[1]:.3f}|{fc[2]:.3f}"
    mb = mats.get(bkey) or arch_mat('blade', {'kind': 'plain', 'fa': fc[0], 'fo': [fc[1], fc[2]]}, mN, mS)
    bo.data.materials.append(mb); bo['kind'] = 'blade'
    print('BLADE at', BD, 'crossing px', round(float(XC), 1), flush=True)
bpy.context.view_layer.update()

# ---- sun ----
sun = cfg['sun']
Ls = Vector(sun['dir']).normalized(); Lb = B(Ls).normalized()
bpy.ops.object.light_add(type='SUN'); so = bpy.context.object
so.rotation_euler = Lb.to_track_quat('Z', 'Y').to_euler()
so.data.energy = sun['strength']; so.data.angle = math.radians(sun.get('angle', 0.53)); so.data.color = tuple(sun.get('color', (1, 1, 1)))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bgn = w.node_tree.nodes['Background']
sk = cfg.get('sky', {'color': (1, 1, 1), 'strength': 1.0})
bgn.inputs['Color'].default_value = tuple(sk['color']) + (1,); bgn.inputs['Strength'].default_value = sk['strength']

# ---- cut the holes: V -> receiver P (V-visible), then P -> sun: every stencil crossed gets a hole.
#      the first stencil crossed gets the exact hole (it defines the edge); later ones get a margin so they do not clip ----
t0 = time.time()
dg = bpy.context.evaluated_depsgraph_get()
byname = {s_['ob'].name: s_ for s_ in STEN}
stats = {'samples': 0, 'miss': 0, 'blocked': 0, 'ok': 0, 'recv': {}, 'first': {}}
for ctrl in lightStrokes:
    pts = stroke_samples(ctrl, grow=cfg.get('holeGrowPx', 0.0))
    for px, py in pts:
        stats['samples'] += 1
        hit, P, N, fi, ob, _ = sc.ray_cast(dg, VP, vdir(px, py))
        if not hit: stats['miss'] += 1; continue
        stats['recv'][ob.name[:6]] = stats['recv'].get(ob.name[:6], 0) + 1
        org = P + N * 1e-4 + Lb * 1e-4; first = True; okp = True
        for _ in range(4):
            h2, Q, N2, fi2, ob2, _ = sc.ray_cast(dg, org, Lb)
            if not h2: break                                   # reached the sky
            if ob2 == ob and (Q - org).length < 0.1: org = Q + Lb * 1e-3; continue   # the receiver's own other face
            s_ = byname.get(ob2.name)
            if s_ is None or Q.z > s_['z'] + 1e-3:
                okp = False; kb = ob2.name + '@' + ob.name[:7]; stats.setdefault('blockers', {}); stats['blockers'][kb] = stats['blockers'].get(kb, 0) + 1
                stats.setdefault('blockedPx', []); (len(stats['blockedPx']) < 12) and stats['blockedPx'].append([round(float(px)), round(float(py))]); break   # blocked by the building
            ix = int((Q.x - s_['x0']) / RES); iy = int((Q.y - s_['y0']) / RES)
            if 0 <= ix < s_['NX'] and 0 <= iy < s_['NY']: (s_['exact'] if first else s_['margin'])[iy, ix] = 1
            if first: stats['first'][s_['name']] = stats['first'].get(s_['name'], 0) + 1
            first = False
            org = Q + Lb * ((s_['th'] + 2e-3) / Lb.z)
        if okp: stats['ok'] += 1
        else: stats['blocked'] += 1
def dil(a, k):
    if k <= 0: return a
    ny, nx = a.shape; hp = np.pad(a, k); acc = np.zeros_like(a)
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            if dx * dx + dy * dy <= k * k: acc |= hp[k + dy:k + dy + ny, k + dx:k + dx + nx]
    return acc
for s_ in STEN:
    s_['hole'] = dil(s_['exact'], cfg.get('dilate', 1)) | dil(s_['margin'], int(cfg.get('marginM', 0.06) / RES))
    print('STENCIL', s_['name'], 'area m2', round(float(s_['hole'].sum()) * RES * RES, 3), flush=True)
print('HOLES', json.dumps(stats), 'secs', round(time.time() - t0, 1), flush=True)

def sten_mat(s_):
    NX, NY = s_['NX'], s_['NY']; ZS = s_['z']
    im = bpy.data.images.new('holes_' + s_['name'], NX, NY, alpha=False, float_buffer=False)
    rgba = np.zeros((NY, NX, 4), np.float32); rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = s_['hole']; rgba[..., 3] = 1
    im.pixels.foreach_set(rgba.ravel()); im.filepath_raw = os.path.join(OUT, f"holes-{s_['name']}.png"); im.file_format = 'PNG'; im.save()
    im.colorspace_settings.name = 'Non-Color'
    mat = bpy.data.materials.new('sten_' + s_['name']); mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    o = nt.nodes.new('ShaderNodeOutputMaterial'); mix = nt.nodes.new('ShaderNodeMixShader')
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = col('wall', '#EAE9E6')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); geo = nt.nodes.new('ShaderNodeNewGeometry')
    sepP = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sepP.inputs[0])
    dz = nt.nodes.new('ShaderNodeMath'); dz.operation = 'SUBTRACT'; nt.links.new(sepP.outputs['Z'], dz.inputs[0]); dz.inputs[1].default_value = ZS
    tt = nt.nodes.new('ShaderNodeMath'); tt.operation = 'DIVIDE'; nt.links.new(dz.outputs[0], tt.inputs[0]); tt.inputs[1].default_value = Lb.z
    def axis(comp, lb, lo, n):
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(tt.outputs[0], mul.inputs[0]); mul.inputs[1].default_value = lb
        sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; nt.links.new(sepP.outputs[comp], sub.inputs[0]); nt.links.new(mul.outputs[0], sub.inputs[1])
        nrm = nt.nodes.new('ShaderNodeMath'); nrm.operation = 'MULTIPLY_ADD'; nt.links.new(sub.outputs[0], nrm.inputs[0]); nrm.inputs[1].default_value = 1.0 / (RES * n); nrm.inputs[2].default_value = -lo / (RES * n)
        return nrm
    u = axis('X', Lb.x, s_['x0'], NX); v = axis('Y', Lb.y, s_['y0'], NY)
    cmb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(u.outputs[0], cmb.inputs[0]); nt.links.new(v.outputs[0], cmb.inputs[1])
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = im; tx.interpolation = 'Linear'; tx.extension = 'CLIP'
    nt.links.new(cmb.outputs[0], tx.inputs['Vector'])
    nt.links.new(tx.outputs['Color'], mix.inputs['Fac']); nt.links.new(dif.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], o.inputs['Surface'])
    s_['ob'].data.materials.append(mat)
for s_ in STEN: sten_mat(s_)

# ---- camera ----
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co); sc.camera = co
cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(S['FOV_H']); cam.shift_y = S['SHIFT_Y'] / S['W']
cam.clip_start = 0.1; cam.clip_end = 400
MB = cfg.get('motion_blur')          # 60fps のコマ数でのシャッター(30fps・180° なら 1.0)
if MB:
    for f_, (x, y, z, yaw) in enumerate(S['cams']):
        co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
        co.keyframe_insert('location', frame=f_); co.keyframe_insert('rotation_euler', frame=f_)
    for fc in co.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = MB; sc.cycles.motion_blur_position = 'CENTER'
def set_cam(f, tf=None):
    if MB:
        tf = f if tf is None else tf; fi = int(math.floor(tf)); sc.frame_set(fi, subframe=tf - fi); return
    x, y, z, yaw = S['cams'][f]
    co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
looks = cfg.get('looks', [{'prefix': cfg.get('prefix', ''), 'sun': sun['strength'], 'sky': sk['strength'], 'res': cfg.get('res', [960, 540]), 'samples': cfg.get('samples', 64), 'times': cfg['times']}])
for lk in looks:
    so.data.energy = lk['sun']; bgn.inputs['Strength'].default_value = lk['sky']
    sc.cycles.use_adaptive_sampling = bool(lk.get('adaptive', False)); sc.cycles.adaptive_threshold = lk.get('adaptive', 0.01) or 0.01
    sc.cycles.diffuse_bounces = lk.get('db', cfg.get('diffuse_bounces', 3)); sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y = lk.get('res', cfg.get('res', [960, 540])); sc.cycles.samples = lk.get('samples', cfg.get('samples', 64))
    for t in lk.get('times', cfg['times']):
        f = min(len(S['cams']) - 1, round(t * 60)); set_cam(f, min(len(S['cams']) - 1, t * 60))
        exr = lk.get('exr', False)
        sc.render.image_settings.file_format = 'OPEN_EXR' if exr else 'PNG'
        if exr: sc.render.image_settings.color_depth = '32'
        else: sc.render.image_settings.color_depth = '8'; sc.render.image_settings.color_mode = 'RGB'
        sc.render.filepath = os.path.join(OUT, f"{lk['prefix']}t{t:06.3f}." + ('exr' if exr else 'png'))
        t1 = time.time(); bpy.ops.render.render(write_still=True); print('RENDERED', lk['prefix'], t, sc.render.resolution_x, sc.cycles.samples, round(time.time() - t1, 1), flush=True)
if cfg.get('save_blend'): bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'scene.blend'))
