// CHRONOS — materials: analytic studio environment, procedural windows & panel seams, per-instance glow, height AO
import * as THREE from 'three';

// Shared uniforms (same objects across materials so one update reaches all)
export const SHARED = {
  uTime: { value: 0 },
  uAwake: { value: 0 },            // 0..1+ city wake-up progress (windows switch on)
  uWave: { value: new THREE.Vector4(0, 0, -1000, 30) }, // center x, z, radius, width
  uWaveI: { value: 0 },            // wave glow intensity
  uEnvIntensity: { value: 1.0 },
  uWindowIntensity: { value: 1.0 },
};

const ENV_PARS = /* glsl */`
uniform float uEnvIntensity;
vec3 chronosEnvRadiance(vec3 d, float rough) {
  float w = mix(0.05, 0.6, rough);
  // graphite studio: dark floor, bright soft horizon cyclorama, broad overhead softbox, cyan and orange side strips, thin white ring light
  vec3 base = mix(vec3(0.012, 0.013, 0.016), vec3(0.17, 0.19, 0.24), smoothstep(-0.35, 0.05, d.y));
  base = mix(base, vec3(0.07, 0.08, 0.10), smoothstep(0.25, 0.6, d.y));
  float top = smoothstep(0.50 - w * 0.5, 0.72 + w * 0.3, d.y);
  float az = atan(d.z, d.x);
  float a1 = az - 1.1; a1 = atan(sin(a1), cos(a1));
  float s1 = (1.0 - smoothstep(0.16, 0.16 + w, abs(d.y - 0.30))) * (1.0 - smoothstep(0.7, 0.7 + w * 2.0, abs(a1)));
  float a2 = az + 2.1; a2 = atan(sin(a2), cos(a2));
  float s2 = (1.0 - smoothstep(0.10, 0.10 + w, abs(d.y + 0.06))) * (1.0 - smoothstep(0.5, 0.5 + w * 2.0, abs(a2)));
  float s3 = 1.0 - smoothstep(0.04, 0.04 + w * 0.8, abs(d.y - 0.86));
  float a4 = az + 0.4; a4 = atan(sin(a4), cos(a4));
  float s4 = (1.0 - smoothstep(0.05, 0.05 + w, abs(d.y - 0.12))) * (1.0 - smoothstep(0.12, 0.12 + w, abs(a4)));
  return (base + vec3(0.80, 0.88, 1.0) * top * 0.8 + vec3(0.35, 0.85, 1.0) * s1 * 1.6 + vec3(1.0, 0.42, 0.12) * s2 * 1.4 + vec3(0.95, 0.97, 1.0) * s3 * 0.9 + vec3(0.9, 0.97, 1.0) * s4 * 0.9) * uEnvIntensity;
}
vec3 chronosEnvIrradiance(vec3 n) {
  vec3 sky = mix(vec3(0.02, 0.022, 0.028), vec3(0.16, 0.18, 0.22), n.y * 0.5 + 0.5);
  float c1 = max(0.0, dot(n, normalize(vec3(cos(1.1), 0.45, sin(1.1)))));
  float c2 = max(0.0, dot(n, normalize(vec3(cos(-2.1), -0.08, sin(-2.1)))));
  return (sky + vec3(0.35, 0.85, 1.0) * c1 * 0.13 + vec3(1.0, 0.42, 0.12) * c2 * 0.11) * uEnvIntensity * PI;
}
`;

const ENV_APPLY = /* glsl */`
#ifdef CHRONOS_ENV
{
  vec3 wN = inverseTransformDirection(geometryNormal, viewMatrix);
  vec3 wR = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  radiance += chronosEnvRadiance(wR, material.roughness);
  iblIrradiance += chronosEnvIrradiance(wN);
}
#endif
`;

const HASH = /* glsl */`
float chash(vec2 p) { p = fract(p * vec2(0.3183099, 0.3678794)) * 8.0; vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

// Options: env, windows, seams, glow, hao (height AO), wave
export function makeStandard(params = {}, opts = {}) {
  const { env = true, windows = false, seams = false, polarSeams = false, glow = false, hao = false, wave = false, panel = [6, 4], window = [3.2, 3.0], windowDensity = 0.55, aoParams = [0.35, 0, 24] } = opts;
  const mat = new THREE.MeshStandardMaterial(params);
  const key = JSON.stringify({ env, windows, seams, polarSeams, glow, hao, wave });
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uEnvIntensity: SHARED.uEnvIntensity, uTime: SHARED.uTime, uAwake: SHARED.uAwake, uWave: SHARED.uWave, uWaveI: SHARED.uWaveI, uWindowIntensity: SHARED.uWindowIntensity,
      uPanel: { value: new THREE.Vector2(panel[0], panel[1]) }, uWindow: { value: new THREE.Vector2(window[0], window[1]) }, uWindowDensity: { value: windowDensity },
      uAo: { value: new THREE.Vector3(aoParams[0], aoParams[1], aoParams[2]) }, uGlowColor: { value: new THREE.Color(0.4, 0.9, 1.0) },
    });
    const defs = [];
    if (env) defs.push('#define CHRONOS_ENV');
    if (windows) defs.push('#define USE_WINDOWS');
    if (seams) defs.push('#define USE_SEAMS');
    if (polarSeams) defs.push('#define USE_POLAR_SEAMS');
    if (glow) defs.push('#define USE_GLOW');
    if (hao) defs.push('#define USE_HAO');
    if (wave) defs.push('#define USE_WAVE');
    const needSize = windows || seams;
    // ---- vertex ----
    shader.vertexShader = defs.join('\n') + '\n' + shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorldPos; flat varying vec3 vLN; varying vec2 vCUv; flat varying float vGlowV;
#if defined(USE_WINDOWS) || defined(USE_SEAMS)
attribute vec3 aSize; attribute vec4 aInfo; flat varying vec3 vSize; flat varying vec4 vInfo;
#endif
#ifdef USE_GLOW
attribute float aGlow;
#endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
#ifdef USE_INSTANCING
  vec4 cwp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
  vec4 cwp = modelMatrix * vec4(transformed, 1.0);
#endif
  vWorldPos = cwp.xyz; vLN = normal; vCUv = uv;
#if defined(USE_WINDOWS) || defined(USE_SEAMS)
  vSize = aSize; vInfo = aInfo;
#endif
  float g = 0.0;
#ifdef USE_GLOW
  g += aGlow;
#endif
  vGlowV = g;
}`);
    // ---- fragment ----
    shader.fragmentShader = defs.join('\n') + '\n' + shader.fragmentShader
      .replace('#include <common>', `#include <common>
${ENV_PARS}${HASH}
uniform float uTime, uAwake, uWaveI, uWindowIntensity, uWindowDensity; uniform vec4 uWave; uniform vec2 uPanel, uWindow; uniform vec3 uAo, uGlowColor;
varying vec3 vWorldPos; flat varying vec3 vLN; varying vec2 vCUv; flat varying float vGlowV;
#if defined(USE_WINDOWS) || defined(USE_SEAMS)
flat varying vec3 vSize; flat varying vec4 vInfo;
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef USE_SEAMS
{
  vec3 an = abs(vLN);
  vec2 fs = an.x > 0.5 ? vSize.zy : (an.z > 0.5 ? vSize.xy : vSize.xz);
  vec2 g2 = vCUv * fs / uPanel; vec2 f2 = abs(fract(g2) - 0.5);
  float seam = smoothstep(0.455, 0.5, max(f2.x, f2.y));
  diffuseColor.rgb *= 1.0 - 0.55 * seam;
  roughnessFactor = min(1.0, roughnessFactor + 0.25 * seam);
}
#endif
#ifdef USE_POLAR_SEAMS
{
  float ang = atan(vWorldPos.z, vWorldPos.x); float rr = length(vWorldPos.xz);
  vec2 g2 = vec2(ang / (6.2831853 / 60.0), rr / uPanel.y); vec2 f2 = abs(fract(g2) - 0.5);
  float seam = smoothstep(0.47, 0.5, max(f2.x, f2.y)) * step(0.3, abs(vLN.y));
  float brushed = 0.92 + 0.08 * chash(vec2(floor(rr * 2.0), 0.0));
  diffuseColor.rgb *= (1.0 - 0.5 * seam) * brushed;
  roughnessFactor = min(1.0, roughnessFactor + 0.3 * seam);
}
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float waveG = 0.0;
#ifdef USE_WAVE
  { float d = length(vWorldPos.xz - uWave.xy); float wx = (d - uWave.z) / uWave.w; waveG = exp(-wx * wx) * uWaveI; }
#endif
  totalEmissiveRadiance += uGlowColor * (vGlowV + waveG * 0.12);
#ifdef USE_WINDOWS
  {
    vec3 an = abs(vLN);
    if (an.y < 0.5) {
      vec2 fs = an.x > 0.5 ? vSize.zy : vSize.xy;
      float face = an.x > 0.5 ? (vLN.x > 0.0 ? 1.0 : 2.0) : (vLN.z > 0.0 ? 3.0 : 4.0);
      float style = vInfo.z;
      vec2 cellSize = style < 0.5 ? vec2(2.6, 3.0) : (style < 1.5 ? vec2(1.5, 3.4) : vec2(5.5, 2.4));
      vec4 ins = style < 0.5 ? vec4(0.22, 0.78, 0.3, 0.72) : (style < 1.5 ? vec4(0.32, 0.68, 0.12, 0.88) : vec4(0.06, 0.94, 0.42, 0.62));
      float dens = style < 0.5 ? uWindowDensity : (style < 1.5 ? uWindowDensity * 0.8 : uWindowDensity * 1.35);
      vec2 g = vCUv * fs / cellSize; vec2 cell = floor(g); vec2 f = fract(g);
      float seed = mod(vInfo.x, 97.0);
      float hsh = chash(cell * 0.173 + vec2(seed * 0.37 + face * 1.31, seed * 0.11 + face * 0.29));
      float lit = step(hsh, dens);
      float inset = step(ins.x, f.x) * step(f.x, ins.y) * step(ins.z, f.y) * step(f.y, ins.w);
      float on = smoothstep(0.0, 0.25, uAwake - vInfo.y - hsh * 0.9);
      float warm = step(0.72, fract(hsh * 7.31 + 0.5));
      vec3 wc = mix(vec3(0.5, 0.92, 1.0), vec3(1.0, 0.62, 0.3), warm);
      float flick = 0.9 + 0.1 * sin(uTime * 2.7 + hsh * 60.0);
      totalEmissiveRadiance += wc * lit * inset * on * flick * uWindowIntensity * (0.9 + 1.4 * waveG);
    }
  }
#endif
}`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
${ENV_APPLY}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
#ifdef USE_HAO
{ float ao = mix(uAo.x, 1.0, smoothstep(uAo.y, uAo.z, vWorldPos.y)); reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao; }
#endif`);
  };
  return mat;
}

// Unlit emissive material for light elements; HDR via instanceColor (values > 1 bloom)
export function makeGlow(color = 0xffffff, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, fog: opts.fog !== false, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: opts.depthWrite ?? true, side: opts.side ?? THREE.FrontSide });
}

export function makeAdditive(color = 0xffffff, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
}

// Palette
export const PAL = {
  graphite: 0x0b0c0f,
  titanium: 0x8a8f99,
  titaniumDark: 0x4d525c,
  aluminum: 0xb8bcc4,
  glass: 0x0d1118,
  cyan: new THREE.Color(0.35, 0.9, 1.0),
  orange: new THREE.Color(1.0, 0.45, 0.12),
  white: new THREE.Color(0.95, 0.97, 1.0),
};

export const MATS = {};
export function buildMaterials() {
  MATS.titanium = makeStandard({ color: PAL.titanium, metalness: 0.8, roughness: 0.4 }, { env: true, hao: true, wave: true, glow: true });
  MATS.titaniumSeams = makeStandard({ color: 0x7d838d, metalness: 0.72, roughness: 0.46 }, { env: true, seams: true, hao: true, wave: true, glow: true });
  MATS.titaniumDark = makeStandard({ color: PAL.titaniumDark, metalness: 0.75, roughness: 0.5 }, { env: true, hao: true, wave: true });
  MATS.aluminum = makeStandard({ color: PAL.aluminum, metalness: 0.85, roughness: 0.32 }, { env: true, hao: true, wave: true, glow: true });
  MATS.glassTower = makeStandard({ color: 0x121821, metalness: 0.45, roughness: 0.14 }, { env: true, windows: true, hao: true, wave: true, glow: true });
  MATS.glassClear = makeStandard({ color: 0x0a0d12, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }, { env: true });
  MATS.plate = makeStandard({ color: 0x5a6068, metalness: 0.82, roughness: 0.42 }, { env: true, polarSeams: true, wave: true, glow: false, panel: [6, 22] });
  MATS.orangeMetal = makeStandard({ color: 0xd4642a, metalness: 0.8, roughness: 0.4, emissive: new THREE.Color(0.5, 0.14, 0.02), emissiveIntensity: 0.6 }, { env: true });
  MATS.gearSteel = makeStandard({ color: 0x9aa0aa, metalness: 0.95, roughness: 0.32 }, { env: true, wave: true, glow: true });
  MATS.gearDark = makeStandard({ color: 0x3b3f47, metalness: 0.9, roughness: 0.45 }, { env: true, wave: true });
  MATS.bar = makeStandard({ color: 0xd8dce4, metalness: 0.9, roughness: 0.28, emissive: new THREE.Color(0.06, 0.065, 0.075) }, { env: true });
  MATS.glowCyan = makeGlow(0xffffff);
  MATS.glowOrange = makeGlow(0xffffff);
  MATS.glowWhite = makeGlow(0xffffff);
  return MATS;
}
