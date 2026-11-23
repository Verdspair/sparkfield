import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNoise2D } from 'simplex-noise';
import type { ArenaThemeId } from '@pkg/contracts';
import {
  bakeSimplexCloudTexture,
  bakeSoftRadialGlowTexture,
  type PbrMaterialLibrary,
} from './pbrMaterials.js';
import { SpringDamper } from './spring.js';
import {
  DEFAULT_TACTICIAN_ID,
  TACTICIAN_IDS,
  createTacticianRig,
  type TacticianRig,
} from './tacticianMeshFactory.js';
import type { StageSceneMode, TacticianEmoteKind, TacticianId } from './types.js';

interface LobbyThemePalette {
  readonly bgHex: number;
  readonly fogHex: number;
  readonly zenithHex: number;
  readonly midSkyHex: number;
  readonly horizonHex: number;
  readonly lowerSeaHex: number;
  readonly nebulaAHex: number;
  readonly nebulaBHex: number;
  readonly cloudLitHex: number;
  readonly cloudMidHex: number;
  readonly cloudShadowHex: number;
  readonly runePrimaryHex: number;
  readonly runeAccentHex: number;
  readonly dustHex: number;
  readonly godRayHex: number;
  readonly keyLightHex: number;
  readonly rimLightHex: number;
  readonly bounceLightHex: number;
  readonly hemiSkyHex: number;
  readonly hemiGroundHex: number;
}

const LOBBY_THEME_PALETTES: Readonly<Record<ArenaThemeId, LobbyThemePalette>> = {
  orbital_elevator_port: {
    bgHex: 0x081634,
    fogHex: 0x132f62,
    zenithHex: 0x061538,
    midSkyHex: 0x154488,
    horizonHex: 0xffcc70,
    lowerSeaHex: 0x0a1e44,
    nebulaAHex: 0x2e90f0,
    nebulaBHex: 0x7c68ea,
    cloudLitHex: 0xfff0cc,
    cloudMidHex: 0x4a82c4,
    cloudShadowHex: 0x122a56,
    runePrimaryHex: 0x54d8ff,
    runeAccentHex: 0xf6c95e,
    dustHex: 0xfff2b8,
    godRayHex: 0xffe0a3,
    keyLightHex: 0xffe8c2,
    rimLightHex: 0x54d2ff,
    bounceLightHex: 0x2f68ad,
    hemiSkyHex: 0x9cd2ff,
    hemiGroundHex: 0x1b3056,
  },
  mercury_dyson_forge: {
    bgHex: 0x190d11,
    fogHex: 0x321817,
    zenithHex: 0x12091c,
    midSkyHex: 0x542526,
    horizonHex: 0xf8b664,
    lowerSeaHex: 0x1b0e13,
    nebulaAHex: 0xc85634,
    nebulaBHex: 0xec964c,
    cloudLitHex: 0xffe0b2,
    cloudMidHex: 0x9c5a4b,
    cloudShadowHex: 0x2c161b,
    runePrimaryHex: 0xfbbf24,
    runeAccentHex: 0xfda4af,
    dustHex: 0xfde68a,
    godRayHex: 0xffc878,
    keyLightHex: 0xffe2ba,
    rimLightHex: 0x6cbce0,
    bounceLightHex: 0x703428,
    hemiSkyHex: 0xebb88e,
    hemiGroundHex: 0x2a181a,
  },
  event_horizon_observatory: {
    bgHex: 0x0a071d,
    fogHex: 0x151034,
    zenithHex: 0x060416,
    midSkyHex: 0x20184e,
    horizonHex: 0xc896f2,
    lowerSeaHex: 0x0a071b,
    nebulaAHex: 0x5c3eb0,
    nebulaBHex: 0xb662d6,
    cloudLitHex: 0xecd8ff,
    cloudMidHex: 0x4c3b82,
    cloudShadowHex: 0x130e30,
    runePrimaryHex: 0xc084fc,
    runeAccentHex: 0x93c5fd,
    dustHex: 0xe9d5ff,
    godRayHex: 0xd9c2ff,
    keyLightHex: 0xf5ecff,
    rimLightHex: 0xf0c270,
    bounceLightHex: 0x2c3c7a,
    hemiSkyHex: 0xb0a0ec,
    hemiGroundHex: 0x161230,
  },
};

function smoothSubdivideStageGeo(rawGeo: THREE.BufferGeometry, iterations = 1): THREE.BufferGeometry {
  const sub = LoopSubdivision.modify(rawGeo, iterations, {
    split: false,
    uvSmooth: true,
    preserveEdges: false,
  });
  rawGeo.dispose();
  const clean = new THREE.BufferGeometry();
  clean.setAttribute('position', sub.getAttribute('position').clone());
  const uv = sub.getAttribute('uv');
  if (uv) {
    clean.setAttribute('uv', uv.clone());
  }
  sub.dispose();
  const merged = mergeVertices(clean, 1e-4);
  clean.dispose();
  merged.computeVertexNormals();
  return merged;
}

function createNebulaSkyShader(palette: LobbyThemePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uDimFactor: { value: 1.0 },
      uZenith: { value: new THREE.Color(palette.zenithHex) },
      uMidSky: { value: new THREE.Color(palette.midSkyHex) },
      uHorizon: { value: new THREE.Color(palette.horizonHex) },
      uLowerSea: { value: new THREE.Color(palette.lowerSeaHex) },
      uNebulaA: { value: new THREE.Color(palette.nebulaAHex) },
      uNebulaB: { value: new THREE.Color(palette.nebulaBHex) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDimFactor;
      uniform vec3 uZenith;
      uniform vec3 uMidSky;
      uniform vec3 uHorizon;
      uniform vec3 uLowerSea;
      uniform vec3 uNebulaA;
      uniform vec3 uNebulaB;
      varying vec3 vWorldDir;

      float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float vnoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      float fbm3(vec3 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = p * 2.05 + vec3(7.3, 11.7, 5.1);
          a *= 0.48;
        }
        return v;
      }

      float starLayer(vec3 dir, float scale, float threshold, float time) {
        vec3 p = dir * scale;
        vec3 cell = floor(p);
        vec3 f = fract(p) - 0.5;
        float rnd = hash3(cell);
        if (rnd < threshold) return 0.0;
        vec3 jitter = vec3(
          hash3(cell + vec3(13.1, 7.7, 3.3)),
          hash3(cell + vec3(5.3, 19.7, 11.1)),
          hash3(cell + vec3(23.7, 2.9, 17.3))
        ) - 0.5;
        float dist = length(f - jitter * 0.52);
        float core = smoothstep(0.14, 0.015, dist);
        float twinkle = 0.65 + 0.35 * sin(time * (1.4 + fract(rnd * 31.7) * 1.8) + rnd * 90.0);
        return core * twinkle;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float e = dir.y;

        vec3 col = mix(uLowerSea, uMidSky, smoothstep(-0.32, -0.10, e));
        col = mix(col, uZenith, smoothstep(-0.04, 0.16, e));

        float horizonRibbon = exp(-pow((e + 0.15) / 0.068, 2.0));
        float softMist = exp(-pow((e + 0.10) / 0.14, 2.0));
        float sunBias = 0.52 + 0.48 * smoothstep(-0.55, 0.85, dot(dir.xz, normalize(vec2(0.24, -0.97))));
        col = mix(col, uHorizon, horizonRibbon * sunBias * 0.68);
        col += uHorizon * softMist * 0.10;

        vec3 sunDir = normalize(vec3(0.24, -0.12, -0.96));
        float sunHalo = pow(max(0.0, dot(dir, sunDir)), 12.0);
        col += uHorizon * sunHalo * 0.30;

        float skyMask = smoothstep(-0.12, 0.02, e);
        float galCoord = dot(dir, normalize(vec3(0.30, 0.86, 0.42)));
        float milkyBand = exp(-pow((galCoord + 0.04) / 0.30, 2.0));
        float nebulaWave = fbm3(dir * 3.5 + vec3(uTime * 0.012, -uTime * 0.006, 0.0));
        float veil = smoothstep(0.30, 0.78, nebulaWave);
        col += uNebulaA * milkyBand * veil * skyMask * 0.66;
        col += uNebulaB * pow(milkyBand, 1.35) * smoothstep(0.38, 0.80, nebulaWave) * skyMask * 0.48;

        float starMask = smoothstep(-0.10, 0.04, e);
        float brightStars = starLayer(dir, 72.0, 0.984, uTime);
        float fineStars = starLayer(dir, 140.0, 0.978, uTime * 1.15);
        vec3 starTint = mix(vec3(0.86, 0.94, 1.0), vec3(1.0, 0.94, 0.82), hash3(floor(dir * 72.0)));
        col += starTint * brightStars * starMask * 1.02;
        col += vec3(0.84, 0.91, 1.0) * fineStars * starMask * 0.54;

        gl_FragColor = vec4(col * uDimFactor, 1.0);
      }
    `,
  });
}

function createCloudSeaShader(
  cloudTex: THREE.DataTexture,
  palette: LobbyThemePalette,
  layerScale: number,
  speedX: number,
  speedY: number,
  layerOpacity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCloudMap: { value: cloudTex },
      uCloudLit: { value: new THREE.Color(palette.cloudLitHex) },
      uCloudMid: { value: new THREE.Color(palette.cloudMidHex) },
      uCloudShadow: { value: new THREE.Color(palette.cloudShadowHex) },
      uScale: { value: layerScale },
      uSpeed: { value: new THREE.Vector2(speedX, speedY) },
      uOpacity: { value: layerOpacity },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vRadial;
      void main() {
        vUv = uv;
        vRadial = length((uv - 0.5) * 2.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uCloudMap;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudMid;
      uniform vec3 uCloudShadow;
      uniform float uScale;
      uniform vec2 uSpeed;
      uniform float uOpacity;
      uniform float uDimFactor;
      varying vec2 vUv;
      varying float vRadial;

      void main() {
        vec2 uvA = vUv * uScale + uSpeed * uTime;
        vec2 uvB = vUv * (uScale * 1.78) - uSpeed.yx * (uTime * 0.65) + vec2(0.37, 0.19);
        vec3 sA = texture2D(uCloudMap, uvA).rgb;
        vec3 sB = texture2D(uCloudMap, uvB).rgb;

        float density = sA.r * 0.62 + sB.r * 0.38;
        float wisp = sA.g * 0.55 + sB.b * 0.45;
        float puff = smoothstep(0.34, 0.78, density);

        float edgeFade = smoothstep(1.0, 0.28, vRadial);
        float centerOpening = smoothstep(0.05, 0.24, vRadial);

        float litFactor = smoothstep(0.42, 0.84, density * 0.68 + wisp * 0.38);
        vec3 col = mix(uCloudShadow, uCloudMid, smoothstep(0.24, 0.64, density));
        col = mix(col, uCloudLit, litFactor * 0.86);

        float alpha = puff * edgeFade * (0.48 + 0.52 * centerOpening) * uOpacity;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(col * uDimFactor, clamp(alpha, 0.0, 0.86));
      }
    `,
  });
}

function createVolumetricCloudPuffShader(
  cloudTex: THREE.DataTexture,
  palette: LobbyThemePalette,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCloudMap: { value: cloudTex },
      uCloudLit: { value: new THREE.Color(palette.cloudLitHex) },
      uCloudMid: { value: new THREE.Color(palette.cloudMidHex) },
      uCloudShadow: { value: new THREE.Color(palette.cloudShadowHex) },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uCloudMap;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudMid;
      uniform vec3 uCloudShadow;
      uniform float uDimFactor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float ndotv = max(dot(N, V), 0.0);
        float softSilhouette = pow(ndotv, 3.0);
        float topLight = smoothstep(-0.35, 0.85, N.y);
        float noise = texture2D(uCloudMap, vUv * 2.2 + vec2(uTime * 0.015, 0.0)).r;

        vec3 col = mix(uCloudShadow, uCloudMid, smoothstep(0.05, 0.62, topLight * 0.75 + noise * 0.30));
        col = mix(col, uCloudLit, smoothstep(0.45, 0.95, topLight * 0.80 + noise * 0.25) * 0.82);

        float alpha = softSilhouette * smoothstep(0.18, 0.72, noise * 0.65 + 0.35) * 0.56;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createSanctuaryRuneDiscShader(palette: LobbyThemePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(palette.runePrimaryHex) },
      uAccent: { value: new THREE.Color(palette.runeAccentHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uAccent;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float ang = atan(p.y, p.x);

        float ringOuter = exp(-pow((r - 0.84) / 0.015, 2.0));
        float ringMid = exp(-pow((r - 0.58) / 0.012, 2.0));
        float ringInner = exp(-pow((r - 0.34) / 0.014, 2.0));
        float petalArc = exp(-pow((r - (0.71 + 0.03 * sin(ang * 8.0 + uTime * 0.3))) / 0.014, 2.0));
        float softGlow = exp(-r * r * 3.8) * 0.24;
        float gentleSweep = (0.76 + 0.24 * sin(ang * 2.0 - uTime * 0.7));

        vec3 col = uPrimary * (ringOuter * 0.62 + ringInner * 0.45 + softGlow) * gentleSweep
                 + uAccent * (ringMid * 0.72 + petalArc * 0.42);
        float alpha = (ringOuter * 0.52 + ringMid * 0.58 + ringInner * 0.38 + petalArc * 0.32 + softGlow)
                    * smoothstep(0.98, 0.88, r);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.56));
      }
    `,
  });
}

function createBokehStardustShader(
  glowTex: THREE.DataTexture,
  palette: LobbyThemePalette,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uGlowMap: { value: glowTex },
      uColorA: { value: new THREE.Color(palette.dustHex) },
      uColorB: { value: new THREE.Color(palette.runePrimaryHex) },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aTint;
      uniform float uTime;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec3 pos = position;
        float cycle = mod(pos.y + uTime * (0.14 + aPhase * 0.08) + 1.2, 6.2) - 1.2;
        pos.y = cycle;
        float orbit = uTime * (0.045 + aPhase * 0.025);
        float c = cos(orbit);
        float s = sin(orbit);
        pos.xz = mat2(c, -s, s, c) * pos.xz;

        float fadeVert = smoothstep(-1.2, 0.2, cycle) * smoothstep(5.0, 3.4, cycle);
        float twinkle = 0.58 + 0.42 * sin(uTime * 1.9 + aPhase * 18.0);
        vAlpha = fadeVert * twinkle * 0.76;
        vTint = aTint;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (290.0 / max(-mvPosition.z, 1.0));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uGlowMap;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uDimFactor;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec4 tex = texture2D(uGlowMap, gl_PointCoord);
        vec3 col = mix(uColorA, uColorB, vTint) * uDimFactor;
        float alpha = tex.a * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function normalizeGeoForLobbyMerge(
  source: THREE.BufferGeometry,
  matrix?: THREE.Matrix4,
): THREE.BufferGeometry {
  const g = source.index ? source.toNonIndexed() : source.clone();
  if (matrix) g.applyMatrix4(matrix);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  const keep = new Set(['position', 'normal', 'uv']);
  for (const name of Object.keys(g.attributes)) {
    if (!keep.has(name)) g.deleteAttribute(name);
  }
  return g;
}

function createVolumetricGodRayShader(palette: LobbyThemePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRayColor: { value: new THREE.Color(palette.godRayHex) },
      uAccentColor: { value: new THREE.Color(palette.runePrimaryHex) },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vViewSoft;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 N = normalize(mat3(modelMatrix) * normal);
        vec3 V = normalize(cameraPosition - wp.xyz);
        vViewSoft = pow(abs(dot(N, V)), 0.55);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uRayColor;
      uniform vec3 uAccentColor;
      uniform float uDimFactor;
      varying vec2 vUv;
      varying float vViewSoft;

      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float core = exp(-x * x * 4.4);
        float streakA = 0.62 + 0.38 * sin(vUv.x * 19.0 + uTime * 0.22 + vUv.y * 2.4);
        float streakB = 0.70 + 0.30 * cos(vUv.x * 33.0 - uTime * 0.16 - vUv.y * 1.8);
        float vertical = smoothstep(0.0, 0.34, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
        float breath = 0.84 + 0.16 * sin(uTime * 0.55 + vUv.x * 3.14);
        vec3 col = mix(uAccentColor, uRayColor, smoothstep(0.08, 0.88, vUv.y));
        float alpha = core * streakA * streakB * vertical * vViewSoft * breath * 0.165;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createDaisFilamentShader(palette: LobbyThemePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(palette.runePrimaryHex) },
      uAccent: { value: new THREE.Color(palette.runeAccentHex) },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uAccent;
      uniform float uDimFactor;
      varying vec3 vLocal;

      void main() {
        float ang = atan(vLocal.z, vLocal.x);
        float waveA = 0.55 + 0.45 * sin(ang * 3.0 - uTime * 0.85);
        float waveB = 0.72 + 0.28 * sin(uTime * 1.45 + ang * 6.0);
        vec3 col = mix(uPrimary, uAccent, waveA * 0.65);
        float alpha = (0.36 + 0.36 * waveA * waveB) * uDimFactor;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createHorizonSilhouetteShader(
  baseHex: number,
  rimHex: number,
  opacity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uOpacity: { value: opacity },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uRimColor;
      uniform float uOpacity;
      uniform float uDimFactor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;

      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 2.2);
        float mistVert = smoothstep(-7.5, 4.5, vWorldPos.y);
        float horizFade = smoothstep(42.0, 14.0, abs(vWorldPos.x));
        float shimmer = 0.88 + 0.12 * sin(vWorldPos.x * 0.18 - uTime * 0.45);
        vec3 col = mix(uBaseColor, uRimColor, clamp(fresnel * 0.78 + 0.14, 0.0, 1.0) * shimmer);
        float alpha = uOpacity * mistVert * horizFade;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createDistantShuttleTrailShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDimFactor;
      varying vec2 vUv;

      void main() {
        float head = fract(uTime * 0.055 + 0.22);
        float dist = head - vUv.x;
        if (dist < 0.0) dist += 1.0;
        float tail = exp(-dist * 9.5) * smoothstep(0.0, 0.012, dist);
        float tip = exp(-pow(dist / 0.018, 2.0));
        float widthFade = exp(-pow((vUv.y - 0.5) * 3.8, 2.0));
        float edgeMask = smoothstep(0.02, 0.14, vUv.x) * smoothstep(0.98, 0.86, vUv.x);
        vec3 col = mix(vec3(0.55, 0.86, 1.0), vec3(1.0, 0.94, 0.78), tip);
        float alpha = (tail * 0.42 + tip * 0.85) * widthFade * edgeMask;
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createDistantCoronaHaloShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDimFactor;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float rays = 0.72 + 0.28 * sin(ang * 14.0 + uTime * 0.24) * cos(ang * 9.0 - uTime * 0.18);
        float coronaRing = exp(-pow((r - 0.46) / 0.14, 2.0));
        float coreGlow = exp(-r * r * 3.2);
        float horizonClip = smoothstep(-0.32, 0.16, p.y);
        vec3 col = mix(vec3(0.92, 0.36, 0.12), vec3(1.0, 0.82, 0.46), clamp(coreGlow + coronaRing * 0.6, 0.0, 1.0));
        float alpha = (coronaRing * 0.52 * rays + coreGlow * 0.36) * smoothstep(1.0, 0.55, r) * horizonClip * 0.74;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col * uDimFactor, alpha);
      }
    `,
  });
}

function createDistantLensArcShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uDimFactor: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDimFactor;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        vec2 tilted = mat2(0.95, -0.31, 0.31, 0.95) * p;
        float r = length(tilted);
        float ang = atan(tilted.y, tilted.x);
        float lensRing = exp(-pow((r - 0.34) / 0.036, 2.0)) * (0.65 + 0.35 * sin(ang * 2.0 - uTime * 0.32));
        float outerArc = exp(-pow((r - 0.54) / 0.068, 2.0)) * smoothstep(-0.2, 0.65, tilted.y);
        float rift = exp(-pow((tilted.y - 0.04 * sin(tilted.x * 5.0 + uTime * 0.25)) / 0.075, 2.0))
                   * smoothstep(0.95, 0.12, abs(tilted.x)) * (0.65 + 0.35 * cos(tilted.x * 11.0 - uTime * 0.35));
        float voidCut = smoothstep(0.22, 0.31, r);
        vec3 goldArc = vec3(0.98, 0.80, 0.44);
        vec3 violetRift = vec3(0.70, 0.46, 0.98);
        vec3 col = goldArc * (lensRing * 0.88 + outerArc * 0.36) + violetRift * (rift * 0.56 + outerArc * 0.52);
        float alpha = (lensRing * 0.62 + outerArc * 0.34 + rift * 0.38) * voidCut * smoothstep(1.0, 0.68, r);
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col * uDimFactor, clamp(alpha, 0.0, 0.72));
      }
    `,
  });
}

const SPLASH_INTRO_DURATION_SEC = 2.0;
const DRAG_RETURN_DELAY_SEC = 2.5;

export class LobbyStageAssembly {
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;
  public readonly bloomTargets: THREE.Object3D[] = [];

  private readonly materials: PbrMaterialLibrary;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly runeDiscMat: THREE.ShaderMaterial;
  private readonly godRayMat: THREE.ShaderMaterial;
  private readonly daisFilamentMat: THREE.ShaderMaterial;
  private readonly cloudMats: THREE.ShaderMaterial[] = [];
  private readonly cloudPuffMat: THREE.ShaderMaterial;
  private readonly stardustMat: THREE.ShaderMaterial;
  private readonly mistHaloMat: THREE.MeshBasicMaterial;
  private readonly horizonShaderMats: THREE.ShaderMaterial[] = [];
  private readonly horizonGroups: Record<ArenaThemeId, THREE.Group>;
  private readonly dysonFarRingGroup = new THREE.Group();
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly bounceLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sceneFog: THREE.FogExp2;
  private readonly sceneBgColor: THREE.Color;

  private readonly cloudBanks: { group: THREE.Group; baseY: number; phase: number }[] = [];
  private readonly tacticianAnchor = new THREE.Group();
  private readonly tacticianRigs = new Map<TacticianId, TacticianRig>();
  private tacticianRig: TacticianRig;
  private currentTacticianId: TacticianId;
  private currentTheme: ArenaThemeId = 'orbital_elevator_port';

  private mode: StageSceneMode = 'lobby';
  private elapsedSec = 0;
  private splashElapsedSec = 0;
  private splashCompleted = false;

  private readonly lookXSpring = new SpringDamper(0.0, 14, 0.92);
  private readonly lookYSpring = new SpringDamper(1.04, 14, 0.92);
  private readonly fovSpring = new SpringDamper(33, 10, 0.90);
  private readonly pitchSpring = new SpringDamper(THREE.MathUtils.degToRad(10), 10, 0.90);
  private readonly distanceSpring = new SpringDamper(5.80, 10, 0.90);

  private readonly yawSpring = new SpringDamper(0, 11, 0.66);
  private isDraggingTactician = false;
  private idleSinceReleaseSec = 0;

  private readonly scratchLookAt = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();

  private readonly ownedGeos: THREE.BufferGeometry[] = [];
  private readonly ownedMats: THREE.Material[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];

  constructor(
    materials: PbrMaterialLibrary,
    initialTacticianId: TacticianId = DEFAULT_TACTICIAN_ID,
  ) {
    this.materials = materials;
    this.currentTacticianId = initialTacticianId;

    const palette = LOBBY_THEME_PALETTES[this.currentTheme];
    this.sceneBgColor = new THREE.Color(palette.bgHex);
    this.scene.background = this.sceneBgColor;
    this.sceneFog = new THREE.FogExp2(palette.fogHex, 0.0045);
    this.scene.fog = this.sceneFog;

    this.camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.2, 220);

    this.keyLight = new THREE.DirectionalLight(palette.keyLightHex, 1.62);
    this.keyLight.position.set(5.4, 8.4, 6.2);
    this.rimLight = new THREE.DirectionalLight(palette.rimLightHex, 1.30);
    this.rimLight.position.set(-6.2, 5.5, -6.2);
    this.bounceLight = new THREE.DirectionalLight(palette.bounceLightHex, 0.60);
    this.bounceLight.position.set(5.6, 1.8, -5.2);
    this.hemiLight = new THREE.HemisphereLight(palette.hemiSkyHex, palette.hemiGroundHex, 0.74);
    this.scene.add(this.keyLight, this.rimLight, this.bounceLight, this.hemiLight);

    this.skyMat = createNebulaSkyShader(palette);
    this.ownedMats.push(this.skyMat);
    const skyGeo = new THREE.SphereGeometry(110, 36, 24);
    this.ownedGeos.push(skyGeo);
    this.scene.add(new THREE.Mesh(skyGeo, this.skyMat));

    const cloudTex = bakeSimplexCloudTexture(256);
    const glowTex = bakeSoftRadialGlowTexture(128);
    this.ownedTextures.push(cloudTex, glowTex);

    const terracePorcelainMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x23406b),
      map: materials.porcelainMaps.albedoMap,
      normalMap: materials.porcelainMaps.normalMap,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.56,
      metalness: 0.16,
      envMapIntensity: 0.52,
      sheen: 0.10,
      sheenRoughness: 0.70,
      sheenColor: new THREE.Color(0x93c5fd),
    });
    const terraceJadeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x2e507e),
      map: materials.porcelainMaps.albedoMap,
      normalMap: materials.porcelainMaps.normalMap,
      normalScale: new THREE.Vector2(0.20, 0.20),
      roughness: 0.60,
      metalness: 0.14,
      envMapIntensity: 0.48,
      sheen: 0.10,
      sheenRoughness: 0.72,
    });
    const terraceTrimGoldMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xe8be66),
      map: materials.champagneGoldMaps.albedoMap,
      normalMap: materials.champagneGoldMaps.normalMap,
      normalScale: new THREE.Vector2(0.30, 0.30),
      roughness: 0.34,
      metalness: 0.72,
      envMapIntensity: 0.68,
    });
    const terraceTailMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1e2e4a),
      normalMap: materials.basaltMaps.normalMap,
      normalScale: new THREE.Vector2(0.30, 0.30),
      roughness: 0.78,
      metalness: 0.10,
      envMapIntensity: 0.28,
    });
    this.ownedMats.push(terracePorcelainMat, terraceJadeMat, terraceTrimGoldMat, terraceTailMat);

    const daisGroup = new THREE.Group();

    const mainTerracePts = [
      new THREE.Vector2(0.01, -0.34),
      new THREE.Vector2(1.42, -0.32),
      new THREE.Vector2(2.05, -0.22),
      new THREE.Vector2(2.34, -0.09),
      new THREE.Vector2(2.38, 0.01),
      new THREE.Vector2(2.22, 0.10),
      new THREE.Vector2(1.94, 0.145),
      new THREE.Vector2(1.78, 0.16),
      new THREE.Vector2(0.0, 0.162),
    ];
    const mainTerraceGeo = smoothSubdivideStageGeo(new THREE.LatheGeometry(mainTerracePts, 32), 1);
    this.ownedGeos.push(mainTerraceGeo);
    const mainTerrace = new THREE.Mesh(mainTerraceGeo, terracePorcelainMat);

    const innerCushionPts = [
      new THREE.Vector2(1.36, 0.14),
      new THREE.Vector2(1.66, 0.15),
      new THREE.Vector2(1.78, 0.175),
      new THREE.Vector2(1.68, 0.185),
      new THREE.Vector2(0.0, 0.185),
    ];
    const innerCushionGeo = smoothSubdivideStageGeo(new THREE.LatheGeometry(innerCushionPts, 28), 1);
    this.ownedGeos.push(innerCushionGeo);
    const innerCushion = new THREE.Mesh(innerCushionGeo, terraceJadeMat);

    const tailPts = [
      new THREE.Vector2(0.0, -1.60),
      new THREE.Vector2(0.28, -1.28),
      new THREE.Vector2(0.72, -0.92),
      new THREE.Vector2(1.24, -0.60),
      new THREE.Vector2(1.68, -0.36),
      new THREE.Vector2(1.94, -0.22),
    ];
    const rawTail = new THREE.LatheGeometry(tailPts, 24);
    const tailNoise = createNoise2D(() => 0.42);
    const tPos = rawTail.getAttribute('position');
    for (let i = 0; i < tPos.count; i += 1) {
      const x = tPos.getX(i);
      const y = tPos.getY(i);
      const z = tPos.getZ(i);
      const wave = 1.0 + tailNoise(x * 1.1, z * 1.1) * 0.07 * Math.min(1, Math.abs(y + 0.25));
      tPos.setXYZ(i, x * wave, y, z * wave);
    }
    const tailGeo = smoothSubdivideStageGeo(rawTail, 1);
    this.ownedGeos.push(tailGeo);
    const tailMesh = new THREE.Mesh(tailGeo, terraceTailMat);

    const goldContourOuterGeo = new THREE.TorusGeometry(2.26, 0.017, 12, 64);
    goldContourOuterGeo.rotateX(Math.PI * 0.5);
    const goldContourInnerGeo = new THREE.TorusGeometry(1.76, 0.013, 12, 64);
    goldContourInnerGeo.rotateX(Math.PI * 0.5);
    this.ownedGeos.push(goldContourOuterGeo, goldContourInnerGeo);

    const goldContourOuter = new THREE.Mesh(goldContourOuterGeo, terraceTrimGoldMat);
    goldContourOuter.position.set(0, 0.065, 0);
    const goldContourInner = new THREE.Mesh(goldContourInnerGeo, terraceTrimGoldMat);
    goldContourInner.position.set(0, 0.178, 0);

    this.runeDiscMat = createSanctuaryRuneDiscShader(palette);
    this.ownedMats.push(this.runeDiscMat);
    const runeDiscGeo = new THREE.PlaneGeometry(3.26, 3.26);
    runeDiscGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeos.push(runeDiscGeo);
    const runeDisc = new THREE.Mesh(runeDiscGeo, this.runeDiscMat);
    runeDisc.position.set(0, 0.188, 0);

    this.mistHaloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.runePrimaryHex),
      map: glowTex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ownedMats.push(this.mistHaloMat);
    const mistHaloGeo = new THREE.PlaneGeometry(6.8, 6.8);
    mistHaloGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeos.push(mistHaloGeo);
    const mistHalo = new THREE.Mesh(mistHaloGeo, this.mistHaloMat);
    mistHalo.position.set(0, -0.32, 0);

    const tickParts: THREE.BufferGeometry[] = [];
    const minorTickGeo = new THREE.BoxGeometry(0.018, 0.010, 0.11);
    const majorTickGeo = new THREE.BoxGeometry(0.044, 0.016, 0.19);
    const lugGeo = new THREE.BoxGeometry(0.22, 0.022, 0.09);
    const tickMat = new THREE.Matrix4();
    const tickPos = new THREE.Vector3();
    const tickQuat = new THREE.Quaternion();
    const tickScale = new THREE.Vector3(1, 1, 1);
    const yAxis = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < 48; i += 1) {
      const ang = (i / 48) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const r = isMajor ? 2.02 : 2.05;
      tickPos.set(Math.cos(ang) * r, isMajor ? 0.140 : 0.136, Math.sin(ang) * r);
      tickQuat.setFromAxisAngle(yAxis, -ang + Math.PI * 0.5);
      tickMat.compose(tickPos, tickQuat, tickScale);
      tickParts.push(normalizeGeoForLobbyMerge(isMajor ? majorTickGeo : minorTickGeo, tickMat));
      if (i % 12 === 0) {
        tickPos.set(Math.cos(ang) * 2.24, 0.088, Math.sin(ang) * 2.24);
        tickMat.compose(tickPos, tickQuat, tickScale);
        tickParts.push(normalizeGeoForLobbyMerge(lugGeo, tickMat));
      }
    }
    minorTickGeo.dispose();
    majorTickGeo.dispose();
    lugGeo.dispose();
    const mergedTicksGeo = mergeGeometries(tickParts, false)!;
    for (const p of tickParts) p.dispose();
    this.ownedGeos.push(mergedTicksGeo);
    const astrolabeTicks = new THREE.Mesh(mergedTicksGeo, terraceTrimGoldMat);

    this.daisFilamentMat = createDaisFilamentShader(palette);
    this.ownedMats.push(this.daisFilamentMat);
    const filOuterRaw = new THREE.TorusGeometry(2.14, 0.011, 8, 72);
    filOuterRaw.rotateX(Math.PI * 0.5);
    const filInnerRaw = new THREE.TorusGeometry(1.66, 0.009, 8, 64);
    filInnerRaw.rotateX(Math.PI * 0.5);
    const filA = normalizeGeoForLobbyMerge(filOuterRaw, new THREE.Matrix4().makeTranslation(0, 0.118, 0));
    const filB = normalizeGeoForLobbyMerge(filInnerRaw, new THREE.Matrix4().makeTranslation(0, 0.184, 0));
    filOuterRaw.dispose();
    filInnerRaw.dispose();
    const mergedFilamentGeo = mergeGeometries([filA, filB], false)!;
    filA.dispose();
    filB.dispose();
    this.ownedGeos.push(mergedFilamentGeo);
    const daisFilaments = new THREE.Mesh(mergedFilamentGeo, this.daisFilamentMat);

    const contactCoreGeo = new THREE.PlaneGeometry(1.24, 1.24);
    contactCoreGeo.rotateX(-Math.PI * 0.5);
    const contactWideGeo = new THREE.PlaneGeometry(2.12, 2.12);
    contactWideGeo.rotateX(-Math.PI * 0.5);
    const mergedContactGeo = mergeGeometries(
      [
        normalizeGeoForLobbyMerge(contactWideGeo, new THREE.Matrix4().makeTranslation(0, 0.189, 0)),
        normalizeGeoForLobbyMerge(contactCoreGeo, new THREE.Matrix4().makeTranslation(0, 0.191, 0)),
      ],
      false,
    )!;
    contactCoreGeo.dispose();
    contactWideGeo.dispose();
    this.ownedGeos.push(mergedContactGeo);
    const contactShadow = new THREE.Mesh(mergedContactGeo, materials.contactShadowMat);

    daisGroup.add(
      mainTerrace,
      innerCushion,
      tailMesh,
      goldContourOuter,
      goldContourInner,
      astrolabeTicks,
      daisFilaments,
      runeDisc,
      mistHalo,
      contactShadow,
    );
    this.scene.add(daisGroup);

    this.godRayMat = createVolumetricGodRayShader(palette);
    this.ownedMats.push(this.godRayMat);
    const godRayParts: THREE.BufferGeometry[] = [];
    const raySpecs: readonly { x: number; y: number; z: number; w: number; h: number; rz: number; ry: number }[] = [
      { x: 1.55, y: 4.35, z: -5.8, w: 3.9, h: 12.6, rz: 0.36, ry: -0.14 },
      { x: -1.15, y: 4.85, z: -7.8, w: 4.8, h: 13.8, rz: 0.31, ry: 0.08 },
      { x: 4.10, y: 4.60, z: -9.6, w: 5.4, h: 14.5, rz: 0.40, ry: -0.22 },
    ];
    for (const rs of raySpecs) {
      const planeRaw = new THREE.PlaneGeometry(rs.w, rs.h, 1, 1);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(rs.x, rs.y, rs.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rs.ry, rs.rz)),
        new THREE.Vector3(1, 1, 1),
      );
      godRayParts.push(normalizeGeoForLobbyMerge(planeRaw, m));
      planeRaw.dispose();
    }
    const mergedGodRaysGeo = mergeGeometries(godRayParts, false)!;
    for (const p of godRayParts) p.dispose();
    this.ownedGeos.push(mergedGodRaysGeo);
    this.scene.add(new THREE.Mesh(mergedGodRaysGeo, this.godRayMat));

    this.horizonGroups = {
      orbital_elevator_port: this.buildOrbitalHorizon(glowTex),
      mercury_dyson_forge: this.buildDysonHorizon(),
      event_horizon_observatory: this.buildEventHorizonBackdrop(),
    };
    this.scene.add(
      this.horizonGroups.orbital_elevator_port,
      this.horizonGroups.mercury_dyson_forge,
      this.horizonGroups.event_horizon_observatory,
    );
    this.syncHorizonVisibility();

    const cloudSpecs: readonly {
      y: number;
      z: number;
      w: number;
      d: number;
      arch: number;
      scale: number;
      sx: number;
      sy: number;
      opacity: number;
    }[] = [
      { y: -1.80, z: -5.5, w: 50, d: 40, arch: 1.4, scale: 2.3, sx: 0.008, sy: 0.004, opacity: 0.50 },
      { y: -2.85, z: -14.5, w: 80, d: 58, arch: 2.5, scale: 1.7, sx: -0.006, sy: 0.003, opacity: 0.68 },
      { y: -4.10, z: -26.0, w: 120, d: 84, arch: 4.0, scale: 1.3, sx: 0.004, sy: -0.002, opacity: 0.80 },
    ];
    for (const cs of cloudSpecs) {
      const geo = new THREE.PlaneGeometry(cs.w, cs.d, 24, 16);
      geo.rotateX(-Math.PI * 0.5);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        const px = pos.getX(i) / (cs.w * 0.5);
        const pz = pos.getZ(i) / (cs.d * 0.5);
        const dome = (1 - (px * px * 0.42 + pz * pz * 0.42)) * cs.arch;
        pos.setY(i, dome);
      }
      geo.computeVertexNormals();
      const mat = createCloudSeaShader(cloudTex, palette, cs.scale, cs.sx, cs.sy, cs.opacity);
      this.ownedGeos.push(geo);
      this.ownedMats.push(mat);
      this.cloudMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, cs.y, cs.z);
      this.scene.add(mesh);
    }

    this.cloudPuffMat = createVolumetricCloudPuffShader(cloudTex, palette);
    this.ownedMats.push(this.cloudPuffMat);
    const puffGeo = new THREE.SphereGeometry(1.0, 20, 16);
    this.ownedGeos.push(puffGeo);

    const cloudBankSpecs: readonly { x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = [
      { x: -11.5, y: -1.8, z: -17.0, sx: 5.4, sy: 1.9, sz: 3.6 },
      { x: -14.8, y: -1.2, z: -19.5, sx: 4.2, sy: 2.2, sz: 3.2 },
      { x: 11.8, y: -1.7, z: -17.5, sx: 5.6, sy: 2.0, sz: 3.8 },
      { x: 15.2, y: -1.1, z: -20.0, sx: 4.5, sy: 2.3, sz: 3.4 },
      { x: -18.5, y: -0.6, z: -29.0, sx: 8.2, sy: 2.8, sz: 4.8 },
      { x: 19.0, y: -0.5, z: -30.0, sx: 8.6, sy: 2.9, sz: 5.0 },
    ];
    for (let i = 0; i < cloudBankSpecs.length; i += 1) {
      const cb = cloudBankSpecs[i]!;
      const g = new THREE.Group();
      g.position.set(cb.x, cb.y, cb.z);
      const m = new THREE.Mesh(puffGeo, this.cloudPuffMat);
      m.scale.set(cb.sx, cb.sy, cb.sz);
      g.add(m);
      this.scene.add(g);
      this.cloudBanks.push({ group: g, baseY: cb.y, phase: i * 1.15 });
    }

    const dustCount = 80;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustPhases = new Float32Array(dustCount);
    const dustTints = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i += 1) {
      const angle = (i / dustCount) * Math.PI * 2 * 3.7;
      const radius = 2.4 + ((i * 41) % 100) / 100 * 8.6;
      const y = -1.0 + ((i * 59) % 100) / 100 * 5.8;
      dustPositions[i * 3] = Math.cos(angle) * radius;
      dustPositions[i * 3 + 1] = y;
      dustPositions[i * 3 + 2] = Math.sin(angle) * radius - 2.2;
      dustSizes[i] = 0.24 + ((i * 23) % 100) / 100 * 0.44;
      dustPhases[i] = ((i * 31) % 100) / 100;
      dustTints[i] = (i % 3 === 0) ? 0.78 : 0.18;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));
    dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));
    dustGeo.setAttribute('aTint', new THREE.BufferAttribute(dustTints, 1));
    this.ownedGeos.push(dustGeo);

    this.stardustMat = createBokehStardustShader(glowTex, palette);
    this.ownedMats.push(this.stardustMat);
    this.scene.add(new THREE.Points(dustGeo, this.stardustMat));

    this.tacticianAnchor.position.set(0, 0.18, 0);
    this.scene.add(this.tacticianAnchor);

    for (const tid of TACTICIAN_IDS) {
      const rig = createTacticianRig(tid, this.materials);
      rig.root.scale.setScalar(1.28);
      rig.root.visible = tid === initialTacticianId;
      this.tacticianAnchor.add(rig.root);
      this.tacticianRigs.set(tid, rig);
    }
    this.tacticianRig = this.tacticianRigs.get(initialTacticianId) ?? this.tacticianRigs.get(DEFAULT_TACTICIAN_ID)!;
    this.syncCameraNow();
  }

  public getTacticianId(): TacticianId {
    return this.currentTacticianId;
  }

  public getTheme(): ArenaThemeId {
    return this.currentTheme;
  }

  private syncHorizonVisibility(): void {
    this.horizonGroups.orbital_elevator_port.visible =
      this.currentTheme === 'orbital_elevator_port';
    this.horizonGroups.mercury_dyson_forge.visible =
      this.currentTheme === 'mercury_dyson_forge';
    this.horizonGroups.event_horizon_observatory.visible =
      this.currentTheme === 'event_horizon_observatory';
  }

  private buildOrbitalHorizon(glowTex: THREE.DataTexture): THREE.Group {
    const group = new THREE.Group();

    const silMat = createHorizonSilhouetteShader(0x162b4d, 0x8cccf5, 0.56);
    this.ownedMats.push(silMat);
    this.horizonShaderMats.push(silMat);

    const parts: THREE.BufferGeometry[] = [];
    const ringMainRaw = new THREE.TorusGeometry(34.0, 0.24, 10, 96, Math.PI * 0.58);
    const ringSubRaw = new THREE.TorusGeometry(32.8, 0.12, 8, 84, Math.PI * 0.52);
    parts.push(
      normalizeGeoForLobbyMerge(
        ringMainRaw,
        new THREE.Matrix4().compose(
          new THREE.Vector3(0, -26.4, -37.5),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0, Math.PI * 0.21)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
    parts.push(
      normalizeGeoForLobbyMerge(
        ringSubRaw,
        new THREE.Matrix4().compose(
          new THREE.Vector3(0, -26.6, -38.8),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0, Math.PI * 0.24)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
    ringMainRaw.dispose();
    ringSubRaw.dispose();

    const spireRaw = new THREE.CylinderGeometry(0.055, 0.16, 15.5, 8);
    const spireXs = [-14.5, 15.2];
    for (const sx of spireXs) {
      parts.push(
        normalizeGeoForLobbyMerge(
          spireRaw,
          new THREE.Matrix4().makeTranslation(sx, 0.4, -36.8),
        ),
      );
    }
    spireRaw.dispose();

    const archGeo = mergeGeometries(parts, false)!;
    for (const p of parts) p.dispose();
    this.ownedGeos.push(archGeo);
    group.add(new THREE.Mesh(archGeo, silMat));

    const beaconCount = 26;
    const beaconPos = new Float32Array(beaconCount * 3);
    const beaconSizes = new Float32Array(beaconCount);
    const beaconPhases = new Float32Array(beaconCount);
    const beaconTints = new Float32Array(beaconCount);
    for (let i = 0; i < beaconCount; i += 1) {
      const t = i / (beaconCount - 1);
      const ang = Math.PI * 0.24 + t * Math.PI * 0.52;
      beaconPos[i * 3] = Math.cos(ang) * 34.0;
      beaconPos[i * 3 + 1] = -26.2 + Math.sin(ang) * 34.0;
      beaconPos[i * 3 + 2] = -37.2;
      beaconSizes[i] = i % 4 === 0 ? 0.46 : 0.26;
      beaconPhases[i] = (i * 0.37) % 1.0;
      beaconTints[i] = i % 3 === 0 ? 0.85 : 0.15;
    }
    const beaconGeo = new THREE.BufferGeometry();
    beaconGeo.setAttribute('position', new THREE.BufferAttribute(beaconPos, 3));
    beaconGeo.setAttribute('aSize', new THREE.BufferAttribute(beaconSizes, 1));
    beaconGeo.setAttribute('aPhase', new THREE.BufferAttribute(beaconPhases, 1));
    beaconGeo.setAttribute('aTint', new THREE.BufferAttribute(beaconTints, 1));
    this.ownedGeos.push(beaconGeo);

    const beaconMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGlowMap: { value: glowTex },
        uDimFactor: { value: 1.0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute float aTint;
        uniform float uTime;
        varying float vAlpha;
        varying float vTint;
        void main() {
          vAlpha = (0.45 + 0.55 * sin(uTime * 1.6 + aPhase * 18.0)) * 0.85;
          vTint = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (280.0 / max(-mv.z, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uGlowMap;
        uniform float uDimFactor;
        varying float vAlpha;
        varying float vTint;
        void main() {
          vec4 t = texture2D(uGlowMap, gl_PointCoord);
          vec3 col = mix(vec3(1.0, 0.86, 0.58), vec3(0.56, 0.88, 1.0), vTint);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col * uDimFactor, a);
        }
      `,
    });
    this.ownedMats.push(beaconMat);
    this.horizonShaderMats.push(beaconMat);
    group.add(new THREE.Points(beaconGeo, beaconMat));

    const trailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-24.0, 3.6, -34.5),
      new THREE.Vector3(-8.5, 6.2, -35.8),
      new THREE.Vector3(7.5, 6.8, -36.2),
      new THREE.Vector3(24.0, 4.4, -34.8),
    ]);
    const trailGeo = new THREE.TubeGeometry(trailCurve, 64, 0.14, 6, false);
    const trailMat = createDistantShuttleTrailShader();
    this.ownedGeos.push(trailGeo);
    this.ownedMats.push(trailMat);
    this.horizonShaderMats.push(trailMat);
    group.add(new THREE.Mesh(trailGeo, trailMat));

    return group;
  }

  private buildDysonHorizon(): THREE.Group {
    const group = new THREE.Group();

    const coronaMat = createDistantCoronaHaloShader();
    this.ownedMats.push(coronaMat);
    this.horizonShaderMats.push(coronaMat);
    const coronaGeo = new THREE.PlaneGeometry(34.0, 26.0, 1, 1);
    this.ownedGeos.push(coronaGeo);
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.position.set(0, -1.2, -39.5);
    group.add(coronaMesh);

    const ringSilMat = createHorizonSilhouetteShader(0x281312, 0xf6a64d, 0.58);
    this.ownedMats.push(ringSilMat);
    this.horizonShaderMats.push(ringSilMat);

    const ringParts: THREE.BufferGeometry[] = [];
    const ringARaw = new THREE.TorusGeometry(14.6, 0.28, 10, 72);
    const ringBRaw = new THREE.TorusGeometry(17.4, 0.16, 8, 72, Math.PI * 1.45);
    ringParts.push(
      normalizeGeoForLobbyMerge(
        ringARaw,
        new THREE.Matrix4().makeRotationX(0.32),
      ),
    );
    ringParts.push(
      normalizeGeoForLobbyMerge(
        ringBRaw,
        new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.24, 0.18, 0.65)),
      ),
    );
    ringARaw.dispose();
    ringBRaw.dispose();

    const vaneRaw = new THREE.BoxGeometry(0.55, 2.2, 0.18);
    const vm = new THREE.Matrix4();
    const vp = new THREE.Vector3();
    const vq = new THREE.Quaternion();
    const vs = new THREE.Vector3(1, 1, 1);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 12; i += 1) {
      const ang = (i / 12) * Math.PI * 2;
      vp.set(Math.cos(ang) * 14.6, Math.sin(ang) * 14.6, 0);
      vq.setFromAxisAngle(zAxis, ang);
      vm.compose(vp, vq, vs);
      ringParts.push(normalizeGeoForLobbyMerge(vaneRaw, vm));
    }
    vaneRaw.dispose();

    const mergedDysonRings = mergeGeometries(ringParts, false)!;
    for (const p of ringParts) p.dispose();
    this.ownedGeos.push(mergedDysonRings);

    this.dysonFarRingGroup.position.set(0, -5.8, -37.2);
    this.dysonFarRingGroup.add(new THREE.Mesh(mergedDysonRings, ringSilMat));
    group.add(this.dysonFarRingGroup);

    return group;
  }

  private buildEventHorizonBackdrop(): THREE.Group {
    const group = new THREE.Group();

    const lensMat = createDistantLensArcShader();
    this.ownedMats.push(lensMat);
    this.horizonShaderMats.push(lensMat);
    const lensGeo = new THREE.PlaneGeometry(22.5, 22.5, 1, 1);
    this.ownedGeos.push(lensGeo);
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(2.4, 4.3, -36.5);
    group.add(lensMesh);

    const riftSilMat = createHorizonSilhouetteShader(0x160f34, 0xc79bff, 0.42);
    this.ownedMats.push(riftSilMat);
    this.horizonShaderMats.push(riftSilMat);
    const arcParts: THREE.BufferGeometry[] = [];
    const arcRawA = new THREE.TorusGeometry(19.5, 0.14, 8, 72, Math.PI * 0.62);
    const arcRawB = new THREE.TorusGeometry(22.2, 0.09, 8, 72, Math.PI * 0.48);
    arcParts.push(
      normalizeGeoForLobbyMerge(
        arcRawA,
        new THREE.Matrix4().compose(
          new THREE.Vector3(0.4, -10.8, -37.8),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, Math.PI * 0.19)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
    arcParts.push(
      normalizeGeoForLobbyMerge(
        arcRawB,
        new THREE.Matrix4().compose(
          new THREE.Vector3(0.4, -12.2, -38.8),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, 0, Math.PI * 0.27)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
    arcRawA.dispose();
    arcRawB.dispose();
    const mergedHorizonArcs = mergeGeometries(arcParts, false)!;
    for (const p of arcParts) p.dispose();
    this.ownedGeos.push(mergedHorizonArcs);
    group.add(new THREE.Mesh(mergedHorizonArcs, riftSilMat));

    return group;
  }

  public setTheme(theme: ArenaThemeId): void {
    this.currentTheme = theme;
    this.syncHorizonVisibility();
  }

  public getActiveBloomTargets(): THREE.Object3D[] {
    return [...this.bloomTargets, ...this.tacticianRig.bloomTargets];
  }

  public setTactician(id: TacticianId): void {
    if (this.currentTacticianId === id) return;
    const nextRig = this.tacticianRigs.get(id);
    if (!nextRig) return;
    this.tacticianRig.root.visible = false;
    this.currentTacticianId = id;
    this.tacticianRig = nextRig;
    this.tacticianRig.root.visible = true;
    this.yawSpring.snap(0);
    this.tacticianRig.triggerEmote('cheer');
  }

  public setMode(mode: StageSceneMode, instant = false): void {
    const prevMode = this.mode;
    this.mode = mode;

    if (mode === 'splash') {
      if (prevMode !== 'splash') {
        this.splashElapsedSec = 0;
        this.splashCompleted = false;
      }
      this.fovSpring.setTarget(33);
      this.lookXSpring.setTarget(0.0);
      this.lookYSpring.setTarget(1.08);
      this.pitchSpring.setTarget(THREE.MathUtils.degToRad(7));
      this.distanceSpring.setTarget(6.25);
      if (instant) {
        this.splashElapsedSec = SPLASH_INTRO_DURATION_SEC;
        this.splashCompleted = true;
        this.fovSpring.snap(33);
        this.lookXSpring.snap(0.0);
        this.lookYSpring.snap(1.08);
        this.pitchSpring.snap(THREE.MathUtils.degToRad(7));
        this.distanceSpring.snap(6.25);
      }
    } else if (mode === 'prep') {
      this.fovSpring.setTarget(33);
      this.lookXSpring.setTarget(2.25);
      this.lookYSpring.setTarget(1.06);
      this.pitchSpring.setTarget(THREE.MathUtils.degToRad(10));
      this.distanceSpring.setTarget(6.15);
      if (instant) {
        this.fovSpring.snap(33);
        this.lookXSpring.snap(2.25);
        this.lookYSpring.snap(1.06);
        this.pitchSpring.snap(THREE.MathUtils.degToRad(10));
        this.distanceSpring.snap(6.15);
      }
    } else {
      this.fovSpring.setTarget(33);
      this.lookXSpring.setTarget(0.0);
      this.lookYSpring.setTarget(1.04);
      this.pitchSpring.setTarget(THREE.MathUtils.degToRad(10));
      this.distanceSpring.setTarget(5.80);
      if (instant) {
        this.fovSpring.snap(33);
        this.lookXSpring.snap(0.0);
        this.lookYSpring.snap(1.04);
        this.pitchSpring.snap(THREE.MathUtils.degToRad(10));
        this.distanceSpring.snap(5.80);
      }
    }

    const dim = mode === 'subpage' ? 0.62 : 1.0;
    this.skyMat.uniforms['uDimFactor']!.value = dim;
    this.stardustMat.uniforms['uDimFactor']!.value = dim;
    this.cloudPuffMat.uniforms['uDimFactor']!.value = dim;
    this.godRayMat.uniforms['uDimFactor']!.value = dim;
    this.daisFilamentMat.uniforms['uDimFactor']!.value = dim;
    for (const hm of this.horizonShaderMats) {
      hm.uniforms['uDimFactor']!.value = dim;
    }
    for (const cm of this.cloudMats) {
      cm.uniforms['uDimFactor']!.value = dim;
    }
    this.syncCameraNow();
  }

  public skipSplashIntro(): void {
    this.splashElapsedSec = SPLASH_INTRO_DURATION_SEC;
    this.splashCompleted = true;
  }

  public isSplashCompleted(): boolean {
    return this.splashCompleted;
  }

  public beginTacticianDrag(): void {
    this.isDraggingTactician = true;
    this.idleSinceReleaseSec = 0;
  }

  public dragTacticianYaw(deltaPixelsX: number): void {
    const nextYaw = this.yawSpring.target + deltaPixelsX * 0.011;
    this.yawSpring.setTarget(nextYaw);
    this.idleSinceReleaseSec = 0;
  }

  public endTacticianDrag(): void {
    this.isDraggingTactician = false;
    this.idleSinceReleaseSec = 0;
  }

  public getTacticianYaw(): number {
    return this.yawSpring.value;
  }

  public triggerTacticianEmote(kind: TacticianEmoteKind): number {
    return this.tacticianRig.triggerEmote(kind);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.5, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  private lerpThemeAtmosphere(dt: number): void {
    const target = LOBBY_THEME_PALETTES[this.currentTheme];
    const alpha = Math.min(1, 1 - Math.exp(-dt * 4.5));

    const lerpUniformColor = (mat: THREE.ShaderMaterial, key: string, hex: number) => {
      const col = mat.uniforms[key]!.value as THREE.Color;
      this.scratchColor.setHex(hex);
      col.lerp(this.scratchColor, alpha);
    };

    this.scratchColor.setHex(target.bgHex);
    this.sceneBgColor.lerp(this.scratchColor, alpha);
    this.scratchColor.setHex(target.fogHex);
    this.sceneFog.color.lerp(this.scratchColor, alpha);

    lerpUniformColor(this.skyMat, 'uZenith', target.zenithHex);
    lerpUniformColor(this.skyMat, 'uMidSky', target.midSkyHex);
    lerpUniformColor(this.skyMat, 'uHorizon', target.horizonHex);
    lerpUniformColor(this.skyMat, 'uLowerSea', target.lowerSeaHex);
    lerpUniformColor(this.skyMat, 'uNebulaA', target.nebulaAHex);
    lerpUniformColor(this.skyMat, 'uNebulaB', target.nebulaBHex);

    for (const cm of this.cloudMats) {
      lerpUniformColor(cm, 'uCloudLit', target.cloudLitHex);
      lerpUniformColor(cm, 'uCloudMid', target.cloudMidHex);
      lerpUniformColor(cm, 'uCloudShadow', target.cloudShadowHex);
    }
    lerpUniformColor(this.cloudPuffMat, 'uCloudLit', target.cloudLitHex);
    lerpUniformColor(this.cloudPuffMat, 'uCloudMid', target.cloudMidHex);
    lerpUniformColor(this.cloudPuffMat, 'uCloudShadow', target.cloudShadowHex);

    lerpUniformColor(this.runeDiscMat, 'uPrimary', target.runePrimaryHex);
    lerpUniformColor(this.runeDiscMat, 'uAccent', target.runeAccentHex);
    lerpUniformColor(this.daisFilamentMat, 'uPrimary', target.runePrimaryHex);
    lerpUniformColor(this.daisFilamentMat, 'uAccent', target.runeAccentHex);
    lerpUniformColor(this.godRayMat, 'uRayColor', target.godRayHex);
    lerpUniformColor(this.godRayMat, 'uAccentColor', target.runePrimaryHex);
    lerpUniformColor(this.stardustMat, 'uColorA', target.dustHex);
    lerpUniformColor(this.stardustMat, 'uColorB', target.runePrimaryHex);

    this.scratchColor.setHex(target.runePrimaryHex);
    this.mistHaloMat.color.lerp(this.scratchColor, alpha);

    this.scratchColor.setHex(target.keyLightHex);
    this.keyLight.color.lerp(this.scratchColor, alpha);
    this.scratchColor.setHex(target.rimLightHex);
    this.rimLight.color.lerp(this.scratchColor, alpha);
    this.scratchColor.setHex(target.bounceLightHex);
    this.bounceLight.color.lerp(this.scratchColor, alpha);
    this.scratchColor.setHex(target.hemiSkyHex);
    this.hemiLight.color.lerp(this.scratchColor, alpha);
    this.scratchColor.setHex(target.hemiGroundHex);
    this.hemiLight.groundColor.lerp(this.scratchColor, alpha);
  }

  private syncCameraNow(): void {
    let fov = this.fovSpring.value;
    let lookX = this.lookXSpring.value;
    let lookY = this.lookYSpring.value;
    let pitch = this.pitchSpring.value;
    let dist = this.distanceSpring.value;

    if (this.mode === 'splash') {
      const t = Math.min(1, this.splashElapsedSec / SPLASH_INTRO_DURATION_SEC);
      const easeOut = 1 - Math.pow(1 - t, 3.2);
      dist = 8.6 + (6.25 - 8.6) * easeOut;
      fov = 33;
      pitch = THREE.MathUtils.degToRad(7 + Math.sin(this.elapsedSec * 0.45) * 0.45);
      lookX = Math.sin(this.elapsedSec * 0.35) * 0.10;
      lookY = 1.08;
    }

    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    const camY = lookY + Math.sin(pitch) * dist;
    const camZ = Math.cos(pitch) * dist;
    this.camera.position.set(lookX, camY, camZ);
    this.scratchLookAt.set(lookX, lookY, 0);
    this.camera.lookAt(this.scratchLookAt);
    this.camera.updateMatrixWorld();
  }

  public update(dt: number): void {
    this.elapsedSec += dt;
    this.skyMat.uniforms['uTime']!.value = this.elapsedSec;
    this.runeDiscMat.uniforms['uTime']!.value = this.elapsedSec;
    this.godRayMat.uniforms['uTime']!.value = this.elapsedSec;
    this.daisFilamentMat.uniforms['uTime']!.value = this.elapsedSec;
    this.stardustMat.uniforms['uTime']!.value = this.elapsedSec;
    this.cloudPuffMat.uniforms['uTime']!.value = this.elapsedSec;
    for (const hm of this.horizonShaderMats) {
      hm.uniforms['uTime']!.value = this.elapsedSec;
    }
    for (const cm of this.cloudMats) {
      cm.uniforms['uTime']!.value = this.elapsedSec;
    }
    this.dysonFarRingGroup.rotation.z = this.elapsedSec * 0.045;

    this.lerpThemeAtmosphere(dt);

    if (this.mode === 'splash') {
      this.splashElapsedSec = Math.min(SPLASH_INTRO_DURATION_SEC, this.splashElapsedSec + dt);
      if (this.splashElapsedSec >= SPLASH_INTRO_DURATION_SEC) {
        this.splashCompleted = true;
      }
    }

    for (const cb of this.cloudBanks) {
      cb.group.position.y = cb.baseY + Math.sin(this.elapsedSec * 0.40 + cb.phase) * 0.14;
    }

    if (!this.isDraggingTactician && Math.abs(this.yawSpring.target) > 0.001) {
      this.idleSinceReleaseSec += dt;
      if (this.idleSinceReleaseSec >= DRAG_RETURN_DELAY_SEC) {
        this.yawSpring.setTarget(0);
      }
    }

    const yaw = this.yawSpring.step(dt);
    this.tacticianAnchor.position.set(0, 0.18, 0);
    this.tacticianAnchor.rotation.y = yaw;
    this.tacticianRig.update(dt, this.elapsedSec);

    this.lookXSpring.step(dt);
    this.lookYSpring.step(dt);
    this.fovSpring.step(dt);
    this.pitchSpring.step(dt);
    this.distanceSpring.step(dt);
    this.syncCameraNow();
  }

  public dispose(): void {
    for (const rig of this.tacticianRigs.values()) {
      rig.dispose();
    }
    this.tacticianRigs.clear();
    for (const g of this.ownedGeos) g.dispose();
    for (const m of this.ownedMats) m.dispose();
    for (const t of this.ownedTextures) t.dispose();
  }
}
