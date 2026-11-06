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

    // Ambient floating particles (hormone analytes matching 3D hormone elements)
    // Sourced directly from Three.js hormone atom materials (Carbon #9333EA, Oxygen #FB923C, Hydrogen #2DD4BF)
    const HORMONE_SPECIES = [
      {
        name: "Carbon / Progesterone",
        label: "P4",
        color: "#9333EA",
        highlight: "#F5D0FE",
        dark: "#3B0764",
        glow: "rgba(147, 51, 234, 0.85)",
        shadowColor: "#9333EA",
      },
      {
        name: "Oxygen / Androgen",
        label: "FT",
        color: "#FB923C",
        highlight: "#FFEDD5",
        dark: "#9A3412",
        glow: "rgba(251, 146, 60, 0.85)",
        shadowColor: "#FB923C",
      },
      {
        name: "Hydrogen / ISF Telemetry",
        label: "ISF",
        color: "#2DD4BF",
        highlight: "#CCFBF1",
        dark: "#115E59",
        glow: "rgba(45, 212, 191, 0.85)",
        shadowColor: "#2DD4BF",
      },
    ];

    const particles = Array.from({ length: 38 }).map((_, i) => {
      const species = HORMONE_SPECIES[i % 3];
      return {
        angle: (i / 38) * Math.PI * 2,
        dist: 108 + Math.random() * 85,
        yOffset: (Math.random() - 0.5) * 65,
        speed: 0.007 + Math.random() * 0.012,
        size: 3.4 + Math.random() * 3.4,
        ...species,
      };
    });

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

      // Render 3D shaded hormone atom particle with specular glint, saturated core, and emissive glow
      const drawHormoneDot = (
        p: (typeof particles)[0],
        projX: number,
        projY: number,
        scale: number,
        isForeground: boolean
      ) => {
        const r = Math.max(2.2, p.size * scale);
        ctx.save();

        // 1. Emissive glow halo matching 3D hormone atom radiance
        ctx.shadowColor = p.shadowColor;
        ctx.shadowBlur = isForeground ? Math.round(18 * scale) : Math.round(10 * scale);
        ctx.globalAlpha = isForeground ? 1.0 : Math.min(0.85, 0.65 + 0.25 * scale);

        // 2. Soft outer radial radiance (eliminates washed-out look)
        const haloGrad = ctx.createRadialGradient(projX, projY, r * 0.3, projX, projY, r * 2.2);
        haloGrad.addColorStop(0, p.glow);
        haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.beginPath();
        ctx.arc(projX, projY, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        // 3. Volumetric 3D Shaded Sphere (specular glint + vibrant hormone atom color + rim shadow)
        const sphereGrad = ctx.createRadialGradient(
          projX - r * 0.35,
          projY - r * 0.35,
          r * 0.08,
          projX,
          projY,
          r
        );
        sphereGrad.addColorStop(0, "#FFFFFF");          // 3D Specular reflection glint
        sphereGrad.addColorStop(0.25, p.highlight);     // Tinted specular highlight
        sphereGrad.addColorStop(0.68, p.color);         // Saturated 3D hormone color
        sphereGrad.addColorStop(1.0, p.dark);           // Three.js-style rim shadow

        ctx.beginPath();
        ctx.arc(projX, projY, r, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        // 4. Foreground Analyte Label (crisp, high-contrast)
        if (isForeground && scale > 0.82) {
          ctx.font = "bold 9.5px sans-serif";
          ctx.fillStyle = p.highlight;
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 4;
          ctx.fillText(p.label, projX + r + 3, projY + 3.5);
        }

        ctx.restore();
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
          drawHormoneDot(p, proj.px, proj.py, proj.scale, false);
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
      ctx.strokeStyle = "rgba(45, 212, 191, 0.95)"; // Luminous Teal / Hydrogen
      ctx.lineWidth = 3.2;
      ctx.shadowColor = "#2DD4BF";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      // 5. Central Sensing Micro-needle Module (Whitish Core with 3D Hormone Accents)
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
      ctx.strokeStyle = "rgba(251, 146, 60, 0.9)"; // Oxygen / Amber accent ring
      ctx.lineWidth = 2;
      ctx.shadowColor = "#FB923C";
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Pulsing Center Biosensor Dot (Oxygen / Amber)
      const pulse = Math.sin(time * 3) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(coreCenter.px, coreCenter.py, 6.5 * coreCenter.scale * pulse, 0, Math.PI * 2);
      ctx.fillStyle = "#FB923C";
      ctx.shadowColor = "#FB923C";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();

      // Micro-needle array indicators on the patch surface (Matching 3D Hormone Atoms)
      const pinpoints = [
        { x: -16, z: -16, color: "#2DD4BF" }, // Luminous Teal / Hydrogen
        { x: 16, z: -16, color: "#FB923C" },  // Vibrant Orange / Oxygen
        { x: -16, z: 16, color: "#9333EA" },  // Deep Purple / Carbon
        { x: 16, z: 16, color: "#FB923C" },   // Vibrant Orange / Oxygen
      ];
      pinpoints.forEach((pin) => {
        const p = project(pin.x, -thickness / 2 - 1.2, pin.z);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.px, p.py, 3.2 * p.scale, 0, Math.PI * 2);
        ctx.fillStyle = pin.color;
        ctx.shadowColor = pin.color;
        ctx.shadowBlur = 10;
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
          drawHormoneDot(p, proj.px, proj.py, proj.scale, true);
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
