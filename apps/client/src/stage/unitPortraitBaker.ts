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
  COST_TIER_COLORS,
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
let activePrebakePromise: Promise<void> | null = null;

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

function toHexCss(colorInt: number): string {
  return `#${colorInt.toString(16).padStart(6, '0')}`;
}

function encodeSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function roleGlyphPath(role: string): string {
  if (role === '重装') {
    return '<path d="M128 54 L182 78 V130 C182 164 158 190 128 206 C98 190 74 164 74 130 V78 Z" fill="none" stroke="url(#fg)" stroke-width="9"/><path d="M128 74 L164 90 V128 C164 152 148 172 128 184 C108 172 92 152 92 128 V90 Z" fill="url(#fg)" fill-opacity="0.22"/>';
  }
  if (role === '磁轨') {
    return '<path d="M58 174 L188 74 M78 186 L202 90" stroke="url(#fg)" stroke-width="9" stroke-linecap="round"/><circle cx="174" cy="96" r="24" fill="none" stroke="#fff0c4" stroke-width="4" stroke-dasharray="6 5"/>';
  }
  if (role === '光子') {
    return '<polygon points="128,48 178,128 128,208 78,128" fill="url(#fg)" fill-opacity="0.26" stroke="url(#fg)" stroke-width="8"/><circle cx="128" cy="128" r="20" fill="#fff7d6"/>';
  }
  if (role === '矩阵') {
    return '<polygon points="128,54 186,88 186,168 128,202 70,168 70,88" fill="url(#fg)" fill-opacity="0.18" stroke="url(#fg)" stroke-width="8"/><circle cx="128" cy="128" r="28" fill="none" stroke="#a5f3fc" stroke-width="5"/>';
  }
  if (role === '维生') {
    return '<circle cx="128" cy="128" r="64" fill="url(#fg)" fill-opacity="0.18" stroke="url(#fg)" stroke-width="8"/><path d="M128 84 V172 M84 128 H172" stroke="#ecfeff" stroke-width="10" stroke-linecap="round"/>';
  }
  return '<path d="M62 178 L128 56 L194 178 L128 148 Z" fill="url(#fg)" fill-opacity="0.24" stroke="url(#fg)" stroke-width="8" stroke-linejoin="round"/>';
}

function buildUnitSvgFallback(unitDef: UnitDef, star: UnitStar = 1): string {
  const palette = FACTION_PALETTES[unitDef.faction] ?? FACTION_PALETTES['戴森工团']!;
  const costColor = toHexCss(COST_TIER_COLORS[unitDef.cost] ?? 0x94a3b8);
  const accentCss = toHexCss(palette.accentHex);
  const secondaryCss = toHexCss(palette.secondaryHex);
  const starText = '★'.repeat(star);

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
    '<defs>',
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.backdropTopCss}"/><stop offset="52%" stop-color="${palette.backdropMidCss}"/><stop offset="100%" stop-color="${palette.backdropBotCss}"/></linearGradient>`,
    `<radialGradient id="halo" cx="50%" cy="42%" r="54%"><stop offset="0%" stop-color="${accentCss}" stop-opacity="0.40"/><stop offset="100%" stop-color="${accentCss}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="${accentCss}"/><stop offset="100%" stop-color="${secondaryCss}"/></linearGradient>`,
    '</defs>',
    '<rect width="256" height="256" fill="url(#bg)"/>',
    '<rect width="256" height="256" fill="url(#halo)"/>',
    '<circle cx="128" cy="124" r="96" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>',
    '<circle cx="128" cy="124" r="76" fill="none" stroke="rgba(255,255,255,0.16)" stroke-dasharray="5 7" stroke-width="1.5"/>',
    roleGlyphPath(unitDef.role),
    `<rect x="10" y="10" width="236" height="236" rx="18" fill="none" stroke="${costColor}" stroke-opacity="0.72" stroke-width="4"/>`,
    `<text x="22" y="38" fill="${costColor}" font-size="16" font-weight="800" font-family="sans-serif">${unitDef.cost}G</text>`,
    `<text x="234" y="38" text-anchor="end" fill="#fde68a" font-size="15" font-weight="700" font-family="sans-serif">${starText}</text>`,
    `<text x="128" y="236" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="700" font-family="sans-serif">${unitDef.name}</text>`,
    '</svg>',
  ].join('');
  return encodeSvgDataUrl(svg);
}

function buildTacticianSvgFallback(tacticianId: TacticianId): string {
  const entry = TACTICIAN_CATALOG.find((t) => t.id === tacticianId) ?? TACTICIAN_CATALOG[0]!;
  const emblem =
    tacticianId === 'tactician_europa_fin'
      ? '<ellipse cx="128" cy="134" rx="64" ry="44" fill="url(#fg)" fill-opacity="0.34" stroke="#a5f3fc" stroke-width="6"/><circle cx="128" cy="134" r="18" fill="#38bdf8"/><circle cx="106" cy="126" r="6" fill="#0f172a"/><circle cx="150" cy="126" r="6" fill="#0f172a"/>'
      : tacticianId === 'tactician_singularity_mew'
        ? '<polygon points="84,96 104,54 122,94" fill="#c084fc"/><polygon points="172,96 152,54 134,94" fill="#c084fc"/><circle cx="128" cy="132" r="48" fill="#2e1f4d" stroke="#f2c97d" stroke-width="5"/><ellipse cx="128" cy="172" rx="76" ry="18" fill="none" stroke="#f5c451" stroke-width="6"/><circle cx="110" cy="128" r="6" fill="#fde047"/><circle cx="146" cy="128" r="6" fill="#fde047"/>'
        : '<ellipse cx="128" cy="68" rx="46" ry="12" fill="none" stroke="#f5c451" stroke-width="6"/><path d="M84 166 C84 102 104 82 128 82 C152 82 172 102 172 166 Z" fill="#f8fafc" stroke="#f2c97d" stroke-width="4"/><rect x="96" y="106" width="64" height="34" rx="14" fill="#132144"/><path d="M108 124 Q115 114 122 124 M134 124 Q141 114 148 124" fill="none" stroke="#67e8f9" stroke-width="4" stroke-linecap="round"/>';

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#173866"/><stop offset="56%" stop-color="#27558c"/><stop offset="100%" stop-color="#1b2642"/></linearGradient>',
    `<linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${entry.accentHex}"/><stop offset="100%" stop-color="${entry.secondaryHex}"/></linearGradient>`,
    '</defs>',
    '<rect width="256" height="256" fill="url(#bg)"/>',
    '<circle cx="128" cy="128" r="92" fill="none" stroke="rgba(242,201,125,0.42)" stroke-width="2.5"/>',
    emblem,
    `<text x="128" y="234" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="700" font-family="sans-serif">${entry.name}</text>`,
    '</svg>',
  ].join('');
  return encodeSvgDataUrl(svg);
}

function buildArenaSvgFallback(themeId: ArenaThemeId): string {
  const preset = getArenaThemeLightingPreset(themeId);
  const top = `#${preset.skyTop.getHexString()}`;
  const mid = `#${preset.skyMid.getHexString()}`;
  const horizon = `#${preset.skyHorizon.getHexString()}`;

  if (themeId === 'mercury_dyson_forge') {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
      '<defs>',
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${top}"/><stop offset="56%" stop-color="${mid}"/><stop offset="100%" stop-color="${horizon}"/></linearGradient>`,
      '<radialGradient id="sun" cx="50%" cy="44%" r="40%"><stop offset="0%" stop-color="#f8cb72"/><stop offset="60%" stop-color="#d96e26"/><stop offset="100%" stop-color="#5a1e0c" stop-opacity="0"/></radialGradient>',
      '</defs>',
      '<rect width="256" height="256" fill="url(#sky)"/>',
      '<circle cx="128" cy="110" r="68" fill="url(#sun)"/>',
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
      '<defs>',
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${top}"/><stop offset="56%" stop-color="${mid}"/><stop offset="100%" stop-color="${horizon}"/></linearGradient>`,
      '</defs>',
      '<rect width="256" height="256" fill="url(#sky)"/>',
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
    '<defs>',
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${top}"/><stop offset="58%" stop-color="${mid}"/><stop offset="100%" stop-color="${horizon}"/></linearGradient>`,
    '</defs>',
    '<rect width="256" height="256" fill="url(#sky)"/>',
    '<rect x="118" y="22" width="20" height="118" fill="#bfe8ff" fill-opacity="0.38"/>',
    '<path d="M38 148 Q128 32 218 148" fill="none" stroke="#f2f6fa" stroke-width="9" stroke-linecap="round"/>',
    '<path d="M52 148 Q128 52 204 148" fill="none" stroke="#80c8eb" stroke-width="4" stroke-linecap="round"/>',
    '<ellipse cx="128" cy="196" rx="108" ry="28" fill="#f7f4ec" fill-opacity="0.72"/>',
    '<rect x="58" y="136" width="140" height="44" rx="18" fill="#eef3f8" stroke="#d4b57a" stroke-width="3.5"/>',
    '<text x="128" y="236" text-anchor="middle" fill="#18324d" font-size="18" font-weight="700" font-family="sans-serif">天梯港</text>',
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
        vec3 col = mix(uBot * 0.72, uMid * 0.84, smoothstep(0.0, 0.56, vUv.y));
        col = mix(col, uTop * 0.78, smoothstep(0.56, 1.0, vUv.y));
        vec2 p = (vUv - vec2(0.5, 0.50)) * vec2(1.0, 1.04);
        float dist = length(p);
        float glow = exp(-dist * dist * 5.2);
        col += uAccent * glow * 0.24;
        float ringOuter = exp(-pow((dist - 0.395) / 0.0045, 2.0));
        float ringInner = exp(-pow((dist - 0.355) / 0.0028, 2.0));
        col += uAccent * (ringOuter * 0.18 + ringInner * 0.12);
        float vig = smoothstep(0.95, 0.25, dist);
        col *= mix(0.68, 1.02, vig);
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
    scene.environmentIntensity = 0.46;
  }

  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = createBackdropShader(topCss, midCss, botCss, accentHex);
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.frustumCulled = false;
  scene.add(bgMesh);

  const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.36);
  keyLight.position.set(3.2, 5.0, 4.6);
  const coolRimColor = new THREE.Color(0x88c9f2).lerp(new THREE.Color(accentHex), 0.34);
  const rimLight = new THREE.DirectionalLight(coolRimColor, 1.12);
  rimLight.position.set(-4.6, 3.8, -4.0);
  const warmFill = new THREE.DirectionalLight(0xf2ca88, 0.38);
  warmFill.position.set(4.0, 0.8, 1.4);
  const sideFill = new THREE.DirectionalLight(0x93bce8, 0.30);
  sideFill.position.set(-3.6, 1.8, 3.6);
  const hemi = new THREE.HemisphereLight(0xe4f0fc, 0x222c42, 0.54);
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

  const dataUrl = renderPortraitSceneWithRenderer(renderer, studio.scene, camera, size, 0.94);
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

  const dataUrl = renderPortraitSceneWithRenderer(renderer, studio.scene, camera, size, 0.94);
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
  const envTex = getOrCreateStudioEnvMap(renderer);
  if (envTex) {
    scene.environment = envTex;
    scene.environmentIntensity = 0.48;
  }

  const preset = getArenaThemeLightingPreset(themeId);
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

  const dataUrl = renderPortraitSceneWithRenderer(renderer, scene, camera, size, 0.98);
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
  const fallback = buildUnitSvgFallback(unitDef, star);
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
      const url = png ?? buildUnitSvgFallback(unitDef, star);
      portraitCache.set(`unit:${id}:${star}:${size}`, url);
      return url;
    }
    if (kind === 'tactician') {
      const tid = id as TacticianId;
      const png = bakeSingleTacticianWithWebgl(renderer, materials, tid, size);
      const url = png ?? buildTacticianSvgFallback(tid);
      portraitCache.set(`tactician:${tid}:${size}`, url);
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
}): Promise<void> {
  if (activePrebakePromise) return activePrebakePromise;

  const size = options?.size ?? DEFAULT_BAKE_SIZE;
  const renderer = options?.renderer ?? attachedRenderer;
  const includeArenas = options?.includeArenas ?? true;

  const run = async (): Promise<void> => {
    if (!renderer) {
      for (const u of SEASON1_UNITS) {
        getUnitPortraitUrl(u.id, { size, star: 1 });
      }
      for (const tid of TACTICIAN_IDS) {
        getTacticianPortraitUrl(tid, { size });
      }
      if (includeArenas) {
        for (const theme of ARENA_THEME_IDS) {
          getArenaPreviewUrl(theme, { size });
        }
      }
      return;
    }

    const materials = new PbrMaterialLibrary();
    const unitFactory = new UnitMeshFactory(materials);
    const sharedArena = includeArenas ? new ArenaStageAssembly(materials, 'orbital_elevator_port') : null;
    try {
      const yieldFrame = () =>
        new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
          } else {
            setTimeout(resolve, 0);
          }
        });

      if (sharedArena) {
        for (const theme of ARENA_THEME_IDS) {
          const png = bakeArenaPreview(renderer, materials, theme, size, sharedArena);
          if (png) portraitCache.set(`arena:${theme}:${size}`, png);
        }
        await yieldFrame();
      }

      for (const tid of TACTICIAN_IDS) {
        const png = bakeSingleTacticianWithWebgl(renderer, materials, tid, size);
        if (png) portraitCache.set(`tactician:${tid}:${size}`, png);
      }
      await yieldFrame();

      const batchSize = 6;
      for (let i = 0; i < SEASON1_UNITS.length; i += 1) {
        const u = SEASON1_UNITS[i]!;
        const png = bakeSingleUnitWithWebgl(renderer, unitFactory, u, size, 1);
        if (png) portraitCache.set(`unit:${u.id}:1:${size}`, png);
        if ((i + 1) % batchSize === 0) {
          await yieldFrame();
        }
      }
    } finally {
      sharedArena?.dispose();
      unitFactory.dispose();
      materials.dispose();
    }
  };

  activePrebakePromise = run().finally(() => {
    activePrebakePromise = null;
  });
  return activePrebakePromise;
}
