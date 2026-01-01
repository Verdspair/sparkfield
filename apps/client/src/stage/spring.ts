import {
  BENCH_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  PLAYER_DEPLOY_ROWS,
  type HexCoord,
} from '@pkg/contracts';

export class SpringDamper {
  public value: number;
  public target: number;
  public velocity: number;
  public readonly omega: number;
  public readonly zeta: number;

  constructor(initial = 0, omega = 26, zeta = 0.68) {
    this.value = initial;
    this.target = initial;
    this.velocity = 0;
    this.omega = omega;
    this.zeta = zeta;
  }

  public setTarget(nextTarget: number): void {
    this.target = nextTarget;
  }

  public snap(instantValue: number): void {
    this.value = instantValue;
    this.target = instantValue;
    this.velocity = 0;
  }

  public impulse(deltaVelocity: number): void {
    this.velocity += deltaVelocity;
  }

  public step(dtSeconds: number): number {
    if (dtSeconds <= 0) return this.value;
    const clampedDt = Math.min(dtSeconds, 0.1);
    const maxStep = 1 / 120;
    const steps = Math.max(1, Math.ceil(clampedDt / maxStep));
    const h = clampedDt / steps;
    const k = this.omega * this.omega;
    const c = 2 * this.zeta * this.omega;

    for (let i = 0; i < steps; i += 1) {
      const displacement = this.value - this.target;
      const accel = -k * displacement - c * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }

    if (Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-3) {
      this.value = this.target;
      this.velocity = 0;
    }
    return this.value;
  }

  public isSettled(eps = 1e-3): boolean {
    return Math.abs(this.value - this.target) <= eps && Math.abs(this.velocity) <= eps;
  }
}

export class SpringDamper3D {
  public readonly x: SpringDamper;
  public readonly y: SpringDamper;
  public readonly z: SpringDamper;

  constructor(ix = 0, iy = 0, iz = 0, omega = 26, zeta = 0.68) {
    this.x = new SpringDamper(ix, omega, zeta);
    this.y = new SpringDamper(iy, omega, zeta);
    this.z = new SpringDamper(iz, omega, zeta);
  }

  public setTarget(tx: number, ty: number, tz: number): void {
    this.x.setTarget(tx);
    this.y.setTarget(ty);
    this.z.setTarget(tz);
  }

  public snap(sx: number, sy: number, sz: number): void {
    this.x.snap(sx);
    this.y.snap(sy);
    this.z.snap(sz);
  }

  public impulse(vx: number, vy: number, vz: number): void {
    this.x.impulse(vx);
    this.y.impulse(vy);
    this.z.impulse(vz);
  }

  public step(dt: number): { x: number; y: number; z: number } {
    return {
      x: this.x.step(dt),
      y: this.y.step(dt),
      z: this.z.step(dt),
    };
  }
}

export const HEX_RADIUS = 0.96; 
export const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS; 
export const HEX_ROW_SPACING = 1.5 * HEX_RADIUS; 

export const BENCH_Z_OFFSET = 6.72; 
export const BENCH_SLOT_SPACING = 1.46;
export const SELL_ZONE_Z_THRESHOLD = 8.15;

const GRID_TOTAL_WIDTH = (BOARD_COLS - 1) * HEX_WIDTH + HEX_WIDTH * 0.5;
const GRID_ORIGIN_X = -GRID_TOTAL_WIDTH * 0.5;
const GRID_ORIGIN_Z = -((BOARD_ROWS - 1) * HEX_ROW_SPACING) * 0.5 - 0.35;

export function deployRowToBoardRow(deployRow: number): number {
  return deployRow + (BOARD_ROWS - PLAYER_DEPLOY_ROWS);
}

export function boardRowToDeployRow(boardRow: number): number | null {
  const start = BOARD_ROWS - PLAYER_DEPLOY_ROWS;
  if (boardRow < start || boardRow >= BOARD_ROWS) return null;
  return boardRow - start;
}

export function hexToStageXZ(row: number, col: number): { x: number; z: number } {
  const oddRowShift = (row & 1) === 1 ? HEX_WIDTH * 0.5 : 0;
  const x = GRID_ORIGIN_X + col * HEX_WIDTH + oddRowShift;
  const z = GRID_ORIGIN_Z + row * HEX_ROW_SPACING;
  return { x, z };
}

export function stageXZToHex(worldX: number, worldZ: number): HexCoord | null {
  const relZ = worldZ - GRID_ORIGIN_Z;
  const relX = worldX - GRID_ORIGIN_X;

  const fracR = relZ / HEX_ROW_SPACING;
  const fracQ = relX / HEX_WIDTH - fracR * 0.5;
  const fracS = -fracQ - fracR;

  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  const s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }

  const row = r;
  const col = q + ((r - (r & 1)) >> 1);

  if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
    return null;
  }

  const center = hexToStageXZ(row, col);
  const dx = worldX - center.x;
  const dz = worldZ - center.z;
  if (dx * dx + dz * dz > (HEX_RADIUS * 1.06) ** 2) {
    return null;
  }

  return { row, col };
}

export function benchSlotToStageXZ(slot: number): { x: number; z: number } {
  const clamped = Math.max(0, Math.min(BENCH_SLOTS - 1, slot));
  const x = (clamped - (BENCH_SLOTS - 1) * 0.5) * BENCH_SLOT_SPACING;
  return { x, z: BENCH_Z_OFFSET };
}

export function stageXZToBenchSlot(worldX: number, worldZ: number): number | null {
  if (Math.abs(worldZ - BENCH_Z_OFFSET) > 0.78) return null;
  const rawIdx = worldX / BENCH_SLOT_SPACING + (BENCH_SLOTS - 1) * 0.5;
  const slot = Math.round(rawIdx);
  if (slot < 0 || slot >= BENCH_SLOTS) return null;
  const center = benchSlotToStageXZ(slot);
  if (Math.abs(worldX - center.x) > BENCH_SLOT_SPACING * 0.48) return null;
  return slot;
}

export function offsetToAxial(coord: HexCoord): { q: number; r: number } {
  const q = coord.col - ((coord.row - (coord.row & 1)) >> 1);
  return { q, r: coord.row };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const aa = offsetToAxial(a);
  const ba = offsetToAxial(b);
  const dq = aa.q - ba.q;
  const dr = aa.r - ba.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) * 0.5;
}

export function getHexesWithinRange(origin: HexCoord, range: number): HexCoord[] {
  const result: HexCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const candidate = { row, col };
      const dist = hexDistance(origin, candidate);
      if (dist >= 1 && dist <= range) {
        result.push(candidate);
      }
    }
  }
  return result;
}

export function getSeatWorldOrigin(seatIndex: number): { x: number; z: number } {
  const normalized = ((seatIndex % 8) + 8) % 8;
  if (normalized === 0) return { x: 0, z: 0 };
  const angle = (normalized / 8) * Math.PI * 2 - Math.PI * 0.5;
  const radius = 34;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius - 14,
  };
}
