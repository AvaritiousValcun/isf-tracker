import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Lock,
  Crown,
  Info,
  Calendar,
  Activity,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "./ui/badge";

interface HormoneVelocityForecastProps {
  isPremium?: boolean;
  onOpenReport?: () => void;
}

// 7-day projected forward data starting from today (Cycle Day 21)
export const FORECAST_DATA = [
  {
    dayLabel: "Today (D21)",
    dayOffset: 0,
    progesterone: 18.2,
    progesteroneUpper: 19.5,
    progesteroneLower: 17.0,
    freeTestosterone: 4.8,
    freeTestosteroneUpper: 5.4,
    freeTestosteroneLower: 4.2,
    velocityP: -0.4,
    velocityFT: +0.1,
    phase: "Mid-Luteal Peak",
  },
  {
    dayLabel: "+1 Day (D22)",
    dayOffset: 1,
    progesterone: 17.6,
    progesteroneUpper: 19.0,
    progesteroneLower: 16.2,
    freeTestosterone: 4.7,
    freeTestosteroneUpper: 5.3,
    freeTestosteroneLower: 4.1,
    velocityP: -0.6,
    velocityFT: +0.1,
    phase: "Luteal Plateau",
  },
  {
    dayLabel: "+2 Days (D23)",
    dayOffset: 2,
    progesterone: 16.5,
    progesteroneUpper: 18.2,
    progesteroneLower: 14.8,
    freeTestosterone: 4.6,
    freeTestosteroneUpper: 5.2,
    freeTestosteroneLower: 4.0,
    velocityP: -1.1,
    velocityFT: 0.0,
    phase: "Luteal Maintenance",
  },
  {
    dayLabel: "+3 Days (D24)",
    dayOffset: 3,
    progesterone: 14.8,
    progesteroneUpper: 16.6,
    progesteroneLower: 12.9,
    freeTestosterone: 4.5,
    freeTestosteroneUpper: 5.1,
    freeTestosteroneLower: 3.9,
    velocityP: -1.7,
    velocityFT: 0.0,
    phase: "Early Luteolysis",
  },
  {
    dayLabel: "+4 Days (D25)",
    dayOffset: 4,
    progesterone: 12.2,
    progesteroneUpper: 14.2,
    progesteroneLower: 10.1,
    freeTestosterone: 4.4,
    freeTestosteroneUpper: 5.0,
    freeTestosteroneLower: 3.8,
    velocityP: -2.6,
    velocityFT: -0.1,
    phase: "Active Luteolysis",
  },
  {
    dayLabel: "+5 Days (D26)",
    dayOffset: 5,
    progesterone: 8.9,
    progesteroneUpper: 11.0,
    progesteroneLower: 6.8,
    freeTestosterone: 4.3,
    freeTestosteroneUpper: 4.9,
    freeTestosteroneLower: 3.7,
    velocityP: -3.3,
    velocityFT: -0.1,
    phase: "Late Luteal Descent",
  },
  {
    dayLabel: "+6 Days (D27)",
    dayOffset: 6,
    progesterone: 5.4,
    progesteroneUpper: 7.2,
    progesteroneLower: 3.6,
    freeTestosterone: 4.2,
    freeTestosteroneUpper: 4.8,
    freeTestosteroneLower: 3.6,
    velocityP: -3.5,
    velocityFT: -0.1,
    phase: "Luteal Termination",
  },
  {
    dayLabel: "+7 Days (D28)",
    dayOffset: 7,
    progesterone: 2.3,
    progesteroneUpper: 3.8,
    progesteroneLower: 1.0,
    freeTestosterone: 4.1,
    freeTestosteroneUpper: 4.7,
    freeTestosteroneLower: 3.5,
    velocityP: -3.1,
    velocityFT: -0.1,
    phase: "Basal Follicular Reset",
  },
];

export default function HormoneVelocityForecast({
  isPremium = true,
  onOpenReport,
}: HormoneVelocityForecastProps) {
  const [tierOverride, setTierOverride] = useState<"free" | "premium">(
    isPremium ? "premium" : "free"
  );

  const showPremium = tierOverride === "premium";

  // In free mode, only display days 0-2 fully, days 3-7 are locked
  const displayData = showPremium ? FORECAST_DATA : FORECAST_DATA.slice(0, 3);

  return (
    <div className={`rounded-[24px] border p-5 sm:p-6 transition-all duration-300 space-y-6 ${
      showPremium
        ? "border-amber-300/80 dark:border-amber-500/40 bg-gradient-to-br from-[#FFFDF9] via-[#FFFBF2] to-[#FFF6E5] dark:from-[#15232A] dark:via-[#1D211B] dark:to-[#171B16] shadow-[0_14px_42px_rgba(245,158,11,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        : "border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] shadow-sm"
    }`}>
      
      {/* Header and Plan Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              <Sparkles size={12} className="text-amber-500" /> 7-Day Velocity Model
            </span>
            {showPremium ? (
              <Badge className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white hover:opacity-95 text-[10px] flex items-center gap-1 border border-amber-300/40 shadow-xs">
                <Crown size={11} className="text-yellow-200 fill-yellow-200" /> Premium Forecast
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-white/10 text-[10px]">
                Free 48h Preview
              </Badge>
            )}
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#2C4C5C] dark:text-[#E8F2F6]">
            Forward Hormone Velocity Forecast
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A0B4BE] mt-0.5">
            Predictive continuous trajectories of Progesterone and Free Testosterone heading over the next 7 days.
          </p>
        </div>

        {/* Free vs Premium Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#1C2F38] p-1 border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setTierOverride("free")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !showPremium
                  ? "bg-white dark:bg-[#15232A] text-slate-800 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-white/10"
                  : "text-slate-500 hover:text-slate-800 dark:text-[#A0B4BE]"
              }`}
            >
              Free (48h)
            </button>
            <button
              onClick={() => setTierOverride("premium")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                showPremium
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25 border border-amber-300/50"
                  : "text-slate-500 hover:text-amber-600 dark:text-[#A0B4BE]"
              }`}
            >
              <Crown size={12} className={showPremium ? "text-yellow-200 fill-yellow-200 drop-shadow-xs" : "text-amber-500"} />
              <span>Premium (7-Day)</span>
            </button>
          </div>

          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 transition"
            >
              Doctor Report PDF
            </button>
          )}
        </div>
      </div>

      {/* Velocity Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-4 transition ${
          showPremium
            ? "border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/25 dark:to-[#111D23] shadow-xs"
            : "border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23]"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Progesterone Velocity</span>
            <span className="h-2 w-2 rounded-full bg-[#0EA5A4]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0EA5A4]">&minus;1.8</span>
            <span className="text-xs text-slate-500">ng/mL/day</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#A0B4BE]">
            Secretory luteal phase; orderly decline towards follicular reset.
          </p>
        </div>

        <div className={`rounded-2xl border p-4 transition ${
          showPremium
            ? "border-purple-200/70 dark:border-purple-900/40 bg-gradient-to-b from-purple-50/40 to-white dark:from-purple-950/25 dark:to-[#111D23] shadow-xs"
            : "border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23]"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Free Testosterone Velocity</span>
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#7C3AED]">+0.1</span>
            <span className="text-xs text-slate-500">pg/mL/day</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#A0B4BE]">
            Stable basal profile within asymptomatic physiological bounds.
          </p>
        </div>

        <div className={`rounded-2xl border p-4 transition ${
          showPremium
            ? "border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/40 to-white dark:from-amber-950/25 dark:to-[#111D23] shadow-xs"
            : "border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23]"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Luteal Adequacy</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">13.1</span>
            <span className="text-xs text-slate-500">days total</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#A0B4BE]">
            Normal secretory duration (&gt;11 days); no luteal defect detected.
          </p>
        </div>
      </div>

      {/* Main Forward Velocity Forecast Chart */}
      <div className="relative">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={showPremium ? FORECAST_DATA : displayData}
              margin={{ top: 15, right: 25, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} />

              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />

              {/* Left Y Axis: Progesterone (ng/mL) */}
              <YAxis
                yAxisId="progesterone"
                domain={[0, 25]}
                tick={{ fontSize: 10, fill: "#0EA5A4" }}
                axisLine={false}
                tickLine={false}
                width={38}
                unit=" ng"
              />

              {/* Right Y Axis: Free Testosterone (pg/mL) */}
              <YAxis
                yAxisId="freeTestosterone"
                orientation="right"
                domain={[0, 8]}
                tick={{ fontSize: 10, fill: "#7C3AED" }}
                axisLine={false}
                tickLine={false}
                width={40}
                unit=" pg"
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-3 text-xs shadow-lg space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-1">
                        {label} &bull; {item?.phase}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#0EA5A4] font-semibold">Progesterone (P4):</span>
                        <span className="font-bold">{item?.progesterone} ng/mL</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#7C3AED] font-semibold">Free Testosterone (FT):</span>
                        <span className="font-bold">{item?.freeTestosterone} pg/mL</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                        Velocity: &Delta;P4 {item?.velocityP} ng/d &bull; &Delta;FT {item?.velocityFT} pg/d
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
              />

              {/* Progesterone Confidence Envelope */}
              {showPremium && (
                <Area
                  yAxisId="progesterone"
                  type="monotone"
                  dataKey="progesteroneUpper"
                  stroke="none"
                  fill="#0EA5A4"
                  fillOpacity={0.12}
                  name="P4 95% Confidence Corridor"
                />
              )}

              {/* Progesterone Projected Line */}
              <Line
                yAxisId="progesterone"
                type="monotone"
                dataKey="progesterone"
                name="Progesterone (ng/mL)"
                stroke="#0EA5A4"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0EA5A4", stroke: "#FFFFFF", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#0EA5A4", stroke: "#FFFFFF", strokeWidth: 3 }}
              />

              {/* Free Testosterone Projected Line */}
              <Line
                yAxisId="freeTestosterone"
                type="monotone"
                dataKey="freeTestosterone"
                name="Free Testosterone (pg/mL)"
                stroke="#7C3AED"
                strokeWidth={3}
                strokeDasharray="4 4"
                dot={{ r: 4, fill: "#7C3AED", stroke: "#FFFFFF", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#7C3AED", stroke: "#FFFFFF", strokeWidth: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Free Plan Lock Overlay for Days 3-7 */}
        {!showPremium && (
          <div className="absolute inset-y-0 right-0 w-3/5 flex flex-col items-center justify-center bg-gradient-to-l from-white dark:from-[#15232A] via-white/80 dark:via-[#15232A]/80 to-transparent p-6 text-center backdrop-blur-[2px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 mb-2">
              <Lock size={18} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              7-Day Hormone Velocity Forecast
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A0B4BE] max-w-[280px]">
              Free accounts see a 48-hour preview. Upgrade to Premium to unlock the full 7-day predictive curves and Bayesian confidence corridors.
            </p>
            <button
              onClick={() => setTierOverride("premium")}
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 text-xs font-bold transition shadow-md shadow-amber-500/25"
            >
              <Crown size={13} className="text-yellow-200 fill-yellow-200" /> Unlock 7-Day Forecast
            </button>
          </div>
        )}
      </div>

      {/* Explanatory Clinical Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 dark:text-[#A0B4BE] border-t border-slate-200 dark:border-[#243C47]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0EA5A4]" /> Progesterone Velocity (&Delta;P4)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" /> Free Testosterone Velocity (&Delta;FT)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-xs bg-[#0EA5A4]/20" /> 95% Bayesian Confidence Corridor
          </span>
        </div>

        <p className="text-[10px] text-slate-400">
          Derivatives computed via moving-average Kalman filter on continuous dermal ISF telemetry.
        </p>
      </div>

    </div>
  );
}
