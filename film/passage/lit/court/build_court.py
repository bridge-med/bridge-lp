# blender -b -P build.py -- cfg.json : PASSAGE の場面を Cycles で組み立てて、指定のコマを書き出す
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
cfg = json.load(open(sys.argv[sys.argv.index('--') + 1]))
S = json.load(open(cfg['scene']))
SD = os.path.dirname(cfg['scene'])
LIB = os.path.dirname(os.path.abspath(__file__))
def B(p): return Vector((p[0], -p[2], p[1]))            # three(x,y,z) -> blender(x,-z,y)
def srgb2lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)
TOK = S['TOK']; A = cfg.get('albedo', {})
def col(key, default): return srgb2lin(A.get(key, default))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.shading_system = True
sc.cycles.samples = cfg.get('samples', 64); sc.cycles.use_denoising = cfg.get('denoise', True)
sc.cycles.max_bounces = cfg.get('bounces', 6); sc.cycles.diffuse_bounces = cfg.get('diffuse_bounces', 4)
sc.render.resolution_x, sc.render.resolution_y = cfg.get('res', [960, 540]); sc.render.resolution_percentage = 100
sc.view_settings.view_transform = cfg.get('view', 'AgX'); sc.view_settings.look = cfg.get('look', 'None'); sc.view_settings.exposure = cfg.get('exposure', 0.0)
sc.render.fps = 60
sc.render.film_transparent = False
sc.render.dither_intensity = 0.0
if cfg.get('adaptive'): sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = cfg['adaptive']
sc.cycles.glossy_bounces = 2; sc.cycles.transmission_bounces = 0; sc.cycles.volume_bounces = 0; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.cycles.sample_clamp_indirect = 10.0
sc.render.use_persistent_data = True
if cfg.get('plate_denoise_exclude'):
    sc.cycles.use_denoising = False
    vl = bpy.context.view_layer; vl.cycles.denoising_store_passes = True; vl.use_pass_object_index = True
    sc.use_nodes = True; tree = sc.node_tree
    for n in list(tree.nodes): tree.nodes.remove(n)
    rl = tree.nodes.new('CompositorNodeRLayers'); dn = tree.nodes.new('CompositorNodeDenoise'); dn.prefilter = 'ACCURATE'
    idm = tree.nodes.new('CompositorNodeIDMask'); idm.index = 1; idm.use_antialiasing = True
    mix = tree.nodes.new('CompositorNodeMixRGB'); comp = tree.nodes.new('CompositorNodeComposite')
    tree.links.new(rl.outputs['Image'], dn.inputs['Image']); tree.links.new(rl.outputs['Denoising Normal'], dn.inputs['Normal']); tree.links.new(rl.outputs['Denoising Albedo'], dn.inputs['Albedo'])
    tree.links.new(rl.outputs['IndexOB'], idm.inputs['ID value'])
    tree.links.new(idm.outputs['Alpha'], mix.inputs['Fac']); tree.links.new(dn.outputs['Image'], mix.inputs[1]); tree.links.new(rl.outputs['Image'], mix.inputs[2])
    tree.links.new(mix.outputs['Image'], comp.inputs['Image'])

# ---- 材料 ----
osl = bpy.data.texts.load(os.path.join(os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('-P') + 1])) if False else os.path.dirname(os.path.abspath(__file__)), 'arch.osl'))
e = S['vp']; eye = S['V']['pos']
def arch_mat(key, m, layer=None):
    mat = bpy.data.materials.new(key); mat.use_nodes = True; nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = cfg.get('rough', 0.85)
    sn = nt.nodes.new('ShaderNodeScript'); sn.mode = 'INTERNAL'; sn.script = osl
    kind = m['kind']
    base = {'floor': col('floor', TOK['bg2']), 'ceil': col('ceil', TOK['bg']), 'plain': col('wall', TOK['bg']), 'col': col('wall', TOK['bg']), 'auto': col('wall', TOK['bg'])}[kind]
    I = sn.inputs
    I['albedo'].default_value = base
    j = col('joint', TOK['bg2']) if kind != 'floor' else col('floorJoint', TOK['bg3'])
    I['jointCol'].default_value = j; I['skirtCol'].default_value = col('skirt', TOK['bg3'])
    I['joints'].default_value = {'plain': 0, 'ceil': 0, 'col': 2, 'floor': 1, 'auto': 1}[kind]
    I['isFloor'].default_value = 1 if kind == 'floor' else 0
    I['fY'].default_value = m.get('fy', 0) or 0; I['fA'].default_value = m.get('fa', 0); I['fOx'].default_value = m['fo'][0]; I['fOz'].default_value = m['fo'][1]
    I['jointAmt'].default_value = cfg.get('jointAmt', 1.0)
    I['maskN'].default_value = os.path.join(SD, 'maskN.png'); I['maskS'].default_value = os.path.join(SD, 'maskS.png'); I['depth'].default_value = os.path.join(SD, 'depth.pfm')
    I['r0'].default_value = (e[0], e[4], e[8]); I['r1'].default_value = (e[1], e[5], e[9]); I['r3'].default_value = (e[3], e[7], e[11])
    I['w0'].default_value = e[12]; I['w1'].default_value = e[13]; I['w3'].default_value = e[15]
    I['eyeT'].default_value = eye
    PL = (cfg.get('paint_layers') or {}).get(layer) if layer else None
    I['navy'].default_value = srgb2lin(PL['navy']) if PL else col('navy', TOK['navy'])
    I['dawn'].default_value = srgb2lin(PL['dawn']) if PL else col('dawn', TOK['dawn'])
    I['paint'].default_value = 1 if cfg.get('paint', True) else 0
    I['dW'].default_value = S['W'] * 2; I['dH'].default_value = S['H'] * 2
    nt.links.new(sn.outputs['Col'], bsdf.inputs['Base Color'])
    if cfg.get('style') == 'bible':
        bsdf.inputs['Roughness'].default_value = 0.45 if kind == 'floor' else 0.9
        bsdf.inputs['Specular IOR Level'].default_value = 0.5 if kind == 'floor' else 0.25
        I['joints'].default_value = 1 if kind == 'floor' else 0
        I['jointAmt'].default_value = 0.0 if kind == 'floor' else 1.0
        bump = nt.nodes.new('ShaderNodeBump')
        if kind == 'floor':
            bump.inputs['Strength'].default_value = 1.0; bump.inputs['Distance'].default_value = 0.002; bump.invert = True
            nt.links.new(sn.outputs['Groove'], bump.inputs['Height'])
        else:
            tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 600; nz.inputs['Detail'].default_value = 3
            nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
            bump.inputs['Strength'].default_value = 0.04; bump.inputs['Distance'].default_value = 0.0004
            nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    if cfg.get('paint_spec') is not None:      # specular level on painted texels (dark navy is lifted ~5 L* by the plaster's 0.25)
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = bsdf.inputs['Specular IOR Level'].default_value; mr.inputs['To Max'].default_value = cfg['paint_spec']
        nt.links.new(sn.outputs['Paint'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], bsdf.inputs['Specular IOR Level'])
    return mat
mats = {}
def plate_mat(m):
    img = bpy.data.images.load(m['file']); img.colorspace_settings.name = 'sRGB'
    mat = bpy.data.materials.new('plate-' + os.path.basename(m['file'])); mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    tx.interpolation = 'Cubic'
    em.inputs['Strength'].default_value = cfg.get('plateStrength', 1.0)
    nt.links.new(tx.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat, img

# ---- 形 ----
def make_mesh(name, m, mat):
    P = m['pos']; verts = [B(P[i:i + 3]) for i in range(0, len(P), 3)]; I = m['idx']
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], [tuple(I[i:i + 3]) for i in range(0, len(I), 3)])
    if m.get('uv'):
        uvl = me.uv_layers.new(); U = m['uv']
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index; uvl.data[li].uv = (U[vi * 2], U[vi * 2 + 1])
    me.update(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat)
    if m['kind'] != 'plate':
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = False
    return ob
objs = []
DROP = set(cfg.get('drop', []))
EXT = cfg.get('extend')      # {'idx':[...], 'from':4.2, 'to':12.0}: raise the top of these boxes (louver fins -> full-height blades)
for i, m in enumerate(S['meshes']):
    k = m['kind']
    if i in DROP: continue
    if EXT and i in EXT['idx']:
        P = m['pos']; m['pos'] = [ (EXT['to'] if (j % 3 == 1 and abs(v - EXT['from']) < 1e-3) else v) for j, v in enumerate(P) ]
    if k == 'plate':
        mat, img = plate_mat(m)
        if m.get('region'):
            r = m['region']; iw, ih = img.size; U = m['uv']
            m['uv'] = [v for j in range(0, len(U), 2) for v in (U[j] * r['w'] / iw + r['x'] / iw, U[j + 1] * r['h'] / ih + 1 - (r['y'] + r['h']) / ih)]
        ob = make_mesh(f'plate{i}', m, mat)
        ob.visible_diffuse = ob.visible_glossy = ob.visible_transmission = ob.visible_volume_scatter = ob.visible_shadow = False; ob.pass_index = 1
    elif k == 'sandplate':
        mat = bpy.data.materials.new('sandplate'); mat.use_nodes = True; mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col('sandplate', A.get('dawn', TOK['dawn']))
        ob = make_mesh('sandplate', m, mat)
    else:
        layer = next((ln for ln, L in (cfg.get('paint_layers') or {}).items() if i in L['idx']), None)
        key = f"{k}|{m.get('fy', 0)}|{m['fa']:.5f}|{m['fo'][0]:.3f}|{m['fo'][1]:.3f}|{layer}"
        if key not in mats: mats[key] = arch_mat(key, m, layer)
        ob = make_mesh(f'{k}{i}', m, mats[key])
    ob['kind'] = k; objs.append(ob)

# ---- 開口(天井・壁を切る箱)。frame の座標で [x0,x1,y0,y1,z0,z1] ----
S['frames'].update(cfg.get('frames_extra', {}))
def fr_w(F, x, z):
    a, ox, oz = S['frames'][F]; c, s = math.cos(a), math.sin(a)
    return (ox + c * x + s * z, oz - s * x + c * z)
# ---- 足す箱(光の井戸の壁・屋根など)。材料は同じ部屋の壁と同じ漆喰 ----
for ad in cfg.get('adds', []):
    F = ad['frame']; x0, x1, y0, y1, z0, z1 = ad['box']; a, ox, oz = S['frames'][F]
    cx, cz = fr_w(F, (x0 + x1) / 2, (z0 + z1) / 2)
    bpy.ops.mesh.primitive_cube_add(location=B((cx, (y0 + y1) / 2, cz)))
    ob = bpy.context.object; ob.scale = (abs(x1 - x0) / 2, abs(z1 - z0) / 2, abs(y1 - y0) / 2); ob.rotation_euler = (0, 0, a)
    m = {'kind': ad.get('kind', 'plain'), 'fy': 0, 'fa': a, 'fo': [ox, oz]}
    key = f"{m['kind']}|0|{a:.5f}|{ox:.3f}|{oz:.3f}"
    if key not in mats: mats[key] = arch_mat(key, m)
    ob.data.materials.append(mats[key]); ob['kind'] = m['kind']; objs.append(ob)
for cu in cfg.get('cutters', []):
    F = cu['frame']; x0, x1, y0, y1, z0, z1 = cu['box']
    cx, cz = fr_w(F, (x0 + x1) / 2, (z0 + z1) / 2); a = S['frames'][F][0]
    bpy.ops.mesh.primitive_cube_add(location=B((cx, (y0 + y1) / 2, cz)))
    cut = bpy.context.object; cut.scale = ((x1 - x0) / 2, (z1 - z0) / 2, (y1 - y0) / 2); cut.rotation_euler = (0, 0, a); cut.display_type = 'WIRE'; cut.hide_render = True
    bpy.context.view_layer.update()
    cmin = [min((cut.matrix_world @ Vector(v)).__getitem__(k) for v in [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]) for k in range(3)]
    cmax = [max((cut.matrix_world @ Vector(v)).__getitem__(k) for v in [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]) for k in range(3)]
    for ob in objs:
        if ob['kind'] in ('plate', 'sandplate'): continue
        if cu.get('kinds') and ob['kind'] not in cu['kinds']: continue
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        omin = [min(v[k] for v in bb) for k in range(3)]; omax = [max(v[k] for v in bb) for k in range(3)]
        if all(omin[k] < cmax[k] and omax[k] > cmin[k] for k in range(3)):
            md = ob.modifiers.new('cut', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cut; md.solver = 'EXACT'

# ---- 光 ----
sun = cfg.get('sun')
if sun:
    L = Vector(sun['dir']).normalized()  # three の座標で「太陽へ向かう」向き
    Lb = B(L); bpy.ops.object.light_add(type='SUN'); so = bpy.context.object
    so.rotation_euler = Lb.to_track_quat('Z', 'Y').to_euler()   # 光は -Z へ進む。+Z を太陽へ向ける
    so.data.energy = sun.get('strength', 4.0); so.data.angle = math.radians(sun.get('angle', 0.6))
    so.data.color = sun.get('color', (1.0, 0.96, 0.9))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
sk = cfg.get('sky', {'color': (0.75, 0.82, 0.95), 'strength': 1.0})
bg.inputs['Color'].default_value = tuple(sk['color']) + (1,); bg.inputs['Strength'].default_value = sk['strength']
for L in cfg.get('areas', []):   # 補助の面光源(使うなら理由を書く)
    bpy.ops.object.light_add(type='AREA', location=B(L['pos'])); a = bpy.context.object; a.data.energy = L['energy']; a.data.size = L['size']
    a.rotation_euler = B(L['dir']).to_track_quat('-Z', 'Y').to_euler()

# ---- カメラ ----
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co); sc.camera = co
cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(S['FOV_H']); cam.shift_y = S['SHIFT_Y'] / S['W']
cam.clip_start = 0.1; cam.clip_end = 400
MB = cfg.get('motion_blur')          # シャッター(60fps のコマ数。30fps・180° なら 1.0)
if MB:
    for f, (x, y, z, yaw) in enumerate(S['cams']):
        co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
        co.keyframe_insert('location', frame=f); co.keyframe_insert('rotation_euler', frame=f)
    for fc in co.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = MB; sc.cycles.motion_blur_position = 'CENTER'
def set_cam(f, tf=None):
    if MB:
        if tf is None: sc.frame_set(f); return
        fi = int(math.floor(tf)); sc.frame_set(fi, subframe=tf - fi); return   # 24fps などで 60fps のコマの間を正しく取る
    x, y, z, yaw = S['cams'][f]
    co.location = B((x, y, z)); co.rotation_euler = (math.pi / 2, 0, yaw)
out = cfg['out']; os.makedirs(out, exist_ok=True)
import time
for t in cfg['times']:
    f = min(len(S['cams']) - 1, round(t * 60)); set_cam(f, min(len(S['cams']) - 1, t * 60))
    SR = cfg.get('sky_ramp')          # [[t0, s0], [t1, s1]]: 空の強さを時刻で直線に変える(部屋→広間)
    if SR:
        (ta, sa), (tb, sb) = SR; u = min(1, max(0, (t - ta) / (tb - ta)))
        bg.inputs['Strength'].default_value = sa + (sb - sa) * u
    sc.render.filepath = os.path.join(out, f"{cfg.get('prefix', '')}t{t:06.3f}.png")
    t0 = time.time(); bpy.ops.render.render(write_still=True); print('RENDERED', t, round(time.time() - t0, 1), flush=True)
if cfg.get('save_blend'): bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'scene.blend'))
