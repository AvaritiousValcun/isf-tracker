import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Layers, Eye, Play, Pause, RotateCcw, Sparkles, Activity } from "lucide-react";

export type HormoneType = "progesterone" | "freeTestosterone";

interface Atom {
  x: number;
  y: number;
  z: number;
  element: "C" | "O" | "H" | "N";
  color: string;
  radius: number;
}

interface Bond {
  a: number;
  b: number;
  order: 1 | 2;
}

interface HormoneConfig {
  name: string;
  chemicalName: string;
  formula: string;
  mw: string;
  targetRange: string;
  phase: string;
  description: string;
  currentReading: string;
  readingStatus: string;
  statusBadge: string;
  accentColor: string;
  atoms: Atom[];
  bonds: Bond[];
}

export const HORMONE_DATA: Record<HormoneType, HormoneConfig> = {
  progesterone: {
    name: "Progesterone (P4)",
    chemicalName: "Pregn-4-ene-3,20-dione",
    formula: "C₂₁H₃₀O₂",
    mw: "314.46 g/mol",
    targetRange: "5 – 60 nmol/L",
    phase: "Luteal Phase & Implantation Window",
    description: "Pregnane steroid critical for secretory endometrium; spikes 48h post-ovulation.",
    currentReading: "19.8 ng/mL",
    readingStatus: "In Plateau",
    statusBadge: "Secretory Luteal",
    accentColor: "#9333EA",
    atoms: [
      // Ring A
      { x: -110, y: -25, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -145, y: 15, z: 8, element: "C", color: "#9333EA", radius: 9 },
      { x: -120, y: 60, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -70, y: 60, z: -8, element: "C", color: "#9333EA", radius: 9 },
      { x: -40, y: 20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -65, y: -25, z: 8, element: "C", color: "#9333EA", radius: 9 },
      // Ring B
      { x: -35, y: 65, z: 20, element: "C", color: "#9333EA", radius: 9 },
      { x: 15, y: 65, z: 12, element: "C", color: "#9333EA", radius: 9 },
      { x: 40, y: 20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 10, y: -25, z: -10, element: "C", color: "#9333EA", radius: 9 },
      // Ring C
      { x: 15, y: -70, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 65, y: -70, z: 15, element: "C", color: "#9333EA", radius: 9 },
      { x: 90, y: -25, z: 5, element: "C", color: "#9333EA", radius: 9 },
      { x: 60, y: 20, z: -10, element: "C", color: "#9333EA", radius: 9 },
      // Ring D
      { x: 105, y: 60, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 145, y: 35, z: 12, element: "C", color: "#9333EA", radius: 9 },
      { x: 135, y: -20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      // Functional groups
      { x: -155, y: 95, z: 0, element: "O", color: "#FB923C", radius: 11 },   // 3-Keto =O
      { x: 175, y: -45, z: 12, element: "C", color: "#9333EA", radius: 9 },   // C20
      { x: 195, y: -25, z: 25, element: "O", color: "#FB923C", radius: 11 },  // 20-Keto =O
      { x: 195, y: -80, z: 5, element: "C", color: "#9333EA", radius: 8 },    // C21 methyl
      { x: -65, y: -30, z: 48, element: "C", color: "#9333EA", radius: 8 },   // C19 methyl
      { x: 90, y: -30, z: 48, element: "C", color: "#9333EA", radius: 8 },    // C18 methyl
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
      { a: 3, b: 4, order: 2 }, { a: 4, b: 5, order: 1 }, { a: 5, b: 0, order: 1 },
      { a: 4, b: 6, order: 1 }, { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 },
      { a: 8, b: 9, order: 1 }, { a: 9, b: 5, order: 1 },
      { a: 9, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 11, b: 12, order: 1 },
      { a: 12, b: 13, order: 1 }, { a: 13, b: 8, order: 1 },
      { a: 13, b: 14, order: 1 }, { a: 14, b: 15, order: 1 }, { a: 15, b: 16, order: 1 },
      { a: 16, b: 12, order: 1 },
      { a: 2, b: 17, order: 2 },
      { a: 16, b: 18, order: 1 }, { a: 18, b: 19, order: 2 }, { a: 18, b: 20, order: 1 },
      { a: 5, b: 21, order: 1 },
      { a: 12, b: 22, order: 1 },
    ],
  },
  freeTestosterone: {
    name: "Free Testosterone (FT)",
    chemicalName: "17β-hydroxyandrost-4-en-3-one",
    formula: "C₁₉H₂₈O₂",
    mw: "288.42 g/mol",
    targetRange: "1.0 – 8.5 pg/mL",
    phase: "Basal Dermal Telemetry",
    description: "Bioactive unbound androgen tracking follicular development, metabolic tone, and hyperandrogenic safety margins in ISF.",
    currentReading: "38.2 ng/dL",
    readingStatus: "Controlled",
    statusBadge: "Basal Androgen",
    accentColor: "#0EA5A4",
    atoms: [
      // Ring A
      { x: -110, y: -25, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -145, y: 15, z: 8, element: "C", color: "#9333EA", radius: 9 },
      { x: -120, y: 60, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -70, y: 60, z: -8, element: "C", color: "#9333EA", radius: 9 },
      { x: -40, y: 20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: -65, y: -25, z: 8, element: "C", color: "#9333EA", radius: 9 },
      // Ring B
      { x: -35, y: 65, z: 20, element: "C", color: "#9333EA", radius: 9 },
      { x: 15, y: 65, z: 12, element: "C", color: "#9333EA", radius: 9 },
      { x: 40, y: 20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 10, y: -25, z: -10, element: "C", color: "#9333EA", radius: 9 },
      // Ring C
      { x: 15, y: -70, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 65, y: -70, z: 15, element: "C", color: "#9333EA", radius: 9 },
      { x: 90, y: -25, z: 5, element: "C", color: "#9333EA", radius: 9 },
      { x: 60, y: 20, z: -10, element: "C", color: "#9333EA", radius: 9 },
      // Ring D
      { x: 105, y: 60, z: 0, element: "C", color: "#9333EA", radius: 9 },
      { x: 145, y: 35, z: 12, element: "C", color: "#9333EA", radius: 9 },
      { x: 135, y: -20, z: 0, element: "C", color: "#9333EA", radius: 9 },
      // Functional groups: 3-Keto =O and 17β-OH
      { x: -155, y: 95, z: 0, element: "O", color: "#FB923C", radius: 11 },   // 3-Keto =O
      { x: 175, y: -45, z: 12, element: "O", color: "#FB923C", radius: 11 },  // 17-OH Oxygen
      { x: -65, y: -30, z: 48, element: "C", color: "#9333EA", radius: 8 },   // C19 methyl
      { x: 90, y: -30, z: 48, element: "C", color: "#9333EA", radius: 8 },    // C18 methyl
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
      { a: 3, b: 4, order: 2 }, { a: 4, b: 5, order: 1 }, { a: 5, b: 0, order: 1 },
      { a: 4, b: 6, order: 1 }, { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 },
      { a: 8, b: 9, order: 1 }, { a: 9, b: 5, order: 1 },
      { a: 9, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 11, b: 12, order: 1 },
      { a: 12, b: 13, order: 1 }, { a: 13, b: 8, order: 1 },
      { a: 13, b: 14, order: 1 }, { a: 14, b: 15, order: 1 }, { a: 15, b: 16, order: 1 },
      { a: 16, b: 12, order: 1 },
      { a: 2, b: 17, order: 2 },
      { a: 16, b: 18, order: 1 },
      { a: 5, b: 19, order: 1 },
      { a: 12, b: 20, order: 1 },
    ],
  },
};

/* =========================================================================
   AUTHENTIC STEROID RING GEOMETRY ENGINE (MATCHING LOGIN PAGE AUTH ENGINE)
   ========================================================================= */
const SC = 0.78;
const CEN = [2.45, 1.6];
const V = THREE.Vector3;

const RA: Record<string, [number, number]> = {
  C1: [0, 1],
  C2: [-0.866, 0.5],
  C3: [-0.866, -0.5],
  C4: [0, -1],
  C5: [0.866, -0.5],
  C10: [0.866, 0.5],
  C6: [1.732, -1],
  C7: [2.598, -0.5],
  C8: [2.598, 0.5],
  C9: [1.732, 1],
  C11: [1.732, 2],
  C12: [2.598, 2.5],
  C13: [3.464, 2],
  C14: [3.464, 1],
  C15: [4.415, 0.692],
  C16: [5.002, 1.5],
  C17: [4.415, 2.308],
};

const REL0: Record<string, [string, number, number, number]> = {
  C18: ["C13", 0, 0.25, 0.97],
  C19: ["C10", 0, 0.25, 0.97],
  O3: ["C3", -0.866, -0.5, 0],
};

const BDS: [string, string][] = [
  ["C1", "C2"],
  ["C2", "C3"],
  ["C3", "C4"],
  ["C4", "C5"],
  ["C5", "C10"],
  ["C10", "C1"],
  ["C5", "C6"],
  ["C6", "C7"],
  ["C7", "C8"],
  ["C8", "C9"],
  ["C9", "C10"],
  ["C9", "C11"],
  ["C11", "C12"],
  ["C12", "C13"],
  ["C13", "C14"],
  ["C14", "C8"],
  ["C13", "C17"],
  ["C17", "C16"],
  ["C16", "C15"],
  ["C15", "C14"],
  ["C10", "C19"],
  ["C13", "C18"],
  ["C3", "O3"],
];

const DBS = ["C4C5", "C3O3"];
const HC0: Record<string, number> = {
  C1: 2,
  C2: 2,
  C4: 1,
  C6: 2,
  C7: 2,
  C8: 1,
  C9: 1,
  C11: 2,
  C12: 2,
  C14: 1,
  C15: 2,
  C16: 2,
  C17: 1,
  C18: 3,
  C19: 3,
};
const HZ: Record<string, number> = { C8: 1, C9: -1, C14: -1, C17: -1 };
const HL = 0.42;

/* Molecule Specific Functional Groups */
const MOLECULE_CONFIGS: Record<HormoneType, any> = {
  progesterone: {
    rel: {
      C20: ["C17", 0.43, 0.62, 0.66],
      C21: ["C20", 0.925, -0.18, 0.33],
      O20: ["C20", -0.495, 0.8, 0.33],
    },
    bd: [
      ["C17", "C20"],
      ["C20", "C21"],
      ["C20", "O20"],
    ],
    hc: { C21: 3 },
    db: ["C20O20"],
  },
  freeTestosterone: {
    rel: {
      O17: ["C17", 0.43, 0.62, 0.66],
      HO: ["O17", 0.35, 0.55, 0.1],
    },
    bd: [
      ["C17", "O17"],
      ["O17", "HO"],
    ],
    hc: {},
    db: [],
  },
};

/* =========================================================================
   INDIVIDUAL 3D HORMONE CANVAS (AUTHENTIC LOGIN PAGE VISUALS)
   ========================================================================= */
interface SingleHormoneCanvasProps {
  type: HormoneType;
  config: HormoneConfig;
  isRotatingGlobal: boolean;
}

function SingleHormoneCanvas({
  type,
  config,
  isRotatingGlobal,
}: SingleHormoneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [localRotating, setLocalRotating] = useState(true);

  // Drag interaction references
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const spinGroupRef = useRef<THREE.Group | null>(null);
  const tiltGroupRef = useRef<THREE.Group | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch {
      // Graceful fallback for headless environments
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / Math.max(container.clientHeight, 220),
      0.1,
      60
    );
    camera.position.set(0, 0, 7.8);
    camera.lookAt(0, 0, 0);

    /* Scene Lighting Matching AuthPage */
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223642, 1.25));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const l1 = new THREE.PointLight(0xdff4fc, 1.6, 22);
    l1.position.set(-4, -1, 4);
    scene.add(l1);

    const l2 = new THREE.PointLight(0x8cb6cb, 2.2, 24);
    l2.position.set(4, 2, -3);
    scene.add(l2);

    const l3 = new THREE.PointLight(0xffffff, 1.3, 16);
    l3.position.set(0, 0, 6);
    scene.add(l3);

    /* Group Hierarchy for smooth tilt & spin */
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    scene.add(root);
    root.add(tilt);
    tilt.add(spin);

    rootGroupRef.current = root;
    tiltGroupRef.current = tilt;
    spinGroupRef.current = spin;

    tilt.rotation.x = 0.18;
    tilt.rotation.z = -0.06;

    /* Materials Matching AuthPage */
    const M = (c: number, o?: any) =>
      new THREE.MeshStandardMaterial(
        Object.assign({ color: c, roughness: 0.42, metalness: 0.12 }, o || {})
      );

    const EM: Record<string, THREE.Material> = {
      C: M(0x9333ea, {
        roughness: 0.32,
        metalness: 0.15,
        emissive: 0x3b0764,
        emissiveIntensity: 0.32,
      }),
      O: M(0xfb923c, {
        roughness: 0.32,
        metalness: 0.15,
        emissive: 0x9a3412,
        emissiveIntensity: 0.34,
      }),
      H: M(0x2dd4bf, {
        roughness: 0.32,
        metalness: 0.15,
        emissive: 0x115e59,
        emissiveIntensity: 0.34,
      }),
    };

    const EG: Record<string, THREE.BufferGeometry> = {
      C: new THREE.SphereGeometry(0.145, 26, 18),
      O: new THREE.SphereGeometry(0.17, 26, 18),
      H: new THREE.SphereGeometry(0.088, 20, 14),
    };

    const bmat = M(0x8faab5, { roughness: 0.45, metalness: 0.12 });
    const bg1 = new THREE.CylinderGeometry(0.034, 0.034, 1, 10);
    const bg2 = new THREE.CylinderGeometry(0.022, 0.022, 1, 8);

    /* Build Steroid Ring System */
    const molConfig = MOLECULE_CONFIGS[type];
    const PB: Record<string, THREE.Vector3> = {};
    const BD = BDS.concat(molConfig.bd);
    const DB = DBS.concat(molConfig.db);
    const NB: Record<string, string[]> = {};
    const HB: string[] = [];

    Object.entries(RA).forEach(
      ([n, a]) =>
        (PB[n] = new V(
          a[0],
          a[1],
          0.18 * Math.sin(a[0] * 1.9 + a[1] * 2.3)
        ))
    );

    Object.entries(Object.assign({}, REL0, molConfig.rel)).forEach(
      ([n, r]: any) => (PB[n] = PB[r[0]].clone().add(new V(r[1], r[2], r[3])))
    );

    Object.values(PB).forEach((v) =>
      v.set((v.x - CEN[0]) * SC, (v.y - CEN[1]) * SC, v.z * SC)
    );

    BD.forEach(([a, b]) => {
      (NB[a] = NB[a] || []).push(b);
      (NB[b] = NB[b] || []).push(a);
    });

    Object.entries(Object.assign({}, HC0, molConfig.hc)).forEach(
      ([n, cnt]: any) => {
        const c = PB[n];
        if (!c) return;
        const us = (NB[n] || []).map((k) => PB[k].clone().sub(c).normalize());
        const sum = us.reduce((a, u) => a.add(u), new V());
        const dirs: THREE.Vector3[] = [];

        if (cnt === 1) {
          const d = sum.clone().negate();
          if (HZ[n]) d.z += HZ[n] * 1.1;
          dirs.push(d.normalize());
        } else if (cnt === 2) {
          const u = sum.clone().negate().normalize();
          const w = new V()
            .crossVectors(us[0] || new V(1, 0, 0), us[1] || new V(0, 1, 0))
            .normalize();
          if (w.z < 0) w.negate();
          dirs.push(
            u.clone().multiplyScalar(0.577).addScaledVector(w, 0.816),
            u.clone().multiplyScalar(0.577).addScaledVector(w, -0.816)
          );
        } else {
          const d = sum.clone().negate().normalize();
          const q = Math.abs(d.x) > 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
          const t1 = new V().crossVectors(d, q).normalize();
          const t2 = new V().crossVectors(d, t1);
          for (let i = 0; i < 3; i++) {
            const a = i * 2.094;
            dirs.push(
              d
                .clone()
                .multiplyScalar(0.333)
                .addScaledVector(t1, 0.943 * Math.cos(a))
                .addScaledVector(t2, 0.943 * Math.sin(a))
            );
          }
        }

        dirs.forEach((dr) => {
          const h = "H" + HB.length;
          PB[h] = c.clone().addScaledVector(dr, HL);
          HB.push(h);
          BD.push([n, h]);
        });
      }
    );

    const mol = new THREE.Group();
    spin.add(mol);

    const ATM = Object.keys(PB).map((n) => {
      const atomType = n[0];
      const geom = EG[atomType] || EG.C;
      const mat = EM[atomType] || EM.C;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(PB[n]);
      mol.add(mesh);
      return { n, mesh, b: PB[n] };
    });

    const BN: any[] = [];
    const dir = new V();
    const perp = new V();
    const zax = new V(0, 0, 1);
    const yax = new V(0, 1, 0);

    BD.forEach(([a, b]) => {
      const isDouble = DB.includes(a + b);
      const count = isDouble ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const bm = new THREE.Mesh(b[0] === "H" ? bg2 : bg1, bmat);
        mol.add(bm);
        const off = count === 1 ? 0 : (i ? 0.5 : -0.5) * 0.08;
        BN.push({ a, b, off, m: bm });
      }
    });

    // Initial bond alignment
    BN.forEach((o) => {
      const p = PB[o.a];
      const q = PB[o.b];
      if (!p || !q) return;
      dir.subVectors(q, p);
      const len = dir.length();
      dir.normalize();
      perp.crossVectors(dir, zax).normalize().multiplyScalar(o.off);
      o.m.position.copy(p).add(q).multiplyScalar(0.5).add(perp);
      o.m.scale.set(1, len, 1);
      o.m.quaternion.setFromUnitVectors(yax, dir);
    });

    /* ISF Swirling Droplets Particles */
    const N = 180;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const cl = [
      [0.58, 0.2, 0.92], // purple
      [0.0, 0.72, 0.68], // teal
      [0.98, 0.57, 0.24], // amber
    ];
    const P = [...Array(N)].map((_, i) => ({
      a: Math.random() * 6.283,
      r: 1.8 + Math.random() * 1.6,
      h: (Math.random() - 0.5) * 1.5,
      sp: 0.15 + Math.random() * 0.35,
      ph: Math.random(),
      c: cl[i % 3],
    }));

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(col, 3));

    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const cx = cv.getContext("2d");
    if (cx) {
      const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.35, "rgba(255,255,255,0.7)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 64, 64);
    }

    const particleTexture = new THREE.CanvasTexture(cv);
    const pts = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        size: 0.11,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.frustumCulled = false;
    scene.add(pts);

    /* Resize Handling */
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth || 320;
      const height = Math.max(container.clientHeight || 260, 240);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    /* Animation Loop */
    let animId: number;
    let t = 0;
    let last = performance.now();

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      // Auto rotation when enabled and not dragging
      if (localRotating && isRotatingGlobal && !isDraggingRef.current) {
        spin.rotation.y += dt * 0.48;
        root.position.y = Math.sin(t * 1.4) * 0.05;
      }

      // Animate swirling ISF particle cloud
      for (let i = 0; i < N; i++) {
        const q = P[i];
        const a = q.a + t * q.sp;
        const ox = Math.cos(a) * q.r;
        const oz = Math.sin(a) * q.r;
        const oy = q.h + Math.sin(t * 1.3 + q.ph * 6) * 0.14;
        pos[i * 3] = ox;
        pos[i * 3 + 1] = oy;
        pos[i * 3 + 2] = oz;

        const b = 0.75 + Math.sin(t * 2.2 + q.ph * 4) * 0.25;
        col[i * 3] = q.c[0] * b;
        col[i * 3 + 1] = q.c[1] * b;
        col[i * 3 + 2] = q.c[2] * b;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      particleTexture.dispose();
      pg.dispose();
      Object.values(EG).forEach((g) => g.dispose());
      bg1.dispose();
      bg2.dispose();
      Object.values(EM).forEach((m) => m.dispose());
      bmat.dispose();
    };
  }, [type, localRotating, isRotatingGlobal]);

  // Pointer event handlers for 3D interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    if (spinGroupRef.current) {
      spinGroupRef.current.rotation.y += deltaX * 0.009;
    }
    if (tiltGroupRef.current) {
      tiltGroupRef.current.rotation.x += deltaY * 0.009;
      // Clamp tilt angle to prevent invert
      tiltGroupRef.current.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, tiltGroupRef.current.rotation.x)
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const handleResetOrientation = () => {
    if (spinGroupRef.current) spinGroupRef.current.rotation.y = 0;
    if (tiltGroupRef.current) {
      tiltGroupRef.current.rotation.x = 0.18;
      tiltGroupRef.current.rotation.z = -0.06;
    }
    if (rootGroupRef.current) rootGroupRef.current.position.set(0, 0, 0);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[24px] border border-slate-200/90 dark:border-[#243C47] bg-white/95 dark:bg-[#15232A]/95 p-4 sm:p-5 shadow-lg dark:shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-all">
      {/* Molecule Card Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#243C47] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl shadow-xs text-white"
            style={{ backgroundColor: config.accentColor }}
          >
            <Activity size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-display text-[15px] font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
                {config.name}
              </h4>
              <span className="rounded-full bg-slate-100 dark:bg-[#1C2F38] px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-[#A0B4BE]">
                {config.statusBadge}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#738C98]">
              {config.chemicalName}
            </p>
          </div>
        </div>

        {/* Live reading telemetry pill */}
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            {config.currentReading}
          </span>
          <span className="block text-[9px] font-medium text-slate-400 dark:text-[#738C98] mt-0.5">
            {config.readingStatus}
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas Area */}
      <div
        ref={containerRef}
        className="relative my-2.5 flex h-[250px] w-full cursor-grab items-center justify-center active:cursor-grabbing touch-none select-none overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50/70 via-white to-slate-100/50 dark:from-[#111D23] dark:via-[#132026] dark:to-[#0D161A]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="h-full w-full touch-none select-none" />

        {/* Live Interaction Drag Hint */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-1.5 rounded-full bg-white/85 dark:bg-[#111D23]/90 border border-slate-200/80 dark:border-[#243C47] px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-[#A0B4BE] backdrop-blur-xs shadow-xs">
          <Eye size={12} className="text-[#0EA5A4] dark:text-[#F3E308]" />
          <span>Drag in 3D to rotate</span>
        </div>

        {/* Canvas Controls: Reset & Rotation Toggle */}
        <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetOrientation}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-[#243C47] bg-white/90 dark:bg-[#111D23]/90 text-slate-600 dark:text-[#E8F2F6] shadow-xs transition hover:bg-slate-100 dark:hover:bg-[#1C2F38]"
            title="Reset 3D view"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            onClick={() => setLocalRotating((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-[#243C47] bg-white/90 dark:bg-[#111D23]/90 text-slate-600 dark:text-[#E8F2F6] shadow-xs transition hover:bg-slate-100 dark:hover:bg-[#1C2F38]"
            title={localRotating ? "Pause rotation" : "Resume rotation"}
          >
            {localRotating && isRotatingGlobal ? (
              <Pause size={12} />
            ) : (
              <Play size={12} />
            )}
          </button>
        </div>
      </div>

      {/* Chemical & Physiological Telemetry Bar (4 Columns) */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23]/90 p-3 text-[11px] backdrop-blur-xs sm:grid-cols-4">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#738C98]">
            Formula
          </span>
          <span className="font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
            {config.formula}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#738C98]">
            Target Band
          </span>
          <span className="font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
            {config.targetRange}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#738C98]">
            Mass
          </span>
          <span className="font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
            {config.mw}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#738C98]">
            ISF Matrix
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500 dark:bg-teal-400" />
            Continuous
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN EXPORTED VISUALIZER: DUAL SIDE-BY-SIDE 3D BIOSENSING
   ========================================================================= */
export default function Hormone3DVisualizer({ compact = false }: { compact?: boolean }) {
  const [globalRotating, setGlobalRotating] = useState(true);

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-[#243C47] bg-gradient-to-br from-white via-slate-50 to-[#F2F7F9] dark:from-[#15232A] dark:via-[#111D23] dark:to-[#0D161A] shadow-md dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      {/* Global Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-[#243C47] pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2C4C5C] to-[#1E343F] text-white shadow-sm">
            <Layers size={20} className="text-[#0EA5A4] dark:text-[#F3E308]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[17px] font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
                3D ISF Molecular Biosensing
              </h3>
              <span className="rounded-full bg-[#0EA5A4]/15 px-2 py-0.5 text-[10px] font-bold text-[#0EA5A4] dark:text-[#F3E308]">
                Dual Analyte Sync
              </span>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-[#A0B4BE]">
              Interactive interstitial analyte structure & dermal flux
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGlobalRotating((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#111D23] px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-[#E8F2F6] hover:bg-slate-100 dark:hover:bg-[#1C2F38] transition shadow-2xs cursor-pointer"
          >
            {globalRotating ? (
              <>
                <Pause size={13} className="text-[#0EA5A4] dark:text-[#F3E308]" />
                <span>Pause All</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-[#0EA5A4] dark:text-[#F3E308]" />
                <span>Play All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Side-by-Side Dual 3D Hormone Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Progesterone */}
        <SingleHormoneCanvas
          type="progesterone"
          config={HORMONE_DATA.progesterone}
          isRotatingGlobal={globalRotating}
        />

        {/* Right: Free Testosterone */}
        <SingleHormoneCanvas
          type="freeTestosterone"
          config={HORMONE_DATA.freeTestosterone}
          isRotatingGlobal={globalRotating}
        />
      </div>

      {/* Shared Molecular Palette & Sensor Legend */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-[#243C47] bg-white/70 dark:bg-[#111D23]/70 px-4 py-2.5 text-[11px] text-slate-600 dark:text-[#A0B4BE] backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
            Molecular Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#9333EA] shadow-xs" />
            <span>Carbon (C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FB923C] shadow-xs" />
            <span>Oxygen (O)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2DD4BF] shadow-xs" />
            <span>Hydrogen (H)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8FAAB5] shadow-xs" />
            <span>Dermal Covalent Bonds</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-[#738C98]">
          <Sparkles size={12} className="text-[#0EA5A4] dark:text-[#F3E308]" />
          <span>Biocompatible Stratum Corneum ISF Flux</span>
        </div>
      </div>
    </div>
  );
}
