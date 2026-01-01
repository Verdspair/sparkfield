import * as THREE from 'three';

export interface PbrFourMapSet {
  readonly albedoMap: THREE.DataTexture;
  readonly normalMap: THREE.DataTexture;
  readonly roughnessMap: THREE.DataTexture;
  readonly aoCurvatureMap: THREE.DataTexture;
}

function hash2d(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2d(x: number, y: number, period: number, seed: number): number {
  const px = ((x % period) + period) % period;
  const py = ((y % period) + period) % period;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const sx = px - x0;
  const sy = py - y0;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);

  const n00 = hash2d(x0, y0, seed);
  const n10 = hash2d(x1, y0, seed);
  const n01 = hash2d(x0, y1, seed);
  const n11 = hash2d(x1, y1, seed);

  const nx0 = n00 + (n10 - n00) * u;
  const nx1 = n01 + (n11 - n01) * u;
  return nx0 + (nx1 - nx0) * v;
}

function fbmTileable(u: number, v: number, baseFreq: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise2d(u * freq, v * freq, freq, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function toByte(v01: number): number {
  return Math.round(clamp01(v01) * 255);
}

function configureDataTexture(
  data: Uint8Array,
  size: number,
  isSrgb: boolean,
  repeat = 1,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.channel = 0;
  tex.needsUpdate = true;
  return tex;
}

function heightFieldToNormalMap(
  heights: Float32Array,
  size: number,
  strength: number,
  repeat = 1,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const hL = heights[y * size + xm] ?? 0;
      const hR = heights[y * size + xp] ?? 0;
      const hD = heights[ym * size + x] ?? 0;
      const hU = heights[yp * size + x] ?? 0;

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      data[idx] = toByte(dx * invLen * 0.5 + 0.5);
      data[idx + 1] = toByte(dy * invLen * 0.5 + 0.5);
      data[idx + 2] = toByte(dz * invLen * 0.5 + 0.5);
      data[idx + 3] = 255;
    }
  }
  return configureDataTexture(data, size, false, repeat);
}

export function bakeBasaltTitaniumMaps(size = 128): PbrFourMapSet {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const grain = fbmTileable(u, v, 8, 4, 101);
      const scratchA = valueNoise2d(u * 48 + v * 12, v * 6, 48, 211);
      const scratchB = valueNoise2d(u * 8, v * 44 - u * 10, 44, 307);
      const microScratch = Math.max(scratchA, scratchB);

      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const seamGroove = edgeDist < 0.035 ? (0.035 - edgeDist) / 0.035 : 0;
      const chamferCurvature = edgeDist >= 0.035 && edgeDist < 0.075 ? 1 - Math.abs(edgeDist - 0.055) / 0.02 : 0;

      heights[idx] = grain * 0.55 - seamGroove * 0.9 + chamferCurvature * 0.18 + microScratch * 0.12;

      const lum = 0.088 + grain * 0.052 + chamferCurvature * 0.016 - seamGroove * 0.012;
      const clampedLum = Math.max(0.08, Math.min(0.16, lum));
      albedo[p4] = toByte(clampedLum * 0.92);
      albedo[p4 + 1] = toByte(clampedLum * 0.98);
      albedo[p4 + 2] = toByte(Math.min(0.16, clampedLum * 1.10));
      albedo[p4 + 3] = 255;

      const roughVal = Math.max(
        0.72,
        Math.min(0.86, 0.74 + grain * 0.07 + microScratch * 0.045 - chamferCurvature * 0.02),
      );
      const rByte = toByte(roughVal);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      const aoVal = clamp01(1.0 - seamGroove * 0.52 - (1 - grain) * 0.12);
      const metalVal = clamp01(0.18 + chamferCurvature * 0.24);
      aoCurv[p4] = toByte(aoVal);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(metalVal);
      aoCurv[p4 + 3] = toByte(chamferCurvature);
    }
  }

  return {
    albedoMap: configureDataTexture(albedo, size, true, 2),
    normalMap: heightFieldToNormalMap(heights, size, 1.85, 2),
    roughnessMap: configureDataTexture(roughness, size, false, 2),
    aoCurvatureMap: configureDataTexture(aoCurv, size, false, 2),
  };
}

export function bakeBrushedChampagneGoldMaps(size = 128): PbrFourMapSet {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const brushFine = valueNoise2d(u * 4, v * 64, 64, 503);
      const brushMed = valueNoise2d(u * 2, v * 32, 32, 607);
      const brush = brushFine * 0.65 + brushMed * 0.35;

      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const wornEdge = edgeDist < 0.032 ? 1.0 - edgeDist / 0.032 : 0;
      const innerRecess = edgeDist >= 0.032 && edgeDist < 0.055 ? 0.35 : 0;

      heights[idx] = brush * 0.42 + wornEdge * 0.35 - innerRecess * 0.25;

      const rCol = 0.784 * (0.94 + brush * 0.10) * (1 - wornEdge) + 0.941 * wornEdge;
      const gCol = 0.667 * (0.94 + brush * 0.10) * (1 - wornEdge) + 0.863 * wornEdge;
      const bCol = 0.431 * (0.94 + brush * 0.10) * (1 - wornEdge) + 0.667 * wornEdge;

      albedo[p4] = toByte(rCol);
      albedo[p4 + 1] = toByte(gCol);
      albedo[p4 + 2] = toByte(bCol);
      albedo[p4 + 3] = 255;

      const baseRough = 0.25 + brush * 0.13; 
      const finalRough = wornEdge > 0.25 ? 0.18 + (1 - wornEdge) * 0.07 : baseRough;
      const finalMetal = wornEdge > 0.25 ? 0.95 : 0.88 + brush * 0.04;
      const aoVal = clamp01(1.0 - innerRecess * 0.38);

      const rByte = toByte(finalRough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(aoVal);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(finalMetal);
      aoCurv[p4 + 3] = toByte(wornEdge);
    }
  }

  return {
    albedoMap: configureDataTexture(albedo, size, true, 1),
    normalMap: heightFieldToNormalMap(heights, size, 1.35, 1),
    roughnessMap: configureDataTexture(roughness, size, false, 1),
    aoCurvatureMap: configureDataTexture(aoCurv, size, false, 1),
  };
}

export function bakeWhitePorcelainArmorMaps(size = 64): PbrFourMapSet {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const sheen = fbmTileable(u, v, 6, 3, 733);
      const panelLine = Math.abs(v - 0.5) < 0.025 || Math.abs(u - 0.5) < 0.025 ? 1 : 0;
      heights[idx] = sheen * 0.25 - panelLine * 0.65;

      const base = Math.min(0.815, 0.74 + sheen * 0.065 - panelLine * 0.08);
      albedo[p4] = toByte(base);
      albedo[p4 + 1] = toByte(base * 0.99);
      albedo[p4 + 2] = toByte(Math.min(0.82, base * 1.01));
      albedo[p4 + 3] = 255;

      const rough = 0.28 + sheen * 0.14 + panelLine * 0.12;
      const rByte = toByte(rough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(panelLine ? 0.62 : 0.98);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.14);
      aoCurv[p4 + 3] = toByte(panelLine ? 0 : 0.25);
    }
  }

  return {
    albedoMap: configureDataTexture(albedo, size, true, 1),
    normalMap: heightFieldToNormalMap(heights, size, 1.15, 1),
    roughnessMap: configureDataTexture(roughness, size, false, 1),
    aoCurvatureMap: configureDataTexture(aoCurv, size, false, 1),
  };
}

export function bakeSapphirePhotonLatticeMaps(size = 64): PbrFourMapSet {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const lattice =
        Math.abs(Math.sin((u + v * 0.5) * Math.PI * 8)) *
        Math.abs(Math.sin((v - u * 0.5) * Math.PI * 8));
      const facet = clamp01(lattice);
      heights[idx] = facet * 0.65;

      albedo[p4] = toByte(0.10 + facet * 0.14);
      albedo[p4 + 1] = toByte(0.32 + facet * 0.28);
      albedo[p4 + 2] = toByte(0.68 + facet * 0.24);
      albedo[p4 + 3] = 255;

      const rByte = toByte(0.16 + (1 - facet) * 0.14);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(0.75 + facet * 0.25);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.55 + facet * 0.30);
      aoCurv[p4 + 3] = toByte(facet);
    }
  }

  return {
    albedoMap: configureDataTexture(albedo, size, true, 2),
    normalMap: heightFieldToNormalMap(heights, size, 1.5, 2),
    roughnessMap: configureDataTexture(roughness, size, false, 2),
    aoCurvatureMap: configureDataTexture(aoCurv, size, false, 2),
  };
}

export function bakeRadialContactShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const falloff = r >= 1 ? 0 : Math.pow(Math.cos(r * Math.PI * 0.5), 1.85);
      const p4 = (y * size + x) * 4;
      data[p4] = 6;
      data[p4 + 1] = 9;
      data[p4 + 2] = 15;
      data[p4 + 3] = toByte(falloff * 0.72);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function buildProceduralStudioEnvMap(
  renderer: THREE.WebGLRenderer,
): { envTexture: THREE.Texture; renderTarget: THREE.WebGLRenderTarget } {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0d121c);

  const keyPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 2.05, 1.65), side: THREE.DoubleSide }),
  );
  keyPanel.position.set(0, 11, -3);
  keyPanel.rotation.x = Math.PI * 0.5;
  envScene.add(keyPanel);

  const rimPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.35, 1.85), side: THREE.DoubleSide }),
  );
  rimPanel.position.set(-10, 5, -9);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  const fillPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.20, 0.85), side: THREE.DoubleSide }),
  );
  fillPanel.position.set(11, 4, 4);
  fillPanel.lookAt(0, 0, 0);
  envScene.add(fillPanel);

  const bounceFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.14, 0.17, 0.23), side: THREE.DoubleSide }),
  );
  bounceFloor.position.set(0, -8, 0);
  bounceFloor.rotation.x = -Math.PI * 0.5;
  envScene.add(bounceFloor);

  const renderTarget = pmrem.fromScene(envScene, 0.04);
  keyPanel.geometry.dispose();
  (keyPanel.material as THREE.Material).dispose();
  rimPanel.geometry.dispose();
  (rimPanel.material as THREE.Material).dispose();
  fillPanel.geometry.dispose();
  (fillPanel.material as THREE.Material).dispose();
  bounceFloor.geometry.dispose();
  (bounceFloor.material as THREE.Material).dispose();
  pmrem.dispose();

  return { envTexture: renderTarget.texture, renderTarget };
}

const FACTION_HEX_COLORS: Readonly<Record<string, number>> = {
  戴森工团: 0xd9a441,
  云端星环: 0x60a5fa,
  钟慢远征: 0x7dd3fc,
  木卫冰海: 0x2dd4bf,
  深空阵列: 0xa78bfa,
  反物质院: 0xe879f9,
  星门摆渡: 0xf59e0b,
  失控蜂群: 0x94a3b8,
};

export class PbrMaterialLibrary {
  public readonly basaltMaps: PbrFourMapSet;
  public readonly champagneGoldMaps: PbrFourMapSet;
  public readonly porcelainMaps: PbrFourMapSet;
  public readonly sapphireMaps: PbrFourMapSet;
  public readonly contactShadowTex: THREE.DataTexture;

  public readonly hexTileBasaltMat: THREE.MeshStandardMaterial;
  public readonly hexBezelGoldMat: THREE.MeshStandardMaterial;
  public readonly deckArmorMat: THREE.MeshStandardMaterial;
  public readonly brushedGoldMat: THREE.MeshStandardMaterial;
  public readonly porcelainArmorMat: THREE.MeshStandardMaterial;
  public readonly sapphireLatticeMat: THREE.MeshStandardMaterial;
  public readonly cryoGlassMat: THREE.MeshPhysicalMaterial;

  public readonly starPedestal1Mat: THREE.MeshStandardMaterial;
  public readonly starPedestal2Mat: THREE.MeshStandardMaterial;
  public readonly starPedestal3Mat: THREE.MeshStandardMaterial;

  public readonly allyRingMat: THREE.MeshStandardMaterial;
  public readonly enemyRingMat: THREE.MeshStandardMaterial;
  public readonly contactShadowMat: THREE.MeshBasicMaterial;

  private readonly factionMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly extraDisposables: { dispose(): void }[] = [];

  constructor() {
    this.basaltMaps = bakeBasaltTitaniumMaps(128);
    this.champagneGoldMaps = bakeBrushedChampagneGoldMaps(128);
    this.porcelainMaps = bakeWhitePorcelainArmorMaps(64);
    this.sapphireMaps = bakeSapphirePhotonLatticeMaps(64);
    this.contactShadowTex = bakeRadialContactShadowTexture(64);

    this.hexTileBasaltMat = new THREE.MeshStandardMaterial({
      map: this.basaltMaps.albedoMap,
      normalMap: this.basaltMaps.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: this.basaltMaps.aoCurvatureMap,
      metalnessMap: this.basaltMaps.aoCurvatureMap,
      aoMap: this.basaltMaps.aoCurvatureMap,
      aoMapIntensity: 0.85,
      roughness: 1.0,
      metalness: 1.0,
    });

    this.hexBezelGoldMat = new THREE.MeshStandardMaterial({
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: this.champagneGoldMaps.aoCurvatureMap,
      metalnessMap: this.champagneGoldMaps.aoCurvatureMap,
      aoMap: this.champagneGoldMaps.aoCurvatureMap,
      roughness: 1.0,
      metalness: 1.0,
      transparent: true,
      opacity: 1.0,
    });

    this.deckArmorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x9ca3af),
      map: this.basaltMaps.albedoMap,
      normalMap: this.basaltMaps.normalMap,
      roughnessMap: this.basaltMaps.roughnessMap,
      roughness: 0.88,
      metalness: 0.35,
    });

    this.brushedGoldMat = new THREE.MeshStandardMaterial({
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      roughnessMap: this.champagneGoldMaps.aoCurvatureMap,
      metalnessMap: this.champagneGoldMaps.aoCurvatureMap,
      aoMap: this.champagneGoldMaps.aoCurvatureMap,
      roughness: 1.0,
      metalness: 1.0,
    });

    this.porcelainArmorMat = new THREE.MeshStandardMaterial({
      map: this.porcelainMaps.albedoMap,
      normalMap: this.porcelainMaps.normalMap,
      roughnessMap: this.porcelainMaps.aoCurvatureMap,
      metalnessMap: this.porcelainMaps.aoCurvatureMap,
      aoMap: this.porcelainMaps.aoCurvatureMap,
      roughness: 1.0,
      metalness: 1.0,
    });

    this.sapphireLatticeMat = new THREE.MeshStandardMaterial({
      map: this.sapphireMaps.albedoMap,
      normalMap: this.sapphireMaps.normalMap,
      roughnessMap: this.sapphireMaps.aoCurvatureMap,
      metalnessMap: this.sapphireMaps.aoCurvatureMap,
      aoMap: this.sapphireMaps.aoCurvatureMap,
      roughness: 1.0,
      metalness: 1.0,
      emissive: new THREE.Color(0x1d4ed8),
      emissiveIntensity: 0.32,
    });

    this.cryoGlassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x88e2f5),
      roughness: 0.14,
      metalness: 0.08,
      transmission: 0.62,
      transparent: true,
      opacity: 0.56,
      emissive: new THREE.Color(0x22d3ee),
      emissiveIntensity: 0.25,
    });

    this.starPedestal1Mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xa66e44),
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.46,
      metalness: 0.78,
    });

    this.starPedestal2Mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdbe5f0),
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.24,
      metalness: 0.92,
    });

    this.starPedestal3Mat = new THREE.MeshStandardMaterial({
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.20,
      metalness: 0.96,
      emissive: new THREE.Color(0xc8aa6e),
      emissiveIntensity: 0.22,
    });

    this.allyRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5cc8d6),
      roughness: 0.30,
      metalness: 0.82,
      emissive: new THREE.Color(0x236c78),
      emissiveIntensity: 0.35,
    });

    this.enemyRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc94a5a),
      roughness: 0.32,
      metalness: 0.80,
      emissive: new THREE.Color(0x6e1a26),
      emissiveIntensity: 0.35,
    });

    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
    });
  }

  public getFactionAccentMaterial(faction: string): THREE.MeshStandardMaterial {
    const existing = this.factionMaterials.get(faction);
    if (existing) return existing;

    const hex = FACTION_HEX_COLORS[faction] ?? 0xc8aa6e;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      normalMap: this.porcelainMaps.normalMap,
      roughnessMap: this.porcelainMaps.roughnessMap,
      roughness: 0.34,
      metalness: 0.72,
    });
    this.factionMaterials.set(faction, mat);
    return mat;
  }

  public createBloomEmissiveMaterial(colorHex: number, intensity = 2.1): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: intensity,
      roughness: 0.22,
      metalness: 0.35,
      toneMapped: false,
    });
    this.extraDisposables.push(mat);
    return mat;
  }

  public dispose(): void {
    const mapSets = [this.basaltMaps, this.champagneGoldMaps, this.porcelainMaps, this.sapphireMaps];
    for (const s of mapSets) {
      s.albedoMap.dispose();
      s.normalMap.dispose();
      s.roughnessMap.dispose();
      s.aoCurvatureMap.dispose();
    }
    this.contactShadowTex.dispose();

    const coreMats = [
      this.hexTileBasaltMat,
      this.hexBezelGoldMat,
      this.deckArmorMat,
      this.brushedGoldMat,
      this.porcelainArmorMat,
      this.sapphireLatticeMat,
      this.cryoGlassMat,
      this.starPedestal1Mat,
      this.starPedestal2Mat,
      this.starPedestal3Mat,
      this.allyRingMat,
      this.enemyRingMat,
      this.contactShadowMat,
    ];
    for (const m of coreMats) m.dispose();
    for (const m of this.factionMaterials.values()) m.dispose();
    for (const d of this.extraDisposables) d.dispose();
    this.factionMaterials.clear();
  }
}
