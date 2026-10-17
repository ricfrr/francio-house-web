/**
 * Plants and landscape for the street scene. Everything is instanced or merged,
 * so a whole garden costs a handful of draw calls.
 */
import * as THREE from 'three';
import { rng } from './noise';

export interface Clump {
  x: number; y: number; z: number;
  /** ellipsoid radii */
  rx: number; ry: number; rz: number;
  count: number;
  /** size of each card in metres */
  size: number;
  tint: THREE.Color;
}

type Time = { value: number };

/** Crossed alpha cards scattered through ellipsoids: tree crowns and bushes. */
export function foliage(map: THREE.Texture, clumps: Clump[], time: Time, seed = 1): THREE.InstancedMesh {
  const total = clumps.reduce((a, c) => a + c.count, 0);
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.6;
        float sw = position.y + 0.5;
        transformed.x += sin(uTime * 1.4 + ph) * 0.05 * sw;
        transformed.y += cos(uTime * 1.1 + ph * 1.3) * 0.025 * sw;`,
      );
  };
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, total);
  const r = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  for (const c of clumps) {
    for (let k = 0; k < c.count; k++, i++) {
      let a: number, b: number, d: number;
      do {
        a = r() * 2 - 1; b = r() * 2 - 1; d = r() * 2 - 1;
      } while (a * a + b * b + d * d > 1);
      p.set(c.x + a * c.rx, c.y + b * c.ry, c.z + d * c.rz);
      e.set((r() - 0.5) * 1.4 + b * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.8, 'YXZ');
      q.setFromEuler(e);
      const s = c.size * (0.7 + r() * 0.6);
      sc.set(s, s, s);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
      // lighter on top, darker underneath: cheap self-shadowing
      col.copy(c.tint).multiplyScalar(0.6 + 0.5 * (b * 0.5 + 0.5) + (r() - 0.5) * 0.2);
      mesh.setColorAt(i, col);
    }
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Blades of dry grass; `sample` returns a spot (or null to skip). */
export function grass(count: number, sample: (r: () => number) => [number, number] | null, time: Time, seed = 7): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 3);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * 0.05 * (1 - y * 0.85));
    pos.setZ(i, y * y * 0.3);
  }
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vY = position.y;
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        transformed.x += sin(uTime * 1.8 + ph) * 0.35 * position.y * position.y;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.5, 1.15, vY);');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const r = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const at = sample(r);
    if (!at) continue;
    p.set(at[0], 0, at[1]);
    e.set((r() - 0.5) * 0.3, r() * Math.PI * 2, 0, 'YXZ');
    q.setFromEuler(e);
    const h = 0.16 + r() * 0.3;
    sc.set(0.7 + r() * 0.6, h, 1);
    m.compose(p, q, sc);
    mesh.setMatrixAt(n, m);
    const dry = r();
    col.setRGB(0.38 + dry * 0.3, 0.45 + dry * 0.12, 0.2 + dry * 0.1);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Layered ridges of hills around the horizon. Colours are set every frame (haze + time of day). */
export function hills(): { group: THREE.Group; layers: THREE.Mesh[] } {
  const group = new THREE.Group();
  const layers: THREE.Mesh[] = [];
  const specs = [
    { R: 380, base: 22, amp: 34, f: 5, seed: 3 },
    { R: 335, base: 14, amp: 26, f: 7, seed: 9 },
    { R: 300, base: 6, amp: 17, f: 11, seed: 15 },
  ];
  const SEG = 160;
  for (const s of specs) {
    const r = rng(s.seed);
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    const pts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const h = s.base + s.amp * (0.5 + 0.28 * Math.sin(a * s.f + ph[0]) + 0.17 * Math.sin(a * s.f * 2.3 + ph[1]) + 0.08 * Math.sin(a * s.f * 5.1 + ph[2]));
      const x = Math.cos(a) * s.R, z = Math.sin(a) * s.R;
      pts.push(x, -4, z, x, h, z);
      if (i < SEG) {
        const o = i * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x607050, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    mesh.renderOrder = -0.5;
    mesh.frustumCulled = false;
    group.add(mesh);
    layers.push(mesh);
  }
  return { group, layers };
}
