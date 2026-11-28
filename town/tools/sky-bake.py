# 町の7棟の「空の見え方」(距離を限った環境遮蔽)を焼く。入力は sky-export.mjs の OBJ、出力は 8bit の灰色の PNG(色は焼かない)
# python sky-bake.py <入力.obj> <出力.png> [遮る距離=0.7] [サンプル=256]   (bpy が要る: pip install bpy)
# 1回目: 前の壁(p1)と屋根(p2)を外した開いた状態で、ほかの部品を焼く(ひらいたときに内側の壁が真っ黒にならないように)
# 2回目: 閉じた状態で、前の壁と屋根だけを焼き足す。地面はどちらも遮る物としてだけ使う
import bpy, sys, time
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
dist = float(argv[2]) if len(argv) > 2 else 0.7
samples = int(argv[3]) if len(argv) > 3 else 256
W, H = 2048, 1536   # skymap.js の SKY.W・SKY.H と同じ

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = dist
img = bpy.data.images.new('sky', W, H, alpha=False, float_buffer=False)
img.colorspace_settings.name = 'Non-Color'
img.generated_color = (1, 1, 1, 1)
mat = bpy.data.materials.new('m')
nt = mat.node_tree if mat.node_tree else None
if nt is None:
    mat.use_nodes = True; nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
objs = [o for o in sc.objects if o.type == 'MESH']
for o in objs:
    o.data.materials.clear(); o.data.materials.append(mat)
def join(lst, name):   # 部品ごとに焼くと待ちが長いので、1つの物にまとめてから焼く(貼り位置はそのまま)
    if not lst: return []
    bpy.ops.object.select_all(action='DESELECT')
    for o in lst: o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]; bpy.ops.object.join(); lst[0].name = name
    return [lst[0]]
moving = [o for o in objs if o.name.endswith('_p1') or o.name.endswith('_p2')]
body = [o for o in objs if o not in moving and not o.name.startswith('ground')]
nb, nm = len(body), len(moving)
body, moving = join(body, 'body'), join(moving, 'moving')
sc.render.bake.margin = 3
sc.render.bake.margin_type = 'EXTEND'

def bake(sel, clear):
    bpy.ops.object.select_all(action='DESELECT')
    for o in sel: o.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    sc.render.bake.use_clear = clear
    t = time.time(); bpy.ops.object.bake(type='AO', margin=3, use_clear=clear)
    return round(time.time() - t, 1)

for o in moving: o.hide_render = True
t1 = bake(body, True)
for o in moving: o.hide_render = False
t2 = bake(moving, False) if moving else 0
img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('sky-bake', {'body': nb, 'moving': nm, 'sec': [t1, t2], 'dist': dist, 'samples': samples})
