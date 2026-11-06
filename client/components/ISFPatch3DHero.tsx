import React, { useEffect, useRef } from "react";

interface ISFPatch3DHeroProps {
  variant?: "welcome" | "hero" | "compact";
  title?: string;
  subtitle?: string;
}

export default function ISFPatch3DHero({
  variant = "hero",
}: ISFPatch3DHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mouse tilt tracking
  const targetTilt = useRef({ x: 0, y: 0 });
  const currentTilt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Ambient floating particles (hormone analytes matching chart colors)
    // 0: Progesterone (Greenish-Blue / Teal #0EA5A4)
    // 1: Free Testosterone (Orange / Gold #F59E0B)
    // 2: Trend / ISF Kinetic (Purple #7C3AED)
    const particles = Array.from({ length: 36 }).map((_, i) => ({
      angle: (i / 36) * Math.PI * 2,
      dist: 110 + Math.random() * 80,
      yOffset: (Math.random() - 0.5) * 60,
      speed: 0.008 + Math.random() * 0.012,
      size: 2.5 + Math.random() * 3.5,
      color: i % 3 === 0 ? "#0EA5A4" : i % 3 === 1 ? "#F59E0B" : "#7C3AED",
      label: i % 3 === 0 ? "P4" : i % 3 === 1 ? "FT" : "ISF",
    }));

    const render = () => {
      time += 0.018;

      // Smooth mouse lerp
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * 0.06;
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * 0.06;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2 + Math.sin(time * 1.5) * 8; // Gentle floating levitation

      ctx.clearRect(0, 0, width, height);

      // Base tilt angles
      const rotX = 0.45 + currentTilt.current.y * 0.45;
      const rotY = time * 0.4 + currentTilt.current.x * 0.7;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // 3D projection helper
      const project = (x: number, y: number, z: number) => {
        // Y-axis rotation
        const rx = x * cosY - z * sinY;
        const rz1 = z * cosY + x * sinY;
        // X-axis tilt
        const ry = y * cosX - rz1 * sinX;
        const rz = rz1 * cosX + y * sinX;

        const fov = 420;
        const scale = fov / (fov + rz + 180);
        return {
          px: cx + rx * scale,
          py: cy + ry * scale,
          scale,
          z: rz,
        };
      };

      // 1. Soft 3D Drop Shadow on Ground
      const shadowY = cy + 110;
      const shadowScale = 1 - Math.sin(time * 1.5) * 0.08;
      const shadowGrad = ctx.createRadialGradient(cx, shadowY, 10, cx, shadowY, 130 * shadowScale);
      shadowGrad.addColorStop(0, "rgba(44, 76, 92, 0.28)");
      shadowGrad.addColorStop(0.5, "rgba(44, 76, 92, 0.1)");
      shadowGrad.addColorStop(1, "rgba(44, 76, 92, 0)");

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, shadowY, 130 * shadowScale, 36 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrad;
      ctx.fill();
      ctx.restore();

      // 2. Background Orbiting Hormone Particles (Back half)
      particles.forEach((p) => {
        p.angle += p.speed;
        const px = Math.cos(p.angle) * p.dist;
        const pz = Math.sin(p.angle) * p.dist;
        const py = p.yOffset + Math.sin(time * 2 + p.dist) * 15;

        const proj = project(px, py, pz);
        if (proj.z < 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.45 * proj.scale;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      });

      // 3. 3D Biosensor Patch Body (Cylinder / Beveled Disc)
      const layers = 16;
      const discRadius = 88;
      const thickness = 18;

      for (let l = layers; l >= 0; l--) {
        const layerY = (l / layers) * thickness - thickness / 2;
        const isTop = l === 0;
        const isBottom = l === layers;

        // Draw 3D circular perimeter points
        const segments = 36;
        const ringPoints = [];
        for (let s = 0; s < segments; s++) {
          const theta = (s / segments) * Math.PI * 2;
          const r = isBottom ? discRadius * 0.94 : discRadius;
          ringPoints.push(project(Math.cos(theta) * r, layerY, Math.sin(theta) * r));
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ringPoints[0].px, ringPoints[0].py);
        for (let s = 1; s < segments; s++) {
          ctx.lineTo(ringPoints[s].px, ringPoints[s].py);
        }
        ctx.closePath();

        if (isTop) {
          // Top Face: Premium Satin White / Clean Ceramic
          const topGrad = ctx.createLinearGradient(
            ringPoints[0].px,
            ringPoints[0].py,
            ringPoints[segments / 2].px,
            ringPoints[segments / 2].py
          );
          topGrad.addColorStop(0, "#FFFFFF");
          topGrad.addColorStop(0.35, "#F8FAFC");
          topGrad.addColorStop(0.8, "#EFF4F7");
          topGrad.addColorStop(1, "#E2E8F0");
          ctx.fillStyle = topGrad;
          ctx.fill();

          ctx.strokeStyle = "rgba(203, 213, 225, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Disc Sides / Rim: Whitish / Satin Pearl Rim
          const shade = Math.floor(212 + (l / layers) * 33);
          ctx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 5}, 0.95)`;
          ctx.fill();
          ctx.strokeStyle = "rgba(180, 195, 205, 0.4)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 4. Glowing Annular LED Ring on Top of the Patch (Chart Greenish-Blue / Teal)
      const ledPoints = [];
      const ledRadius = 72;
      for (let s = 0; s < 36; s++) {
        const theta = (s / 36) * Math.PI * 2;
        ledPoints.push(project(Math.cos(theta) * ledRadius, -thickness / 2 - 0.5, Math.sin(theta) * ledRadius));
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ledPoints[0].px, ledPoints[0].py);
      for (let s = 1; s < 36; s++) {
        ctx.lineTo(ledPoints[s].px, ledPoints[s].py);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(14, 165, 164, 0.9)"; // Greenish-blue / Teal
      ctx.lineWidth = 3.2;
      ctx.shadowColor = "#0EA5A4";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // 5. Central Sensing Micro-needle Module (Whitish Core with Chart Gold & Purple Accents)
      const coreCenter = project(0, -thickness / 2 - 1, 0);
      const innerRadius = 38;
      const innerPoints = [];
      for (let s = 0; s < 24; s++) {
        const theta = (s / 24) * Math.PI * 2;
        innerPoints.push(project(Math.cos(theta) * innerRadius, -thickness / 2 - 1, Math.sin(theta) * innerRadius));
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(innerPoints[0].px, innerPoints[0].py);
      for (let s = 1; s < 24; s++) {
        ctx.lineTo(innerPoints[s].px, innerPoints[s].py);
      }
      ctx.closePath();
      const coreGrad = ctx.createRadialGradient(
        coreCenter.px,
        coreCenter.py,
        2,
        coreCenter.px,
        coreCenter.py,
        innerRadius * coreCenter.scale
      );
      coreGrad.addColorStop(0, "#FFFFFF");
      coreGrad.addColorStop(0.65, "#F1F5F9");
      coreGrad.addColorStop(1, "#E2E8F0");
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(245, 158, 11, 0.85)"; // Orange/Gold chart accent ring
      ctx.lineWidth = 2;
      ctx.shadowColor = "#F59E0B";
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Pulsing Center Biosensor Dot (Orange/Gold)
      const pulse = Math.sin(time * 3) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(coreCenter.px, coreCenter.py, 6.5 * coreCenter.scale * pulse, 0, Math.PI * 2);
      ctx.fillStyle = "#F59E0B";
      ctx.shadowColor = "#F59E0B";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();

      // Micro-needle array indicators on the patch surface (Matching Chart Trio)
      const pinpoints = [
        { x: -16, z: -16, color: "#0EA5A4" }, // Greenish-blue / Teal
        { x: 16, z: -16, color: "#F59E0B" },  // Orange / Gold
        { x: -16, z: 16, color: "#7C3AED" },  // Purple
        { x: 16, z: 16, color: "#F59E0B" },   // Orange / Gold
      ];
      pinpoints.forEach((pin) => {
        const p = project(pin.x, -thickness / 2 - 1.2, pin.z);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.px, p.py, 2.8 * p.scale, 0, Math.PI * 2);
        ctx.fillStyle = pin.color;
        ctx.shadowColor = pin.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      // 6. Foreground Orbiting Hormone Particles (Front half)
      particles.forEach((p) => {
        const px = Math.cos(p.angle) * p.dist;
        const pz = Math.sin(p.angle) * p.dist;
        const py = p.yOffset + Math.sin(time * 2 + p.dist) * 15;

        const proj = project(px, py, pz);
        if (proj.z >= 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, 0.75 * proj.scale);
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.fill();

          // Particle tag matching hormone analyte color
          if (proj.scale > 0.85) {
            ctx.font = "bold 9.5px sans-serif";
            ctx.fillStyle = p.color;
            ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
            ctx.shadowBlur = 4;
            ctx.fillText(p.label, proj.px + 5, proj.py + 3);
          }
          ctx.restore();
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, []);

  // Parallax mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetTilt.current = { x: x * 1.8, y: y * 1.8 };
  };

  const handleMouseLeave = () => {
    targetTilt.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center select-none"
    >
      <canvas
        ref={canvasRef}
        width={380}
        height={320}
        className="w-full max-w-[380px] drop-shadow-xl"
      />
    </div>
  );
}
