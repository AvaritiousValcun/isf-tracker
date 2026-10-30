import React, { useEffect, useRef } from "react";
import { Activity, ShieldCheck, Zap, Sparkles, Cpu } from "lucide-react";

interface AnalyteParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  radius: number;
  color: string;
  label: string;
  opacity: number;
}

export default function ISFBiosensor3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    // Generate analyte particles representing interstitial fluid hormone molecules
    const particles: AnalyteParticle[] = [];
    const hormones = [
      { name: "E2", color: "#38BDF8" },   // Estradiol (Sky blue)
      { name: "P4", color: "#F59E0B" },   // Progesterone (Gold/Amber)
      { name: "LH", color: "#A855F7" },   // Luteinizing Hormone (Purple)
      { name: "FSH", color: "#10B981" },  // FSH (Emerald)
      { name: "CRT", color: "#FB7185" },  // Cortisol (Rose)
    ];

    for (let i = 0; i < 60; i++) {
      const h = hormones[i % hormones.length];
      particles.push({
        x: (Math.random() - 0.5) * 400,
        y: Math.random() * 280 - 140,
        z: (Math.random() - 0.5) * 350,
        speed: 0.3 + Math.random() * 0.5,
        radius: 2 + Math.random() * 3,
        color: h.color,
        label: h.name,
        opacity: 0.3 + Math.random() * 0.6,
      });
    }

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 400;

      ctx.clearRect(0, 0, width, height);
      angle += 0.007;

      const cosA = Math.cos(angle * 0.7);
      const sinA = Math.sin(angle * 0.7);
      const tiltX = 0.35;
      const cosT = Math.cos(tiltX);
      const sinT = Math.sin(tiltX);

      const project3D = (x: number, y: number, z: number) => {
        // Rotate around Y
        const rx = x * cosA - z * sinA;
        const rz1 = z * cosA + x * sinA;
        // Tilt around X
        const ry = y * cosT - rz1 * sinT;
        const rz = rz1 * cosT + y * sinT;

        const scale = fov / (fov + rz + 200);
        return {
          px: centerX + rx * scale,
          py: centerY + ry * scale,
          scale,
          z: rz,
        };
      };

      // 1. Draw 3D Subcutaneous Dermal Grid (Interstitial Fluid Matrix)
      ctx.save();
      ctx.strokeStyle = "rgba(44, 76, 92, 0.12)";
      ctx.lineWidth = 1;

      const gridSize = 160;
      const gridStep = 40;
      const gridY = 50;

      for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
        const p1 = project3D(gx, gridY, -gridSize);
        const p2 = project3D(gx, gridY, gridSize);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
        const p1 = project3D(-gridSize, gridY, gz);
        const p2 = project3D(gridSize, gridY, gz);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Draw 3D Micro-Needle Sensor Patch (Array of 4 sensing cones)
      const needles = [
        { x: -50, z: -50 },
        { x: 50, z: -50 },
        { x: -50, z: 50 },
        { x: 50, z: 50 },
        { x: 0, z: 0 },
      ];

      // Top patch base plate
      const patchY = -40;
      const patchCorners = [
        project3D(-80, patchY, -80),
        project3D(80, patchY, -80),
        project3D(80, patchY, 80),
        project3D(-80, patchY, 80),
      ];

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(patchCorners[0].px, patchCorners[0].py);
      ctx.lineTo(patchCorners[1].px, patchCorners[1].py);
      ctx.lineTo(patchCorners[2].px, patchCorners[2].py);
      ctx.lineTo(patchCorners[3].px, patchCorners[3].py);
      ctx.closePath();
      const patchGrad = ctx.createLinearGradient(
        patchCorners[0].px,
        patchCorners[0].py,
        patchCorners[2].px,
        patchCorners[2].py
      );
      patchGrad.addColorStop(0, "rgba(44, 76, 92, 0.4)");
      patchGrad.addColorStop(0.5, "rgba(91, 141, 239, 0.3)");
      patchGrad.addColorStop(1, "rgba(44, 76, 92, 0.5)");
      ctx.fillStyle = patchGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(44, 76, 92, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Micro-needles penetrating downward to dermal depth (650µm)
      needles.forEach((n) => {
        const base = project3D(n.x, patchY, n.z);
        const tip = project3D(n.x, 48, n.z);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(base.px, base.py);
        ctx.lineTo(tip.px, tip.py);
        ctx.strokeStyle = "rgba(44, 76, 92, 0.85)";
        ctx.lineWidth = 2.5 * base.scale;
        ctx.lineCap = "round";
        ctx.stroke();

        // Glowing sensing electrode tip
        const pulse = 0.5 + 0.5 * Math.sin(angle * 4 + n.x);
        ctx.beginPath();
        ctx.arc(tip.px, tip.py, 4 * tip.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(243, 227, 8, ${0.7 + 0.3 * pulse})`;
        ctx.shadowColor = "#F3E308";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      });

      // 3. Render 3D Interstitial Fluid Analyte Molecules drifting past needles
      const sortedParticles = [...particles].map((p) => {
        p.x += Math.sin(angle * 2 + p.y * 0.05) * 0.4;
        p.y -= p.speed;
        if (p.y < -130) p.y = 130;
        const proj = project3D(p.x, p.y, p.z);
        return { ...p, ...proj };
      });

      sortedParticles.sort((a, b) => a.z - b.z);

      sortedParticles.forEach((p) => {
        const r = p.radius * p.scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.px, p.py, Math.max(1, r), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * Math.max(0.2, p.scale);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();

        // Molecule label
        if (p.scale > 0.8) {
          ctx.font = "bold 8px sans-serif";
          ctx.fillStyle = "rgba(44, 76, 92, 0.85)";
          ctx.fillText(p.label, p.px + 4, p.py + 3);
        }
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-[#2C4C5C]/10 via-[#F0F4F6] to-[#E3EBEF] p-8 shadow-sm">
      {/* 3D Canvas Visual */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={440}
          height={320}
          className="w-full max-w-[440px] select-none"
        />

        {/* Floating Science Pills */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#2C4C5C] shadow-xs backdrop-blur-xs">
          <Activity size={13} className="text-[#2C4C5C]" />
          <span>ISF Micro-needle Telemetry</span>
        </div>

        <div className="absolute bottom-3 right-2 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-teal-700 shadow-xs backdrop-blur-xs">
          <span className="h-2 w-2 animate-ping rounded-full bg-teal-500" />
          <span>Continuous Dermal Flux</span>
        </div>
      </div>

      {/* Science Highlights */}
      <div className="mt-4 grid w-full grid-cols-3 gap-2.5 text-center">
        <div className="rounded-2xl border border-white/60 bg-white/60 p-2.5 backdrop-blur-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Depth</div>
          <div className="text-[13px] font-bold text-[#2C4C5C]">650 µm</div>
          <div className="text-[9px] text-slate-400">Minimally invasive</div>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/60 p-2.5 backdrop-blur-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Analytes</div>
          <div className="text-[13px] font-bold text-[#2C4C5C]">E2 · P4 · CRT</div>
          <div className="text-[9px] text-slate-400">Multi-hormone</div>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/60 p-2.5 backdrop-blur-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Latency</div>
          <div className="text-[13px] font-bold text-teal-700">&lt; 15 min</div>
          <div className="text-[9px] text-slate-400">Rapid ISF exchange</div>
        </div>
      </div>
    </div>
  );
}
