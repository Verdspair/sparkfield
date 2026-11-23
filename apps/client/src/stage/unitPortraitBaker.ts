import * as THREE from 'three';
import {
  SEASON1_UNITS,
  SEASON1_UNITS_BY_ID,
  type ArenaThemeId,
  type UnitDef,
  type UnitStar,
} from '@pkg/contracts';
import { ArenaStageAssembly, getArenaThemeLightingPreset } from './arenaBuilder.js';
import {
  FACTION_PALETTES,
  PbrMaterialLibrary,
  buildProceduralStudioEnvMap,
} from './pbrMaterials.js';
import {
  TACTICIAN_CATALOG,
  TACTICIAN_IDS,
  createTacticianRig,
} from './tacticianMeshFactory.js';
import type { TacticianId } from './types.js';
import { UnitMeshFactory } from './unitMeshFactory.js';

const DEFAULT_BAKE_SIZE = 256;
const ARENA_THEME_IDS: readonly ArenaThemeId[] = [
  'orbital_elevator_port',
  'mercury_dyson_forge',
  'event_horizon_observatory',
];

const portraitCache = new Map<string, string>();
const studioEnvCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
let attachedRenderer: THREE.WebGLRenderer | null = null;
const portraitListeners = new Map<string, Set<() => void>>();

function subscribePortrait(key: string, onChange: () => void): () => void {
  const listeners = portraitListeners.get(key) ?? new Set<() => void>();
  listeners.add(onChange);
  portraitListeners.set(key, listeners);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) portraitListeners.delete(key);
  };
}

function publishPortrait(key: string, url: string): void {
  if (portraitCache.get(key) === url) return;
  portraitCache.set(key, url);
  portraitListeners.get(key)?.forEach((onChange) => onChange());
}

export function subscribeUnitPortrait(unitId: string, onChange: () => void): () => void {
  return subscribePortrait(`unit:${unitId}:1:${DEFAULT_BAKE_SIZE}`, onChange);
}

export function subscribeTacticianPortrait(tacticianId: TacticianId, onChange: () => void): () => void {
  return subscribePortrait(`tactician:${tacticianId}:${DEFAULT_BAKE_SIZE}`, onChange);
}

function getOrCreateStudioEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  const existing = studioEnvCache.get(renderer);
  if (existing) return existing;
  try {
    const built = buildProceduralStudioEnvMap(renderer);
    studioEnvCache.set(renderer, built.envTexture);
    return built.envTexture;
  } catch {
    return null;
  }
}

function encodeSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function roleGlyphPath(role: string): string {
  if (role === '重装') {
    return '<path d="M128 54 L182 78 V130 C182 164 158 190 128 206 C98 190 74 164 74 130 V78 Z" fill="none" stroke="#91a1b4" stroke-width="9"/><path d="M128 74 L164 90 V128 C164 152 148 172 128 184 C108 172 92 152 92 128 V90 Z" fill="#91a1b4" fill-opacity="0.22"/>';
  }
  if (role === '磁轨') {
    return '<path d="M58 174 L188 74 M78 186 L202 90" stroke="#91a1b4" stroke-width="9" stroke-linecap="round"/><circle cx="174" cy="96" r="24" fill="none" stroke="#b7c0ce" stroke-width="4"/>';
  }
  if (role === '光子') {
    return '<polygon points="128,48 178,128 128,208 78,128" fill="#91a1b4" fill-opacity="0.26" stroke="#91a1b4" stroke-width="8"/><circle cx="128" cy="128" r="20" fill="#b7c0ce"/>';
  }
  if (role === '矩阵') {
    return '<polygon points="128,54 186,88 186,168 128,202 70,168 70,88" fill="#91a1b4" fill-opacity="0.18" stroke="#91a1b4" stroke-width="8"/><circle cx="128" cy="128" r="28" fill="none" stroke="#b7c0ce" stroke-width="5"/>';
  }
  if (role === '维生') {
    return '<circle cx="128" cy="128" r="64" fill="#91a1b4" fill-opacity="0.18" stroke="#91a1b4" stroke-width="8"/><path d="M128 84 V172 M84 128 H172" stroke="#b7c0ce" stroke-width="10" stroke-linecap="round"/>';
  }
  return '<path d="M62 178 L128 56 L194 178 L128 148 Z" fill="#91a1b4" fill-opacity="0.24" stroke="#91a1b4" stroke-width="8" stroke-linejoin="round"/>';
}

function buildUnitSvgFallback(unitDef: UnitDef): string {
  return encodeSvgDataUrl([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
    '<rect width="256" height="256" fill="rgba(16,25,42,0.38)"/>',
    `<title>${unitDef.name}</title>`,
    roleGlyphPath(unitDef.role),
    '</svg>',
  ].join(''));
}

function buildTacticianSvgFallback(tacticianId: TacticianId): string {
  const entry = TACTICIAN_CATALOG.find((t) => t.id === tacticianId) ?? TACTICIAN_CATALOG[0]!;
  const emblem =
    tacticianId === 'tactician_europa_fin'
      ? '<ellipse cx="128" cy="134" rx="64" ry="44" fill="#89a3b8" fill-opacity="0.34" stroke="#a4bacb" stroke-width="6"/><circle cx="128" cy="134" r="18" fill="#89a3b8"/><circle cx="106" cy="126" r="6" fill="#0f172a"/><circle cx="150" cy="126" r="6" fill="#0f172a"/>'
      : tacticianId === 'tactician_singularity_mew'
        ? '<polygon points="84,96 104,54 122,94" fill="#a89ab8"/><polygon points="172,96 152,54 134,94" fill="#a89ab8"/><circle cx="128" cy="132" r="48" fill="#2e1f4d" stroke="#c8b590" stroke-width="5"/><ellipse cx="128" cy="172" rx="76" ry="18" fill="none" stroke="#c8b590" stroke-width="6"/><circle cx="110" cy="128" r="6" fill="#d3c2a0"/><circle cx="146" cy="128" r="6" fill="#d3c2a0"/>'
        : '<ellipse cx="128" cy="68" rx="46" ry="12" fill="none" stroke="#c8b590" stroke-width="6"/><path d="M84 166 C84 102 104 82 128 82 C152 82 172 102 172 166 Z" fill="#f8fafc" stroke="#c8b590" stroke-width="4"/><rect x="96" y="106" width="64" height="34" rx="14" fill="#132144"/><path d="M108 124 Q115 114 122 124 M134 124 Q141 114 148 124" fill="none" stroke="#a4bacb" stroke-width="4" stroke-linecap="round"/>';

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
    '<rect width="256" height="256" fill="rgba(16,25,42,0.38)"/>',
    '<circle cx="128" cy="128" r="92" fill="none" stroke="rgba(200,181,144,0.28)" stroke-width="2.5"/>',
    emblem,
    `<text x="128" y="234" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="700" font-family="sans-serif">${entry.name}</text>`,
    '</svg>',
  ].join('');
  return encodeSvgDataUrl(svg);
}

function buildArenaSvgFallback(themeId: ArenaThemeId): string {
  if (themeId === 'mercury_dyson_forge') {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
      '<rect width="256" height="256" fill="#222d40"/>',
      '<circle cx="128" cy="110" r="68" fill="#937856"/>',
      '<path d="M54 114 A74 74 0 0 1 202 114" fill="none" stroke="#b87e42" stroke-width="6"/>',
      '<polygon points="44,186 72,134 184,134 212,186" fill="#2a1d18" stroke="#c98e46" stroke-width="3.5"/>',
      '<polygon points="28,126 42,106 56,126 42,146" fill="#c98e46" stroke="#3c261c" stroke-width="2.5"/>',
      '<polygon points="200,126 214,106 228,126 214,146" fill="#c98e46" stroke="#3c261c" stroke-width="2.5"/>',
      '<ellipse cx="128" cy="196" rx="92" ry="16" fill="none" stroke="#a26f3c" stroke-width="5" stroke-dasharray="10 6"/>',
      '<text x="128" y="236" text-anchor="middle" fill="#fde6c4" font-size="18" font-weight="700" font-family="sans-serif">戴森熔炉</text>',
      '</svg>',
    ].join('');
    return encodeSvgDataUrl(svg);
  }

  if (themeId === 'event_horizon_observatory') {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
      '<rect width="256" height="256" fill="#222d40"/>',
      '<ellipse cx="128" cy="96" rx="76" ry="20" transform="rotate(-10 128 96)" fill="none" stroke="#b38ef5" stroke-width="7"/>',
      '<ellipse cx="128" cy="96" rx="54" ry="14" transform="rotate(-10 128 96)" fill="none" stroke="#e5bd6c" stroke-width="4.5"/>',
      '<circle cx="128" cy="96" r="24" fill="#05040c" stroke="#e5bd6c" stroke-width="3"/>',
      '<ellipse cx="128" cy="168" rx="68" ry="26" fill="#231c44" stroke="#c9a35b" stroke-width="3"/>',
      '<polygon points="34,154 50,142 58,166 40,174" fill="#2d2354" stroke="#a685ec" stroke-width="2"/>',
      '<polygon points="198,164 208,140 224,154 214,174" fill="#2d2354" stroke="#a685ec" stroke-width="2"/>',
      '<text x="128" y="236" text-anchor="middle" fill="#ece8ff" font-size="18" font-weight="700" font-family="sans-serif">视界观测台</text>',
      '</svg>',
    ].join('');
    return encodeSvgDataUrl(svg);
  }

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
    '<rect width="256" height="256" fill="#222d40"/>',
    '<rect x="118" y="22" width="20" height="118" fill="#bfe8ff" fill-opacity="0.38"/>',
    '<path d="M38 148 Q128 32 218 148" fill="none" stroke="#f2f6fa" stroke-width="9" stroke-linecap="round"/>',
    '<path d="M52 148 Q128 52 204 148" fill="none" stroke="#80c8eb" stroke-width="4" stroke-linecap="round"/>',
    '<ellipse cx="128" cy="196" rx="108" ry="28" fill="#f7f4ec" fill-opacity="0.72"/>',
    '<rect x="58" y="136" width="140" height="44" rx="18" fill="#eef3f8" stroke="#d4b57a" stroke-width="3.5"/>',
    '<text x="128" y="236" text-anchor="middle" fill="#eef1f5" font-size="18" font-weight="700" font-family="sans-serif">天梯港</text>',
    '</svg>',
  ].join('');
  return encodeSvgDataUrl(svg);
}

function createBackdropShader(topCss: string, midCss: string, botCss: string, accentHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(topCss) },
      uMid: { value: new THREE.Color(midCss) },
      uBot: { value: new THREE.Color(botCss) },
      uAccent: { value: new THREE.Color(accentHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBot;
      uniform vec3 uAccent;
      varying vec2 vUv;
      void main() {
        vec3 col = mix(uBot * 0.88, uMid * 1.02, smoothstep(0.0, 0.54, vUv.y));
        col = mix(col, uTop * 0.96, smoothstep(0.54, 1.0, vUv.y));
        vec2 p = (vUv - vec2(0.5, 0.48)) * vec2(1.0, 1.04);
        float dist = length(p);
        float glow = exp(-dist * dist * 4.2);
        col += uAccent * glow * 0.30;
        float vig = smoothstep(0.98, 0.22, dist);
        col *= mix(0.76, 1.08, vig);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function renderTargetToPngDataUrl(
  renderer: THREE.WebGLRenderer,
  renderTarget: THREE.WebGLRenderTarget,
  size: number,
): string | null {
  if (typeof document === 'undefined') return null;
  const pixels = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, size, size, pixels);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  const dst = imgData.data;
  for (let y = 0; y < size; y += 1) {
    const srcRow = (size - 1 - y) * size * 4;
    const dstRow = y * size * 4;
    dst.set(pixels.subarray(srcRow, srcRow + size * 4), dstRow);
  }
  ctx.putImageData(imgData, 0, 0);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function renderPortraitSceneWithRenderer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  size: number,
  exposure = 0.94,
): string | null {
  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  const prevExposure = renderer.toneMappingExposure;

  const rt = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
    samples: renderer.capabilities.isWebGL2 ? 4 : 0,
  });

  try {
    renderer.setRenderTarget(rt);
    renderer.autoClear = true;
    renderer.toneMappingExposure = exposure;
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    return renderTargetToPngDataUrl(renderer, rt, size);
  } catch {
    return null;
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    renderer.toneMappingExposure = prevExposure;
    rt.dispose();
  }
}

function buildPortraitStudioScene(
  renderer: THREE.WebGLRenderer,
  topCss: string,
  midCss: string,
  botCss: string,
  accentHex: number,
): { scene: THREE.Scene; dispose(): void } {
  const scene = new THREE.Scene();
  const envTex = getOrCreateStudioEnvMap(renderer);
  if (envTex) {
    scene.environment = envTex;
    scene.environmentIntensity = 0.66;
  }

  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = createBackdropShader(topCss, midCss, botCss, accentHex);
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.frustumCulled = false;
  scene.add(bgMesh);

  const keyLight = new THREE.DirectionalLight(0xfff0d8, 1.54);
  keyLight.position.set(3.2, 5.0, 4.6);
  const coolRimColor = new THREE.Color(0x58c8ff).lerp(new THREE.Color(accentHex), 0.48);
  const rimLight = new THREE.DirectionalLight(coolRimColor, 1.30);
  rimLight.position.set(-4.6, 3.8, -4.0);
  const warmFill = new THREE.DirectionalLight(0xffcf78, 0.48);
  warmFill.position.set(4.0, 0.8, 1.4);
  const sideFill = new THREE.DirectionalLight(0x74c2ff, 0.38);
  sideFill.position.set(-3.6, 1.8, 3.6);
  const hemi = new THREE.HemisphereLight(0xdaf0ff, 0x1e3052, 0.62);
  scene.add(keyLight, rimLight, warmFill, sideFill, hemi);

  return {
    scene,
    dispose: () => {
      bgGeo.dispose();
      bgMat.dispose();
    },
  };
}

function bakeSingleUnitWithWebgl(
  renderer: THREE.WebGLRenderer,
  unitFactory: UnitMeshFactory,
  unitDef: UnitDef,
  size: number,
  star: UnitStar,
): string | null {
  const palette = FACTION_PALETTES[unitDef.faction] ?? FACTION_PALETTES['戴森工团']!;
  const studio = buildPortraitStudioScene(
    renderer,
    palette.backdropTopCss,
    palette.backdropMidCss,
    palette.backdropBotCss,
    palette.accentHex,
  );
  const preview = unitFactory.buildPortraitPreviewGroup(unitDef.id, star);
  studio.scene.add(preview.group);
  preview.group.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(preview.group);
  const boxSize = new THREE.Vector3();
  const boxCenter = new THREE.Vector3();
  bounds.getSize(boxSize);
  bounds.getCenter(boxCenter);

  const fovDeg = 28;
  const camera = new THREE.PerspectiveCamera(fovDeg, 1, 0.1, 40);
  const halfFovRad = THREE.MathUtils.degToRad(fovDeg * 0.5);
  const maxExtent = Math.max(boxSize.y, boxSize.x * 0.96, boxSize.z * 0.96, 1.38);
  const fitDist = (maxExtent * 0.56) / Math.tan(halfFovRad);
  const dist = Math.max(2.75, Math.min(4.65, fitDist * 1.14));

  const targetY = Number.isFinite(boxCenter.y)
    ? Math.max(0.68, boxCenter.y + 0.04)
    : Math.max(0.78, preview.headTopLocalY * 0.52);
  const elev = THREE.MathUtils.degToRad(7.5);
  const azim = THREE.MathUtils.degToRad(24);
  camera.position.set(
    boxCenter.x + Math.sin(azim) * Math.cos(elev) * dist,
    targetY + Math.sin(elev) * dist,
    boxCenter.z + Math.cos(azim) * Math.cos(elev) * dist,
  );
  camera.lookAt(boxCenter.x, targetY, boxCenter.z);
  camera.updateMatrixWorld();

  const dataUrl = renderPortraitSceneWithRenderer(renderer, studio.scene, camera, size, 1.06);
  preview.dispose();
  studio.dispose();
  return dataUrl;
}

function bakeSingleTacticianWithWebgl(
  renderer: THREE.WebGLRenderer,
  materials: PbrMaterialLibrary,
  tacticianId: TacticianId,
  size: number,
): string | null {
  const entry = TACTICIAN_CATALOG.find((t) => t.id === tacticianId) ?? TACTICIAN_CATALOG[0]!;
  const accentInt = Number.parseInt(entry.accentHex.slice(1), 16);
  const studio = buildPortraitStudioScene(renderer, '#153661', '#26548a', '#162038', accentInt);
  const rig = createTacticianRig(tacticianId, materials);
  rig.update(0.016, 0.8);
  studio.scene.add(rig.root);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const targetY = 0.78;
  const dist = 3.05;
  const elev = THREE.MathUtils.degToRad(12);
  const azim = THREE.MathUtils.degToRad(22);
  camera.position.set(
    Math.sin(azim) * Math.cos(elev) * dist,
    targetY + Math.sin(elev) * dist,
    Math.cos(azim) * Math.cos(elev) * dist,
  );
  camera.lookAt(0, targetY, 0);
  camera.updateMatrixWorld();

  const dataUrl = renderPortraitSceneWithRenderer(renderer, studio.scene, camera, size, 1.06);
  rig.dispose();
  studio.dispose();
  return dataUrl;
}

function configureArenaPreviewShot(
  camera: THREE.PerspectiveCamera,
  themeId: ArenaThemeId,
): void {
  if (themeId === 'mercury_dyson_forge') {
    camera.fov = 40;
    camera.position.set(-11.2, 8.6, 15.6);
    camera.lookAt(0.0, -0.45, -2.6);
  } else if (themeId === 'event_horizon_observatory') {
    camera.fov = 40;
    camera.position.set(10.8, 8.2, 15.2);
    camera.lookAt(0.0, -0.35, -2.8);
  } else {
    camera.fov = 40;
    camera.position.set(10.6, 8.4, 15.8);
    camera.lookAt(0.0, -0.20, -2.5);
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function bakeArenaPreview(
  renderer: THREE.WebGLRenderer,
  materials: PbrMaterialLibrary,
  themeId: ArenaThemeId,
  size: number,
  sharedArena?: ArenaStageAssembly,
): string | null {
  const scene = new THREE.Scene();
  const preset = getArenaThemeLightingPreset(themeId);
  const envTex = getOrCreateStudioEnvMap(renderer);
  if (envTex) {
    scene.environment = envTex;
    scene.environmentIntensity = preset.envIntensity;
  }
  scene.background = new THREE.Color(preset.fogColor);
  scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity * 0.55);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 180);
  configureArenaPreviewShot(camera, themeId);

  const key = new THREE.DirectionalLight(preset.keyColor, preset.keyIntensity * 1.12);
  key.position.set(camera.position.x * 0.75 + 4.0, 17.5, camera.position.z * 0.85 + 4.0);
  const rim = new THREE.DirectionalLight(preset.rimColor, preset.rimIntensity * 1.15);
  rim.position.set(-camera.position.x * 0.8, 10.5, -13.0);
  const fill = new THREE.DirectionalLight(preset.fillColor, preset.fillIntensity * 1.15);
  fill.position.set(-camera.position.x * 0.6, 7.5, 8.0);
  const hemi = new THREE.HemisphereLight(
    preset.hemiSkyColor,
    preset.hemiGroundColor,
    preset.hemiIntensity * 1.12,
  );
  scene.add(key, rim, fill, hemi);

  const arena = sharedArena ?? new ArenaStageAssembly(materials, themeId);
  if (sharedArena) {
    arena.setTheme(themeId);
  }
  arena.setScoutPadsVisible(false);
  arena.setIntegerGold(30);
  arena.update(1.45);
  scene.add(arena.root);

  const dataUrl = renderPortraitSceneWithRenderer(renderer, scene, camera, size, 1.08);
  arena.setScoutPadsVisible(true);
  scene.remove(arena.root);
  if (!sharedArena) {
    arena.dispose();
  }
  return dataUrl;
}

export function attachPortraitBakerRenderer(renderer: THREE.WebGLRenderer | null): void {
  attachedRenderer = renderer;
}

export function clearPortraitCache(): void {
  portraitCache.clear();
  portraitListeners.forEach((listeners) => listeners.forEach((onChange) => onChange()));
}

export function getUnitPortraitUrl(
  unitId: string,
  options?: { readonly size?: number; readonly star?: UnitStar },
): string {
  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const star = options?.star ?? 1;
  const sizedKey = `unit:${unitId}:${star}:${size}`;
  const existing = portraitCache.get(sizedKey);
  if (existing) return existing;

  if (size !== DEFAULT_BAKE_SIZE) {
    const defaultExisting = portraitCache.get(`unit:${unitId}:${star}:${DEFAULT_BAKE_SIZE}`);
    if (defaultExisting && !defaultExisting.startsWith('data:image/svg')) return defaultExisting;
  }

  const unitDef = SEASON1_UNITS_BY_ID.get(unitId) ?? SEASON1_UNITS[0]!;
  const fallback = buildUnitSvgFallback(unitDef);
  portraitCache.set(sizedKey, fallback);
  return fallback;
}

export function getTacticianPortraitUrl(
  tacticianId: TacticianId,
  options?: { readonly size?: number },
): string {
  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const key = `tactician:${tacticianId}:${size}`;
  const existing = portraitCache.get(key);
  if (existing) return existing;

  if (size !== DEFAULT_BAKE_SIZE) {
    const defaultExisting = portraitCache.get(`tactician:${tacticianId}:${DEFAULT_BAKE_SIZE}`);
    if (defaultExisting && !defaultExisting.startsWith('data:image/svg')) return defaultExisting;
  }

  const fallback = buildTacticianSvgFallback(tacticianId);
  portraitCache.set(key, fallback);
  return fallback;
}

export function getArenaPreviewUrl(
  themeId: ArenaThemeId,
  options?: { readonly size?: number },
): string {
  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const key = `arena:${themeId}:${size}`;
  const existing = portraitCache.get(key);
  if (existing) return existing;

  if (size !== DEFAULT_BAKE_SIZE) {
    const defaultExisting = portraitCache.get(`arena:${themeId}:${DEFAULT_BAKE_SIZE}`);
    if (defaultExisting && !defaultExisting.startsWith('data:image/svg')) return defaultExisting;
  }

  const fallback = buildArenaSvgFallback(themeId);
  portraitCache.set(key, fallback);
  return fallback;
}

export function bakePortraitNow(
  kind: 'unit' | 'tactician' | 'arena',
  id: string,
  options?: {
    readonly size?: number;
    readonly star?: UnitStar;
    readonly renderer?: THREE.WebGLRenderer | null;
  },
): string {
  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const star = options?.star ?? 1;
  const renderer = options?.renderer ?? attachedRenderer;

  if (!renderer) {
    if (kind === 'unit') return getUnitPortraitUrl(id, { size, star });
    if (kind === 'tactician') return getTacticianPortraitUrl(id as TacticianId, { size });
    return getArenaPreviewUrl(id as ArenaThemeId, { size });
  }

  const materials = new PbrMaterialLibrary();
  const unitFactory = kind === 'unit' ? new UnitMeshFactory(materials) : null;

  try {
    if (kind === 'unit') {
      const unitDef = SEASON1_UNITS_BY_ID.get(id) ?? SEASON1_UNITS[0]!;
      const png = bakeSingleUnitWithWebgl(renderer, unitFactory!, unitDef, size, star);
      const url = png ?? buildUnitSvgFallback(unitDef);
      publishPortrait(`unit:${id}:${star}:${size}`, url);
      return url;
    }
    if (kind === 'tactician') {
      const tid = id as TacticianId;
      const png = bakeSingleTacticianWithWebgl(renderer, materials, tid, size);
      const url = png ?? buildTacticianSvgFallback(tid);
      publishPortrait(`tactician:${tid}:${size}`, url);
      return url;
    }
    const arenaId = id as ArenaThemeId;
    const png = bakeArenaPreview(renderer, materials, arenaId, size);
    const url = png ?? buildArenaSvgFallback(arenaId);
    portraitCache.set(`arena:${arenaId}:${size}`, url);
    return url;
  } finally {
    unitFactory?.dispose();
    materials.dispose();
  }
}

export async function prebakePortraitsAsync(options?: {
  readonly size?: number;
  readonly renderer?: THREE.WebGLRenderer | null;
  readonly includeArenas?: boolean;
  readonly signal?: AbortSignal;
}): Promise<void> {
  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const renderer = options?.renderer ?? attachedRenderer;
  const includeArenas = options?.includeArenas ?? true;
  const signal = options?.signal;
  if (signal?.aborted) return;

  if (!renderer) {
    for (const unit of SEASON1_UNITS) getUnitPortraitUrl(unit.id, { size });
    for (const id of TACTICIAN_IDS) getTacticianPortraitUrl(id, { size });
    if (includeArenas) {
      for (const id of ARENA_THEME_IDS) getArenaPreviewUrl(id, { size });
    }
    return;
  }

  const yieldFrame = () => new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  const needsBake = (key: string) => !portraitCache.get(key)?.startsWith('data:image/png');
  await yieldFrame();
  if (signal?.aborted) return;

  const materials = new PbrMaterialLibrary();
  const unitFactory = new UnitMeshFactory(materials);
  const sharedArena = includeArenas && ARENA_THEME_IDS.some((id) => needsBake(`arena:${id}:${size}`))
    ? new ArenaStageAssembly(materials, 'orbital_elevator_port')
    : null;
  try {
    for (const id of TACTICIAN_IDS) {
      const key = `tactician:${id}:${size}`;
      if (!needsBake(key)) continue;
      const url = bakeSingleTacticianWithWebgl(renderer, materials, id, size);
      if (url) publishPortrait(key, url);
    }
    await yieldFrame();

    for (let i = 0; i < SEASON1_UNITS.length; i += 1) {
      if (signal?.aborted) return;
      const unit = SEASON1_UNITS[i]!;
      const key = `unit:${unit.id}:1:${size}`;
      if (needsBake(key)) {
        const url = bakeSingleUnitWithWebgl(renderer, unitFactory, unit, size, 1);
        if (url) publishPortrait(key, url);
      }
      if ((i + 1) % 6 === 0) await yieldFrame();
    }
    if (sharedArena && !signal?.aborted) {
      for (const id of ARENA_THEME_IDS) {
        const key = `arena:${id}:${size}`;
        if (!needsBake(key)) continue;
        const url = bakeArenaPreview(renderer, materials, id, size, sharedArena);
        if (url) publishPortrait(key, url);
      }
    }
  } finally {
    sharedArena?.dispose();
    unitFactory.dispose();
    materials.dispose();
  }
}
