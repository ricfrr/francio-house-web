/**
 * The street scene: a plain white house, built from boxes, with an outside staircase
 * leading to a door. Scroll progress (0 → 1) drives the camera up the stairs and through
 * the door. The inside of the house is rendered fully transparent, so through the open
 * door you see the real website, which sits right behind the canvas.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bark, lawn, leafTuft, needleTuft, paving, plaster, roofTiles, setAnisotropy, wood } from './textures';
import { foliage, grass, hills, type Clump } from './nature';
import { rng } from './noise';

// ---- house dimensions (metres) ----
const W = 11; // x
const D = 9; // z
const FLOOR = 3.8; // first-floor level
const HEIGHT = 7.3;
const WALL = 0.3;

// The real stairs are an L: a short flight along the front of the house, a corner landing, then a long
// flight up the side wall to a terrace. The door is at the start of the terrace, which carries on behind it.
const STEPS_LOW = 5;
const STEPS = 18;
const STEPS_UP = STEPS - STEPS_LOW;
const TREAD = 0.3;
const RISER = FLOOR / STEPS;
const LANDING_H = STEPS_LOW * RISER;
const STAIR_X0 = -W / 2 - 1.5;
const STAIR_X1 = -W / 2;
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;
const FRONT_Z0 = D / 2; // the lower flight and the landing sit against the front wall
const FRONT_Z1 = FRONT_Z0 + 1.5;
const FRONT_ZC = (FRONT_Z0 + FRONT_Z1) / 2;
const TOP_Z = FRONT_Z0 - STEPS_UP * TREAD; // where the last step meets the terrace
const TERRACE_END = -D / 2; // the terrace runs the whole length of the side wall, to the back corner of the building
const DOOR_Z = TOP_Z - 0.9;
const DOOR_W = 1.1;
const DOOR_H = 2.3;

// ---- camera path ----
type Key = { t: number; pos: [number, number, number]; look: [number, number, number] };
const EYE = 1.62;
const KEYS: Key[] = [
  { t: 0.0, pos: [6, 1.7, 26], look: [-0.5, 4.5, 0] },
  { t: 0.2, pos: [-1.2, 1.7, 14.5], look: [-4.8, 3.6, 0] },
  // up the short flight along the front...
  { t: 0.34, pos: [-2.2, EYE, 8.4], look: [-5.4, 1.9, FRONT_ZC] },
  { t: 0.42, pos: [-4.6, 0.35 + EYE, FRONT_ZC], look: [-7.5, 2.5, FRONT_ZC - 1.0] },
  // ...round the corner landing, up the long flight...
  { t: 0.47, pos: [STAIR_XC, LANDING_H + EYE, FRONT_ZC - 0.1], look: [STAIR_XC - 0.1, LANDING_H + 2.4, 1.2] },
  { t: 0.53, pos: [STAIR_XC, LANDING_H + RISER * 6 + EYE, 2.8], look: [STAIR_XC - 0.1, FLOOR + 1.2, -2.5] },
  // ...and onto the terrace, facing the door
  { t: 0.58, pos: [STAIR_XC, FLOOR + EYE - 0.1, TOP_Z + 0.2], look: [STAIR_XC + 0.2, FLOOR + 1.4, DOOR_Z - 2.4] },
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
/** One texture tile covers this many metres of wall. */
const TEX_M = 2.4;

function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

/** Boxes get texture coordinates in metres, so plaster has the same grain on every wall. */
function boxUV(g: THREE.BoxGeometry, sx: number, sy: number, sz: number) {
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / TEX_M, (uv.getY(i) * dims[f][1]) / TEX_M);
    }
  }
}

/** Dirt near the ground, shade under the eaves and rain streaks: makes plain white look lived in. */
function weather(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWp;
        float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float up = smoothstep(0.0, 1.5, vWp.y);
        float eave = smoothstep(${(HEIGHT - 0.9).toFixed(2)}, ${HEIGHT.toFixed(2)}, vWp.y) * (1.0 - smoothstep(${(HEIGHT + 0.1).toFixed(2)}, ${(HEIGHT + 0.4).toFixed(2)}, vWp.y));
        float streak = vn(vec2((vWp.x + vWp.z) * 7.0, vWp.y * 0.35));
        float wet = smoothstep(0.55, 0.95, streak) * 0.06 * (1.0 - eave);
        diffuseColor.rgb *= mix(0.72, 1.0, up) * (1.0 - 0.12 * eave) * (1.0 - wet);`,
      );
  };
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
    const g = new THREE.BoxGeometry(sx, sy, sz);
    boxUV(g, sx, sy, sz);
    this.add(key, g, { x, y, z }, rot, parent);
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
  const t0 = performance.now();
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false; // redrawn only when the sun or the door moves
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);

  // ---- sky: deep blue like in the photos, with a few thin clouds ----
  const timeU = { value: 0 };
  const sky = {
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    ground: new THREE.Color('#a59e86'),
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(),
    cloudLit: new THREE.Color(),
    cloudShade: new THREE.Color(),
    cover: { value: 0.66 },
  };
  const DAY = {
    top: new THREE.Color('#0a2f9b'), horizon: new THREE.Color('#86b6ee'), sun: new THREE.Color('#fff6e6'),
    lit: new THREE.Color('#ffffff'), shade: new THREE.Color('#9db4d6'),
  };
  const DUSK = {
    top: new THREE.Color('#18205e'), horizon: new THREE.Color('#ff9a6b'), sun: new THREE.Color('#ffb070'),
    lit: new THREE.Color('#ffb48a'), shade: new THREE.Color('#4a3f6e'),
  };
  const SUN_DAY = new THREE.Vector3(9, 24, 26);
  const SUN_DUSK = new THREE.Vector3(30, 7, 6);
  // start from the daytime look: the baked reflections below come from it
  sky.top.copy(DAY.top);
  sky.horizon.copy(DAY.horizon);
  sky.sunColor.copy(DAY.sun);
  sky.cloudLit.copy(DAY.lit);
  sky.cloudShade.copy(DAY.shade);
  sky.sunDir.copy(SUN_DAY).normalize();
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
      cloudLit: { value: sky.cloudLit },
      cloudShade: { value: sky.cloudShade },
      uCover: sky.cover,
      uTime: timeU,
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
      uniform vec3 cloudLit; uniform vec3 cloudShade; uniform float uCover; uniform float uTime;
      varying vec3 vDir;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0
          ? mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.55))
          : mix(horizon, ground, smoothstep(0.0, 0.08, -h));
        vec3 sd = normalize(sunDir);
        float s = max(dot(d, sd), 0.0);
        c += sunColor * (pow(s, 200.0) * 1.2 + pow(s, 12.0) * 0.18 + pow(s, 3.0) * 0.05);
        if (h > 0.0) {
          vec2 cp = d.xz / (h + 0.14) * 0.85 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(cp);
          float cloud = smoothstep(uCover, uCover + 0.2, n);
          float n2 = fbm(cp + normalize(sd.xz + 0.001) * 0.1);
          float lit = clamp((n - n2) * 3.5 + 0.6, 0.0, 1.0);
          vec3 cc = mix(cloudShade, cloudLit, lit);
          cloud *= smoothstep(0.0, 0.22, h);
          c = mix(c, cc, cloud * 0.9);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  skyDome.renderOrder = -1;
  scene.add(skyDome);
  scene.fog = new THREE.Fog(DAY.horizon.clone(), 45, 200);

  // hills on the horizon, hazier the further they are
  const { group: hillGroup, layers: hillLayers } = hills();
  scene.add(hillGroup);
  const HILL_DAY = ['#5d6b45', '#76876b', '#93a58f'].map((c) => new THREE.Color(c));
  const HILL_DUSK = ['#2d2a45', '#3d3a5c', '#524d70'].map((c) => new THREE.Color(c));
  const HILL_HAZE = [0.58, 0.38, 0.18];

  // reflections (windows) and soft ambient light come from this same sky, baked once
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(500, 24, 12);
    envScene.add(new THREE.Mesh(envGeo, skyMat));
    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
    envGeo.dispose();
  }

  // ---- light: strong clean sun, bluish shade ----
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#c9b995', 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);

  // Colourful light that pours out when the door opens.
  const spillA = new THREE.PointLight('#ff2f8c', 0, 9, 1.6);
  spillA.position.set(-W / 2 + 0.7, FLOOR + 1.5, DOOR_Z);
  const spillB = new THREE.PointLight('#36e08f', 0, 7, 1.6);
  spillB.position.set(-W / 2 + 0.6, FLOOR + 0.4, DOOR_Z - 0.3);
  const gapLight = new THREE.PointLight('#ff2f8c', 0, 2.5, 2);
  gapLight.position.set(-W / 2 - 0.25, FLOOR + 0.08, DOOR_Z);
  scene.add(spillA, spillB, gapLight);
  // porch lamp by the door, switches on at dusk
  const porch = new THREE.PointLight('#ffc27a', 0, 7, 1.4);
  porch.position.set(-W / 2 - 0.35, FLOOR + DOOR_H + 0.05, DOOR_Z + DOOR_W / 2 + 0.45);
  scene.add(porch);

  // ---- materials ----
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const plasterTex = plaster();
  const roofMap = roofTiles();
  roofMap.repeat.set(17, 1.2);
  const paveTex = paving();
  const lawnTex = lawn();
  lawnTex.repeat.set(210, 210);
  const barkTex = bark();
  barkTex.repeat.set(1, 3);
  const woodTex = wood();
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, map: plasterTex.map, bumpMap: plasterTex.bump, bumpScale: 0.3 });
  weather(wallMat);
  const mats: Record<string, THREE.Material> = {
    wall: wallMat,
    trim: new THREE.MeshStandardMaterial({ color: '#4a2c20', roughness: 0.7 }),
    roof: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, map: roofMap, bumpMap: roofMap, bumpScale: 1.2 }),
    rail: new THREE.MeshStandardMaterial({ color: '#f7f7f4', roughness: 0.4, metalness: 0.2 }),
    frame: new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: '#7189a6', roughness: 0.06, metalness: 0.78 }),
    shutter: new THREE.MeshStandardMaterial({ color: '#e4e2dc', roughness: 0.7 }),
    iron: new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.45, metalness: 0.6 }),
    step: new THREE.MeshStandardMaterial({ color: '#dcd8cf', roughness: 0.95, map: paveTex }),
    paving: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, map: paveTex }),
    grass: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: lawnTex }),
    bark: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: barkTex }),
    pot: new THREE.MeshStandardMaterial({ color: '#b5643d', roughness: 0.9 }),
    agave: new THREE.MeshStandardMaterial({ color: '#7f9a86', roughness: 0.65 }),
    mat: new THREE.MeshStandardMaterial({ color: '#8a6e48', roughness: 1 }),
    neighbour: new THREE.MeshStandardMaterial({ color: '#ecc96a', roughness: 0.95, map: plasterTex.map, bumpMap: plasterTex.bump, bumpScale: 0.7 }),
    wire: new THREE.MeshBasicMaterial({ color: '#2b2b2b' }),
  };

  const b = new Batch();

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 48), mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  {
    const slabs = new THREE.PlaneGeometry(22, 24).rotateX(-Math.PI / 2);
    scaleUV(slabs, 22 / TEX_M, 24 / TEX_M);
    b.add('paving', slabs, { x: -1, y: 0.01, z: 2 });
    const path = new THREE.PlaneGeometry(4, 18).rotateX(-Math.PI / 2);
    scaleUV(path, 4 / TEX_M, 18 / TEX_M);
    b.add('paving', path, { x: -5, y: 0.012, z: 20 });
  }

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
    scaleUV(g, 1 / TEX_M, 1 / TEX_M);
    g.rotateY(Math.PI / 2);
    b.add('wall', g, { x: -W / 2, y: 0, z: 0 });
  }
  // a thin band between the storeys, outside only (the inside must stay empty)
  const bandY = FLOOR - 0.13;
  b.box('wall', W + 0.08, 0.14, 0.06, 0, bandY, D / 2 + 0.03);
  b.box('wall', W + 0.08, 0.14, 0.06, 0, bandY, -D / 2 - 0.03);
  b.box('wall', 0.06, 0.14, D, W / 2 + 0.03, bandY, 0);

  // ---- roof: very low hip roof, thin dark-brown fascia, a white cable under the eaves ----
  const OVER = 0.6;
  b.box('trim', W + OVER * 2, 0.22, D + OVER * 2, 0, HEIGHT + 0.11, 0);
  b.box('wall', W + OVER * 2 - 0.12, 0.04, D + OVER * 2 - 0.12, 0, HEIGHT - 0.02, 0);
  {
    const roof = new THREE.ConeGeometry(1, 1, 4, 1, false, Math.PI / 4);
    roof.scale((W + OVER * 2) / Math.SQRT2, 0.9, (D + OVER * 2) / Math.SQRT2);
    b.add('roof', roof, { x: 0, y: HEIGHT + 0.22 + 0.45, z: 0 });
  }
  // the cable that runs along the front eave and down the right corner
  b.box('rail', W + OVER * 2 - 0.3, 0.03, 0.03, 0, HEIGHT - 0.12, D / 2 + OVER - 0.18);
  b.box('rail', 0.03, 0.03, D + OVER * 2 - 0.3, -W / 2 - OVER + 0.18, HEIGHT - 0.12, 0);
  b.box('rail', 0.03, HEIGHT - 0.2, 0.03, W / 2 + 0.05, (HEIGHT - 0.2) / 2 + 0.1, D / 2 + 0.05);
  // chimney: white, tall, with a wider cap, set back from the front
  b.box('wall', 0.75, 2.0, 0.75, -0.9, HEIGHT + 1.15, -1.8);
  b.box('wall', 1.0, 0.12, 1.0, -0.9, HEIGHT + 2.2, -1.8);
  b.box('frame', 0.55, 0.08, 0.55, -0.9, HEIGHT + 2.3, -1.8);

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
    const dark = kind === 'grid' || kind === 'grill';
    const fk = dark ? 'iron' : 'frame';
    const f = dark ? 0.07 : 0.09;
    b.box('glass', w, h, 0.04, 0, y, 0.015, undefined, m);
    b.box(fk, w + f * 2, f, 0.12, 0, y + h / 2 + f / 2, 0.04, undefined, m);
    b.box(fk, w + f * 2, f, 0.12, 0, y - h / 2 - f / 2, 0.04, undefined, m);
    b.box(fk, f, h, 0.12, -w / 2 - f / 2, y, 0.04, undefined, m);
    b.box(fk, f, h, 0.12, w / 2 + f / 2, y, 0.04, undefined, m);
    b.box('wall', w + 0.34, 0.07, 0.22, 0, y - h / 2 - f - 0.035, 0.09, undefined, m); // sill
    if (kind === 'plain' || kind === 'shutter') b.box('frame', 0.05, h, 0.06, 0, y, 0.04, undefined, m);
    if (kind === 'grid') {
      // black steel window: two columns, three rows
      b.box('iron', 0.05, h, 0.06, 0, y, 0.05, undefined, m);
      for (let j = 1; j < 3; j++) b.box('iron', w, 0.045, 0.06, 0, y - h / 2 + (h / 3) * j, 0.05, undefined, m);
    }
    if (kind === 'grill') {
      // wide black opening with thin vertical bars and a transom
      for (let i = 1; i < 8; i++) b.box('iron', 0.04, h, 0.05, -w / 2 + (w / 8) * i, y, 0.05, undefined, m);
      b.box('iron', w, 0.05, 0.06, 0, y + h * 0.22, 0.05, undefined, m);
      // something stacked inside, as in the photo
      b.box('shutter', 0.7, 0.5, 0.4, w * 0.1, y - h / 2 + 0.35, -0.25, undefined, m);
    }
    if (kind === 'shutter') {
      // half-lowered roller shutter, slats as thin bands
      const sh = h * 0.42;
      for (let i = 0; i < 9; i++) b.box('shutter', w, sh / 9 - 0.012, 0.03, 0, y + h / 2 - (sh / 9) * (i + 0.5), 0.05, undefined, m);
    }
  }
  // front, as in the photos: two narrow french windows above, a black-framed window and a wide black opening below
  windowAt('front', -2.5, FLOOR + 1.2, 1.15, 2.1, 'plain');
  windowAt('front', 1.7, FLOOR + 1.2, 1.15, 2.1, 'plain');
  windowAt('front', -2.9, 2.0, 2.3, 2.3, 'grid');
  windowAt('front', 1.95, 1.5, 3.9, 2.7, 'grill');
  // roller-shutter boxes above the lower windows
  b.box('frame', 2.6, 0.3, 0.14, -2.9, 3.4, D / 2 + 0.07);
  b.box('frame', 4.2, 0.3, 0.14, 1.95, 3.4, D / 2 + 0.07);
  // left: windows above the stairs
  windowAt('left', 3.0, FLOOR + 1.45, 0.95, 1.5, 'plain');
  windowAt('left', -2.0, FLOOR + 1.45, 0.95, 1.5, 'shutter');
  windowAt('left', -3.3, FLOOR + 1.45, 0.95, 1.5, 'plain');
  // right and back
  windowAt('right', 2.2, FLOOR + 1.45, 1.0, 1.5, 'shutter');
  windowAt('right', -2.2, FLOOR + 1.45, 1.0, 1.5, 'plain');
  windowAt('right', 2.2, 1.7, 1.0, 1.5, 'plain');
  windowAt('right', -2.2, 1.7, 1.0, 1.5, 'shutter');
  windowAt('back', -3, FLOOR + 1.45, 1.0, 1.5, 'plain');
  windowAt('back', 3, FLOOR + 1.45, 1.0, 1.5, 'plain');
  // an outdoor air-conditioning unit on the right wall
  b.box('frame', 0.3, 0.6, 0.9, W / 2 + 0.18, 5.4, -1.5);
  b.box('iron', 0.02, 0.44, 0.7, W / 2 + 0.34, 5.4, -1.5);

  // ---- railings: white flat bars, horizontal, like the real ones ----
  const BAR = [0.14, 0.265, 0.39, 0.515, 0.64, 0.765, 0.89];
  function railLine(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, posts = true) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    const rot = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    for (const h of BAR) b.box('rail', 0.03, 0.075, len, (x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2, rot);
    b.box('rail', 0.07, 0.05, len, (x0 + x1) / 2, (y0 + y1) / 2 + 1.0, (z0 + z1) / 2, rot);
    if (!posts) return;
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.box('rail', 0.06, 1.0, 0.06, x0 + dx * t, y0 + dy * t + 0.5, z0 + dz * t);
    }
  }

  // ---- stairs: short flight along the front, corner landing, long flight up the side, long terrace ----
  // white plastered mass underneath, thin grey concrete treads on top
  const step = (w: number, h: number, d: number, x: number, z: number) => {
    b.box('wall', w, h - 0.05, d, x, (h - 0.05) / 2, z);
    b.box('step', w + 0.03, 0.05, d + 0.03, x, h - 0.025, z);
  };
  for (let i = 0; i < STEPS_LOW; i++) {
    const h = (i + 1) * RISER;
    const cx = STAIR_X1 + (STEPS_LOW - i - 0.5) * TREAD;
    step(TREAD + 0.002, h, 1.5, cx, FRONT_ZC);
    b.box('wall', 0.04, 0.03, 1.52, cx + TREAD / 2 - 0.01, h - 0.015, FRONT_ZC); // nosing
  }
  step(1.5, LANDING_H, 1.5, STAIR_XC, FRONT_ZC);
  for (let j = 0; j < STEPS_UP; j++) {
    const h = LANDING_H + (j + 1) * RISER;
    const cz = FRONT_Z0 - (j + 0.5) * TREAD;
    step(1.5, h, TREAD + 0.002, STAIR_XC, cz);
    b.box('wall', 1.52, 0.03, 0.04, STAIR_XC, h - 0.015, cz + TREAD / 2 - 0.01); // nosing
  }
  step(1.5, FLOOR, TOP_Z - TERRACE_END, STAIR_XC, (TOP_Z + TERRACE_END) / 2); // the terrace
  {
    const rx = STAIR_X0 + 0.04, rz = FRONT_Z1 - 0.04, startX = STAIR_X1 + STEPS_LOW * TREAD;
    railLine(startX, rz, RISER, STAIR_X1, rz, LANDING_H); // up the short flight
    railLine(STAIR_X1, rz, LANDING_H, rx, rz, LANDING_H); // round the landing
    railLine(rx, rz, LANDING_H, rx, FRONT_Z0, LANDING_H);
    railLine(rx, FRONT_Z0, LANDING_H, rx, TOP_Z, FLOOR); // up the long flight
    railLine(rx, TOP_Z, FLOOR, rx, TERRACE_END + 0.04, FLOOR); // along the terrace
    railLine(rx, TERRACE_END + 0.04, FLOOR, STAIR_X1, TERRACE_END + 0.04, FLOOR);
  }

  // ---- front balcony: a full-width slab with a thick front edge, as in the photos ----
  const BAL_D = 1.4;
  const BAL_W = W + 0.9;
  b.box('wall', BAL_W, 0.2, BAL_D, 0, FLOOR - 0.02, D / 2 + BAL_D / 2);
  b.box('wall', BAL_W, 0.3, 0.08, 0, FLOOR - 0.12, D / 2 + BAL_D + 0.02);
  const by = FLOOR + 0.08;
  railLine(-BAL_W / 2 + 0.05, D / 2 + BAL_D - 0.05, by, BAL_W / 2 - 0.05, D / 2 + BAL_D - 0.05, by);
  railLine(-BAL_W / 2 + 0.05, D / 2 + 0.02, by, -BAL_W / 2 + 0.05, D / 2 + BAL_D - 0.05, by);
  railLine(BAL_W / 2 - 0.05, D / 2 + 0.02, by, BAL_W / 2 - 0.05, D / 2 + BAL_D - 0.05, by);

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

  // ---- trees, bushes, agave, the neighbour, a wire ----
  const treeClumps: Clump[] = [];
  const bushClumps: Clump[] = [];
  const blobs: [number, number, number][] = []; // soft ground shadows: x, z, radius
  function pine(x: number, z: number, s: number) {
    const trunkH = 6.8 * s;
    b.add('bark', new THREE.CylinderGeometry(0.15 * s, 0.27 * s, trunkH, 8), { x, y: trunkH / 2, z }, new THREE.Euler(0.05, 0, -0.04));
    // an umbrella crown: a few flat clumps of needles on branches
    const cy = trunkH + 0.2 * s;
    for (let k = 0; k < 5; k++) {
      const a = k * 2.4 + x * 0.3;
      const off = k === 0 ? 0 : 1.9 * s;
      const cx = x + Math.cos(a) * off, cz = z + Math.sin(a) * off;
      const y = cy + (k === 0 ? 0.55 : -0.5 + (k % 2) * 0.35) * s;
      treeClumps.push({ x: cx, y, z: cz, rx: 2.2 * s, ry: 0.5 * s, rz: 2.2 * s, count: 62, size: 1.35 * s, tint: new THREE.Color(k % 2 ? '#5d7a3a' : '#4d6e34') });
      if (k > 0) b.add('bark', new THREE.CylinderGeometry(0.05 * s, 0.09 * s, off * 1.1, 5).translate(0, off * 0.55, 0), { x, y: trunkH * 0.93, z }, new THREE.Euler(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1));
    }
    blobs.push([x, z, 2.2 * s]);
  }
  pine(-15, -11, 1.15);
  pine(13, -15, 1.3);
  pine(-26, 6, 1.0);
  pine(24, -4, 1.05);
  pine(-6, -24, 1.4);
  pine(36, 12, 0.9);
  function bush(x: number, z: number, r: number, tint = '#4a6b2c') {
    bushClumps.push({ x, y: r * 0.6, z, rx: r * 1.3, ry: r * 0.7, rz: r * 1.05, count: Math.round(46 * r), size: 0.5 + r * 0.25, tint: new THREE.Color(tint) });
    blobs.push([x, z, r * 1.5]);
  }
  bush(7.4, 5.2, 0.9, '#5d7e33');
  bush(8.3, 3.6, 0.7);
  bush(7.0, -4.8, 1.1);
  bush(-9.4, -5.6, 1.0, '#5d7e33');
  bush(-10.2, 2.4, 0.75);
  // agave by the foot of the stairs, as in the photos
  function agave(x: number, z: number, scale: number) {
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const len = (0.5 + t * 0.6) * scale;
      const g = new THREE.ConeGeometry(0.075 * scale, len, 5).scale(1, 1, 0.4).translate(0, len / 2, 0);
      const tilt = 0.2 + t * 1.1;
      const yaw = i * 2.4;
      b.add('agave', g, { x, y: 0.12 * scale, z }, new THREE.Euler(Math.sin(yaw) * tilt, 0, -Math.cos(yaw) * tilt));
    }
    b.add('pot', new THREE.CylinderGeometry(0.28 * scale, 0.21 * scale, 0.28 * scale, 12), { x, y: 0.0, z });
    blobs.push([x, z, 0.9 * scale]);
  }
  // clear of the bottom of the stairs (x -4), where you walk in: they sit further along the front, as in the photo
  agave(-1.3, D / 2 + 0.9, 1.15);
  agave(-0.45, D / 2 + 0.55, 0.8);
  // a door mat on the landing
  b.box('mat', 0.5, 0.025, 0.75, -W / 2 - 0.3, FLOOR + 0.0125, DOOR_Z);
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

  // ---- plants: instanced, so a whole garden is a few draw calls ----
  const treeMesh = foliage(needleTuft(), treeClumps, timeU, 3);
  const bushMesh = foliage(leafTuft(), bushClumps, timeU, 5);
  scene.add(treeMesh, bushMesh);
  const lawnSpot = (r: () => number): [number, number] | null => {
    // half the blades go where the camera walks past, the rest spread over the verge
    // (not under the camera at the start: blades at eye level would look like reeds)
    const near = r() < 0.55;
    const x = near ? -14 + r() * 22 : (r() * 2 - 1) * 20;
    const z = near ? 13 + r() * 9 : -12 + r() * 34;
    const onPaving = x > -12 && x < 10 && z > -10 && z < 14;
    const onPath = x > -7.2 && x < -2.8 && z >= 14 && z < 29.5;
    return onPaving || onPath ? null : [x, z];
  };
  const grassMesh = grass(small ? 4500 : 9000, lawnSpot, timeU);
  scene.add(grassMesh);

  // soft contact shadows under plants and around the foot of the house (cheap ambient occlusion)
  {
    const gradient = (w: number, h: number, paint: (x: CanvasRenderingContext2D) => CanvasGradient) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = paint(x);
      x.fillRect(0, 0, w, h);
      return new THREE.CanvasTexture(c);
    };
    const radial = gradient(64, 64, (x) => {
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      return g;
    });
    const edge = gradient(8, 64, (x) => {
      const g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      return g;
    });
    const decal = (map: THREE.Texture, geos: THREE.BufferGeometry[]) => {
      const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
      mesh.renderOrder = 1;
      scene.add(mesh);
    };
    decal(radial, blobs.map(([x, z, r]) => new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2).translate(x, 0.022, z)));
    const side = (len: number, yaw: number, x: number, z: number) => new THREE.PlaneGeometry(len, 1.8).rotateX(-Math.PI / 2).rotateY(yaw).translate(x, 0.022, z);
    decal(edge, [
      side(W + 3, 0, 0, D / 2 + 0.9),
      side(W + 3, Math.PI, 0, -D / 2 - 0.9),
      side(D + 3, -Math.PI / 2, -W / 2 - 0.9, 0),
      side(D + 3, Math.PI / 2, W / 2 + 0.9, 0),
    ]);
  }

  // ---- the door ----
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2 + 0.05, FLOOR, DOOR_Z + DOOR_W / 2);
  scene.add(doorPivot);
  const doorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTex, roughness: 0.55 });
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

  // dust floating in the light by the door
  const DUST = 140;
  const dustSeed = (() => {
    const r = rng(77);
    return Float32Array.from({ length: DUST * 3 }, () => r());
  })();
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  const dustMat = new THREE.PointsMaterial({ map: glowTex, size: 0.08, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe2b0', fog: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  function updateDust(t: number) {
    const a = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST; i++) {
      const sx = dustSeed[i * 3], sy = dustSeed[i * 3 + 1], sz = dustSeed[i * 3 + 2];
      a.setXYZ(
        i,
        -W / 2 - 1.6 + sx * 2.2 + Math.sin(t * 0.3 + sy * 6) * 0.15,
        FLOOR + 0.2 + sy * 2.6 + Math.sin(t * 0.5 + sz * 9) * 0.1,
        DOOR_Z - 1.4 + sz * 2.8 + Math.cos(t * 0.25 + sx * 7) * 0.15,
      );
    }
    a.needsUpdate = true;
  }

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
  let shadowDusk = -1, shadowOpen = -1, shadowFrames = 0;
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
    if (Math.abs(target - progress) < 0.0004 || !Number.isFinite(progress)) progress = target;
    progress = Math.min(1, Math.max(0, progress));
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 3));
    const p = progress;

    // time of day: afternoon at the gate, concert time at the door
    timeU.value = time / 1000;
    const dusk = smooth(0.08, 0.72, p);
    sky.top.copy(DAY.top).lerp(DUSK.top, dusk);
    sky.horizon.copy(DAY.horizon).lerp(DUSK.horizon, dusk);
    sky.sunColor.copy(DAY.sun).lerp(DUSK.sun, dusk);
    sky.cloudLit.copy(DAY.lit).lerp(DUSK.lit, dusk);
    sky.cloudShade.copy(DAY.shade).lerp(DUSK.shade, dusk);
    sky.cover.value = THREE.MathUtils.lerp(0.66, 0.5, dusk);
    (scene.fog as THREE.Fog).color.copy(sky.horizon);
    hillLayers.forEach((h, i) => {
      const c = (h.material as THREE.MeshBasicMaterial).color;
      c.copy(HILL_DAY[i]).lerp(HILL_DUSK[i], dusk).lerp(sky.horizon, HILL_HAZE[i]);
    });
    scene.environmentIntensity = THREE.MathUtils.lerp(1.0, 0.5, dusk);
    sun.position.copy(SUN_DAY).lerp(SUN_DUSK, dusk);
    sky.sunDir.copy(sun.position).normalize();
    sun.color.copy(sky.sunColor);
    sun.intensity = THREE.MathUtils.lerp(3.4, 1.6, dusk);
    hemi.intensity = THREE.MathUtils.lerp(0.5, 0.6, dusk);
    hemi.color.set('#d6e6ff').lerp(tmpColor.set('#6c6fd6'), dusk);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.95, dusk);

    const lampOn = smooth(0.45, 0.6, p);
    porch.intensity = lampOn * 9;
    lampMat.color.set('#3a3a3a').lerp(tmpColor.set('#ffd9a0'), lampOn);

    // door
    const open = smooth(DOOR_OPEN_FROM, DOOR_OPEN_TO, p);
    doorPivot.rotation.y = -open * 1.78;
    if (Math.abs(dusk - shadowDusk) > 0.004 || Math.abs(open - shadowOpen) > 0.004 || shadowFrames++ < 3) {
      renderer.shadowMap.needsUpdate = true;
      shadowDusk = dusk;
      shadowOpen = open;
    }
    dustMat.opacity = smooth(0.5, 0.72, p) * 0.55 * (1 - open * 0.3);
    if (dustMat.opacity > 0.01) updateDust(time / 1000);

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
    const baseFov = portrait ? 58 : camera.aspect < 1.3 ? 48 : 44;
    camera.fov = baseFov + smooth(0.84, 1, p) * 14;
    camera.updateProjectionMatrix();
    skyDome.position.copy(camera.position);

    frameCb?.({ progress: p, door: open });
  }

  // Quality governor: if the device struggles, lower the resolution step by step (never raise it again,
  // so the picture doesn't pump). Costly extras go first.
  const basePR = Math.min(window.devicePixelRatio, small ? 2 : 1.6);
  const LEVELS = [1, 0.82, 0.66, 0.52];
  let level = 0, ema = 16.7, warm = 0, since = 0;
  function setLevel(l: number) {
    level = l;
    renderer.setPixelRatio(basePR * LEVELS[l]);
    width = 0; // force a resize on the next frame
    if (l >= 2) grassMesh.visible = false;
    if (l >= 3) sun.castShadow = false;
  }
  renderer.setPixelRatio(basePR);

  function tick(now: number) {
    // (never negative: after a tab comes back to the foreground the frame time can jump backwards)
    const ms = Math.max(0, Math.min(100, now - last));
    const dt = Math.min(0.05, ms / 1000);
    last = now;
    // ignore the first frames (shader compilation) and slow frames from background tabs
    if (++warm > 40 && !document.hidden) {
      ema = ema * 0.92 + ms * 0.08;
      if (++since > 60 && ema > 35 && level < LEVELS.length - 1) {
        setLevel(level + 1);
        since = 0;
        ema = 16.7;
      }
    }
    resize();
    apply(dt, now);
    renderer.render(scene, camera);
  }

  // dev only: look at the scene from the console (stripped from production builds)
  if (import.meta.env.DEV) Object.assign(window, { __street: { renderer, scene, camera, get progress() { return progress; }, get level() { return level; }, setLevel, shot(p: number) { target = progress = p; resize(); apply(0.016, 1000); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); } } });

  if (import.meta.env.DEV) console.info(`[street] scene built in ${Math.round(performance.now() - t0)} ms`);

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
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const mm of Array.isArray(m) ? m : m ? [m] : []) {
          const t = mm as THREE.MeshStandardMaterial;
          t.map?.dispose();
          t.bumpMap?.dispose();
        }
      });
      glowTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
