"""蚊に刺されるとなぜかゆい? — Blender(bpy)でシーンを手続き的に組み、timing.json に合わせてアニメーションを付ける。

使い方(bpy モジュール):
  python3 scene.py <episode_dir> [--blend <out.blend>] [--stills t1,t2,...] [--stilldir <dir>] [--res 540]
  - timing.json(timeline.py の出力)の区間 cue ごとにキーを打つ。cue 名は script.json の cue と同じ
  - 出力: work/scene.blend(render.py が描く)、work/anchors.json(ラベルの画面座標)、work/qa_scene.json(幾何の検証値)
  - --stills を付けると、その秒の静止画を低解像度で描いて確認用に出す(本番の描画は render.py)

世界は二つ(同じ .blend の中、x で 100 離す):
  macro   … 腕と蚊。着地 → 口器の刺入 → 皮膚へ寄る / 終盤: 赤く膨らんだ腕
  section … 皮膚の断面(表皮・真皮・皮下組織・血管・神経終末・マスト細胞)。唾液 → 認識 → 脱顆粒 → ヒスタミン → 神経 → 膨疹
"""
import json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

random.seed(7)
EP = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else Path(__file__).resolve().parent
ARGS = sys.argv[1:]
def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default
WORK = EP / "work"; WORK.mkdir(exist_ok=True)
SCRIPT = json.load(open(EP / "script.json", encoding="utf-8"))
TIMING = json.load(open(EP / "timing.json", encoding="utf-8"))
FPS = TIMING["fps"]; W, H = SCRIPT["width"], SCRIPT["height"]
SEG = {s["cue"]: s for s in TIMING["segments"]}
TOTAL_FRAMES = TIMING["total_frames"]
SEC = Vector((100.0, 0.0, 0.0))  # 断面の世界の原点

def F(t):  # 秒 → フレーム(1 始まり)
    return int(round(t * FPS)) + 1

# ---------------------------------------------------------------- 基本
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, TOTAL_FRAMES
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.1
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.max_bounces = 3
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 4
scene.cycles.transparent_max_bounces = 6
scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False
scene.render.use_motion_blur = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False

def srgb(r, g, b, a=1.0):
    def c(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)

def material(name, color, rough=0.5, emission=None, estrength=0.0, alpha=1.0, sss=0.0, metallic=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if sss: bsdf.inputs["Subsurface Weight"].default_value = sss
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = estrength
    return m

def value_node(mat, name, v=0.0):
    n = mat.node_tree.nodes.new("ShaderNodeValue"); n.name = n.label = name; n.outputs[0].default_value = v
    return n

def key_value(mat, name, frame, v):
    n = mat.node_tree.nodes[name]; n.outputs[0].default_value = v
    n.outputs[0].keyframe_insert("default_value", frame=frame)

def key(obj, path, frame, value=None, index=-1):
    if value is not None: setattr(obj, path, value)
    obj.keyframe_insert(data_path=path, frame=frame, index=index)

def fcurves(id_data):
    """Blender 5 の階層アクションから F カーブを集める(id_data は Object / Camera / NodeTree)"""
    ad = id_data.animation_data
    if not ad or not ad.action: return []
    act = ad.action
    if hasattr(act, "fcurves") and not act.is_action_layered if hasattr(act, "is_action_layered") else False: return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags: out.extend(cb.fcurves)
    return out

def set_interp(obj, kind="BEZIER", path=None):
    for fc in fcurves(obj):
        if path and fc.data_path != path: continue
        for kp in fc.keyframe_points: kp.interpolation = kind

def link(obj, coll):
    for c in obj.users_collection: c.objects.unlink(obj)
    coll.objects.link(obj)

def new_coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c

def sphere(name, r, loc, mat, coll, seg=24, ring=12, scale=(1, 1, 1), parent=None, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=ring)
    o = bpy.context.object; o.name = name; o.scale = scale; o.data.materials.append(mat)
    if smooth: bpy.ops.object.shade_smooth()
    link(o, coll)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def cylinder_between(name, p1, p2, r, mat, coll, parent=None, verts=12, r2=None):
    p1, p2 = Vector(p1), Vector(p2); d = p2 - p1
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=verts, location=(p1 + p2) / 2)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=d.length, vertices=verts, location=(p1 + p2) / 2)
    o = bpy.context.object; o.name = name
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    o.data.materials.append(mat); bpy.ops.object.shade_smooth(); link(o, coll)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def poly_curve(name, points, radius, mat, coll, parent=None, smooth=True, resolution=12):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.fill_mode = "FULL"
    cu.bevel_depth = radius; cu.bevel_resolution = 4; cu.resolution_u = resolution; cu.use_fill_caps = True
    sp = cu.splines.new("NURBS" if smooth else "POLY"); sp.points.add(len(points) - 1)
    for p, pt in zip(sp.points, points): p.co = (*pt, 1.0)
    if smooth: sp.order_u = min(4, len(points)); sp.use_endpoint_u = True
    o = bpy.data.objects.new(name, cu); coll.objects.link(o); o.data.materials.append(mat)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def empty(name, loc, coll, parent=None):
    o = bpy.data.objects.new(name, None); o.location = loc; coll.objects.link(o)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def light(name, kind, loc, energy, coll, size=3.0, color=(1, 1, 1), target=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == "AREA": ld.size = size
    if kind == "SUN": ld.angle = 0.2
    o = bpy.data.objects.new(name, ld); o.location = loc; coll.objects.link(o)
    if target is not None: o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o

def ease(u):  # smoothstep
    u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)

# ---------------------------------------------------------------- 世界: 空と光
world = bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = srgb(0.86, 0.90, 0.95); bg.inputs[1].default_value = 0.6

# ================================================================ MACRO 世界: 腕と蚊
MAC = new_coll("macro")
ARM_R = 3.0
BITE = Vector((0.0, 0.0, 0.0))  # 刺す点(腕の頂点)

skin = material("Skin", srgb(0.90, 0.70, 0.56), rough=0.55)
nt = skin.node_tree; bsdf = nt.nodes["Principled BSDF"]
tc = nt.nodes.new("ShaderNodeTexCoord"); noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 18.0; noise.inputs["Detail"].default_value = 6.0
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12
nt.links.new(tc.outputs["Object"], noise.inputs["Vector"]); nt.links.new(noise.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
# 赤み: 刺した点(BiteEmpty)からの距離で減衰 × Redness
bite_empty = empty("BiteEmpty", BITE, MAC)
tco = nt.nodes.new("ShaderNodeTexCoord"); tco.object = bite_empty
ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.2; mr.inputs["From Max"].default_value = 1.7; mr.inputs["To Min"].default_value = 1.0; mr.inputs["To Max"].default_value = 0.0
red = value_node(skin, "Redness", 0.0); mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs[7].default_value = srgb(0.90, 0.70, 0.56); mix.inputs[6].default_value = srgb(0.86, 0.24, 0.20)
nt.links.new(tco.outputs["Object"], ln.inputs[0]); nt.links.new(ln.outputs["Value"], mr.inputs["Value"])
nt.links.new(mr.outputs["Result"], mul.inputs[0]); nt.links.new(red.outputs[0], mul.inputs[1])
nt.links.new(mul.outputs[0], mix.inputs["Factor"]); nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
mix.inputs["A"].default_value = srgb(0.90, 0.70, 0.56); mix.inputs["B"].default_value = srgb(0.86, 0.24, 0.20)

# 腕: x 方向に伸びる円柱(頂点が z=0)。膨らみ用に細かく割る
import bmesh
bm = bmesh.new(); NA, NL = 96, 64; L = 16.0
rows = []
for i in range(NL + 1):
    x = -L / 2 + L * i / NL; row = []
    for j in range(NA):
        a = 2 * math.pi * j / NA
        row.append(bm.verts.new((x, ARM_R * math.sin(a), -ARM_R + ARM_R * math.cos(a))))
    rows.append(row)
for i in range(NL):
    for j in range(NA):
        bm.faces.new((rows[i][j], rows[i][(j + 1) % NA], rows[i + 1][(j + 1) % NA], rows[i + 1][j]))
arm_me = bpy.data.meshes.new("Arm"); bm.to_mesh(arm_me); bm.free()
arm = bpy.data.objects.new("Arm", arm_me); MAC.objects.link(arm); arm.data.materials.append(skin)
for p in arm.data.polygons: p.use_smooth = True
arm.rotation_euler = (0, 0, math.radians(-18))
# 膨疹の形(シェイプキー): 刺した点の周りを法線方向に持ち上げる
arm.shape_key_add(name="Basis"); sk_bump = arm.shape_key_add(name="Bump")
for v in arm.data.vertices:
    d = (v.co - Vector((0, 0, 0))).length
    if d < 1.5:
        n = Vector((0, v.co.y, v.co.z + ARM_R)).normalized()
        sk_bump.data[v.index].co = v.co + n * 0.28 * (0.5 + 0.5 * math.cos(math.pi * d / 1.5))
# うぶ毛
hair = material("Hair", srgb(0.35, 0.25, 0.18), rough=0.6)
for i in range(28):
    a = random.uniform(-0.55, 0.55); x = random.uniform(-6, 6)
    base = Vector((x, ARM_R * math.sin(a), -ARM_R + ARM_R * math.cos(a)))
    if base.length < 0.9: continue
    n = Vector((0, base.y, base.z + ARM_R)).normalized()
    tip = base + n * 0.2 + Vector((random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), 0.1))
    h = cylinder_between(f"Hair{i}", base, tip, 0.005, hair, MAC, parent=arm, verts=6, r2=0.001)

# 蚊(体長 ≈ 1.3)
MOS = empty("Mosquito", (0, 0, 0), MAC)
m_body = material("MosquitoBody", srgb(0.22, 0.17, 0.14), rough=0.45)
m_dark = material("MosquitoDark", srgb(0.08, 0.06, 0.05), rough=0.35)
m_eye = material("MosquitoEye", srgb(0.05, 0.04, 0.06), rough=0.15)
m_wing = material("Wing", srgb(0.85, 0.88, 0.92), rough=0.2, alpha=0.22)
m_prob = material("Proboscis", srgb(0.12, 0.09, 0.08), rough=0.4)
# 体: 胸(前上がり)・腹(後ろへ細く)・頭
LEG_Z = 0.42  # 立ったときの胴の高さ
thorax = sphere("Thorax", 0.2, (0.05, 0, LEG_Z), m_body, MAC, scale=(1.25, 0.9, 1.0), parent=MOS)
# 腹: 節のある形(球を 6 つ連ねて細くする)
for i in range(6):
    r = 0.15 * (1 - i * 0.11)
    sphere(f"Abdomen{i}", r, (-0.22 - i * 0.14, 0, LEG_Z + 0.02 + i * 0.03), m_body if i % 2 == 0 else m_dark, MAC, scale=(1.3, 1, 1), parent=MOS)
head = sphere("Head", 0.12, (0.36, 0, LEG_Z + 0.04), m_body, MAC, parent=MOS)
sphere("EyeL", 0.075, (0.40, 0.085, LEG_Z + 0.06), m_eye, MAC, parent=MOS)
sphere("EyeR", 0.075, (0.40, -0.085, LEG_Z + 0.06), m_eye, MAC, parent=MOS)
for s in (1, -1):
    cylinder_between(f"Antenna{'L' if s > 0 else 'R'}", (0.42, 0.04 * s, LEG_Z + 0.10), (0.75, 0.22 * s, LEG_Z + 0.30), 0.012, m_dark, MAC, parent=MOS, verts=6, r2=0.004)
    cylinder_between(f"Palp{'L' if s > 0 else 'R'}", (0.44, 0.03 * s, LEG_Z + 0.02), (0.70, 0.07 * s, LEG_Z - 0.06), 0.012, m_dark, MAC, parent=MOS, verts=6, r2=0.006)
# 口器: 頭の前の支点から前下へ。刺すときに支点で回る
PIV = Vector((0.44, 0, LEG_Z + 0.01))
PROB_PIVOT = empty("ProboscisPivot", PIV, MAC, parent=MOS)
PROB_LEN = 0.62
PROB_END = PIV + Vector((PROB_LEN * math.cos(math.radians(-25)), 0, PROB_LEN * math.sin(math.radians(-25))))
# 子は「作ったときの世界座標」を保つ(親の逆行列)ので、支点からの相対ではなく世界座標で作る
proboscis = cylinder_between("ProboscisMacro", PIV, PROB_END, 0.013, m_prob, MAC, parent=PROB_PIVOT, verts=8, r2=0.004)
PROB_TIP = empty("ProboscisTip", PROB_END, MAC, parent=PROB_PIVOT)
# 脚 6 本(基節→腿節→脛節→跗節)。前脚は前へ、中脚は横へ、後脚は長く後ろへ上がる
LEGS = []
for s in (1, -1):
    for k, (bx, hip, knee, foot) in enumerate([
        (0.18, (0.30, 0.22, 0.75), (0.65, 0.45, 0.55), (1.00, 0.62, 0.0)),
        (0.02, (0.05, 0.30, 0.80), (0.00, 0.72, 0.55), (-0.10, 1.05, 0.0)),
        (-0.12, (-0.30, 0.25, 0.95), (-0.95, 0.55, 0.85), (-1.55, 0.75, 0.0)),
    ]):
        pts = [(bx, 0.12 * s, LEG_Z - 0.06), (hip[0], hip[1] * s, hip[2]), (knee[0], knee[1] * s, knee[2]), (foot[0], foot[1] * s, foot[2])]
        LEGS.append(poly_curve(f"Leg{k}{'L' if s > 0 else 'R'}", pts, 0.011, m_dark, MAC, parent=MOS, smooth=False))
# 翅 2 枚(胸の上から後ろへ)
WINGS = []
for s in (1, -1):
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=1.0, fill_type="NGON", location=(0, 0, 0))
    w = bpy.context.object; w.name = f"Wing{'L' if s > 0 else 'R'}"; w.data.materials.append(m_wing); link(w, MAC)
    w.scale = (0.55, 0.16, 1.0)
    # 付け根を胸の上に置く: 原点は楕円の中心なので、付け根が胸に来るように回転の支点を作る
    piv = empty(f"WingPivot{'L' if s > 0 else 'R'}", (0.02, 0.06 * s, LEG_Z + 0.2), MAC, parent=MOS)
    w.parent = piv; w.location = (-0.45, 0.12 * s, 0.0); w.rotation_euler = (0, 0, math.radians(12 * s))
    WINGS.append(piv)

# ---- macro のアニメーション
land, insert = SEG["land"], SEG["insert"]
f_land0, f_land1 = F(land["start"]), F(land["end"])
f_touch = F(land["start"] + min(2.4, (land["end"] - land["start"]) * 0.62))
# 飛来: 上の画面外から弧を描いて着地
MOS.rotation_euler = (0, 0, math.radians(20))
for f in range(f_land0, f_touch + 1):
    u = ease((f - f_land0) / max(1, f_touch - f_land0))
    bob = 0.06 * math.sin(f * 0.9) * (1 - u)
    MOS.location = (-0.9 * (1 - u) ** 1.2 + 0.0, 0.5 * (1 - u) ** 1.2, 1.7 * (1 - u) ** 1.4 + bob)
    MOS.rotation_euler = (math.radians(6 * (1 - u) * math.sin(f * 0.5)), math.radians(-10 * (1 - u)), math.radians(20))
    key(MOS, "location", f); key(MOS, "rotation_euler", f)
    for i, piv in enumerate(WINGS):
        s = 1 if i == 0 else -1
        piv.rotation_euler = (math.radians(55 * math.sin(f * 2.6 + i)) * s, 0, 0)
        key(piv, "rotation_euler", f)
# 着地後: 翅を閉じる(腹の上に重ねる)
for i, piv in enumerate(WINGS):
    s = 1 if i == 0 else -1
    piv.rotation_euler = (math.radians(4) * s, 0, 0); key(piv, "rotation_euler", f_touch + 8)
# 刺入: 体を前へ傾け、口器を支点で下へ回して皮膚へ(先端が表面より 0.35 下へ)
f_in0, f_in1 = F(insert["start"]), F(insert["start"] + 1.2)
PROB_PIVOT.rotation_euler = (0, 0, 0); key(PROB_PIVOT, "rotation_euler", f_in0 - 2)
key(MOS, "location", f_in0 - 2); key(MOS, "rotation_euler", f_in0 - 2)
PROB_PIVOT.rotation_euler = (0, math.radians(46), 0); key(PROB_PIVOT, "rotation_euler", f_in1)  # y 軸回りに下げる
MOS.location = (0.0, 0.0, -0.03); MOS.rotation_euler = (0, math.radians(14), math.radians(20)); key(MOS, "location", f_in1); key(MOS, "rotation_euler", f_in1)
# 腹がふくらむ(吸血)は見せない。刺したまま保持 → swell の段で退場(macro に戻る前)

# ================================================================ SECTION 世界: 皮膚の断面
SC = new_coll("section")
ROOT = empty("SectionRoot", SEC, SC)
X0, X1, Y0, Y1 = -4.0, 4.0, 0.0, 6.0
Z_TOP, Z_EPI, Z_DER, Z_BOT = 1.0, 0.4, -2.6, -5.2
m_epi = material("Epidermis", srgb(0.96, 0.86, 0.76), rough=0.6)
m_der = material("Dermis", srgb(0.95, 0.67, 0.64), rough=0.65)
m_sub = material("Subcutis", srgb(0.97, 0.90, 0.62), rough=0.7)
m_fat = material("Fat", srgb(0.98, 0.86, 0.45), rough=0.6)
# 真皮の赤み(swell)
ntd = m_der.node_tree; bd = ntd.nodes["Principled BSDF"]
redd = value_node(m_der, "Redness", 0.0)
tcd = ntd.nodes.new("ShaderNodeTexCoord"); vcenter = empty("DermisRedCenter", SEC + Vector((0.3, 0.0, -0.6)), SC); tcd.object = vcenter
lnd = ntd.nodes.new("ShaderNodeVectorMath"); lnd.operation = "LENGTH"
mrd = ntd.nodes.new("ShaderNodeMapRange"); mrd.inputs["From Min"].default_value = 0.6; mrd.inputs["From Max"].default_value = 3.2; mrd.inputs["To Min"].default_value = 1.0; mrd.inputs["To Max"].default_value = 0.0
muld = ntd.nodes.new("ShaderNodeMath"); muld.operation = "MULTIPLY"
mixd = ntd.nodes.new("ShaderNodeMix"); mixd.data_type = "RGBA"; mixd.inputs["A"].default_value = srgb(0.95, 0.67, 0.64); mixd.inputs["B"].default_value = srgb(0.90, 0.30, 0.28)
ntd.links.new(tcd.outputs["Object"], lnd.inputs[0]); ntd.links.new(lnd.outputs["Value"], mrd.inputs["Value"]); ntd.links.new(mrd.outputs["Result"], muld.inputs[0]); ntd.links.new(redd.outputs[0], muld.inputs[1])
ntd.links.new(muld.outputs[0], mixd.inputs["Factor"]); ntd.links.new(mixd.outputs[2], bd.inputs["Base Color"])

def slab(name, z0, z1, mat, nx=40, ny=12, swell=0.0, swell_bottom=False):
    """箱(上面を細かく割る)。swell>0 なら上面(と必要なら底面)を持ち上げるシェイプキーを持つ"""
    bm = bmesh.new()
    grid = [[bm.verts.new((X0 + (X1 - X0) * i / nx, Y0 + (Y1 - Y0) * j / ny, z1)) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    gridb = [[bm.verts.new((X0 + (X1 - X0) * i / nx, Y0 + (Y1 - Y0) * j / ny, z0)) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((gridb[i][j], gridb[i][j + 1], gridb[i + 1][j + 1], gridb[i + 1][j]))
    # 側面
    for i in range(nx):
        bm.faces.new((grid[i][0], gridb[i][0], gridb[i + 1][0], grid[i + 1][0]))
        bm.faces.new((grid[i][ny], grid[i + 1][ny], gridb[i + 1][ny], gridb[i][ny]))
    for j in range(ny):
        bm.faces.new((grid[0][j], grid[0][j + 1], gridb[0][j + 1], gridb[0][j]))
        bm.faces.new((grid[nx][j], gridb[nx][j], gridb[nx][j + 1], grid[nx][j + 1]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); SC.objects.link(o); o.data.materials.append(mat)
    o.parent = ROOT; o.matrix_parent_inverse = ROOT.matrix_world.inverted()
    if swell:
        o.shape_key_add(name="Basis"); sk = o.shape_key_add(name="Swell")
        for v in o.data.vertices:
            if abs(v.co.z - z1) < 1e-6 or (swell_bottom and abs(v.co.z - z0) < 1e-6):
                d = math.hypot(v.co.x - 0.3, (v.co.y - 0.0) * 0.8)
                if d < 2.6: sk.data[v.index].co = v.co + Vector((0, 0, swell * (0.5 + 0.5 * math.cos(math.pi * d / 2.6))))
    return o

epi = slab("EpidermisSlab", Z_EPI, Z_TOP, m_epi, swell=0.9, swell_bottom=True)
epi.data.materials.append(skin)  # 上面だけ肌の色
for p in epi.data.polygons:
    if p.normal.z > 0.5: p.material_index = 1
der = slab("DermisSlab", Z_DER, Z_EPI, m_der, swell=0.9)
sub = slab("SubcutisSlab", Z_BOT, Z_DER, m_sub)
# 皮下脂肪の小葉
for i in range(26):
    x = random.uniform(X0 + 0.4, X1 - 0.4); z = random.uniform(Z_BOT + 0.5, Z_DER - 0.45); y = random.uniform(-0.1, 1.2)
    sphere(f"Fat{i}", random.uniform(0.32, 0.5), SEC + Vector((x, y, z)), m_fat, SC, seg=16, ring=8, scale=(1.2, 1, 0.85), parent=ROOT)
# 基底層の線(表皮と真皮の境)
m_basal = material("Basal", srgb(0.85, 0.60, 0.55), rough=0.7)
cylinder_between("BasalLine", SEC + Vector((X0, -0.02, Z_EPI)), SEC + Vector((X1, -0.02, Z_EPI)), 0.035, m_basal, SC, parent=ROOT, verts=8)

# 血管(真皮の中を x 方向に走る、半分断面から出る)
m_vessel = material("Vessel", srgb(0.75, 0.12, 0.12), rough=0.35, alpha=0.55, emission=srgb(0.9, 0.1, 0.1), estrength=0.0)
VZ = -1.45
vessel = poly_curve("Vessel", [(X0 - 0.5, 0.05, VZ - 0.3), (-2.0, 0.05, VZ + 0.1), (0.0, 0.05, VZ - 0.1), (2.0, 0.05, VZ + 0.15), (X1 + 0.5, 0.05, VZ - 0.2)], 0.27, m_vessel, SC, parent=ROOT)
vessel.location = SEC
# 赤血球(血管の中を流れる)
m_rbc = material("RBC", srgb(0.85, 0.15, 0.15), rough=0.5)
RBCS = []
for i in range(14):
    o = sphere(f"RBC{i}", 0.09, SEC + Vector((X0 + i * 0.6, 0.05 + random.uniform(-0.08, 0.08), VZ + random.uniform(-0.1, 0.1))), m_rbc, SC, seg=12, ring=6, scale=(1.0, 1.0, 0.45), parent=ROOT)
    o.rotation_euler = (math.radians(random.uniform(-30, 30)), math.radians(random.uniform(-30, 30)), 0)
    RBCS.append(o)
# 神経: 皮下から上がって表皮近くで終わる(自由神経終末)
m_nerve = material("Nerve", srgb(0.96, 0.88, 0.55), rough=0.5, emission=srgb(1.0, 0.85, 0.35), estrength=0.0)
NERVE_PTS = [(-3.2, 0.0, Z_BOT + 0.3), (-2.4, 0.0, -3.6), (-1.2, 0.0, -2.9), (0.4, 0.0, -2.2), (1.3, 0.0, -1.0), (1.05, 0.0, -0.1), (0.95, 0.0, 0.25)]
nerve = poly_curve("Nerve", NERVE_PTS, 0.07, m_nerve, SC, parent=ROOT, resolution=24); nerve.location = SEC
nerve_branch = poly_curve("NerveBranch", [(0.4, 0.0, -2.2), (-0.3, 0.0, -1.6), (-0.5, 0.0, -0.9), (-0.2, 0.0, -0.3)], 0.045, m_nerve, SC, parent=ROOT); nerve_branch.location = SEC
nerve_end = sphere("NerveEnding", 0.12, SEC + Vector((0.95, 0.0, 0.25)), m_nerve, SC, seg=16, ring=8, parent=ROOT)
nerve_end2 = sphere("NerveEnding2", 0.09, SEC + Vector((-0.2, 0.0, -0.3)), m_nerve, SC, seg=16, ring=8, parent=ROOT)
# マスト細胞: 顆粒を抱えた大きな細胞と、表面の IgE(Y 字)
m_mast = material("MastCell", srgb(0.62, 0.55, 0.85), rough=0.5, alpha=0.6, sss=0.0)
m_gran = material("Granule", srgb(0.95, 0.50, 0.15), rough=0.4, emission=srgb(1.0, 0.45, 0.10), estrength=0.0)
m_nuc = material("Nucleus", srgb(0.35, 0.25, 0.60), rough=0.5)
m_ige = material("IgE", srgb(0.95, 0.95, 0.98), rough=0.4)
MAST_C = Vector((-1.15, 0.0, -0.85))
mast = sphere("MastCell", 0.55, SEC + MAST_C, m_mast, SC, seg=32, ring=16, parent=ROOT)
sphere("MastNucleus", 0.2, SEC + MAST_C + Vector((0.12, 0.1, -0.1)), m_nuc, SC, seg=16, ring=8, parent=ROOT)
GRANULES = []
for i in range(20):
    while True:
        p = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
        if 0.35 < p.length < 0.95: break
    GRANULES.append(sphere(f"Granule{i}", 0.075, SEC + MAST_C + p * 0.5, m_gran, SC, seg=10, ring=6, parent=ROOT))
IGE_TIPS = []
for i in range(9):
    a = math.radians(-70 + i * 20); d = Vector((math.cos(a), 0.0, math.sin(a)))
    base = SEC + MAST_C + d * 0.55; stem = base + d * 0.14
    cylinder_between(f"IgEStem{i}", base, stem, 0.016, m_ige, SC, parent=ROOT, verts=6)
    side = Vector((-d.z, 0, d.x))
    for s in (1, -1):
        tip = stem + d * 0.12 + side * 0.09 * s
        cylinder_between(f"IgEArm{i}{s}", stem, tip, 0.014, m_ige, SC, parent=ROOT, verts=6)
    IGE_TIPS.append(stem + d * 0.12)

# 口器(断面の世界の大きさで): 上から斜めに入り、先端は真皮の上部・血管の近く
m_prob_s = material("ProboscisSection", srgb(0.12, 0.09, 0.08), rough=0.4)
TIP = Vector((0.35, 0.0, -0.75))
PROB_DIR = Vector((-0.28, 0.0, 1.0)).normalized()
PROB_S = empty("ProboscisSectionRoot", SEC + TIP, SC, parent=ROOT)
cylinder_between("ProboscisS", SEC + TIP, SEC + TIP + PROB_DIR * 4.6, 0.05, m_prob_s, SC, parent=PROB_S, verts=10, r2=0.012)
cylinder_between("ProboscisSheath", SEC + TIP + PROB_DIR * 2.2, SEC + TIP + PROB_DIR * 4.6, 0.11, m_prob_s, SC, parent=PROB_S, verts=10, r2=0.13)
head_s = sphere("HeadS", 0.7, SEC + TIP + PROB_DIR * 5.1, m_body, SC, seg=20, ring=10, parent=PROB_S)
# 唾液: 先端から雲のように広がる
m_sal = material("Saliva", srgb(0.75, 0.95, 1.0), rough=0.3, emission=srgb(0.6, 0.95, 1.0), estrength=1.2, alpha=0.9)
SAL = [sphere(f"Saliva{i}", 0.05, SEC + TIP, m_sal, SC, seg=10, ring=6, parent=ROOT) for i in range(34)]
# 血漿のにじみ(swell)
m_plasma = material("Plasma", srgb(0.85, 0.93, 1.0), rough=0.2, alpha=0.6)
PLASMA = [sphere(f"Plasma{i}", 0.06, SEC + Vector((random.uniform(-1.5, 2.0), 0.05, VZ)), m_plasma, SC, seg=10, ring=6, parent=ROOT) for i in range(14)]
# 神経の信号(光の玉が神経を下る)
m_pulse = material("Pulse", srgb(1.0, 0.95, 0.6), rough=0.3, emission=srgb(1.0, 0.9, 0.4), estrength=6.0)
PULSES = []
for i in range(3):
    o = sphere(f"Pulse{i}", 0.11, SEC, m_pulse, SC, seg=12, ring=6, parent=ROOT)
    c = o.constraints.new("FOLLOW_PATH"); c.target = nerve; c.use_fixed_location = True; c.offset_factor = 1.0; c.use_curve_follow = False
    PULSES.append((o, c))
for o, c in PULSES:
    o.scale = (0, 0, 0); key(o, "scale", 1)

# ラベルの錨(画面座標に投影する点)
ANCH = {
    "表皮": empty("Anchor_表皮", SEC + Vector((-1.6, -0.05, 0.7)), SC, parent=ROOT),
    "真皮": empty("Anchor_真皮", SEC + Vector((-1.9, -0.05, -1.3)), SC, parent=ROOT),
    "皮下組織": empty("Anchor_皮下組織", SEC + Vector((-1.6, -0.05, -3.4)), SC, parent=ROOT),
    "唾液": empty("Anchor_唾液", SEC + TIP + Vector((0.5, -0.05, -0.1)), SC, parent=ROOT),
    "血管": empty("Anchor_血管", SEC + Vector((1.6, -0.05, VZ + 0.05)), SC, parent=ROOT),
    "マスト細胞": empty("Anchor_マスト細胞", SEC + MAST_C + Vector((0.0, -0.05, -0.85)), SC, parent=ROOT),
    "ヒスタミン": empty("Anchor_ヒスタミン", SEC + MAST_C + Vector((0.9, -0.05, 0.75)), SC, parent=ROOT),
    "神経": empty("Anchor_神経", SEC + Vector((1.55, -0.05, 0.05)), SC, parent=ROOT),
}

# 光(断面)
light("SecKey", "AREA", SEC + Vector((-3, -7, 6)), 2500, SC, size=6, target=SEC + Vector((0, 0, -1.5)))
light("SecFill", "AREA", SEC + Vector((5, -8, 0)), 900, SC, size=8, color=(0.9, 0.95, 1.0), target=SEC + Vector((0, 0, -1.5)))
light("SecRim", "AREA", SEC + Vector((0, 4, 6)), 600, SC, size=5, target=SEC)
# 光(腕)
light("Sun", "SUN", (3, -4, 8), 3.0, MAC, target=(0, 0, 0))
light("MacFill", "AREA", (-4, -5, 4), 400, MAC, size=6, color=(0.95, 0.97, 1.0), target=(0, 0, 0))

# ---- section のアニメーション
sec_, sal_, ves_, rec_, deg_, sti_, sig_, swe_ = (SEG[k] for k in ("section", "saliva", "vessel", "recognize", "degranulate", "stimulate", "signal", "swell"))
f_sec0 = F(sec_["start"])
# 口器: 断面の冒頭で上から刺さってくる(先端が表皮の上 → 真皮へ)
PROB_S.location = SEC + TIP + PROB_DIR * 2.4; key(PROB_S, "location", f_sec0)
PROB_S.location = SEC + TIP; key(PROB_S, "location", F(sec_["start"] + 1.1))
key(PROB_S, "location", F(swe_["start"]))
PROB_S.location = SEC + TIP + PROB_DIR * 5.5; key(PROB_S, "location", F(swe_["start"] + 0.9))
# 赤血球: 流れ続ける(x 方向に一定速度、循環)
for i, o in enumerate(RBCS):
    x0 = o.location.x
    o.location.x = x0; key(o, "location", 1, index=0)
    o.location.x = x0 + 8.0; key(o, "location", 1 + int(FPS * 5.0), index=0)
    fc = [c for c in fcurves(o) if c.data_path == "location" and c.array_index == 0][0]
    for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
    mod = fc.modifiers.new("CYCLES")
    o.location.x = x0
# 唾液: 先端から順に出て広がり、真皮の中に漂う。5 個はマスト細胞の IgE へ向かう(recognize)
targets_rec = IGE_TIPS[2:8]
for i, o in enumerate(SAL):
    t0 = sal_["start"] + 0.15 + (i / len(SAL)) * (sal_["end"] - sal_["start"] - 1.2)
    o.scale = (0, 0, 0); key(o, "scale", F(t0) - 1)
    o.location = SEC + TIP; key(o, "location", F(t0))
    o.scale = (1, 1, 1); key(o, "scale", F(t0) + 3)
    spread = Vector((random.uniform(-1.3, 0.9), random.uniform(-0.15, 0.15), random.uniform(-1.0, 0.5)))
    o.location = SEC + TIP + spread; key(o, "location", F(t0 + 1.6))
    if i < len(targets_rec):
        # 認識: IgE の先へ着く
        key(o, "location", F(rec_["start"]))
        o.location = targets_rec[i] + Vector((0, -0.03, 0)); key(o, "location", F(rec_["start"] + 1.3))
    else:
        drift = spread + Vector((random.uniform(-0.3, 0.3), 0, random.uniform(-0.3, 0.3)))
        o.location = SEC + TIP + drift; key(o, "location", F(ves_["end"]))
        key(o, "scale", F(rec_["end"]))
        o.scale = (0, 0, 0); key(o, "scale", F(deg_["start"] + 0.5))
# 脱顆粒: 顆粒が細胞の外へ出て、オレンジに光るヒスタミンとして血管と神経終末へ
f_deg0 = F(deg_["start"] + 0.6); f_deg1 = F(deg_["end"]); f_sti1 = F(sti_["end"])
mast.scale = (1, 1, 1); key(mast, "scale", f_deg0 - 6)
mast.scale = (1.12, 1.12, 1.12); key(mast, "scale", f_deg0 + 4)
mast.scale = (1.0, 1.0, 1.0); key(mast, "scale", f_deg0 + 14)
key_value(m_gran, "Emission Strength", 1, 0.0) if False else None
# 顆粒の発光は材質の Emission Strength をキーで
gb = m_gran.node_tree.nodes["Principled BSDF"]
gb.inputs["Emission Strength"].default_value = 0.0; gb.inputs["Emission Strength"].keyframe_insert("default_value", frame=f_deg0)
gb.inputs["Emission Strength"].default_value = 2.5; gb.inputs["Emission Strength"].keyframe_insert("default_value", frame=f_deg0 + 10)
hist_targets = []
for i, g in enumerate(GRANULES):
    p0 = g.location.copy(); d = (p0 - (SEC + MAST_C)); d.y = 0
    key(g, "location", f_deg0 + i // 4)
    g.location = SEC + MAST_C + d.normalized() * 0.72 + Vector((0, -0.08, 0)); key(g, "location", f_deg0 + 8 + i // 4)
    if i < 10: tgt = SEC + Vector((random.uniform(-0.8, 1.6), -0.12, VZ + random.uniform(0.25, 0.55)))  # 血管の上へ
    elif i < 16: tgt = SEC + Vector((0.95, 0, 0.25)) + Vector((random.uniform(-0.3, 0.3), -0.14, random.uniform(-0.3, 0.2)))  # 神経終末へ
    else: tgt = SEC + Vector((-0.2, 0, -0.3)) + Vector((random.uniform(-0.3, 0.3), -0.14, random.uniform(-0.3, 0.2)))  # 枝の終末へ
    hist_targets.append(tgt)
    g.location = tgt; key(g, "location", f_sti1 - 10 - (i % 5) * 4)
# 血管の拡張(stimulate): 太く・明るく
f_sti0 = F(sti_["start"])
vessel.scale = (1, 1, 1); key(vessel, "scale", f_sti0)
vessel.scale = (1, 1.5, 1.5); key(vessel, "scale", F(sti_["start"] + 1.6))
vb = m_vessel.node_tree.nodes["Principled BSDF"]
vb.inputs["Emission Strength"].default_value = 0.0; vb.inputs["Emission Strength"].keyframe_insert("default_value", frame=f_sti0)
vb.inputs["Emission Strength"].default_value = 0.6; vb.inputs["Emission Strength"].keyframe_insert("default_value", frame=F(sti_["start"] + 1.6))
# 神経の発光(stimulate 後半 → signal)
nb = m_nerve.node_tree.nodes["Principled BSDF"]
nb.inputs["Emission Strength"].default_value = 0.0; nb.inputs["Emission Strength"].keyframe_insert("default_value", frame=F(sti_["start"] + 1.4))
nb.inputs["Emission Strength"].default_value = 2.2; nb.inputs["Emission Strength"].keyframe_insert("default_value", frame=F(sti_["start"] + 2.4))
nb.inputs["Emission Strength"].default_value = 1.2; nb.inputs["Emission Strength"].keyframe_insert("default_value", frame=F(swe_["start"] + 1.0))
for k in range(3):
    nerve_end.scale = (1, 1, 1); key(nerve_end, "scale", F(sti_["start"] + 1.4 + k * 0.5))
    nerve_end.scale = (1.5, 1.5, 1.5); key(nerve_end, "scale", F(sti_["start"] + 1.65 + k * 0.5))
nerve_end.scale = (1.2, 1.2, 1.2); key(nerve_end, "scale", F(sti_["start"] + 3.0))
# 信号: 光の玉が神経終末(offset 1.0)から皮下(0.0)へ下る ×3
f_sig0 = F(sig_["start"])
for i, (o, c) in enumerate(PULSES):
    t0 = sig_["start"] + i * 0.55
    o.scale = (0, 0, 0); key(o, "scale", F(t0) - 1)
    o.scale = (1, 1, 1); key(o, "scale", F(t0) + 2)
    c.offset_factor = 1.0; o.keyframe_insert('constraints["Follow Path"].offset_factor', frame=F(t0))
    c.offset_factor = 0.0; o.keyframe_insert('constraints["Follow Path"].offset_factor', frame=F(t0 + 1.7))
    key(o, "scale", F(t0 + 1.7)); o.scale = (0, 0, 0); key(o, "scale", F(t0 + 1.8))
    fc = [f for f in fcurves(o) if "offset_factor" in f.data_path][0]
    for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
# 膨疹(swell): 真皮・表皮が持ち上がり、赤み、血漿のにじみ
f_sw0, f_sw1 = F(swe_["start"]), F(swe_["end"])
for o in (epi, der):
    sk = o.data.shape_keys.key_blocks["Swell"]
    sk.value = 0.0; sk.keyframe_insert("value", frame=f_sw0 + 4)
    sk.value = 1.0; sk.keyframe_insert("value", frame=f_sw1 - 6)
key_value(m_der, "Redness", f_sw0, 0.0); key_value(m_der, "Redness", f_sw1 - 8, 1.0)
for i, o in enumerate(PLASMA):
    t0 = swe_["start"] + 0.3 + i * 0.12
    x = o.location.x
    o.location = Vector((x, 0.05, SEC.z + VZ)); o.scale = (0, 0, 0); key(o, "scale", F(t0) - 1); key(o, "location", F(t0))
    o.scale = (1, 1, 1); key(o, "scale", F(t0) + 3)
    o.location = Vector((x + random.uniform(-0.4, 0.4), -0.05, SEC.z + VZ + random.uniform(0.6, 1.4))); key(o, "location", F(t0 + 1.8))
    o.scale = (1.6, 1.6, 1.6); key(o, "scale", F(t0 + 1.8))

# ---- macro(終盤): 蚊が飛び去り、赤い膨らみ。反応の強さの違い(varies)は膨らみの大小で見せる
mb_, va_, out_ = SEG["macro_bump"], SEG["varies"], SEG["outro"]
f_mb0 = F(mb_["start"])
# 蚊の退場: 口器を抜き、羽ばたいて上へ
key(PROB_PIVOT, "rotation_euler", f_mb0); PROB_PIVOT.rotation_euler = (0, 0, 0); key(PROB_PIVOT, "rotation_euler", f_mb0 + 10)
key(MOS, "location", f_mb0 + 8); key(MOS, "rotation_euler", f_mb0 + 8)
for f in range(f_mb0 + 8, f_mb0 + 40):
    u = ease((f - f_mb0 - 8) / 32)
    MOS.location = (0.6 * u, -1.2 * u, 0.0 + 5.5 * u * u); MOS.rotation_euler = (0, math.radians(14 - 30 * u), math.radians(20 + 40 * u))
    key(MOS, "location", f); key(MOS, "rotation_euler", f)
    for i, piv in enumerate(WINGS):
        s = 1 if i == 0 else -1
        piv.rotation_euler = (math.radians(55 * math.sin(f * 2.6 + i)) * s, 0, 0); key(piv, "rotation_euler", f)
# 膨らみと赤み: macro_bump で出る(前の段の断面で膨らんだ直後なので、はじめから少し出ている)
sk_bump.value = 0.0; sk_bump.keyframe_insert("value", frame=1)
sk_bump.value = 0.55; sk_bump.keyframe_insert("value", frame=f_mb0)
sk_bump.value = 1.0; sk_bump.keyframe_insert("value", frame=f_mb0 + 36)
key_value(skin, "Redness", 1, 0.0); key_value(skin, "Redness", f_mb0, 0.6); key_value(skin, "Redness", f_mb0 + 36, 1.0)
# varies: 大きく → 小さく → もとへ(人・蚊の種類で違う)
f_va0, f_va1 = F(va_["start"]), F(va_["end"])
sk_bump.keyframe_insert("value", frame=f_va0)
sk_bump.value = 1.8; sk_bump.keyframe_insert("value", frame=F(va_["start"] + 1.1))
sk_bump.value = 0.35; sk_bump.keyframe_insert("value", frame=F(va_["start"] + 2.4))
sk_bump.value = 1.0; sk_bump.keyframe_insert("value", frame=f_va1)
key_value(skin, "Redness", f_va0, 1.0); key_value(skin, "Redness", F(va_["start"] + 1.1), 1.4); key_value(skin, "Redness", F(va_["start"] + 2.4), 0.45); key_value(skin, "Redness", f_va1, 1.0)

# ================================================================ カメラ
cam_data = bpy.data.cameras.new("Camera"); cam_data.lens = 50; cam_data.sensor_fit = "VERTICAL"; cam_data.sensor_height = 24
cam = bpy.data.objects.new("Camera", cam_data); scene.collection.objects.link(cam); scene.camera = cam
cam_data.clip_start = 0.05; cam_data.clip_end = 300

CUTS = []
def cam_key(frame, loc, look, lens=50, cut=False):
    cam.location = Vector(loc); cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    key(cam, "location", frame); key(cam, "rotation_euler", frame)
    cam_data.lens = lens; cam_data.keyframe_insert("lens", frame=frame)
    if cut: CUTS.append(frame)

# macro: 着地(腕を斜め上から)→ 刺入(頭へ寄る)→ 皮膚へ飛び込む
cam_key(F(land["start"]), (3.0, -4.6, 2.2), (-0.3, 0.3, 0.6), 50)
cam_key(f_touch, (2.3, -3.4, 1.6), (0.0, 0.1, 0.35), 55)
cam_key(F(land["end"]), (1.9, -2.9, 1.2), (0.1, 0.0, 0.3), 60)
cam_key(F(insert["start"] + 1.2), (1.7, -2.3, 0.65), (0.5, 0.15, 0.15), 50)
cam_key(F(insert["end"] - 0.7), (1.55, -2.1, 0.55), (0.55, 0.15, 0.1), 52)
cam_key(F(insert["end"]) - 1, (0.95, -0.5, 0.18), (0.9, 0.1, -0.1), 85)
# section: 表皮の上の口器から引いて層が見える → 先端へ寄る → 血管 → マスト細胞 → 脱顆粒 → 血管と神経 → 信号 → 全体
S = lambda x, y, z: SEC + Vector((x, y, z))
cam_key(F(sec_["start"]), S(0.3, -4.4, 1.9), S(0.3, 0, 0.5), 40, cut=True)
cam_key(F(sec_["start"] + 1.6), S(-0.2, -11.0, -0.2), S(-0.2, 0, -1.5), 40)
cam_key(F(sec_["end"]), S(-0.2, -11.0, -0.2), S(-0.2, 0, -1.5), 40)
cam_key(F(sal_["start"] + 1.0), S(0.1, -5.0, -0.2), S(0.2, 0, -0.9), 40)
cam_key(F(sal_["end"]), S(0.1, -5.0, -0.2), S(0.2, 0, -0.9), 40)
cam_key(F(ves_["start"] + 1.0), S(0.6, -5.4, -0.8), S(0.7, 0, -1.4), 40)
cam_key(F(ves_["end"]), S(0.6, -5.4, -0.8), S(0.7, 0, -1.4), 40)
cam_key(F(rec_["start"] + 1.0), S(-0.9, -4.4, -0.4), S(-0.9, 0, -0.9), 40)
cam_key(F(rec_["end"]), S(-0.9, -4.4, -0.4), S(-0.9, 0, -0.9), 40)
cam_key(F(deg_["start"] + 1.5), S(-0.4, -6.4, -0.5), S(-0.3, 0, -1.0), 40)
cam_key(F(deg_["end"]), S(-0.4, -6.4, -0.5), S(-0.3, 0, -1.0), 40)
cam_key(F(sti_["start"] + 1.2), S(0.6, -6.6, -0.3), S(0.7, 0, -0.8), 40)
cam_key(F(sti_["end"]), S(0.6, -6.6, -0.3), S(0.7, 0, -0.8), 40)
cam_key(F(sig_["start"] + 1.6), S(-0.3, -9.5, -1.2), S(-0.2, 0, -2.0), 40)
cam_key(F(sig_["end"]), S(-0.3, -9.5, -1.2), S(-0.2, 0, -2.0), 40)
cam_key(F(swe_["start"] + 1.4), S(0.2, -11.0, 0.4), S(0.2, 0, -0.9), 40)
cam_key(F(swe_["end"]), S(0.2, -11.0, 0.4), S(0.2, 0, -0.9), 40)
# macro(終盤): 膨らみを斜め上から。ゆっくり寄って、最後にゆっくり引く
cam_key(F(mb_["start"]), (2.6, -3.6, 1.3), (-0.2, 0.2, 0.45), 50, cut=True)
cam_key(F(va_["end"]), (2.1, -2.9, 0.95), (0.0, 0.1, 0.3), 55)
cam_key(F(out_["end"]) + int(FPS * TIMING["end_hold"]), (2.4, -3.4, 1.2), (-0.1, 0.15, 0.4), 50)
# カット: 直前のキーを CONSTANT にして、間を補間しない
for fc in fcurves(cam):
    pts = sorted(fc.keyframe_points, key=lambda k: k.co.x)
    for i, kp in enumerate(pts):
        kp.interpolation = "BEZIER"
        if i + 1 < len(pts) and int(pts[i + 1].co.x) in CUTS: kp.interpolation = "CONSTANT"
for fc in fcurves(cam_data):
    pts = sorted(fc.keyframe_points, key=lambda k: k.co.x)
    for i, kp in enumerate(pts):
        if i + 1 < len(pts) and int(pts[i + 1].co.x) in CUTS: kp.interpolation = "CONSTANT"

# ================================================================ 書き出し: ラベルの錨と検証値
def project(obj_or_vec, frame):
    scene.frame_set(frame)
    p = obj_or_vec.matrix_world.translation if hasattr(obj_or_vec, "matrix_world") else obj_or_vec
    v = world_to_camera_view(scene, cam, p)
    return [round(v.x * W, 1), round((1 - v.y) * H, 1), round(v.z, 3)]

anchors = {}
for line in SCRIPT["lines"]:
    seg = SEG[line["cue"]]
    for lab in line.get("labels", []):
        a = ANCH[lab]
        f0, f1 = F(seg["start"] + 0.5), F(seg["end"]) - 2
        anchors.setdefault(lab, {"frames": {}, "start": f0, "end": f1})
        for f in range(f0, f1 + 1):
            anchors[lab]["frames"][f] = project(a, f)
json.dump(anchors, open(WORK / "anchors.json", "w", encoding="utf-8"), ensure_ascii=False)

# 検証値: 口器の先端と皮膚の位置関係、蚊の部品数、カメラのカット位置
qa = {"cuts": CUTS, "total_frames": TOTAL_FRAMES, "fps": FPS}
scene.frame_set(F(insert["start"] + 1.4))
tip = PROB_TIP.matrix_world.translation
arm_inv = arm.matrix_world.inverted(); tl = arm_inv @ tip
surface_z = -ARM_R + math.sqrt(max(0.0, ARM_R ** 2 - tl.y ** 2))
qa["macro_tip_depth_below_skin"] = round(surface_z - tl.z, 3)
scene.frame_set(F(insert["start"]) - 2); tip2 = arm_inv @ PROB_TIP.matrix_world.translation
qa["macro_tip_depth_before_insert"] = round((-ARM_R + math.sqrt(max(0.0, ARM_R ** 2 - tip2.y ** 2))) - tip2.z, 3)
scene.frame_set(F(sal_["start"]))
tp = PROB_S.matrix_world.translation - SEC
qa["section_tip"] = [round(c, 3) for c in tp]; qa["section_layers"] = {"top": Z_TOP, "epidermis_bottom": Z_EPI, "dermis_bottom": Z_DER}
qa["section_tip_in_dermis"] = bool(Z_DER < tp.z < Z_EPI)
scene.frame_set(F(swe_["start"] + 1.0)); tp2 = PROB_S.matrix_world.translation - SEC; qa["section_tip_withdrawn_z"] = round(tp2.z, 3)
qa["mosquito_parts"] = {"legs": len(LEGS), "wings": len(WINGS), "proboscis": 1, "antennae": 2, "eyes": 2}
qa["segments"] = {k: [F(v["start"]), F(v["end"])] for k, v in SEG.items()}
# 各区間の「意味のある変化」(キーが打たれているフレームの数)
all_keyframes = set()
for o in bpy.data.objects:
    for fc in fcurves(o):
        for kp in fc.keyframe_points: all_keyframes.add(int(kp.co.x))
for m in bpy.data.materials:
    if m.node_tree:
        for fc in fcurves(m.node_tree):
            for kp in fc.keyframe_points: all_keyframes.add(int(kp.co.x))
qa["keyframes_per_segment"] = {k: sum(1 for f in all_keyframes if F(v["start"]) <= f <= F(v["end"])) for k, v in SEG.items()}
json.dump(qa, open(WORK / "qa_scene.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

blend = Path(arg("--blend", WORK / "scene.blend"))
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
print("scene ok:", blend, TOTAL_FRAMES, "frames; cuts", CUTS)

if arg("--stills"):
    outdir = Path(arg("--stilldir", WORK / "stills")); outdir.mkdir(parents=True, exist_ok=True)
    res = int(arg("--res", "432"))
    scene.render.resolution_x, scene.render.resolution_y = res, int(res * 16 / 9)
    scene.cycles.samples = 12
    for t in arg("--stills").split(","):
        f = F(float(t)) if "f" not in t else int(t.strip("f"))
        scene.frame_set(f); scene.render.filepath = str(outdir / f"t{float(t) if 'f' not in t else f:0>6}.png")
        bpy.ops.render.render(write_still=True)
    print("stills ok:", outdir)
