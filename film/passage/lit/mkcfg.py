# python3 mkcfg.py scene.json out_dir times... : bible の光(P1)の設定を、その場面の V に合わせて作る
import json, sys
scene, out = sys.argv[1], sys.argv[2]; times = [float(t) for t in sys.argv[3].split(',')]
extra = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
S = json.load(open(scene)); vz = S['hall']['vpl'][1]; zPar = S['hall']['zPar']
cut = [
 {"frame":"FI","box":[-2.4,-1.2,2.6,3.4,3.0,-8.0]},
 {"frame":"FI","box":[-2.4,-0.6,2.6,3.4,-9.0,-15.0]},
 {"frame":"FT","box":[-4.8,4.8,4.1,4.8,-3.0,-4.2]},
 {"frame":"FT","box":[-4.8,4.8,4.1,4.8,-6.6,-7.8]},
 {"frame":"FT","box":[-4.8,4.8,4.1,4.8,-9.9,-11.1]},
 {"frame":"FC","box":[-10.8,10.8,11.9,12.6,vz-21.0,-42.0]},
 {"frame":"FC","box":[-9.6,9.6,11.9,12.6,vz+2.4,zPar]},
]
adds = [
 {"frame":"FC","box":[-10.8,10.8,12.0,24.0,-43.2,-42.0]},
 {"frame":"FC","box":[-10.8,-9.6,12.0,24.0,-42.0,vz-21.0]},
 {"frame":"FC","box":[9.6,10.8,12.0,24.0,-42.0,vz-21.0]},
 {"frame":"FC","box":[-10.8,10.8,24.0,24.45,-42.0,vz-21.0]},
]
c = {"scene": scene, "out": out, "style": "bible", "view": "Standard", "exposure": 0,
 "albedo": {"wall":"#EAE9E6","ceil":"#EAE9E6","floor":"#C5C1BA","navy":"#142039","dawn":"#9D855C","sandplate":"#E1BF85"},
 "sun": {"dir":[-0.2106,0.7880,0.5785],"strength":3.4,"angle":0.53,"color":[1,1,1]}, "sky": {"color":[1,1,1],"strength":3.0},
 "cutters": cut, "adds": adds, "res": [960,540], "samples": 48, "adaptive": 0.03, "bounces": 8, "diffuse_bounces": 4,
 "plate_denoise_exclude": True, "times": times}
c.update(extra)
json.dump(c, open(out + '/cfg.json', 'w'), indent=1)
print(out + '/cfg.json')
