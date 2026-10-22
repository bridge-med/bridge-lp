// CHRONOS — HDR post pipeline: temporal accumulation, dual-kawase bloom, anamorphic streak, god rays, ACES composite
import * as THREE from 'three';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
void main(){
  vec3 c = 0.25 * (texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + texel * vec2(0.5, -0.5)).rgb + texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + texel * vec2(0.5, 0.5)).rgb);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = threshold * 0.5;
  float s = clamp(l - threshold + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-5);
  float f = max(s, l - threshold) / max(l, 1e-5);
  gl_FragColor = vec4(c * f, 1.0);
}`;

const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec2 o = texel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 texel; uniform float addWeight; varying vec2 vUv;
void main(){
  vec2 o = texel;
  vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += 2.0 * (texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb);
  gl_FragColor = vec4(c / 12.0 + texture2D(tAdd, vUv).rgb * addWeight, 1.0);
}`;

const STREAK = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float stepPx; varying vec2 vUv;
void main(){
  vec3 c = vec3(0.0); float wsum = 0.0;
  for (int i = -8; i <= 8; i++) { float w = 1.0 - abs(float(i)) / 9.0; w *= w; c += texture2D(tSrc, vUv + vec2(float(i) * stepPx * texel.x, 0.0)).rgb * w; wsum += w; }
  gl_FragColor = vec4(c / wsum, 1.0);
}`;

const GOD = /* glsl */`
uniform sampler2D tSrc; uniform vec2 center; uniform float density, decay, weight; varying vec2 vUv;
void main(){
  vec2 uv = vUv; vec2 d = (center - uv) * density / 48.0;
  vec3 c = vec3(0.0); float w = 1.0;
  for (int i = 0; i < 48; i++) { uv += d; c += texture2D(tSrc, uv).rgb * w; w *= decay; }
  gl_FragColor = vec4(c * weight, 1.0);
}`;

const ACCUM = /* glsl */`
uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`;

const COMPOSITE = /* glsl */`
uniform sampler2D tScene, tBloom, tStreak, tGod; uniform vec2 res; uniform float bloom, streak, god, exposure, vignette, ca, grain, time, fade, contrast, saturation;
varying vec2 vUv;
vec3 ACESFit(vec3 c){
  const mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = IN * c;
  vec3 a = c * (c + 0.0245786) - 0.000090537; vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;
  c = a / b;
  return clamp(OUT * c, 0.0, 1.0);
}
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 q = vUv - 0.5; float r2 = dot(q, q);
  vec2 d = q * r2 * ca * 8.0 / res.x;
  vec3 col;
  col.r = texture2D(tScene, vUv + d).r; col.g = texture2D(tScene, vUv).g; col.b = texture2D(tScene, vUv - d).b;
  col += texture2D(tBloom, vUv).rgb * bloom;
  col += texture2D(tStreak, vUv).rgb * streak * vec3(0.75, 0.9, 1.0);
  col += texture2D(tGod, vUv).rgb * god;
  col *= exposure / 0.6;
  col = ACESFit(col);
  // grade: cool shadows, warm highlights, contrast
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = mix(col, col * vec3(0.92, 0.98, 1.08), (1.0 - l) * 0.35);
  col = mix(col, col * vec3(1.06, 1.0, 0.94), l * l * 0.25);
  col = (col - 0.5) * contrast + 0.5;
  float v = 1.0 - vignette * smoothstep(0.15, 0.95, length(q * vec2(res.x / res.y, 1.0)) * 0.9);
  col *= v;
  float g = (hash(vUv * res + fract(time * 7.13) * 100.0) - 0.5) * grain * (1.0 - l * 0.6);
  col += g;
  col = clamp(col * fade, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}`;

function rt(w, h, type = THREE.HalfFloatType, depth = false, samples = 0) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type, depthBuffer: depth, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples });
}

export class Post {
  constructor(renderer, w, h, { msaa = 0 } = {}) {
    this.renderer = renderer; this.msaa = msaa;
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mPre = mk(PREFILTER, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.0 } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() }, addWeight: { value: 1 } });
    this.mStreak = mk(STREAK, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, stepPx: { value: 1 } });
    this.mGod = mk(GOD, { tSrc: { value: null }, center: { value: new THREE.Vector2(0.5, 0.5) }, density: { value: 0.9 }, decay: { value: 0.96 }, weight: { value: 0.08 } });
    this.mAccum = mk(ACCUM, { tSrc: { value: null }, weight: { value: 1 } }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });
    this.mComp = mk(COMPOSITE, { tScene: { value: null }, tBloom: { value: null }, tStreak: { value: null }, tGod: { value: null }, res: { value: new THREE.Vector2() }, bloom: { value: 0.35 }, streak: { value: 0.1 }, god: { value: 0 }, exposure: { value: 1 }, vignette: { value: 0.45 }, ca: { value: 1.0 }, grain: { value: 0.03 }, time: { value: 0 }, fade: { value: 1 }, contrast: { value: 1.04 }, saturation: { value: 1.05 } });
    this.black = rt(2, 2); // zero texture for disabled passes
    this.setSize(w, h);
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    this.dispose(true);
    this.sceneRT = rt(w, h, THREE.HalfFloatType, true, this.msaa);
    this.accumRT = rt(w, h, THREE.FloatType, false, 0);
    this.half = rt(w >> 1, h >> 1);
    this.mips = []; this.tmps = [];
    let mw = w >> 2, mh = h >> 2;
    for (let i = 0; i < 5; i++) { this.mips.push(rt(mw, mh)); this.tmps.push(rt(mw, mh)); mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); }
    this.bloomRT = rt(w >> 1, h >> 1);
    this.streakA = rt(w >> 2, h >> 2); this.streakB = rt(w >> 2, h >> 2);
    this.godRT = rt(w >> 1, h >> 1);
    this.mComp.uniforms.res.value.set(w, h);
  }

  dispose(onlyTargets = false) {
    for (const k of ['sceneRT', 'accumRT', 'half', 'bloomRT', 'streakA', 'streakB', 'godRT']) if (this[k]) { this[k].dispose(); this[k] = null; }
    for (const r of (this.mips || [])) r.dispose(); for (const r of (this.tmps || [])) r.dispose();
    this.mips = []; this.tmps = [];
    if (!onlyTargets) { this.black.dispose(); }
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.cam);
  }

  beginScene() { this.renderer.setRenderTarget(this.sceneRT); this.renderer.clear(); return this.sceneRT; }

  // add the current sceneRT into the accumulation buffer
  accumulate(weight, first) {
    this.mAccum.uniforms.tSrc.value = this.sceneRT.texture; this.mAccum.uniforms.weight.value = weight;
    const r = this.renderer; const ac = r.autoClear; r.autoClear = false;
    r.setRenderTarget(this.accumRT); if (first) r.clear(true, false, false);
    this.quad.material = this.mAccum; r.render(this.quadScene, this.cam);
    r.autoClear = ac;
  }

  compose(p, useAccum) {
    const r = this.renderer; const src = useAccum ? this.accumRT.texture : this.sceneRT.texture;
    // bright pass to half
    this.mPre.uniforms.tSrc.value = src; this.mPre.uniforms.texel.value.set(1 / this.w, 1 / this.h); this.mPre.uniforms.threshold.value = p.threshold ?? 1.0;
    this._pass(this.mPre, this.half);
    // down chain
    let prev = this.half;
    for (let i = 0; i < this.mips.length; i++) { this.mDown.uniforms.tSrc.value = prev.texture; this.mDown.uniforms.texel.value.set(0.5 / prev.width, 0.5 / prev.height); this._pass(this.mDown, this.mips[i]); prev = this.mips[i]; }
    // up chain
    // up chain: each finer level is added with increasing weight so the halo stays tight (deep mips give a faint wide glow only)
    const W = [1.4, 1.2, 1.0, 0.8, 0.6];
    let acc = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) { this.mUp.uniforms.tSrc.value = acc.texture; this.mUp.uniforms.tAdd.value = this.mips[i].texture; this.mUp.uniforms.texel.value.set(1 / acc.width, 1 / acc.height); this.mUp.uniforms.addWeight.value = W[i] * (i === this.mips.length - 2 ? 1 / W[4] : 1); this._pass(this.mUp, this.tmps[i]); acc = this.tmps[i]; }
    this.mUp.uniforms.tSrc.value = acc.texture; this.mUp.uniforms.tAdd.value = this.half.texture; this.mUp.uniforms.texel.value.set(1 / acc.width, 1 / acc.height); this.mUp.uniforms.addWeight.value = 0.8; this._pass(this.mUp, this.bloomRT);
    // streak from mip0 (quarter res)
    let streakTex = this.black.texture;
    if ((p.streak ?? 0) > 0) {
      this.mStreak.uniforms.tSrc.value = this.mips[0].texture; this.mStreak.uniforms.texel.value.set(1 / this.streakA.width, 1 / this.streakA.height); this.mStreak.uniforms.stepPx.value = 1.5; this._pass(this.mStreak, this.streakA);
      this.mStreak.uniforms.tSrc.value = this.streakA.texture; this.mStreak.uniforms.stepPx.value = 6.0; this._pass(this.mStreak, this.streakB);
      this.mStreak.uniforms.tSrc.value = this.streakB.texture; this.mStreak.uniforms.stepPx.value = 20.0; this._pass(this.mStreak, this.streakA);
      streakTex = this.streakA.texture;
    }
    // god rays
    let godTex = this.black.texture;
    if ((p.god ?? 0) > 0) {
      this.mGod.uniforms.tSrc.value = this.half.texture; this.mGod.uniforms.center.value.copy(p.godPos || new THREE.Vector2(0.5, 0.5)); this.mGod.uniforms.density.value = p.godDensity ?? 0.9; this.mGod.uniforms.decay.value = p.godDecay ?? 0.965; this.mGod.uniforms.weight.value = 0.06;
      this._pass(this.mGod, this.godRT); godTex = this.godRT.texture;
    }
    const u = this.mComp.uniforms;
    u.tScene.value = src; u.tBloom.value = this.bloomRT.texture; u.tStreak.value = streakTex; u.tGod.value = godTex;
    u.bloom.value = p.bloom ?? 0.35; u.streak.value = p.streak ?? 0; u.god.value = p.god ?? 0; u.exposure.value = p.exposure ?? 1; u.vignette.value = p.vignette ?? 0.45;
    u.ca.value = p.ca ?? 1.0; u.grain.value = p.grain ?? 0.03; u.time.value = p.time ?? 0; u.fade.value = p.fade ?? 1; u.contrast.value = p.contrast ?? 1.04; u.saturation.value = p.saturation ?? 1.05;
    this._pass(this.mComp, null);
  }
}
