import * as THREE from 'three';
import { lookupItemById } from '@pkg/contracts';
import { getGameItemIconUrl } from '@pkg/learning-ui';
import type { UnitActorRig } from './unitMeshFactory.js';
import type {
  DamageFloatKind,
  StageDamageEvent,
  StageUnitState,
  UnitScreenProjection,
} from './types.js';

interface PooledDamageFloat {
  active: boolean;
  worldOrigin: THREE.Vector3;
  amount: number;
  kind: DamageFloatKind;
  isCrit: boolean;
  ageSec: number;
  durationSec: number;
  velX: number;
  velY: number;
}

interface PooledGoldFloat {
  active: boolean;
  worldOrigin: THREE.Vector3;
  amount: number;
  ageSec: number;
  durationSec: number;
  driftX: number;
}

const COMPONENT_COLOR: Readonly<Record<string, string>> = {
  C_SWORD: '#F97316',
  C_BOW: '#FACC15',
  C_ROD: '#22D3EE',
  C_TEAR: '#3B82F6',
  C_VEST: '#D97706',
  C_CLOAK: '#A855F7',
  C_BELT: '#22C55E',
  C_GLOVE: '#EF4444',
  C_RUBBING: '#F5C451',
};

const DAMAGE_POOL_SIZE = 64;
const GOLD_FLOAT_POOL_SIZE = 16;
const ITEM_BADGE_PX = 18;
const ITEM_BADGE_GAP_PX = 2.5;
const ITEM_CACHE_SCALE = 2;

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function paintItemBadgeFrame(
  ctx: CanvasRenderingContext2D,
  itemId: string,
  img: HTMLImageElement | null,
): void {
  const s = ITEM_BADGE_PX;
  const normalized = itemId === 'C_SPATULA' ? 'C_RUBBING' : itemId;
  const lookedUp = lookupItemById(normalized);
  const pad = 0.9;
  const inner = s - pad * 2;
  const radius = 3.6;

  ctx.clearRect(0, 0, s, s);
  ctx.save();
  drawRoundedRectPath(ctx, pad, pad, inner, inner, radius);
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, pad, pad, inner, inner);
  } else {
    const accent = COMPONENT_COLOR[normalized] ?? '#F5C451';
    const bg = ctx.createRadialGradient(s * 0.5, s * 0.45, 1, s * 0.5, s * 0.5, s * 0.65);
    bg.addColorStop(0, accent);
    bg.addColorStop(1, '#0B1220');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
  }

  const sheen = ctx.createLinearGradient(0, 0, s, s * 0.65);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();

  drawRoundedRectPath(ctx, pad, pad, inner, inner, radius);
  if (lookedUp?.kind === 'completed') {
    const goldBorder = ctx.createLinearGradient(0, 0, s, s);
    goldBorder.addColorStop(0, '#FFF6C8');
    goldBorder.addColorStop(0.5, '#F5C451');
    goldBorder.addColorStop(1, '#B7791F');
    ctx.lineWidth = 1.65;
    ctx.strokeStyle = goldBorder;
    ctx.stroke();
    return;
  }

  if (lookedUp?.kind === 'emblem') {
    const emblemBorder = ctx.createLinearGradient(0, 0, s, s);
    emblemBorder.addColorStop(0, '#FFF6C8');
    emblemBorder.addColorStop(0.5, '#F5C451');
    emblemBorder.addColorStop(1, '#C084FC');
    ctx.lineWidth = 1.65;
    ctx.strokeStyle = emblemBorder;
    ctx.stroke();
    return;
  }

  if (lookedUp?.kind === 'flag' || normalized === 'I_MOTHERSHIP_FLAG') {
    const flagBorder = ctx.createLinearGradient(0, 0, s, s);
    flagBorder.addColorStop(0, '#FFFDF0');
    flagBorder.addColorStop(0.45, '#FDE047');
    flagBorder.addColorStop(0.85, '#38BDF8');
    flagBorder.addColorStop(1, '#F59E0B');
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = flagBorder;
    ctx.stroke();
    return;
  }

  const accent =
    normalized === 'TOOL_MAGNETIC_REMOVER'
      ? '#38BDF8'
      : normalized === 'TOOL_REFORGER'
        ? '#FB923C'
        : COMPONENT_COLOR[normalized] ?? '#F5C451';
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = accent;
  ctx.stroke();
}

export class StageHudOverlayProjector {
  private readonly canvas: HTMLCanvasElement | null;
  private readonly ctx: CanvasRenderingContext2D | null;
  private stripePattern: CanvasPattern | null = null;

  private viewportWidth = 1;
  private viewportHeight = 1;
  private dpr = 1;
  private enabled = true;

  private readonly ghostHpByUnit = new Map<string, number>();
  private readonly itemIconCache = new Map<string, HTMLCanvasElement>();
  private readonly itemImageCache = new Map<string, HTMLImageElement>();
  private readonly projections: UnitScreenProjection[] = [];
  private readonly damagePool: PooledDamageFloat[] = [];
  private readonly goldFloatPool: PooledGoldFloat[] = [];
  private staggerCounter = 0;
  private goldStaggerCounter = 0;

  private readonly scratchVec = new THREE.Vector3();

  constructor(container: HTMLElement | null, enabled = true) {
    this.enabled = enabled;

    for (let i = 0; i < DAMAGE_POOL_SIZE; i += 1) {
      this.damagePool.push({
        active: false,
        worldOrigin: new THREE.Vector3(),
        amount: 0,
        kind: 'physical',
        isCrit: false,
        ageSec: 0,
        durationSec: 0.85,
        velX: 0,
        velY: 0,
      });
    }

    for (let i = 0; i < GOLD_FLOAT_POOL_SIZE; i += 1) {
      this.goldFloatPool.push({
        active: false,
        worldOrigin: new THREE.Vector3(),
        amount: 0,
        ageSec: 0,
        durationSec: 1.15,
        driftX: 0,
      });
    }

    if (container && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.dataset['stageHudOverlay'] = 'true';
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.pointerEvents = 'none';
      c.style.zIndex = '4';
      container.appendChild(c);
      this.canvas = c;
      let context2d: CanvasRenderingContext2D | null = null;
      try {
        context2d = c.getContext('2d');
      } catch {
        context2d = null;
      }
      this.ctx = context2d;
      if (this.ctx) {
        this.stripePattern = this.buildDiagonalShieldPattern(this.ctx);
      }
    } else {
      this.canvas = null;
      this.ctx = null;
    }
  }

  private buildDiagonalShieldPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (typeof document === 'undefined') return null;
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 8;
    pCanvas.height = 8;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return null;
    pCtx.fillStyle = '#FFFFFF';
    pCtx.fillRect(0, 0, 8, 8);
    pCtx.strokeStyle = '#CBD5E1';
    pCtx.lineWidth = 2.2;
    pCtx.beginPath();
    pCtx.moveTo(-2, 8);
    pCtx.lineTo(8, -2);
    pCtx.moveTo(2, 10);
    pCtx.lineTo(10, 2);
    pCtx.stroke();
    return ctx.createPattern(pCanvas, 'repeat');
  }

  private getOrBuildItemIcon(itemId: string): HTMLCanvasElement | null {
    const cached = this.itemIconCache.get(itemId);
    if (cached) return cached;
    if (typeof document === 'undefined') return null;

    const c = document.createElement('canvas');
    c.width = ITEM_BADGE_PX * ITEM_CACHE_SCALE;
    c.height = ITEM_BADGE_PX * ITEM_CACHE_SCALE;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    ctx.scale(ITEM_CACHE_SCALE, ITEM_CACHE_SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let img = this.itemImageCache.get(itemId) ?? null;
    if (!img && typeof Image !== 'undefined') {
      img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const target = this.itemIconCache.get(itemId);
        const targetCtx = target?.getContext('2d');
        if (!targetCtx) return;
        targetCtx.save();
        targetCtx.setTransform(ITEM_CACHE_SCALE, 0, 0, ITEM_CACHE_SCALE, 0, 0);
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        paintItemBadgeFrame(targetCtx, itemId, img);
        targetCtx.restore();
      };
      img.src = getGameItemIconUrl(itemId);
      this.itemImageCache.set(itemId, img);
    }

    paintItemBadgeFrame(ctx, itemId, img);
    this.itemIconCache.set(itemId, c);
    return c;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.canvas) {
      this.canvas.style.display = enabled ? 'block' : 'none';
    }
  }

  public resize(width: number, height: number, dpr: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.dpr = Math.max(1, dpr);
    if (this.canvas) {
      this.canvas.width = Math.round(this.viewportWidth * this.dpr);
      this.canvas.height = Math.round(this.viewportHeight * this.dpr);
    }
  }

  public spawnDamageFloat(
    event: StageDamageEvent,
    unitRigs: ReadonlyMap<string, UnitActorRig>,
  ): void {
    const slot = this.damagePool.find((d) => !d.active) ?? this.damagePool[0]!;
    let wx = event.worldPos?.x ?? 0;
    let wy = event.worldPos?.y ?? 1.4;
    let wz = event.worldPos?.z ?? 0;

    if (event.targetInstanceId) {
      const rig = unitRigs.get(event.targetInstanceId);
      if (rig) {
        wx = rig.root.position.x;
        wy = rig.root.position.y + rig.headTopLocalY * 0.85;
        wz = rig.root.position.z;
      }
    }

    this.staggerCounter = (this.staggerCounter + 1) % 7;
    const spreadSign = this.staggerCounter % 2 === 0 ? 1 : -1;
    const spreadMag = 18 + (this.staggerCounter % 4) * 9;

    slot.active = true;
    slot.worldOrigin.set(wx, wy, wz);
    slot.amount = Math.max(0, Math.round(event.amount));
    slot.kind = event.kind;
    slot.isCrit = Boolean(event.isCrit);
    slot.ageSec = 0;
    slot.durationSec = slot.isCrit ? 1.02 : 0.82;
    slot.velX = spreadSign * spreadMag;
    slot.velY = slot.isCrit ? -108 : -86;
  }

  public spawnGoldFloat(
    worldPos: { readonly x: number; readonly y: number; readonly z: number },
    goldAmount: number,
  ): void {
    const slot = this.goldFloatPool.find((g) => !g.active) ?? this.goldFloatPool[0]!;
    this.goldStaggerCounter = (this.goldStaggerCounter + 1) % 5;
    const offsets = [0, 14, -14, 24, -24];
    slot.active = true;
    slot.worldOrigin.set(worldPos.x, worldPos.y, worldPos.z);
    slot.amount = Math.max(1, Math.round(goldAmount));
    slot.ageSec = 0;
    slot.durationSec = 1.18;
    slot.driftX = offsets[this.goldStaggerCounter] ?? 0;
  }

  public getActiveGoldFloatCount(): number {
    let count = 0;
    for (const g of this.goldFloatPool) {
      if (g.active) count += 1;
    }
    return count;
  }

  public getProjections(): readonly UnitScreenProjection[] {
    return this.projections;
  }

  public updateAndRender(
    dt: number,
    camera: THREE.PerspectiveCamera,
    unitStates: ReadonlyMap<string, StageUnitState>,
    unitRigs: ReadonlyMap<string, UnitActorRig>,
  ): void {
    this.projections.length = 0;

    for (const [instanceId, state] of unitStates.entries()) {
      const rig = unitRigs.get(instanceId);
      if (!rig) continue;

      const prevGhost = this.ghostHpByUnit.get(instanceId) ?? state.hp;
      const nextGhost =
        state.hp >= prevGhost
          ? state.hp
          : Math.max(state.hp, prevGhost - Math.max(90, state.maxHp * 0.55) * dt);
      this.ghostHpByUnit.set(instanceId, nextGhost);

      this.scratchVec.set(
        rig.root.position.x,
        rig.root.position.y + rig.headTopLocalY * rig.scaleSpring.value,
        rig.root.position.z,
      );
      this.scratchVec.project(camera);

      const inFrustum = this.scratchVec.z >= -1 && this.scratchVec.z <= 1;
      const screenX = Math.round((this.scratchVec.x * 0.5 + 0.5) * this.viewportWidth);
      const screenY = Math.round((-this.scratchVec.y * 0.5 + 0.5) * this.viewportHeight);

      this.projections.push({
        instanceId,
        unitId: state.unitId,
        allegiance: state.allegiance,
        star: state.star,
        screenX,
        screenY,
        visible: inFrustum && state.hp > 0,
        hp: Math.max(0, state.hp),
        maxHp: Math.max(1, state.maxHp),
        ghostHp: Math.max(0, nextGhost),
        shield: Math.max(0, state.shield ?? 0),
        mana: Math.max(0, state.mana),
        maxMana: Math.max(1, state.maxMana),
        statuses: {
          antiHeal: Boolean(state.statuses?.antiHeal),
          armorShred: Boolean(state.statuses?.armorShred),
          mrShred: Boolean(state.statuses?.mrShred),
          ccImmune: Boolean(state.statuses?.ccImmune),
        },
      });
    }

    for (const df of this.damagePool) {
      if (!df.active) continue;
      df.ageSec += dt;
      if (df.ageSec >= df.durationSec) {
        df.active = false;
      }
    }

    for (const gf of this.goldFloatPool) {
      if (!gf.active) continue;
      gf.ageSec += dt;
      if (gf.ageSec >= gf.durationSec) {
        gf.active = false;
      }
    }

    if (!this.enabled || !this.ctx) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    for (const p of this.projections) {
      if (!p.visible) continue;
      const items = unitStates.get(p.instanceId)?.items;
      this.drawUnitOverheadPlate(ctx, p, items);
    }

    for (const df of this.damagePool) {
      if (!df.active) continue;
      this.scratchVec.copy(df.worldOrigin).project(camera);
      if (this.scratchVec.z < -1 || this.scratchVec.z > 1) continue;
      const baseSx = (this.scratchVec.x * 0.5 + 0.5) * this.viewportWidth;
      const baseSy = (-this.scratchVec.y * 0.5 + 0.5) * this.viewportHeight;
      this.drawDamageFloat(ctx, df, baseSx, baseSy);
    }

    for (const gf of this.goldFloatPool) {
      if (!gf.active) continue;
      this.scratchVec.copy(gf.worldOrigin).project(camera);
      if (this.scratchVec.z < -1 || this.scratchVec.z > 1) continue;
      const baseSx = (this.scratchVec.x * 0.5 + 0.5) * this.viewportWidth;
      const baseSy = (-this.scratchVec.y * 0.5 + 0.5) * this.viewportHeight;
      this.drawGoldFloat(ctx, gf, baseSx, baseSy);
    }

    ctx.restore();
  }

  private drawUnitOverheadPlate(
    ctx: CanvasRenderingContext2D,
    p: UnitScreenProjection,
    items?: readonly string[],
  ): void {
    const barW = p.star === 3 ? 86 : p.star === 2 ? 78 : 70;
    const hpH = 8;
    const manaH = 3.5;
    const x0 = Math.round(p.screenX - barW * 0.5);
    const y0 = Math.round(p.screenY - 18);

    const visibleItems = items && items.length > 0 ? items.slice(0, 3) : null;
    if (visibleItems) {
      const itemY = y0 - ITEM_BADGE_PX - 3;
      let itemX = x0;
      for (const itemId of visibleItems) {
        const iconCanvas = this.getOrBuildItemIcon(itemId);
        if (iconCanvas) {
          ctx.drawImage(iconCanvas, itemX, itemY, ITEM_BADGE_PX, ITEM_BADGE_PX);
        }
        itemX += ITEM_BADGE_PX + ITEM_BADGE_GAP_PX;
      }
    }

    const badges: { label: string; bg: string; fg: string }[] = [];
    if (p.statuses.antiHeal) badges.push({ label: '重伤', bg: '#7F1D1D', fg: '#FCA5A5' });
    if (p.statuses.armorShred || p.statuses.mrShred) {
      badges.push({ label: '破甲', bg: '#78350F', fg: '#FDE68A' });
    }
    if (p.statuses.ccImmune) badges.push({ label: '免控', bg: '#1E3A8A', fg: '#DBEAFE' });

    if (badges.length > 0) {
      const totalBadgeW = badges.length * 26 + (badges.length - 1) * 3;
      let bx = Math.round(p.screenX - totalBadgeW * 0.5);
      const by = visibleItems ? y0 - ITEM_BADGE_PX - 17 : y0 - 14;
      ctx.font = '700 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const b of badges) {
        ctx.fillStyle = b.bg;
        ctx.strokeStyle = '#C8AA6E';
        ctx.lineWidth = 0.8;
        ctx.fillRect(bx, by, 26, 11);
        ctx.strokeRect(bx, by, 26, 11);
        ctx.fillStyle = b.fg;
        ctx.fillText(b.label, bx + 13, by + 5.8);
        bx += 29;
      }
    }

    ctx.fillStyle = 'rgba(11, 14, 21, 0.90)';
    ctx.fillRect(x0 - 1, y0 - 1, barW + 2, hpH + manaH + 3);
    ctx.strokeStyle = p.star === 3 ? '#F0DCAA' : '#8C7446';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 1, y0 - 1, barW + 2, hpH + manaH + 3);

    const effectiveTotal = Math.max(p.maxHp, p.hp + p.shield);
    const hpW = (p.hp / effectiveTotal) * barW;
    const ghostW = (p.ghostHp / effectiveTotal) * barW;
    const shieldW = (p.shield / effectiveTotal) * barW;

    if (ghostW > hpW + 0.5) {
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(x0 + hpW, y0, ghostW - hpW, hpH);
    }

    ctx.fillStyle = p.allegiance === 'ally' ? '#34D399' : '#EF4444';
    ctx.fillRect(x0, y0, hpW, hpH);

    if (shieldW > 0.5) {
      ctx.fillStyle = this.stripePattern ?? '#FFFFFF';
      ctx.fillRect(x0 + hpW, y0, shieldW, hpH);
    }

    const maxTicks = Math.min(40, Math.floor(effectiveTotal / 250));
    for (let step = 1; step <= maxTicks; step += 1) {
      const hpMark = step * 250;
      if (hpMark >= effectiveTotal) break;
      const tx = Math.round(x0 + (hpMark / effectiveTotal) * barW) + 0.5;
      const isMajor1000 = step % 4 === 0;
      ctx.strokeStyle = isMajor1000 ? '#07090E' : 'rgba(11, 14, 21, 0.72)';
      ctx.lineWidth = isMajor1000 ? 1.8 : 1.0;
      ctx.beginPath();
      ctx.moveTo(tx, y0);
      ctx.lineTo(tx, y0 + (isMajor1000 ? hpH : hpH * 0.66));
      ctx.stroke();
    }

    const manaRatio = Math.min(1, p.mana / p.maxMana);
    ctx.fillStyle = manaRatio >= 0.85 ? '#FDE68A' : '#38BDF8';
    ctx.fillRect(x0, y0 + hpH + 1, barW * manaRatio, manaH);

    ctx.font = '800 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.star === 3 ? '#FDE68A' : p.star === 2 ? '#E2E8F0' : '#D99B66';
    ctx.fillText('★'.repeat(p.star), x0 - 4, y0 + hpH * 0.5);
  }

  private drawDamageFloat(
    ctx: CanvasRenderingContext2D,
    df: PooledDamageFloat,
    baseSx: number,
    baseSy: number,
  ): void {
    const t = df.ageSec / df.durationSec;
    const gravity = 210;
    const px = baseSx + df.velX * df.ageSec;
    const py = baseSy + df.velY * df.ageSec + 0.5 * gravity * df.ageSec * df.ageSec;
    const alpha = t < 0.68 ? 1 : 1 - (t - 0.68) / 0.32;

    const baseFontPx = 15;
    const fontPx = df.isCrit ? Math.round(baseFontPx * 1.45) : baseFontPx;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(px, py);

    if (df.isCrit) {
      ctx.fillStyle = 'rgba(28, 21, 10, 0.88)';
      ctx.strokeStyle = '#F0DCAA';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const spikes = 10;
      for (let i = 0; i < spikes * 2; i += 1) {
        const r = i % 2 === 0 ? 24 : 15;
        const ang = (i / (spikes * 2)) * Math.PI * 2;
        const sx = Math.cos(ang) * r * 1.35;
        const sy = Math.sin(ang) * r * 0.72;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.font = `800 ${fontPx}px "PingFang SC", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fill =
      df.kind === 'physical'
        ? '#F59E0B'
        : df.kind === 'magic'
          ? '#38BDF8'
          : '#FFFFFF';

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090C12';
    const label = df.isCrit ? `${df.amount}!` : `${df.amount}`;
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  private drawGoldFloat(
    ctx: CanvasRenderingContext2D,
    gf: PooledGoldFloat,
    baseSx: number,
    baseSy: number,
  ): void {
    const t = Math.min(1, gf.ageSec / gf.durationSec);
    const easeOut = 1 - Math.pow(1 - t, 3);
    const popScale =
      t < 0.14
        ? 0.62 + (t / 0.14) * 0.62
        : t < 0.28
          ? 1.24 - ((t - 0.14) / 0.14) * 0.2
          : 1.04 + (t - 0.28) * 0.06;
    const alpha = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34;
    const px = baseSx + gf.driftX * easeOut;
    const py = baseSy - 16 - easeOut * 72;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(px, py);
    ctx.scale(popScale, popScale);

    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    aura.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
    aura.addColorStop(0.55, 'rgba(245, 158, 11, 0.16)');
    aura.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    const label = `+${gf.amount}G`;
    ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textGrad = ctx.createLinearGradient(0, -12, 0, 12);
    textGrad.addColorStop(0, '#FFFDF0');
    textGrad.addColorStop(0.45, '#FDE047');
    textGrad.addColorStop(1, '#F59E0B');

    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = '#261404';
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = textGrad;
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  public dispose(): void {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.itemIconCache.clear();
    this.itemImageCache.clear();
    this.ghostHpByUnit.clear();
    this.projections.length = 0;
  }
}
