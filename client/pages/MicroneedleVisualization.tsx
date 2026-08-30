import React from "react";

export default function MicroneedleVisualization() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold mb-4">ISF Tracker Patch Concept</h1>
        <p className="text-slate-400 mb-8 max-w-2xl">
          This is a conceptual product visualization. These designs represent the intended 
          form factor for continuous hormone monitoring. This product is currently in development 
          and has not been clinically validated.
        </p>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-square rounded-full border-4 border-slate-700 bg-slate-800 p-8 flex items-center justify-center">
            {/* Annular peripheral adhesive ring (Medical-grade acrylic PSA) */}
            <div className="absolute inset-0 rounded-full border-[24px] border-amber-900/40" title="Annular peripheral adhesive ring (Medical-grade acrylic PSA)" />
            
            {/* No-adhesive zone */}
            <div className="absolute inset-10 rounded-full bg-slate-800" title="No-adhesive zone" />

            {/* Backing layer & PET + PU hybrid construction */}
            <div className="absolute inset-4 rounded-full border border-slate-600/50 border-dashed pointer-events-none" title="Backing layer (PET + PU hybrid construction)" />

            {/* Microneedle array & inlets */}
            <div className="relative z-10 w-32 h-32 grid grid-cols-5 gap-2" title="Microneedle array & Microfluidic inlets">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="bg-teal-500/80 rounded-full flex items-center justify-center relative group">
                  <div className="w-1.5 h-1.5 bg-white rounded-full opacity-50 group-hover:opacity-100 transition-opacity" title="Microneedle tip" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Key Components</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">1</span>
                <div>
                  <h3 className="font-medium">Microneedle Array & Tips</h3>
                  <p className="text-sm text-slate-400">High-density array designed to comfortably penetrate the stratum corneum to access interstitial fluid.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-900/40 text-amber-500 flex items-center justify-center shrink-0">2</span>
                <div>
                  <h3 className="font-medium">Annular Peripheral Adhesive Ring</h3>
                  <p className="text-sm text-slate-400">Medical-grade acrylic PSA applied only to the perimeter to ensure secure attachment.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">3</span>
                <div>
                  <h3 className="font-medium">No-Adhesive Zone</h3>
                  <p className="text-sm text-slate-400">Central area kept completely free of adhesive to prevent interference with microfluidic inlets.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 text-slate-400 flex items-center justify-center shrink-0">4</span>
                <div>
                  <h3 className="font-medium">Backing Layer</h3>
                  <p className="text-sm text-slate-400">PET + PU hybrid construction providing flexibility and protection for the internal sensors.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
