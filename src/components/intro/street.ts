/**
 * The street scene: a plain white house, built from boxes, with an outside staircase
 * leading to a door. Scroll progress (0 → 1) drives the camera up the stairs and through
 * the door. The inside of the house is rendered fully transparent, so through the open
 * door you see the real website, which sits right behind the canvas.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- house dimensions (metres) ----
const W = 12; // x
const D = 9; // z
const FLOOR = 3.2; // first-floor level
const HEIGHT = 6.6;
const WALL = 0.3;

const STEPS = 18;
const TREAD = 0.3;
const RISER = FLOOR / STEPS;
const STAIR_X0 = -W / 2 - 1.5;
const STAIR_X1 = -W / 2;
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;
const STAIR_Z_BOTTOM = 3.4;
const STAIR_Z_TOP = STAIR_Z_BOTTOM - STEPS * TREAD;
const LANDING_Z_END = STAIR_Z_TOP - 1.6;
const DOOR_Z = (STAIR_Z_TOP + LANDING_Z_END) / 2;
const DOOR_W = 1.1;
const DOOR_H = 2.3;

// ---- camera path ----
type Key = { t: number; pos: [number, number, number]; look: [number, number, number] };
const EYE = 1.62;
const KEYS: Key[] = [
  { t: 0.0, pos: [5, 1.7, 25], look: [-0.8, 3.5, 0] },
  { t: 0.2, pos: [-1.2, 1.7, 14.5], look: [-4.8, 3.0, 0] },
  { t: 0.36, pos: [STAIR_XC, EYE, 7.2], look: [STAIR_XC, 2.6, -2] },
  { t: 0.58, pos: [STAIR_XC, FLOOR - RISER * 2 + EYE, STAIR_Z_TOP + 0.5], look: [STAIR_XC - 0.3, FLOOR + 1.6, -6] },
  { t: 0.7, pos: [-10.2, FLOOR + 1.45, DOOR_Z], look: [-6, FLOOR + 1.15, DOOR_Z] },
  { t: 0.84, pos: [-7.25, FLOOR + 1.3, DOOR_Z], look: [-6, FLOOR + 1.2, DOOR_Z] },
  { t: 1.0, pos: [-5.35, FLOOR + 1.2, DOOR_Z], look: [2, FLOOR + 1.2, DOOR_Z] },
];

export const DOOR_OPEN_FROM = 0.715;
export const DOOR_OPEN_TO = 0.86;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- small procedural textures ----
function plasterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 236 + Math.random() * 19;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stickerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#f7f1e3';
  x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f5c31c';
  x.beginPath(); x.arc(64, 64, 46, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#e07b12';
  x.beginPath(); x.arc(64, 64, 30, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#120c08';
  x.beginPath(); x.arc(64, 64, 22, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff';
  x.beginPath(); x.arc(54, 54, 7, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- geometry batching: everything static is merged per material ----
class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, geo: THREE.BufferGeometry, pos: THREE.Vector3Like, rot?: THREE.Euler, parent?: THREE.Matrix4) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Quaternion().setFromEuler(rot ?? new THREE.Euler()),
      new THREE.Vector3(1, 1, 1),
    );
    if (parent) m.premultiply(parent);
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key)!.push(g);
  }
  box(key: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, rot?: THREE.Euler, parent?: THREE.Matrix4) {
    this.add(key, new THREE.BoxGeometry(sx, sy, sz), { x, y, z }, rot, parent);
  }
  build(materials: Record<string, THREE.Material>, scene: THREE.Object3D, noShadow: string[] = []) {
    for (const [key, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), materials[key]);
      mesh.castShadow = !noShadow.includes(key);
      mesh.receiveShadow = true;
      scene.add(mesh);
      geos.forEach((g) => g.dispose());
    }
  }
}

export interface StreetFrame {
  progress: number;
  door: number;
}

export interface Street {
  /** Where the scroll (or autoplay) wants the camera to be, 0 → 1. */
  setTarget(p: number, immediate?: boolean): void;
  /** Pointer position, -1 → 1 on both axes, for a little parallax. */
  setPointer(x: number, y: number): void;
  onFrame(cb: (f: StreetFrame) => void): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export function createStreet(canvas: HTMLCanvasElement): Street {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 2 : 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);

  // ---- sky ----
  const sky = {
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    ground: new THREE.Color('#d9d3c4'),
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(),
  };
  const DAY = { top: new THREE.Color('#1b5fe0'), horizon: new THREE.Color('#9fd0ff'), sun: new THREE.Color('#fff3df') };
  const DUSK = { top: new THREE.Color('#18205e'), horizon: new THREE.Color('#ff9a6b'), sun: new THREE.Color('#ffb070') };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      top: { value: sky.top },
      horizon: { value: sky.horizon },
      ground: { value: sky.ground },
      sunDir: { value: sky.sunDir },
      sunColor: { value: sky.sunColor },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
      uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0
          ? mix(horizon, top, pow(smoothstep(0.0, 0.55, h), 0.65))
          : mix(horizon, ground, smoothstep(0.0, 0.08, -h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 80.0) * 0.7 + pow(s, 6.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  skyDome.renderOrder = -1;
  scene.add(skyDome);
  scene.fog = new THREE.Fog(DAY.horizon.clone(), 50, 190);

  // ---- light ----
  const hemi = new THREE.HemisphereLight('#d6e6ff', '#c2b393', 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const SUN_DAY = new THREE.Vector3(9, 24, 26);
  const SUN_DUSK = new THREE.Vector3(30, 7, 6);

  // Colourful light that pours out when the door opens.
  const spillA = new THREE.PointLight('#ff2f8c', 0, 9, 1.6);
  spillA.position.set(-5.3, FLOOR + 1.5, DOOR_Z);
  const spillB = new THREE.PointLight('#36e08f', 0, 7, 1.6);
  spillB.position.set(-5.4, FLOOR + 0.4, DOOR_Z - 0.3);
  const gapLight = new THREE.PointLight('#ff2f8c', 0, 2.5, 2);
  gapLight.position.set(-6.25, FLOOR + 0.08, DOOR_Z);
  scene.add(spillA, spillB, gapLight);
  // porch lamp by the door, switches on at dusk
  const porch = new THREE.PointLight('#ffc27a', 0, 7, 1.4);
  porch.position.set(-W / 2 - 0.35, FLOOR + DOOR_H + 0.05, DOOR_Z + DOOR_W / 2 + 0.45);
  scene.add(porch);

  // ---- materials ----
  const plaster = plasterTexture();
  const mats: Record<string, THREE.Material> = {
    wall: new THREE.MeshStandardMaterial({ color: '#f3f0ea', roughness: 0.94, map: plaster }),
    trim: new THREE.MeshStandardMaterial({ color: '#5b3a2a', roughness: 0.75 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8a5a43', roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.45, metalness: 0.15 }),
    frame: new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#33414f', roughness: 0.22, metalness: 0.1, emissive: '#0b1420' }),
    shutter: new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.7 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.6, metalness: 0.4 }),
    step: new THREE.MeshStandardMaterial({ color: '#c8c4bb', roughness: 0.95 }),
    paving: new THREE.MeshStandardMaterial({ color: '#cbc5ba', roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: '#a8a27f', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#3f5f31', roughness: 0.9, flatShading: true }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#6c8a3f', roughness: 0.9, flatShading: true }),
    bark: new THREE.MeshStandardMaterial({ color: '#5a4436', roughness: 1 }),
    pot: new THREE.MeshStandardMaterial({ color: '#b5643d', roughness: 0.9 }),
    neighbour: new THREE.MeshStandardMaterial({ color: '#e7c25d', roughness: 0.95 }),
    wire: new THREE.MeshBasicMaterial({ color: '#2b2b2b' }),
  };

  const b = new Batch();

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 48), mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  b.add('paving', new THREE.PlaneGeometry(22, 24).rotateX(-Math.PI / 2), { x: -1, y: 0.01, z: 2 });
  b.add('paving', new THREE.PlaneGeometry(4, 18).rotateX(-Math.PI / 2), { x: -5, y: 0.012, z: 20 });

  // ---- walls ----
  b.box('wall', W, HEIGHT, WALL, 0, HEIGHT / 2, D / 2 - WALL / 2); // front
  b.box('wall', W, HEIGHT, WALL, 0, HEIGHT / 2, -D / 2 + WALL / 2); // back
  b.box('wall', WALL, HEIGHT, D - WALL * 2, W / 2 - WALL / 2, HEIGHT / 2, 0); // right
  {
    // left wall, with the doorway cut out. Shape x = -world z, shape y = world y.
    const s = new THREE.Shape();
    s.moveTo(-D / 2 + WALL, 0);
    s.lineTo(D / 2 - WALL, 0);
    s.lineTo(D / 2 - WALL, HEIGHT);
    s.lineTo(-D / 2 + WALL, HEIGHT);
    s.closePath();
    const u0 = -DOOR_Z - DOOR_W / 2, u1 = -DOOR_Z + DOOR_W / 2;
    const hole = new THREE.Path();
    hole.moveTo(u0, FLOOR);
    hole.lineTo(u0, FLOOR + DOOR_H);
    hole.lineTo(u1, FLOOR + DOOR_H);
    hole.lineTo(u1, FLOOR);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: WALL, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    b.add('wall', g, { x: -W / 2, y: 0, z: 0 });
  }
  // a thin band between the storeys, outside only (the inside must stay empty)
  const bandY = FLOOR - 0.13;
  b.box('wall', W + 0.08, 0.14, 0.06, 0, bandY, D / 2 + 0.03);
  b.box('wall', W + 0.08, 0.14, 0.06, 0, bandY, -D / 2 - 0.03);
  b.box('wall', 0.06, 0.14, D, W / 2 + 0.03, bandY, 0);

  // ---- roof: low hip roof with a brown fascia ----
  const OVER = 0.65;
  b.box('trim', W + OVER * 2, 0.26, D + OVER * 2, 0, HEIGHT + 0.13, 0);
  b.box('wall', W + OVER * 2 - 0.1, 0.04, D + OVER * 2 - 0.1, 0, HEIGHT - 0.02, 0);
  {
    const roof = new THREE.ConeGeometry(1, 1, 4, 1, false, Math.PI / 4);
    roof.scale((W + OVER * 2) / Math.SQRT2, 1.25, (D + OVER * 2) / Math.SQRT2);
    b.add('roof', roof, { x: 0, y: HEIGHT + 0.26 + 0.62, z: 0 });
  }
  // chimney
  b.box('wall', 0.7, 1.5, 0.7, 2.6, HEIGHT + 1.32, -1.2);
  b.box('wall', 0.95, 0.12, 0.95, 2.6, HEIGHT + 2.18, -1.2);
  b.box('wall', 0.55, 0.32, 0.55, 2.6, HEIGHT + 2.4, -1.2);
  b.box('trim', 0.8, 0.06, 0.8, 2.6, HEIGHT + 2.59, -1.2);

  // ---- windows ----
  type Face = 'front' | 'back' | 'left' | 'right';
  const faceMatrix = (face: Face, u: number) => {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    let ry = 0;
    if (face === 'front') { p.set(u, 0, D / 2); ry = 0; }
    if (face === 'back') { p.set(u, 0, -D / 2); ry = Math.PI; }
    if (face === 'left') { p.set(-W / 2, 0, u); ry = -Math.PI / 2; }
    if (face === 'right') { p.set(W / 2, 0, u); ry = Math.PI / 2; }
    return m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  };
  function windowAt(face: Face, u: number, y: number, w: number, h: number, kind: 'plain' | 'grid' | 'grill' | 'shutter' = 'plain') {
    const m = faceMatrix(face, u);
    const f = 0.09;
    b.box('glass', w, h, 0.04, 0, y, 0.015, undefined, m);
    b.box('frame', w + f * 2, f, 0.12, 0, y + h / 2 + f / 2, 0.04, undefined, m);
    b.box('frame', w + f * 2, f, 0.12, 0, y - h / 2 - f / 2, 0.04, undefined, m);
    b.box('frame', f, h, 0.12, -w / 2 - f / 2, y, 0.04, undefined, m);
    b.box('frame', f, h, 0.12, w / 2 + f / 2, y, 0.04, undefined, m);
    b.box('wall', w + 0.34, 0.07, 0.22, 0, y - h / 2 - f - 0.035, 0.09, undefined, m); // sill
    if (kind === 'plain' || kind === 'shutter') b.box('frame', 0.05, h, 0.06, 0, y, 0.04, undefined, m);
    if (kind === 'grid') {
      for (let i = 1; i < 4; i++) b.box('frame', 0.05, h, 0.06, -w / 2 + (w / 4) * i, y, 0.04, undefined, m);
      for (let j = 1; j < 3; j++) b.box('frame', w, 0.05, 0.06, 0, y - h / 2 + (h / 3) * j, 0.04, undefined, m);
    }
    if (kind === 'grill') {
      for (let i = 1; i < 7; i++) b.box('iron', 0.035, h, 0.04, -w / 2 + (w / 7) * i, y, 0.11, undefined, m);
      b.box('iron', w, 0.04, 0.04, 0, y + h * 0.18, 0.11, undefined, m);
    }
    if (kind === 'shutter') {
      // half-lowered roller shutter, slats as thin bands
      const sh = h * 0.42;
      for (let i = 0; i < 9; i++) b.box('shutter', w, sh / 9 - 0.012, 0.03, 0, y + h / 2 - (sh / 9) * (i + 0.5), 0.05, undefined, m);
    }
  }
  // front: french windows on the balcony, big windows downstairs
  windowAt('front', -3.1, FLOOR + 1.3, 1.15, 2.25, 'shutter');
  windowAt('front', 3.1, FLOOR + 1.3, 1.15, 2.25, 'shutter');
  windowAt('front', -3.1, 1.35, 2.3, 2.2, 'grid');
  windowAt('front', 3.0, 1.4, 2.7, 2.35, 'grill');
  // left: two windows upstairs, above the stairs
  windowAt('left', 2.6, FLOOR + 1.55, 0.95, 1.35, 'plain');
  windowAt('left', 0.2, FLOOR + 1.55, 0.95, 1.35, 'shutter');
  // right and back
  windowAt('right', 2.2, FLOOR + 1.55, 1.0, 1.4, 'shutter');
  windowAt('right', -2.2, FLOOR + 1.55, 1.0, 1.4, 'plain');
  windowAt('right', 2.2, 1.5, 1.0, 1.4, 'plain');
  windowAt('right', -2.2, 1.5, 1.0, 1.4, 'shutter');
  windowAt('back', -3, FLOOR + 1.55, 1.0, 1.4, 'plain');
  windowAt('back', 3, FLOOR + 1.55, 1.0, 1.4, 'plain');

  // ---- railings: white flat bars, horizontal, like the real ones ----
  const BAR = [0.22, 0.46, 0.7, 0.94];
  function railLine(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, posts = true) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    const rot = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    for (const h of BAR) b.box('rail', 0.035, 0.07, len, (x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2, rot);
    b.box('rail', 0.07, 0.05, len, (x0 + x1) / 2, (y0 + y1) / 2 + 1.0, (z0 + z1) / 2, rot);
    if (!posts) return;
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.box('rail', 0.06, 1.0, 0.06, x0 + dx * t, y0 + dy * t + 0.5, z0 + dz * t);
    }
  }

  // ---- stairs ----
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * RISER;
    b.box('step', 1.5, h, TREAD + 0.002, STAIR_XC, h / 2, STAIR_Z_BOTTOM - (i + 0.5) * TREAD);
    b.box('wall', 1.52, 0.03, 0.04, STAIR_XC, h - 0.015, STAIR_Z_BOTTOM - i * TREAD - 0.01); // nosing
  }
  b.box('step', 1.5, FLOOR, STAIR_Z_TOP - LANDING_Z_END, STAIR_XC, FLOOR / 2, (STAIR_Z_TOP + LANDING_Z_END) / 2);
  railLine(STAIR_X0 + 0.04, STAIR_Z_BOTTOM - 0.15, RISER, STAIR_X0 + 0.04, STAIR_Z_TOP, FLOOR);
  railLine(STAIR_X0 + 0.04, STAIR_Z_TOP, FLOOR, STAIR_X0 + 0.04, LANDING_Z_END + 0.04, FLOOR);
  railLine(STAIR_X0 + 0.04, LANDING_Z_END + 0.04, FLOOR, STAIR_X1, LANDING_Z_END + 0.04, FLOOR);

  // ---- front balcony ----
  const BAL_D = 1.45;
  b.box('wall', W + 0.5, 0.24, BAL_D, 0, FLOOR, D / 2 + BAL_D / 2);
  const by = FLOOR + 0.12;
  railLine(-W / 2 - 0.2, D / 2 + BAL_D - 0.05, by, W / 2 + 0.2, D / 2 + BAL_D - 0.05, by);
  railLine(-W / 2 - 0.2, D / 2 + 0.02, by, -W / 2 - 0.2, D / 2 + BAL_D - 0.05, by);
  railLine(W / 2 + 0.2, D / 2 + 0.02, by, W / 2 + 0.2, D / 2 + BAL_D - 0.05, by);

  // ---- door frame ----
  {
    const fx = -W / 2 - 0.04;
    b.box('frame', 0.1, 0.12, DOOR_W + 0.24, fx, FLOOR + DOOR_H + 0.06, DOOR_Z);
    b.box('frame', 0.1, DOOR_H, 0.12, fx, FLOOR + DOOR_H / 2, DOOR_Z - DOOR_W / 2 - 0.06);
    b.box('frame', 0.1, DOOR_H, 0.12, fx, FLOOR + DOOR_H / 2, DOOR_Z + DOOR_W / 2 + 0.06);
    // reveal (inside faces of the opening), so the wall has thickness when the door opens
    b.box('wall', WALL, 0.02, DOOR_W, -W / 2 + WALL / 2, FLOOR + DOOR_H + 0.01, DOOR_Z);
    b.box('wall', WALL, DOOR_H, 0.02, -W / 2 + WALL / 2, FLOOR + DOOR_H / 2, DOOR_Z - DOOR_W / 2 - 0.01);
    b.box('wall', WALL, DOOR_H, 0.02, -W / 2 + WALL / 2, FLOOR + DOOR_H / 2, DOOR_Z + DOOR_W / 2 + 0.01);
    b.box('step', WALL + 0.1, 0.04, DOOR_W, -W / 2 + WALL / 2 - 0.05, FLOOR + 0.02, DOOR_Z); // threshold
    // small wall lamp next to the door
    b.box('iron', 0.12, 0.3, 0.16, fx - 0.04, FLOOR + DOOR_H + 0.1, DOOR_Z + DOOR_W / 2 + 0.45);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: '#3a3a3a', toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.11), lampMat);
  lamp.position.set(-W / 2 - 0.15, FLOOR + DOOR_H + 0.1, DOOR_Z + DOOR_W / 2 + 0.45);
  scene.add(lamp);

  // ---- trees, bushes, a pot, the neighbour, a wire ----
  function pine(x: number, z: number, s: number) {
    const trunkH = 6.5 * s;
    b.add('bark', new THREE.CylinderGeometry(0.16 * s, 0.26 * s, trunkH, 6), { x, y: trunkH / 2, z }, new THREE.Euler(0.06, 0, -0.05));
    const r = [[0, 0, 0, 2.6], [1.6, -0.3, 0.6, 1.9], [-1.5, -0.2, -0.4, 2.0], [0.4, 0.4, -1.4, 1.7], [-0.3, 0.2, 1.5, 1.6]];
    for (const [dx, dy, dz, rr] of r) {
      const g = new THREE.IcosahedronGeometry(rr * s, 1);
      g.scale(1.25, 0.42, 1.25);
      b.add(dx > 0 ? 'leafLight' : 'leaf', g, { x: x + dx * s, y: trunkH + 0.4 * s + dy * s, z: z + dz * s });
    }
  }
  pine(-15, -11, 1.15);
  pine(13, -15, 1.3);
  pine(-26, 6, 1.0);
  pine(24, -4, 1.05);
  pine(-6, -24, 1.4);
  pine(36, 12, 0.9);
  function bush(x: number, z: number, r: number, key = 'leaf') {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.3, 0.8, 1.1);
    b.add(key, g, { x, y: r * 0.55, z });
  }
  bush(7.8, 5.5, 0.9, 'leafLight');
  bush(8.6, 3.8, 0.7);
  bush(7.2, -4.8, 1.1);
  bush(-9.4, -5.6, 1.0, 'leafLight');
  bush(-10.2, 2.4, 0.75);
  // potted palm at the foot of the stairs
  b.add('pot', new THREE.CylinderGeometry(0.32, 0.24, 0.55, 10), { x: -5.2, y: 0.28, z: 6.2 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.09, 1.2, 4);
    b.add('leafLight', g, { x: -5.2 + Math.cos(a) * 0.25, y: 1.0, z: 6.2 + Math.sin(a) * 0.25 }, new THREE.Euler(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55));
  }
  // the yellow neighbour
  b.box('neighbour', 9, 8.5, 9, -27, 4.25, -14);
  b.box('trim', 9.8, 0.25, 9.8, -27, 8.6, -14);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.box('glass', 1, 1.4, 0.05, -30 + i * 3, 2.2 + j * 3.6, -9.47);
  // utility pole and a sagging wire, like in the photos
  b.add('bark', new THREE.CylinderGeometry(0.12, 0.16, 9, 6), { x: 17, y: 4.5, z: 9 });
  b.build(mats, scene, ['glass', 'paving', 'frame']);
  {
    const a = new THREE.Vector3(W / 2 - 0.3, HEIGHT - 0.4, D / 2 - 0.2);
    const c = new THREE.Vector3(17, 8.6, 9);
    const mid = a.clone().lerp(c, 0.5).add(new THREE.Vector3(0, -1.4, 0));
    for (const off of [0, 0.35]) {
      const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(a.y + off), mid.clone().setY(mid.y + off), c.clone().setY(c.y + off));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.018, 4), mats.wire));
    }
  }

  // ---- the door ----
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2 + 0.05, FLOOR, DOOR_Z + DOOR_W / 2);
  scene.add(doorPivot);
  const doorMat = new THREE.MeshStandardMaterial({ color: '#6b4a37', roughness: 0.6 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, DOOR_H - 0.02, DOOR_W - 0.02), doorMat);
  door.position.set(0, DOOR_H / 2, -DOOR_W / 2);
  door.castShadow = true;
  doorPivot.add(door);
  for (const [y, h] of [[0.55, 0.7], [1.55, 0.9]] as const) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, DOOR_W - 0.32), new THREE.MeshStandardMaterial({ color: '#5d3f2e', roughness: 0.7 }));
    panel.position.set(-0.035, y, -DOOR_W / 2);
    doorPivot.add(panel);
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshStandardMaterial({ color: '#d6b25a', metalness: 0.8, roughness: 0.3 }));
  handle.position.set(-0.07, 1.05, -DOOR_W + 0.12);
  doorPivot.add(handle);
  // the only hint from the outside: a little owl-eye sticker
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), new THREE.MeshStandardMaterial({ map: stickerTexture(), roughness: 0.5 }));
  sticker.rotation.y = -Math.PI / 2;
  sticker.position.set(-0.032, 1.42, -DOOR_W + 0.2);
  doorPivot.add(sticker);
  // light leaking from the gaps around the closed door
  const gapMat = new THREE.MeshBasicMaterial({ color: '#ff2f8c', toneMapped: false, transparent: true, opacity: 0, fog: false });
  const gapBottom = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W - 0.04, 0.022), gapMat);
  gapBottom.rotation.y = -Math.PI / 2;
  gapBottom.position.set(-W / 2 - 0.005, FLOOR + 0.05, DOOR_Z);
  scene.add(gapBottom);
  const gapSide = new THREE.Mesh(new THREE.PlaneGeometry(0.012, DOOR_H - 0.1), gapMat);
  gapSide.rotation.y = -Math.PI / 2;
  gapSide.position.set(-W / 2 - 0.005, FLOOR + DOOR_H / 2, DOOR_Z - DOOR_W / 2 + 0.01);
  scene.add(gapSide);
  // a soft glow on the landing floor in front of the door
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const floorGlowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: '#ff2f8c', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: false });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), floorGlowMat);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(-W / 2 - 0.55, FLOOR + 0.01, DOOR_Z);
  scene.add(floorGlow);

  // ---- the portal: the inside of the house writes transparent pixels ----
  const portalMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    blending: THREE.NoBlending,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const portal = new THREE.Mesh(new THREE.BoxGeometry(W - WALL * 2 - 0.02, HEIGHT - 0.2, D - WALL * 2 - 0.02), portalMat);
  portal.position.set(0, (HEIGHT - 0.2) / 2 + 0.05, 0);
  scene.add(portal);

  // ---- camera path ----
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal');
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function curveParam(p: number) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], c = KEYS[i + 1];
      if (p <= c.t) {
        const local = (p - a.t) / (c.t - a.t);
        return (i + local) / (KEYS.length - 1);
      }
    }
    return 1;
  }

  // ---- state ----
  let target = 0;
  let progress = 0;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let frameCb: ((f: StreetFrame) => void) | undefined;
  let last = performance.now();
  let width = 0, height = 0;
  const tmpColor = new THREE.Color();
  const BEAT = ['#ff2f8c', '#36e08f', '#3b5bff', '#ffd23f'].map((c) => new THREE.Color(c));

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    // ignore small height changes from mobile toolbars
    if (w === width && Math.abs(h - height) < 120) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function apply(dt: number, time: number) {
    progress += (target - progress) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(target - progress) < 0.0004) progress = target;
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 3));
    const p = progress;

    // time of day: afternoon at the gate, concert time at the door
    const dusk = smooth(0.08, 0.72, p);
    sky.top.copy(DAY.top).lerp(DUSK.top, dusk);
    sky.horizon.copy(DAY.horizon).lerp(DUSK.horizon, dusk);
    sky.sunColor.copy(DAY.sun).lerp(DUSK.sun, dusk);
    (scene.fog as THREE.Fog).color.copy(sky.horizon);
    sun.position.copy(SUN_DAY).lerp(SUN_DUSK, dusk);
    sky.sunDir.copy(sun.position).normalize();
    sun.color.copy(sky.sunColor);
    sun.intensity = THREE.MathUtils.lerp(2.7, 1.5, dusk);
    hemi.intensity = THREE.MathUtils.lerp(1.4, 0.6, dusk);
    hemi.color.set('#d6e6ff').lerp(tmpColor.set('#6c6fd6'), dusk);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 0.92, dusk);

    const lampOn = smooth(0.45, 0.6, p);
    porch.intensity = lampOn * 9;
    lampMat.color.set('#3a3a3a').lerp(tmpColor.set('#ffd9a0'), lampOn);

    // door
    const open = smooth(DOOR_OPEN_FROM, DOOR_OPEN_TO, p);
    doorPivot.rotation.y = -open * 1.78;

    // bass you can see: the gap light pulses at ~112 bpm
    const beatT = (time / 1000) * (112 / 60);
    const beat = Math.pow(1 - (beatT % 1), 3);
    const near = smooth(0.42, 0.7, p);
    const beatColor = BEAT[Math.floor(beatT) % BEAT.length];
    gapMat.color.copy(beatColor);
    gapMat.opacity = near * (0.35 + 0.65 * beat) * (1 - open);
    gapLight.color.copy(beatColor);
    gapLight.intensity = near * (0.6 + 2.6 * beat) * (1 - open);
    floorGlowMat.color.copy(beatColor);
    floorGlowMat.opacity = near * (0.12 + 0.3 * beat) * (1 - open) + open * 0.55;
    spillA.intensity = open * 26;
    spillB.intensity = open * 16;
    spillA.color.set('#ff2f8c').lerp(tmpColor.set('#ffd23f'), 0.5 + 0.5 * Math.sin(time / 900));

    // camera
    const u = curveParam(p);
    posCurve.getPoint(u, camPos);
    lookCurve.getPoint(u, camLook);
    // footsteps on the stairs
    const climb = smooth(0.36, 0.4, p) * (1 - smooth(0.56, 0.6, p));
    camPos.y += Math.sin(((p - 0.36) / 0.22) * STEPS * Math.PI) * 0.035 * climb;
    // a little pointer parallax, fading out as we reach the door
    const sway = 1 - smooth(0.6, 0.75, p);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.translateX(pointerSmooth.x * 0.45 * sway);
    camera.translateY(-pointerSmooth.y * 0.2 * sway);
    camera.lookAt(camLook);
    const portrait = camera.aspect < 0.9;
    // narrow screens: step back a bit from the street so the whole house fits
    if (portrait) camera.translateZ(9 * (1 - smooth(0.05, 0.36, p)));
    const baseFov = portrait ? 58 : camera.aspect < 1.3 ? 48 : 40;
    camera.fov = baseFov + smooth(0.84, 1, p) * 14;
    camera.updateProjectionMatrix();
    skyDome.position.copy(camera.position);

    frameCb?.({ progress: p, door: open });
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    apply(dt, now);
    renderer.render(scene, camera);
  }

  let running = false;
  const onVisibility = () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else if (running) { last = performance.now(); renderer.setAnimationLoop(tick); }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setTarget(p, immediate) {
      target = Math.min(1, Math.max(0, p));
      if (immediate) progress = target;
    },
    setPointer(x, y) {
      pointer.set(x, y);
    },
    onFrame(cb) {
      frameCb = cb;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      renderer.setAnimationLoop(tick);
    },
    stop() {
      running = false;
      renderer.setAnimationLoop(null);
    },
    dispose() {
      this.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      plaster.dispose();
      glowTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
