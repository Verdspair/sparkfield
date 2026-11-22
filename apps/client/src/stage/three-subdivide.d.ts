declare module 'three-subdivide' {
  import type * as THREE from 'three';

  export interface LoopSubdivisionParams {
    split?: boolean;
    uvSmooth?: boolean;
    preserveEdges?: boolean;
    flatOnly?: boolean;
    maxTriangles?: number;
  }

  export class LoopSubdivision {
    static modify(
      geometry: THREE.BufferGeometry,
      iterations?: number,
      params?: LoopSubdivisionParams,
    ): THREE.BufferGeometry;
  }
}
