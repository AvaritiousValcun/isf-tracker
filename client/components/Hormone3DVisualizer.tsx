import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Eye, RotateCw, Play, Pause, Layers } from "lucide-react";

type HormoneType = "estradiol" | "progesterone" | "cortisol";

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
  formula: string;
  mw: string;
  targetRange: string;
  phase: string;
  description: string;
  atoms: Atom[];
  bonds: Bond[];
}

const HORMONE_DATA: Record<HormoneType, HormoneConfig> = {
  estradiol: {
    name: "17β-Estradiol (E2)",
    formula: "C₁₈H₂₄O₂",
    mw: "272.38 g/mol",
    targetRange: "30 – 400 pg/mL",
    phase: "Follicular & Pre-Ovulatory Peak",
    description: "Primary biological estrogen regulating follicular growth and endometrial proliferation in ISF.",
    atoms: [
      // Ring A (Aromatic)
      { x: -110, y: -25, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -145, y: 15, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -120, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -70, y: 60, z: -8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -65, y: -25, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring B
      { x: -35, y: 65, z: 20, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 15, y: 65, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 10, y: -25, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring C
      { x: 15, y: -70, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 65, y: -70, z: 15, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 90, y: -25, z: 5, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 60, y: 20, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring D (5-carbon)
      { x: 105, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 145, y: 35, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 135, y: -20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      // Functional groups
      { x: -160, y: 95, z: 0, element: "O", color: "#E06D53", radius: 11 },   // 3-OH Oxygen
      { x: -185, y: 115, z: 6, element: "H", color: "#94A3B8", radius: 6 },  // 3-OH Hydrogen
      { x: 175, y: -45, z: 12, element: "O", color: "#E06D53", radius: 11 },  // 17-OH Oxygen
      { x: 200, y: -45, z: 20, element: "H", color: "#94A3B8", radius: 6 },  // 17-OH Hydrogen
      { x: 90, y: -30, z: 50, element: "C", color: "#2C4C5C", radius: 8 },   // C18 methyl
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 2 },
      { a: 3, b: 4, order: 1 }, { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
      { a: 4, b: 6, order: 1 }, { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 },
      { a: 8, b: 9, order: 1 }, { a: 9, b: 5, order: 1 },
      { a: 9, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 11, b: 12, order: 1 },
      { a: 12, b: 13, order: 1 }, { a: 13, b: 8, order: 1 },
      { a: 13, b: 14, order: 1 }, { a: 14, b: 15, order: 1 }, { a: 15, b: 16, order: 1 },
      { a: 16, b: 12, order: 1 },
      { a: 2, b: 17, order: 1 }, { a: 17, b: 18, order: 1 },
      { a: 16, b: 19, order: 1 }, { a: 19, b: 20, order: 1 },
      { a: 12, b: 21, order: 1 },
    ],
  },
  progesterone: {
    name: "Progesterone (P4)",
    formula: "C₂₁H₃₀O₂",
    mw: "314.46 g/mol",
    targetRange: "5 – 60 nmol/L",
    phase: "Luteal Phase & Implantation Window",
    description: "Pregnane steroid critical for secretory endometrium; spikes 48h post-ovulation.",
    atoms: [
      // Ring A
      { x: -110, y: -25, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -145, y: 15, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -120, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -70, y: 60, z: -8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -65, y: -25, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring B
      { x: -35, y: 65, z: 20, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 15, y: 65, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 10, y: -25, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring C
      { x: 15, y: -70, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 65, y: -70, z: 15, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 90, y: -25, z: 5, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 60, y: 20, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring D
      { x: 105, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 145, y: 35, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 135, y: -20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      // Functional groups
      { x: -155, y: 95, z: 0, element: "O", color: "#F59E0B", radius: 11 },   // 3-Keto =O
      { x: 175, y: -45, z: 12, element: "C", color: "#2C4C5C", radius: 9 },   // C20
      { x: 195, y: -25, z: 25, element: "O", color: "#F59E0B", radius: 11 },  // 20-Keto =O
      { x: 195, y: -80, z: 5, element: "C", color: "#2C4C5C", radius: 8 },    // C21 methyl
      { x: -65, y: -30, z: 48, element: "C", color: "#2C4C5C", radius: 8 },   // C19 methyl
      { x: 90, y: -30, z: 48, element: "C", color: "#2C4C5C", radius: 8 },    // C18 methyl
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
  cortisol: {
    name: "Cortisol (Hydrocortisone)",
    formula: "C₂₁H₃₀O₅",
    mw: "362.46 g/mol",
    targetRange: "6 – 23 µg/dL",
    phase: "Circadian Rhythm Baseline",
    description: "Glucocorticoid tracking systemic physiological stress, adrenal balance, and metabolic dynamics in ISF.",
    atoms: [
      // Ring A
      { x: -110, y: -25, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -145, y: 15, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -120, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -70, y: 60, z: -8, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: -65, y: -25, z: 8, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring B
      { x: -35, y: 65, z: 20, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 15, y: 65, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 40, y: 20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 10, y: -25, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring C
      { x: 15, y: -70, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 65, y: -70, z: 15, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 90, y: -25, z: 5, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 60, y: 20, z: -10, element: "C", color: "#2C4C5C", radius: 9 },
      // Ring D
      { x: 105, y: 60, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 145, y: 35, z: 12, element: "C", color: "#2C4C5C", radius: 9 },
      { x: 135, y: -20, z: 0, element: "C", color: "#2C4C5C", radius: 9 },
      // Functional groups
      { x: -155, y: 95, z: 0, element: "O", color: "#F59E0B", radius: 11 },   // 3-Keto =O
      { x: 25, y: -100, z: -10, element: "O", color: "#10B981", radius: 11 }, // 11β-OH
      { x: 140, y: 15, z: -35, element: "O", color: "#10B981", radius: 11 },  // 17α-OH
      { x: 175, y: -45, z: 12, element: "C", color: "#2C4C5C", radius: 9 },   // C20
      { x: 195, y: -25, z: 25, element: "O", color: "#F59E0B", radius: 11 },  // 20-Keto =O
      { x: 205, y: -80, z: 5, element: "C", color: "#2C4C5C", radius: 8 },    // C21
      { x: 240, y: -90, z: 15, element: "O", color: "#10B981", radius: 11 },  // 21-OH
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
      { a: 10, b: 18, order: 1 },
      { a: 16, b: 19, order: 1 },
      { a: 16, b: 20, order: 1 }, { a: 20, b: 21, order: 2 }, { a: 20, b: 22, order: 1 },
      { a: 22, b: 23, order: 1 },
    ],
  },
};

interface FluidParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  radius: number;
  color: string;
  alpha: number;
}

export default function Hormone3DVisualizer({ compact = false }: { compact?: boolean }) {
  const [hormone, setHormone] = useState<HormoneType>("estradiol");
  const [isRotating, setIsRotating] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rotation angles in radians
  const anglesRef = useRef({ x: 0.3, y: 0.8, z: 0.1 });
  const mouseRef = useRef({ isDown: false, lastX: 0, lastY: 0 });

  // Floating ISF fluid particles
  const particlesRef = useRef<FluidParticle[]>([]);

  useEffect(() => {
    // Generate 45 ambient fluid particles
    const particles: FluidParticle[] = [];
    const colors = ["#2C4C5C", "#7A6600", "#5B8DEF", "#10B981", "#E06D53"];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 350,
        y: (Math.random() - 0.5) * 260,
        z: (Math.random() - 0.5) * 300,
        speed: 0.2 + Math.random() * 0.4,
        radius: 1.5 + Math.random() * 2.5,
        color: colors[i % colors.length],
        alpha: 0.25 + Math.random() * 0.45,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 450;

      // Clear with elegant subtle radial background
      ctx.clearRect(0, 0, width, height);

      // Auto rotation
      if (isRotating && !mouseRef.current.isDown) {
        anglesRef.current.y += 0.008;
        anglesRef.current.x += 0.003;
      }

      const cosX = Math.cos(anglesRef.current.x);
      const sinX = Math.sin(anglesRef.current.x);
      const cosY = Math.cos(anglesRef.current.y);
      const sinY = Math.sin(anglesRef.current.y);
      const cosZ = Math.cos(anglesRef.current.z);
      const sinZ = Math.sin(anglesRef.current.z);

      // Helper: 3D vector rotation
      const rotate3D = (x: number, y: number, z: number) => {
        // Rotate around Y
        let x1 = x * cosY - z * sinY;
        let z1 = z * cosY + x * sinY;
        // Rotate around X
        let y2 = y * cosX - z1 * sinX;
        let z2 = z1 * cosX + y * sinX;
        // Rotate around Z
        let x3 = x1 * cosZ - y2 * sinZ;
        let y3 = y2 * cosZ + x1 * sinZ;
        return { x: x3, y: y3, z: z2 };
      };

      // 1. Render Floating ISF Fluid Particles in background
      particlesRef.current.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -150) p.y = 150;

        const rotated = rotate3D(p.x, p.y, p.z);
        const scale = fov / (fov + rotated.z + 200);
        const px = centerX + rotated.x * scale;
        const py = centerY + rotated.y * scale;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          ctx.beginPath();
          ctx.arc(px, py, p.radius * scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * Math.max(0.1, scale);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      const currentHormone = HORMONE_DATA[hormone];

      // 2. Rotate all atoms
      const projectedAtoms = currentHormone.atoms.map((atom) => {
        const rotated = rotate3D(atom.x, atom.y, atom.z);
        const scale = fov / (fov + rotated.z + 100);
        const px = centerX + rotated.x * scale;
        const py = centerY + rotated.y * scale;
        return {
          ...atom,
          rx: rotated.x,
          ry: rotated.y,
          rz: rotated.z,
          px,
          py,
          scale,
        };
      });

      // 3. Draw Chemical Bonds with depth
      // Sort bonds by average Z
      const sortedBonds = [...currentHormone.bonds].map((b) => {
        const atomA = projectedAtoms[b.a];
        const atomB = projectedAtoms[b.b];
        const avgZ = (atomA.rz + atomB.rz) / 2;
        return { ...b, avgZ, atomA, atomB };
      });
      sortedBonds.sort((a, b) => a.avgZ - b.avgZ);

      sortedBonds.forEach((b) => {
        const { atomA, atomB, order } = b;
        const alpha = Math.min(1, Math.max(0.3, (atomA.scale + atomB.scale) / 2));

        ctx.save();
        ctx.strokeStyle = `rgba(100, 116, 139, ${alpha * 0.75})`;
        ctx.lineWidth = Math.max(1.8, 2.8 * ((atomA.scale + atomB.scale) / 2));
        ctx.lineCap = "round";

        if (order === 2) {
          // Double bond rendering
          const dx = atomB.px - atomA.px;
          const dy = atomB.py - atomA.py;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = (-dy / len) * 3;
          const ny = (dx / len) * 3;

          ctx.beginPath();
          ctx.moveTo(atomA.px + nx, atomA.py + ny);
          ctx.lineTo(atomB.px + nx, atomB.py + ny);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(atomA.px - nx, atomA.py - ny);
          ctx.lineTo(atomB.px - nx, atomB.py - ny);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(atomA.px, atomA.py);
          ctx.lineTo(atomB.px, atomB.py);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 4. Draw Atoms as 3D Shaded Spheres (sorted back to front)
      const sortedAtoms = [...projectedAtoms].sort((a, b) => a.rz - b.rz);

      sortedAtoms.forEach((atom) => {
        const r = atom.radius * atom.scale;
        const grad = ctx.createRadialGradient(
          atom.px - r * 0.35,
          atom.py - r * 0.35,
          r * 0.1,
          atom.px,
          atom.py,
          r
        );

        // Realistic lighting gradients
        if (atom.element === "C") {
          grad.addColorStop(0, "#52798e");
          grad.addColorStop(0.65, "#2C4C5C");
          grad.addColorStop(1, "#182a33");
        } else if (atom.element === "O") {
          grad.addColorStop(0, "#fca5a5");
          grad.addColorStop(0.65, atom.color);
          grad.addColorStop(1, "#991b1b");
        } else {
          grad.addColorStop(0, "#ffffff");
          grad.addColorStop(0.7, atom.color);
          grad.addColorStop(1, "#475569");
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(atom.px, atom.py, Math.max(1, r), 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = atom.color;
        ctx.shadowBlur = r * 0.6;
        ctx.fill();

        // Optional Element symbol on larger spheres
        if (r > 6 && !compact) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.font = `bold ${Math.max(8, Math.round(r * 0.85))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(atom.element, atom.px, atom.py + 0.5);
        }
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hormone, isRotating, compact]);

  // Mouse interaction handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current.isDown = true;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDown) return;
    const deltaX = e.clientX - mouseRef.current.lastX;
    const deltaY = e.clientY - mouseRef.current.lastY;
    anglesRef.current.y += deltaX * 0.01;
    anglesRef.current.x += deltaY * 0.01;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      mouseRef.current.isDown = true;
      mouseRef.current.lastX = e.touches[0].clientX;
      mouseRef.current.lastY = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!mouseRef.current.isDown || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - mouseRef.current.lastX;
    const deltaY = e.touches[0].clientY - mouseRef.current.lastY;
    anglesRef.current.y += deltaX * 0.01;
    anglesRef.current.x += deltaY * 0.01;
    mouseRef.current.lastX = e.touches[0].clientX;
    mouseRef.current.lastY = e.touches[0].clientY;
  };

  const currentData = HORMONE_DATA[hormone];

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-[#243C47] bg-gradient-to-br from-white via-slate-50 to-[#F2F7F9] dark:from-[#15232A] dark:via-[#111D23] dark:to-[#0D161A] shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${compact ? "p-4" : "p-6"}`}>
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 dark:border-[#243C47] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#2C4C5C] to-[#1E343F] text-white shadow-sm">
            <Layers size={16} />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
              3D ISF Molecular Biosensing
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">
              Interactive interstitial analyte structure & dermal flux
            </p>
          </div>
        </div>

        {/* Hormone Selector Pills */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#111D23] p-1 shadow-xs">
          {(["estradiol", "progesterone", "cortisol"] as HormoneType[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHormone(h)}
              className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                hormone === h
                  ? "bg-[#2C4C5C] dark:bg-[#F3E308] text-white dark:text-[#142229] shadow-xs"
                  : "text-slate-600 dark:text-[#A0B4BE] hover:bg-slate-100 dark:hover:bg-[#1C2F38] hover:text-[#2C4C5C] dark:hover:text-[#F3E308]"
              }`}
            >
              {h === "estradiol" ? "Estradiol (E2)" : h === "progesterone" ? "Progesterone" : "Cortisol"}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div
        className="relative my-3 flex cursor-grab items-center justify-center active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={compact ? 360 : 580}
          height={compact ? 220 : 280}
          className="w-full max-w-[580px] touch-none select-none"
        />

        {/* Live Interaction Hint */}
        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-[#111D23]/90 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:text-[#A0B4BE] backdrop-blur-xs shadow-xs">
          <Eye size={12} className="text-[#2C4C5C] dark:text-[#F3E308]" />
          <span>Drag in 3D to rotate</span>
        </div>

        {/* Auto-Rotation Toggle */}
        <button
          type="button"
          onClick={() => setIsRotating(!isRotating)}
          className="absolute bottom-2 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-[#243C47] bg-white/90 dark:bg-[#111D23]/90 text-slate-600 dark:text-[#E8F2F6] shadow-xs transition hover:bg-slate-100 dark:hover:bg-[#1C2F38]"
          title={isRotating ? "Pause rotation" : "Play rotation"}
        >
          {isRotating ? <Pause size={12} /> : <Play size={12} />}
        </button>
      </div>

      {/* Chemical & Physiological Telemetry Bar */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 dark:border-[#243C47] bg-white/80 dark:bg-[#111D23]/90 p-3 text-[11px] backdrop-blur-xs sm:grid-cols-4">
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Formula</span>
          <span className="font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{currentData.formula}</span>
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Target Band</span>
          <span className="font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{currentData.targetRange}</span>
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Mass</span>
          <span className="font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{currentData.mw}</span>
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-[#738C98]">ISF Matrix</span>
          <span className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500 dark:bg-teal-400" /> Continuous
          </span>
        </div>
      </div>
    </div>
  );
}
