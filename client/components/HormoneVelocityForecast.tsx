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
const FORECAST_DATA = [
  {
    dayLabel: "Today (D21)",
    dayOffset: 0,
    progesterone: 18.2,
    progesteroneUpper: 19.5,
    progesteroneLower: 17.0,
    estrogen: 165,
    estrogenUpper: 180,
    estrogenLower: 150,
    velocityP: -0.4,
    velocityE: -3.0,
    phase: "Mid-Luteal Peak",
  },
  {
    dayLabel: "+1 Day (D22)",
    dayOffset: 1,
    progesterone: 17.6,
    progesteroneUpper: 19.0,
    progesteroneLower: 16.2,
    estrogen: 158,
    estrogenUpper: 172,
    estrogenLower: 144,
    velocityP: -0.6,
    velocityE: -7.0,
    phase: "Luteal Plateau",
  },
  {
    dayLabel: "+2 Days (D23)",
    dayOffset: 2,
    progesterone: 16.5,
    progesteroneUpper: 18.2,
    progesteroneLower: 14.8,
    estrogen: 148,
    estrogenUpper: 164,
    estrogenLower: 132,
    velocityP: -1.1,
    velocityE: -10.0,
    phase: "Luteal Maintenance",
  },
  {
    dayLabel: "+3 Days (D24)",
    dayOffset: 3,
    progesterone: 14.8,
    progesteroneUpper: 16.6,
    progesteroneLower: 12.9,
    estrogen: 136,
    estrogenUpper: 152,
    estrogenLower: 120,
    velocityP: -1.7,
    velocityE: -12.0,
    phase: "Early Luteolysis",
  },
  {
    dayLabel: "+4 Days (D25)",
    dayOffset: 4,
    progesterone: 12.2,
    progesteroneUpper: 14.2,
    progesteroneLower: 10.1,
    estrogen: 122,
    estrogenUpper: 138,
    estrogenLower: 105,
    velocityP: -2.6,
    velocityE: -14.0,
    phase: "Active Luteolysis",
  },
  {
    dayLabel: "+5 Days (D26)",
    dayOffset: 5,
    progesterone: 8.9,
    progesteroneUpper: 11.0,
    progesteroneLower: 6.8,
    estrogen: 106,
    estrogenUpper: 122,
    estrogenLower: 90,
    velocityP: -3.3,
    velocityE: -16.0,
    phase: "Pre-Menstrual Descent",
  },
  {
    dayLabel: "+6 Days (D27)",
    dayOffset: 6,
    progesterone: 5.4,
    progesteroneUpper: 7.2,
    progesteroneLower: 3.6,
    estrogen: 88,
    estrogenUpper: 104,
    estrogenLower: 72,
    velocityP: -3.5,
    velocityE: -18.0,
    phase: "Luteal Termination",
  },
  {
    dayLabel: "+7 Days (D28)",
    dayOffset: 7,
    progesterone: 2.3,
    progesteroneUpper: 3.8,
    progesteroneLower: 1.0,
    estrogen: 72,
    estrogenUpper: 86,
    estrogenLower: 58,
    velocityP: -3.1,
    velocityE: -16.0,
    phase: "Cycle Transition (Menses)",
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
    <div className="rounded-[24px] border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-5 sm:p-6 shadow-sm space-y-6">
      
      {/* Header and Plan Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex items-center gap-1 rounded-full bg-[#0EA5A4]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#0EA5A4]">
              <Sparkles size={12} /> 7-Day Velocity Model
            </span>
            {showPremium ? (
              <Badge className="bg-[#0EA5A4] text-white hover:bg-[#0EA5A4] text-[10px] flex items-center gap-1">
                <Crown size={11} /> Premium Forecast
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
            Predictive continuous trajectories of Progesterone and Estrogen heading over the next 7 days.
          </p>
        </div>

        {/* Free vs Premium Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#1C2F38] p-1 border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setTierOverride("free")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !showPremium
                  ? "bg-white dark:bg-[#15232A] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-[#A0B4BE]"
              }`}
            >
              Free (48h)
            </button>
            <button
              onClick={() => setTierOverride("premium")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                showPremium
                  ? "bg-[#0EA5A4] text-white shadow-xs"
                  : "text-slate-500 hover:text-[#0EA5A4] dark:text-[#A0B4BE]"
              }`}
            >
              <Crown size={12} /> Premium (7-Day)
            </button>
          </div>

          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#243C47] bg-slate-50 dark:bg-[#1C2F38] px-3 py-1.5 text-xs font-semibold text-[#2C4C5C] dark:text-[#E8F2F6] hover:bg-slate-100 transition"
            >
              Doctor Report PDF
            </button>
          )}
        </div>
      </div>

      {/* Velocity Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23] p-4">
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

        <div className="rounded-2xl border border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Estrogen Velocity</span>
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#7C3AED]">&minus;11.0</span>
            <span className="text-xs text-slate-500">pg/mL/day</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#A0B4BE]">
            Synchronized pre-menses descent; balanced E2/P4 ratio.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Predicted Menses</span>
            <Calendar size={14} className="text-[#F3E308]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-[#E8F2F6]">6.2</span>
            <span className="text-xs text-slate-500">days away</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-[#A0B4BE]">
            High confidence window: Nov 11 &ndash; Nov 13 (&plusmn;1.1 days).
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23] p-4">
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

              {/* Right Y Axis: Estrogen (pg/mL) */}
              <YAxis
                yAxisId="estrogen"
                orientation="right"
                domain={[0, 250]}
                tick={{ fontSize: 10, fill: "#7C3AED" }}
                axisLine={false}
                tickLine={false}
                width={44}
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
                        <span className="text-[#7C3AED] font-semibold">Estrogen (E2):</span>
                        <span className="font-bold">{item?.estrogen} pg/mL</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                        Velocity: &Delta;P4 {item?.velocityP} ng/d &bull; &Delta;E2 {item?.velocityE} pg/d
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

              {/* Estrogen Projected Line */}
              <Line
                yAxisId="estrogen"
                type="monotone"
                dataKey="estrogen"
                name="Estrogen (pg/mL)"
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
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#0EA5A4] hover:bg-[#0C8F8E] text-white px-4 py-2 text-xs font-bold transition shadow-sm"
            >
              <Crown size={13} /> Unlock 7-Day Forecast
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
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" /> Estrogen Velocity (&Delta;E2)
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
