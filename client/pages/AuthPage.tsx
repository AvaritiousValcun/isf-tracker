import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useAuth } from "@/hooks/useAuth";
import "./AuthPage.css";

interface AuthPageProps {
  onOpenDashboard?: () => void;
}

export default function AuthPage({ onOpenDashboard }: AuthPageProps) {
  const { user, profile, signIn, signUp, signOut } = useAuth();
  const [scene, setScene] = useState<"boot" | "welcome" | "signin" | "signup" | "done" | "home">("boot");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vzRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const twRef = useRef<HTMLDivElement | null>(null);
  const wipeRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const displayUserName = useMemo(() => {
    if (fullName.trim()) return fullName.trim().split(" ")[0];
    if (profile?.full_name?.trim()) return profile.full_name.trim().split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  }, [fullName, profile, user]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  /* Three.js Engine initialization */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      return;
    }

    const S = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 60);

    S.add(new THREE.HemisphereLight(0xffffff, 0x223642, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 5, 4);
    S.add(key);

    const l1 = new THREE.PointLight(0xdff4fc, 1.6, 22);
    l1.position.set(-4, -1, 4);
    S.add(l1);

    const l2 = new THREE.PointLight(0x8cb6cb, 2.2, 24);
    l2.position.set(4, 2, -3);
    S.add(l2);

    const l3 = new THREE.PointLight(0xffffff, 1.3, 16);
    l3.position.set(0, 0, 6);
    S.add(l3);

    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    S.add(root);
    root.add(tilt);
    tilt.add(spin);

    const root2 = new THREE.Group();
    const tilt2 = new THREE.Group();
    const spin2 = new THREE.Group();
    S.add(root2);
    root2.add(tilt2);
    tilt2.add(spin2);

    const M = (c: number, o?: any) =>
      new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.1 }, o || {}));

    const SC = 0.62;
    const CEN = [2.45, 1.6];
    const FR = ["back", "pcb", "adh", "nd"] as const;
    const V = THREE.Vector3;
    const EXP: Record<string, [number, number, number]> = {
      back: [1.1, 1, 0.6],
      pcb: [1.3, -0.3, 0.3],
      adh: [0, 0.2, -0.8],
      nd: [-1.3, -0.7, 0.4],
    };

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

    const FRG0: Record<string, string> = {
      C1: "nd",
      C2: "nd",
      C3: "nd",
      C4: "nd",
      O3: "nd",
      C15: "pcb",
      C16: "pcb",
      C17: "pcb",
      C20: "back",
      C21: "back",
      O20: "back",
      O17: "back",
      HO: "back",
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

    const EM: Record<string, THREE.Material> = {
      C: M(0x9333ea, { roughness: 0.35, metalness: 0.15, emissive: 0x3b0764, emissiveIntensity: 0.28 }),
      O: M(0xfb923c, { roughness: 0.35, metalness: 0.15, emissive: 0x9a3412, emissiveIntensity: 0.32 }),
      H: M(0x2dd4bf, { roughness: 0.35, metalness: 0.15, emissive: 0x115e59, emissiveIntensity: 0.32 }),
    };

    const EG: Record<string, THREE.BufferGeometry> = {
      C: new THREE.SphereGeometry(0.135, 28, 18),
      O: new THREE.SphereGeometry(0.16, 28, 18),
      H: new THREE.SphereGeometry(0.08, 20, 14),
    };

    const bmat = M(0x8faab5, { roughness: 0.45, metalness: 0.12 });
    const bg1 = new THREE.CylinderGeometry(0.032, 0.032, 1, 10);
    const bg2 = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);

    function makeMol(parent: THREE.Group, X: any) {
      const PB: Record<string, THREE.Vector3> = {};
      const BD = BDS.concat(X.bd);
      const DB = DBS.concat(X.db);
      const NB: Record<string, string[]> = {};
      const FRG = Object.assign({}, FRG0);
      const HB: string[] = [];

      Object.entries(RA).forEach(
        ([n, a]) =>
          (PB[n] = new V(
            a[0],
            a[1],
            0.18 * Math.sin(a[0] * 1.9 + a[1] * 2.3)
          ))
      );

      Object.entries(Object.assign({}, REL0, X.rel)).forEach(
        ([n, r]: any) =>
          (PB[n] = PB[r[0]].clone().add(new V(r[1], r[2], r[3])))
      );

      Object.values(PB).forEach((v) =>
        v.set((v.x - CEN[0]) * SC, (v.y - CEN[1]) * SC, v.z * SC)
      );

      BD.forEach(([a, b]) => {
        (NB[a] = NB[a] || []).push(b);
        (NB[b] = NB[b] || []).push(a);
      });

      Object.entries(Object.assign({}, HC0, X.hc)).forEach(
        ([n, cnt]: any) => {
          const c = PB[n];
          if (!c) return;
          const us = (NB[n] || []).map((k) =>
            PB[k].clone().sub(c).normalize()
          );
          const sum = us.reduce((a, u) => a.add(u), new V());
          const dirs: THREE.Vector3[] = [];

          if (cnt === 1) {
            const d = sum.clone().negate();
            if (HZ[n]) d.z += HZ[n] * 1.1;
            dirs.push(d.normalize());
          } else if (cnt === 2) {
            const u = sum.clone().negate().normalize();
            const w = new V().crossVectors(us[0] || new V(1, 0, 0), us[1] || new V(0, 1, 0)).normalize();
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
            FRG[h] = FRG[n] || "adh";
            HB.push(h);
            BD.push([n, h]);
          });
        }
      );

      const mol = new THREE.Group();
      parent.add(mol);

      const ATM = Object.keys(PB).map((n) => {
        const atomType = n[0];
        const geom = EG[atomType] || EG.C;
        const mat = EM[atomType] || EM.C;
        const mesh = new THREE.Mesh(geom, mat);
        mol.add(mesh);
        return { n, mesh, f: FRG[n] || "adh", b: PB[n] };
      });

      const BN: any[] = [];
      BD.forEach(([a, b]) => {
        const n = DB.includes(a + b) ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const bm = new THREE.Mesh(b[0] === "H" ? bg2 : bg1, bmat);
          mol.add(bm);
          BN.push({ a, b, off: n === 1 ? 0 : (i ? 0.5 : -0.5) * 0.075, m: bm });
        }
      });

      const AP: Record<string, THREE.Vector3> = {};
      const FP: Record<string, THREE.Vector3> = {};
      const dir = new V();
      const perp = new V();
      const zax = new V(0, 0, 1);
      const yax = new V(0, 1, 0);
      FR.forEach((f) => (FP[f] = new V()));

      function update(e: number) {
        const fc: Record<string, number> = { back: 0, pcb: 0, adh: 0, nd: 0 };
        FR.forEach((f) => FP[f].set(0, 0, 0));

        ATM.forEach((a) => {
          const o = EXP[a.f] || [0, 0, 0];
          a.mesh.position.set(a.b.x + o[0] * e, a.b.y + o[1] * e, a.b.z + o[2] * e);
          AP[a.n] = a.mesh.position;
          FP[a.f].add(a.mesh.position);
          fc[a.f]++;
        });

        FR.forEach((f) => {
          if (fc[f]) FP[f].multiplyScalar(1 / fc[f]);
        });

        BN.forEach((o) => {
          const p = AP[o.a];
          const q = AP[o.b];
          if (!p || !q) return;
          dir.subVectors(q, p);
          const len = dir.length();
          dir.normalize();
          perp.crossVectors(dir, zax).normalize().multiplyScalar(o.off);
          o.m.position.copy(p).add(q).multiplyScalar(0.5).add(perp);
          o.m.scale.set(1, len, 1);
          o.m.quaternion.setFromUnitVectors(yax, dir);
        });
      }

      return { mol, FP, update };
    }

    /* Progesterone (MP) and Testosterone (MT) */
    const MP = makeMol(spin, {
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
    });

    const MT = makeMol(spin2, {
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
    });
    MT.update(0);

    /* ISF Swirling Droplets Particles */
    const N = 420;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const cl = [
      [0.22, 0.06, 0.46],
      [0, 0.34, 0.3],
      [0.46, 0.28, 0],
    ];
    const P = [...Array(N)].map((_, i) => ({
      a: Math.random() * 6.283,
      r: 1.9 + Math.random() * 1.7,
      h: (Math.random() - 0.5) * 1.6,
      sp: 0.12 + Math.random() * 0.3,
      ph: Math.random(),
      x: (Math.random() - 0.5) * 3.6,
      z: (Math.random() - 0.5) * 1.6,
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
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.35, "rgba(255,255,255,.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 64, 64);
    }

    const pts = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        size: 0.12,
        map: new THREE.CanvasTexture(cv),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.frustumCulled = false;
    tilt.add(pts);
    const pts2 = pts.clone();
    tilt2.add(pts2);

    const m = { x: 0, y: 0, tx: 0, ty: 0 };
    const cur2 = { x: 0, y: 0, s: 0 };
    const cur: any = {
      x: 2.3,
      y: 0,
      s: 0,
      rx: 1,
      ex: 1,
      st: 0,
      sk: 0,
      cx: 0,
      cy: 0.6,
      cz: 8,
    };
    const kick = { v: 1 };

    const mob = () => window.innerWidth < 900;

    function homeCfg() {
      const vzEl = vzRef.current;
      const r = vzEl ? vzEl.getBoundingClientRect() : { left: 0, top: 0, width: 300, height: 200, bottom: 200 };
      const cz = 9.5;
      const hh = Math.tan((18 * Math.PI) / 180) * cz;
      const hw = (hh * window.innerWidth) / window.innerHeight;
      const vis = r.bottom > 40 && r.top < window.innerHeight - 20;
      const cx = ((r.left + r.width / 2) / window.innerWidth) * 2 * hw - hw;
      const cy = -(((r.top + r.height * 0.5) / window.innerHeight) * 2 * hh - hh);
      const dx = (r.width / window.innerWidth) * 2 * hw * 0.25;
      const s = vis
        ? Math.max(0.15, Math.min(((r.height / window.innerHeight) * 2 * hh * 0.8) / 3.3, ((r.width / window.innerWidth) * 2 * hw * 0.44) / 4.2))
        : 0;
      return {
        rx: 0.1,
        spin: 0.12,
        cam: [0, 0, cz],
        x: cx + dx,
        y: cy,
        s,
        x2: cx - dx,
        y2: cy,
        s2: s,
        ex: 0,
        st: 0,
        sk: 0,
      };
    }

    function getCfg(s: string) {
      if (s === "home") return homeCfg();
      const cfgs: Record<string, any> = {
        boot: { rx: 0.1, spin: 0.3, cam: [0, 0.4, 8], x: 2.3, y: 0, s: 0, ex: 1, st: 0, sk: 0 },
        welcome: { rx: 0.12, spin: 0.3, cam: [0, 0.4, 8], x: 2.5, y: 0, s: 0.7, ex: 0, st: 0, sk: 0 },
        signin: { rx: 0.05, spin: 0.22, cam: [0, 0.2, 7], x: -2.6, y: 0, s: 0.78, ex: 0, st: 1, sk: 0 },
        signup: { rx: 0.15, spin: 0.14, cam: [0, 0.5, 8.6], x: -2.7, y: 0, s: 0.68, ex: 1, st: 0, sk: 0 },
        done: { rx: 0, spin: 1.1, cam: [0, 0, 9], x: 0, y: 0.1, s: 0.95, ex: 0, st: 0, sk: 0 },
      };
      const c = cfgs[s] || cfgs.welcome;
      if (mob()) {
        const o = Object.assign({}, c);
        o.x = 0;
        o.y = s === "done" ? 0.1 : 1.5;
        o.s = c.s * (s === "done" ? 0.8 : 0.9);
        return o;
      }
      return c;
    }

    function handleResize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);
    handleResize();

    function handlePointerMove(e: PointerEvent) {
      m.tx = (e.clientX / window.innerWidth) * 2 - 1;
      m.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", handlePointerMove);

    const ease = (x: number) => x * x * (3 - 2 * x);
    const v3 = new THREE.Vector3();
    let t = 0;
    let last = performance.now();
    let spinK = 0;
    let sph = 0;
    let animId: number;

    const currentScene = () => {
      const rootEl = document.querySelector(".auth-root");
      return rootEl?.getAttribute("data-s") || "welcome";
    };

    function renderLoop(now: number) {
      animId = requestAnimationFrame(renderLoop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      const sc = currentScene();
      const c: any = getCfg(sc);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const kk = reduceMotion ? 1 : 1 - Math.exp(-dt * (sc === "home" ? 4 : 2.6));
      const ks = reduceMotion ? 1 : 1 - Math.exp(-dt * 1.8);

      for (const q of ["x", "y", "s", "rx", "st", "sk"]) {
        cur[q] += (c[q] - cur[q]) * kk;
      }
      cur.ex += (c.ex - cur.ex) * ks;
      cur.cx += (c.cam[0] - cur.cx) * kk;
      cur.cy += (c.cam[1] - cur.cy) * kk;
      cur.cz += (c.cam[2] - cur.cz) * kk;

      m.x += (m.tx - m.x) * 0.06;
      m.y += (m.ty - m.y) * 0.06;
      kick.v *= Math.exp(-dt * 1.5);

      document.documentElement.style.setProperty("--mx", m.x.toFixed(3));
      document.documentElement.style.setProperty("--my", m.y.toFixed(3));

      cam.fov = 36 + kick.v * 9;
      cam.updateProjectionMatrix();

      const pr = sc === "home" ? 0 : 1;
      cam.position.set(cur.cx + m.x * 0.55 * pr, cur.cy - m.y * 0.35 * pr, cur.cz);
      cam.lookAt(0, 0, 0);

      root.position.set(cur.x, cur.y + (reduceMotion ? 0 : Math.sin(t * 1.4) * 0.07), 0);
      root.scale.setScalar(Math.max(0.001, cur.s));
      tilt.rotation.x = cur.rx - m.y * 0.14;
      tilt.rotation.z = -m.x * 0.14;

      cur2.x += ((c.x2 === undefined ? c.x : c.x2) - cur2.x) * kk;
      cur2.y += ((c.y2 === undefined ? c.y : c.y2) - cur2.y) * kk;
      cur2.s += ((c.s2 || 0) - cur2.s) * kk;

      root2.position.set(cur2.x, cur2.y + (reduceMotion ? 0 : Math.sin(t * 1.4 + 1.7) * 0.07), 0);
      root2.scale.setScalar(Math.max(0.001, cur2.s));
      tilt2.rotation.x = cur.rx - m.y * 0.14;
      tilt2.rotation.z = -m.x * 0.14;
      spin2.rotation.y = Math.sin(sph * 1.1 + 1.3) * 0.85 + spinK;

      sph += dt * c.spin * 2;
      spinK += dt * kick.v * 6;
      spin.rotation.y = Math.sin(sph) * 0.85 + spinK;

      const e = ease(Math.min(1, Math.max(0, cur.ex)));
      MP.update(e);

      const st = cur.st;
      const burst = sc === "done" ? 1.5 : 1;
      for (let i = 0; i < N; i++) {
        const q = P[i];
        const a = q.a + t * q.sp * burst;
        const rr = q.r * (1 + e * 0.3) * burst;
        const ox = Math.cos(a) * rr;
        const oz = Math.sin(a) * rr;
        const oy = q.h * 0.5 + Math.sin(t * 1.3 + q.ph * 6) * 0.15;
        const f = (t * q.sp * 0.55 + q.ph) % 1;
        const sy = -2.2 + f * 4.4;
        const sx = q.x + Math.sin(t * 2 + q.ph * 9) * 0.03;
        const fade = Math.sin(f * Math.PI);
        pos[i * 3] = ox + (sx - ox) * st;
        pos[i * 3 + 1] = oy + (sy - oy) * st;
        pos[i * 3 + 2] = oz + (q.z - oz) * st;
        const b = 0.75 + (fade * 1.3 - 0.75) * st;
        col[i * 3] = q.c[0] * b;
        col[i * 3 + 1] = q.c[1] * b;
        col[i * 3 + 2] = q.c[2] * b;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.color.needsUpdate = true;

      renderer.render(S, cam);

      if (sc === "signup" && !mob()) {
        const tagEls = document.querySelectorAll<HTMLElement>(".auth-root .tag");
        tagEls.forEach((el) => {
          const lKey = el.dataset.l;
          if (!lKey || !MP.FP[lKey]) return;
          v3.copy(MP.FP[lKey]);
          MP.mol.localToWorld(v3);
          v3.x = root.position.x + 2.9 * root.scale.x;
          v3.project(cam);
          el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * window.innerWidth}px, ${
            (-v3.y * 0.5 + 0.5) * window.innerHeight - 12
          }px)`;
        });
      }
    }

    animId = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, []);

  /* Initial scene bootstrap */
  useEffect(() => {
    const tId = setTimeout(() => {
      setScene("welcome");
    }, 150);
    return () => clearTimeout(tId);
  }, []);

  /* Card tilt & glare interaction */
  const handleAuthPointerMove = (e: React.PointerEvent) => {
    const tw = twRef.current;
    const card = cardRef.current;
    if (!tw || !card) return;
    const r = tw.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    tw.style.transform = `rotateY(${(x - 0.5) * 9}deg) rotateX(${(0.5 - y) * 7}deg)`;
    card.style.setProperty("--gx", `${x * 100}%`);
    card.style.setProperty("--gy", `${y * 100}%`);
  };

  const handleAuthPointerLeave = () => {
    if (twRef.current) twRef.current.style.transform = "";
  };

  /* Navigation between scenes */
  const goTo = (nextScene: "welcome" | "signin" | "signup" | "done" | "home") => {
    if (busy || nextScene === scene) return;
    const was = scene;
    const isAuth = nextScene === "signin" || nextScene === "signup";

    const apply = () => {
      setScene(nextScene);
      setErrorMsg("");
      if (nextScene === "signin") setMode("signin");
      if (nextScene === "signup") setMode("signup");
    };

    if ((was === "signin" || was === "signup") && isAuth) {
      if (cardRef.current) {
        cardRef.current
          .animate([{ transform: "rotateY(0)" }, { transform: "rotateY(90deg)" }], {
            duration: 240,
            easing: "ease-in",
          })
          .onfinish = () => {
          apply();
          cardRef.current?.animate([{ transform: "rotateY(-90deg)" }, { transform: "rotateY(0)" }], {
            duration: 420,
            easing: "cubic-bezier(.2,.9,.2,1)",
          });
        };
      } else {
        apply();
      }
    } else {
      apply();
    }
  };

  /* Card shake error indicator */
  const shakeCard = (msg: string) => {
    setErrorMsg(msg);
    cardRef.current?.animate(
      [
        { translate: "0" },
        { translate: "-10px" },
        { translate: "9px" },
        { translate: "-6px" },
        { translate: "0" },
      ],
      { duration: 380 }
    );
  };

  /* Form submission with Supabase Authentication */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (mode === "signup" && !cleanName) {
      return shakeCard("Enter your full name.");
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return shakeCard("Enter a valid email address.");
    }
    if (password.length < 6) {
      return shakeCard("Password needs at least 6 characters.");
    }

    setErrorMsg("");
    setBusy(true);

    let authResult: { error: string | null };
    if (mode === "signup") {
      authResult = await signUp(cleanEmail, password, cleanName);
    } else {
      authResult = await signIn(cleanEmail, password);
    }

    if (authResult.error) {
      setBusy(false);
      return shakeCard(authResult.error);
    }

    /* Successful Auth Celebration: Circular Teal Screen Wipe */
    const wipe = wipeRef.current;
    const submitBtn = document.getElementById("go");
    if (wipe && submitBtn) {
      const r = submitBtn.getBoundingClientRect();
      const origin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;

      wipe.animate(
        [{ clipPath: `circle(0 at ${origin})` }, { clipPath: `circle(150% at ${origin})` }],
        { duration: 750, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }
      ).onfinish = () => {
        setBusy(false);
        goTo("done");

        setTimeout(() => {
          if (onOpenDashboard) {
            onOpenDashboard();
          } else {
            goTo("home");
          }
        }, 3600);

        wipe.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 700,
          delay: 200,
          fill: "forwards",
        }).onfinish = () => {
          wipe.getAnimations().forEach((a) => a.cancel());
          wipe.style.clipPath = "circle(0 at 50% 50%)";
        };
      };
    } else {
      setBusy(false);
      goTo("done");
      setTimeout(() => {
        if (onOpenDashboard) {
          onOpenDashboard();
        } else {
          goTo("home");
        }
      }, 3600);
    }
  };

  /* Top Right Date and Greeting calculation */
  const now = new Date();
  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const dateFormatted = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="auth-root" data-s={scene}>
      <div id="glow" />
      <div id="big">
        <span>ISF</span>
      </div>
      <canvas ref={canvasRef} id="c" aria-hidden="true" />

      {/* Top Header */}
      <header>
        <div className="brand">
          <i>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F3E308" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
          </i>
          ISF Tracker
        </div>
        <nav id="nav">
          {scene === "home" ? (
            <>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  signOut();
                  goTo("welcome");
                }}
              >
                Sign out
              </button>
            </>
          ) : scene === "welcome" || scene === "boot" ? (
            <>
              <button type="button" className="ghost" onClick={() => goTo("signin")}>
                Sign in
              </button>
              <button type="button" className="ghost" onClick={() => goTo("signup")}>
                Create account
              </button>
            </>
          ) : (
            <button type="button" className="ghost" onClick={() => goTo("welcome")}>
              Back
            </button>
          )}
        </nav>
      </header>

      {/* Progesterone Molecule Legend and Tags */}
      <div className="cap">
        <b>Progesterone</b>C<sub>21</sub>H<sub>30</sub>O<sub>2</sub>, one of the hormones your patch tracks
        <span className="lg">
          <i style={{ background: "#7F22FE" }} />Carbon
          <i style={{ background: "#FE9A00" }} />Oxygen
          <i style={{ background: "#00BBA7" }} />Hydrogen
        </span>
      </div>
      <div className="tag" data-l="back">
        <b>Acetyl side chain</b>The group that makes it progesterone
      </div>
      <div className="tag" data-l="pcb">
        <b>Ring D</b>The five-carbon ring at the end of the backbone
      </div>
      <div className="tag" data-l="adh">
        <b>Rings B and C</b>The rigid backbone shared by every steroid hormone
      </div>
      <div className="tag" data-l="nd">
        <b>Ring A</b>Carries the ketone group (orange oxygen)
      </div>

      <main>
        {/* HERO Landing Panel */}
        <section className="panel" id="hero">
          <div>
            <h1>
              <span className="ln" style={{ "--i": 0 } as any}>
                <span>Your hormones,</span>
              </span>
              <span className="ln" style={{ "--i": 1 } as any}>
                <span>read through</span>
              </span>
              <span className="ln" style={{ "--i": 2 } as any}>
                <span>your skin.</span>
              </span>
            </h1>
            <p>
              A wearable patch samples interstitial fluid and tracks estradiol, progesterone and cortisol around the clock. No blood draw.
            </p>
            <div className="row">
              <button type="button" className="cta" onClick={() => goTo("signup")}>
                Create account
              </button>
              <button type="button" className="ghost lg" onClick={() => goTo("signin")}>
                Sign in
              </button>
            </div>
          </div>
        </section>

        {/* AUTH Form Panel (Sign in & Sign up with 3D Tilt) */}
        <section className="panel" id="auth" onPointerMove={handleAuthPointerMove} onPointerLeave={handleAuthPointerLeave}>
          <div id="tw" ref={twRef}>
            <div id="card" ref={cardRef}>
              <h2 id="t">{mode === "signup" ? "Start tracking." : "Welcome back."}</h2>
              <p className="sub" id="st">
                {mode === "signup" ? "Create your account, then pair your patch." : "Your patch kept sampling while you were away."}
              </p>
              <form id="form" noValidate onSubmit={handleSubmit}>
                <div className="f" id="fn" hidden={mode !== "signup"}>
                  <label htmlFor="name">Full name</label>
                  <div className="in">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8BFC1" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                    <input
                      id="name"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="f">
                  <label htmlFor="email">Email</label>
                  <div className="in">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8BFC1" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="f">
                  <label htmlFor="pw">Password</label>
                  <div className="in">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8BFC1" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="eye"
                      id="eye"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8BFC1" strokeWidth="2">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p id="err" role="alert">
                  {errorMsg}
                </p>

                <button className={`cta ${busy ? "load" : ""}`} id="go" type="submit" disabled={busy}>
                  {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>

              <p className="sw" id="sw">
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => goTo("signin")}>
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <button type="button" onClick={() => goTo("signup")}>
                      Create an account
                    </button>
                  </>
                )}
              </p>

              <div className="lock">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Your health data is encrypted
              </div>
            </div>
          </div>
        </section>

        {/* DONE Panel (Syncing Animation) */}
        <section className="panel" id="done">
          <div>
            <h2 id="dh">You’re in, {displayUserName}.</h2>
            <p>Your patch is synced. Opening your dashboard.</p>
            <div className="bar">
              <i />
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (onOpenDashboard) onOpenDashboard();
                else goTo("home");
              }}
            >
              Continue
            </button>
          </div>
        </section>

        {/* HOME Panel (The merged experience with 3D telemetry and box) */}
        <section className="panel" id="home">
          <div className="hw">
            <div className="ht">
              <div className="hl">
                <span className="hb">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l9-8 9 8" />
                    <path d="M5 10v10h14V10" />
                  </svg>
                </span>
                <div>
                  <small>Patient portal</small>
                  <b>Home</b>
                </div>
              </div>
              <div className="hr">
                <span className="ib">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="4.5" r="1.8" />
                    <path d="M5 8l7 1.5L19 8M12 9.5V14l-3 6M12 14l3 6" />
                  </svg>
                </span>
                <span className="ib">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
                    <path d="M10 21h4" />
                  </svg>
                  <i />
                </span>
                <button
                  type="button"
                  className="av"
                  id="av"
                  onClick={() => {
                    signOut();
                    goTo("welcome");
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  {displayUserName.slice(0, 2).toUpperCase()}
                </button>
              </div>
            </div>

            <div className="hc">
              <div className="hcol">
                <div className="bd">
                  <span className="tp">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                    </svg>
                    Micro-needle Telemetry Active
                  </span>
                  <span className="dt" id="dt">
                    {dateFormatted}
                  </span>
                </div>
                <h2 id="gr">{`${greeting}, ${displayUserName}`}</h2>
                <p className="ov">
                  Here’s your health overview for today. Real-time interstitial hormone sensing is active and recording baseline biomarkers.
                </p>
                <span className="pp">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
                    <circle cx="12" cy="19" r=".6" />
                  </svg>
                  Patch disconnected
                </span>
                <h1 className="hh1">Feel more in tune with your body.</h1>
                <p className="hp">
                  ISF Tracker brings your hormone signals, care team and long-term insights into one calm, clear space.
                </p>
                <div className="bt">
                  <button
                    type="button"
                    className="b1"
                    onClick={() => {
                      if (onOpenDashboard) onOpenDashboard();
                      else showToast("Opening your patient dashboard...");
                    }}
                  >
                    Open dashboard{" "}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M8 7h9v9" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="b1 b2"
                    onClick={() => {
                      if (onOpenDashboard) onOpenDashboard();
                      else showToast("Explore care spaces: connect with accredited specialists.");
                    }}
                  >
                    Explore care spaces{" "}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
                <div className="vt">
                  <div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Consent first
                  </div>
                  <div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12h4l3-8 4 16 3-8h4" />
                    </svg>
                    Clarity
                  </div>
                  <div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.2-4.6A8 8 0 1 1 21 12z" />
                    </svg>
                    Care connected
                  </div>
                </div>
              </div>

              {/* Right Side Card with 3D Hormone Box */}
              <div className="bw">
                <div className="orb" />
                <div className="bx">
                  <div className="bh">
                    <span className="bm">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12h4l3-8 4 16 3-8h4" />
                      </svg>
                    </span>
                    <span className="bp">ISF Tracker</span>
                  </div>
                  <div className="vb">
                    <div className="vh">
                      <span>
                        <i />
                        3D Hormone Structures
                      </span>
                      <span>Interactive</span>
                    </div>
                    <div id="vz" ref={vzRef} />
                    <div className="vc">
                      <span>
                        <b>Androgen</b>Testosterone
                      </span>
                      <span>
                        <b>Progesterone</b>P4
                      </span>
                    </div>
                  </div>
                  <p className="bk">A better way to listen</p>
                  <p className="bq">Your care, in a clearer rhythm.</p>
                  <div className="bf">
                    <div>
                      <small>Private by design</small>
                      <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                        Your data stays yours
                      </span>
                    </div>
                    <div className="sg">ISF</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div id="wipe" ref={wipeRef} />
      <div id="toast" className={toastMsg ? "on" : ""} role="status">
        {toastMsg}
      </div>
    </div>
  );
}
