/* ================================================================
   融合3「ひらく町」— 仮の中(床と箱だけ)。本当の中(interiors.js)が届くまで、ひらく動き・カメラ・パネルを仕上げるために使う
   約束(BRIEF 9.9)と同じ形: buildInterior(kind, box, ctx) → { group, stations, update, setNight, dispose }
   ================================================================ */
import * as THREE from 'three';
import { BY_ID, TOOLS } from './data.js';

export function buildInterior(kind, box, ctx) {
  const P = ctx.palette, group = new THREE.Group(), disposables = [];
  const mat = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? .85 }); disposables.push(m); return m; };
  const wallM = mat(P.wallIn), floorM = mat(P.floor), woodM = mat(P.wood), darkM = mat(P.dark);
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; group.add(o); disposables.push(g); return o; };
  const { w, d, h, floors } = box, tower = box.shape === 'tower', open = box.shape === 'open';
  const fh = floors ? h / floors : h;
  if (!open) {
    if (tower) {
      const r = w / 2, cg = new THREE.CylinderGeometry(r, r, h, 24, 1, true, Math.PI / 2, Math.PI); const inner = add(cg, mat(P.wallIn), 0, h / 2, 0); inner.material.side = THREE.BackSide;
      for (let f = 0; f < floors; f++) add(new THREE.CylinderGeometry(r - .005, r - .005, .05, 24), floorM, 0, f * fh + .025, 0);
    } else {
      add(new THREE.BoxGeometry(.02, h, d - .04), wallM, -w / 2 + .01, h / 2, -.02);
      add(new THREE.BoxGeometry(.02, h, d - .04), wallM, w / 2 - .01, h / 2, -.02);
      add(new THREE.BoxGeometry(w, h, .02), wallM, 0, h / 2, -d / 2 + .01);
      for (let f = 0; f < floors; f++) add(new THREE.BoxGeometry(w, .05, d - .04), floorM, 0, f * fh + .025, -.02);
      add(new THREE.BoxGeometry(w, .05, d - .04), mat(P.ceil), 0, h - .025, -.02);
    }
  }
  // 道具の物(机と画面)。画面は実際の画面のサムネイルを貼る
  const b = BY_ID[kind], ids = b ? b.tools : [], stations = [];
  ids.forEach((id, i) => {
    const f = floors ? i % floors : 0, k = floors ? Math.floor(i / floors) : i, per = Math.ceil(ids.length / Math.max(1, floors));
    const x = tower ? (k - (per - 1) / 2) * .34 : (k - (per - 1) / 2) * Math.min(.8, (w - .4) / Math.max(1, per)), y = (floors ? f * fh : 0) + .05, z = tower ? -.1 : open ? (i % 2 ? -.6 : .4) : -d * .15;
    const desk = add(new THREE.BoxGeometry(.32, .2, .2), woodM, x, y + .1, z);
    const sm = new THREE.MeshBasicMaterial({ color: '#9AA3AA' }); disposables.push(sm);
    const scr = add(new THREE.PlaneGeometry(.3, .19), sm, x, y + .34, z - .02); scr.castShadow = false;
    add(new THREE.BoxGeometry(.32, .21, .015), darkM, x, y + .34, z - .03);
    const t = TOOLS[id];
    if (t && t.thumb) ctx.loadTexture('../../../images/products/thumbs/' + t.thumb + '.webp').then(tex => { sm.map = tex; sm.color.set('#D9DCDD'); sm.needsUpdate = true; }).catch(() => {});
    const base = scr.position.y;
    stations.push({
      id, label: t ? t.name : id, anchor: new THREE.Vector3(x, y + .5, z), radius: .22,
      setActive(on) { sm.color.set(on ? '#FFFFFF' : (sm.map ? '#D9DCDD' : '#9AA3AA')); scr.position.y = base + (on ? .03 : 0); desk.position.y = y + .1 + (on ? .02 : 0); },
      setHover(on) { scr.scale.setScalar(on ? 1.06 : 1); }
    });
  });
  return {
    group, stations,
    update() {},
    setNight() {},
    dispose() { for (const o of disposables) o.dispose && o.dispose(); }
  };
}
