
import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useReadings,
  usePatch,
  useTrendEvents,
  useReferenceRanges,
  useSubscription,
} from "@/hooks/useData";
import {
  t,
  type Language,
} from "@/lib/i18n";
import {
  Activity,
  ArrowUpRight,
  BatteryMedium,
  CheckCircle2,
  ChevronRight,
  Crown,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";
import Hormone3DVisualizer from "@/components/Hormone3DVisualizer";
import ISFPatch3DHero from "@/components/ISFPatch3DHero";
import HormoneVelocityForecast from "@/components/HormoneVelocityForecast";
import ClinicalReportExportModal from "@/components/ClinicalReportExportModal";

interface HomeViewProps {
  language: Language;
  setView: (
    view:
      | "home"
      | "chat"
      | "predictive"
      | "settings"
  ) => void;
}

function StatusPill({
  children,
  tone = "teal",
  icon,
}: {
  children: ReactNode;
  tone?: "teal" | "purple" | "coral";
  icon?: ReactNode;
}) {
  return (
    <span
      className={`status-pill status-${tone} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium`}
    >
      {icon}
      {children}
    </span>
  );
}

function calculateTimeInRange(
  readings: {
    androgen_value: number;
    progesterone_value: number;
  }[],
  androgenRange: {
    lower: number;
    upper: number;
  },
  progesteroneRange: {
    lower: number;
    upper: number;
  }
) {
  if (readings.length === 0) {
    return 0;
  }

  let inRange = 0;

  for (const reading of readings) {
    const androgenInRange =
      reading.androgen_value >=
        androgenRange.lower &&
      reading.androgen_value <=
        androgenRange.upper;

    const progesteroneInRange =
      reading.progesterone_value >=
        progesteroneRange.lower &&
      reading.progesterone_value <=
        progesteroneRange.upper;

    if (
      androgenInRange &&
      progesteroneInRange
    ) {
      inRange++;
    }
  }

  return Math.round(
    (inRange / readings.length) * 100
  );
}

function formatChartDate(
  value: string,
  language: Language
) {
  return new Intl.DateTimeFormat(
    language === "sw"
      ? "sw-KE"
      : "en-KE",
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

/*
 * #14 — Patch replacement reminder helper.
 *
 * The reminder is intentionally limited to:
 * - overdue patches
 * - patches due within 14 days
 *
 * Existing patch API/data structure is preserved.
 */
function getPatchReminder(
  replacementDueAt:
    | string
    | null
    | undefined
) {
  if (!replacementDueAt) {
    return null;
  }

  const due =
    new Date(
      replacementDueAt
    ).getTime();

  if (!Number.isFinite(due)) {
    return null;
  }

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const daysRemaining =
    Math.ceil(
      (due - Date.now()) /
        millisecondsPerDay
    );

  if (daysRemaining < 0) {
    return {
      type: "overdue" as const,
      daysRemaining,
    };
  }

  if (daysRemaining <= 14) {
    return {
      type: "soon" as const,
      daysRemaining,
    };
  }

  return null;
}

function HormoneTooltip({
  active,
  payload,
  label,
  language,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  language: Language;
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0 ||
    !label
  ) {
    return null;
  }

  const date = new Date(label);

  return (
    <div className="rounded-xl border border-slate-300 dark:border-[#243C47] bg-white/95 dark:bg-[#15232A]/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {new Intl.DateTimeFormat(
          language === "sw"
            ? "sw-KE"
            : "en-KE",
          {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }
        ).format(date)}
      </p>

      <div className="space-y-1.5">
        {payload.map(
          (entry: any) => {
            const isTimeInRange =
              entry.dataKey ===
              "timeInRange";

            return (
              <div
                key={entry.dataKey}
                className="flex items-center justify-between gap-6 text-[12px]"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        entry.color,
                    }}
                  />

                  {entry.name}
                </span>

                <span className="font-semibold text-[#2C4C5C] dark:text-white">
                  {Number(
                    entry.value
                  ).toFixed(
                    isTimeInRange
                      ? 0
                      : 1
                  )}

                  {isTimeInRange
                    ? "%"
                    : " nmol/L"}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function HormoneChart({
  readings,
  androgenRange,
  progesteroneRange,
  language,
}: {
  readings: {
    id: string;
    recorded_at: string;
    androgen_value: number;
    progesterone_value: number;
  }[];
  androgenRange: {
    lower: number;
    upper: number;
  };
  progesteroneRange: {
    lower: number;
    upper: number;
  };
  language: Language;
}) {
  /*
   * #12 — Build the hormone chart data and
   * calculate cumulative time-in-range.
   *
   * Time-in-range uses a separate 0–100% axis
   * so it is not incorrectly plotted against
   * the hormone concentration axis.
   */
  const chartData = useMemo(() => {
    let inRangeCount = 0;

    return readings.map(
      (reading, index) => {
        const androgenValue =
          Number(
            reading.androgen_value
          );

        const progesteroneValue =
          Number(
            reading.progesterone_value
          );

        const androgenInRange =
          androgenValue >=
            androgenRange.lower &&
          androgenValue <=
            androgenRange.upper;

        const progesteroneInRange =
          progesteroneValue >=
            progesteroneRange.lower &&
          progesteroneValue <=
            progesteroneRange.upper;

        if (
          androgenInRange &&
          progesteroneInRange
        ) {
          inRangeCount++;
        }

        const processedCount =
          index + 1;

        return {
          timestamp:
            reading.recorded_at,

          androgen:
            androgenValue,

          progesterone:
            progesteroneValue,

          timeInRange:
            Math.round(
              (inRangeCount /
                processedCount) *
                100
            ),
        };
      }
    );
  }, [
    readings,
    androgenRange,
    progesteroneRange,
  ]);

  const allValues =
    chartData.flatMap(
      (item) => [
        item.androgen,
        item.progesterone,
      ]
    );

  const dataMin =
    allValues.length > 0
      ? Math.min(...allValues)
      : 0;

  const dataMax =
    allValues.length > 0
      ? Math.max(...allValues)
      : 100;

  const rangeMin = Math.min(
    dataMin,
    androgenRange.lower,
    progesteroneRange.lower
  );

  const rangeMax = Math.max(
    dataMax,
    androgenRange.upper,
    progesteroneRange.upper
  );

  const padding = Math.max(
    5,
    (rangeMax - rangeMin) *
      0.12
  );

  const yMin = Math.max(
    0,
    rangeMin - padding
  );

  const yMax =
    rangeMax + padding;

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-slate-300 dark:border-[#243C47] bg-slate-50 dark:bg-[#15232A] p-6 text-center">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No hormone readings yet
          </p>

          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Your readings will appear
            here once the patch
            records data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={chartData}
          margin={{
            top: 12,
            right: 18,
            left: 0,
            bottom: 12,
          }}
        >
          <ReferenceArea
            yAxisId="hormone"
            y1={Math.min(
              androgenRange.lower,
              progesteroneRange.lower
            )}
            y2={Math.max(
              androgenRange.upper,
              progesteroneRange.upper
            )}
            fill="#DCFCE7"
            fillOpacity={0.35}
          />

          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) =>
              formatChartDate(
                value,
                language
              )
            }
            tick={{
              fontSize: 10,
              fill: "#64748B",
            }}
            tickLine={false}
            axisLine={false}
            minTickGap={35}
          />

          {/* Hormone concentration axis */}
          <YAxis
            yAxisId="hormone"
            domain={[
              yMin,
              yMax,
            ]}
            tick={{
              fontSize: 10,
              fill: "#64748B",
            }}
            tickLine={false}
            axisLine={false}
            width={42}
          />

          {/* Time-in-range percentage axis */}
          <YAxis
            yAxisId="range"
            orientation="right"
            domain={[0, 100]}
            tick={{
              fontSize: 9,
              fill: "#64748B",
            }}
            tickLine={false}
            axisLine={false}
            width={32}
          />

          <Tooltip
            content={
              <HormoneTooltip
                language={language}
              />
            }
          />

          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{
              fontSize: "11px",
              paddingBottom:
                "12px",
            }}
          />

          <Line
            type="monotone"
            dataKey="androgen"
            name={t(
              language,
              "home.androgen"
            )}
            yAxisId="hormone"
            stroke="#D97706"
            strokeWidth={3}
            dot={{
              r: 3,
              fill: "#D97706",
              strokeWidth: 2,
              stroke:
                "#FFFFFF",
            }}
            activeDot={{
              r: 7,
              fill: "#D97706",
              stroke:
                "#FFFFFF",
              strokeWidth: 3,
            }}
            isAnimationActive
            animationDuration={
              700
            }
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="progesterone"
            name={t(
              language,
              "home.progesterone"
            )}
            yAxisId="hormone"
            stroke="#0EA5A4"
            strokeWidth={3}
            dot={{
              r: 3,
              fill: "#0EA5A4",
              strokeWidth: 2,
              stroke:
                "#FFFFFF",
            }}
            activeDot={{
              r: 7,
              fill: "#0EA5A4",
              stroke:
                "#FFFFFF",
              strokeWidth: 3,
            }}
            isAnimationActive
            animationDuration={
              700
            }
            connectNulls
          />

          {/* #12 — Moving cumulative time-in-range line */}
          <Line
            type="monotone"
            dataKey="timeInRange"
            name="Time in range"
            yAxisId="range"
            stroke="#64748B"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#64748B",
              stroke:
                "#FFFFFF",
              strokeWidth: 2,
            }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function HomeView({
  language,
  setView,
}: HomeViewProps) {
  const { profile } =
    useAuth();

  const {
    readings,
    loading,
  } = useReadings();

  const { patch } =
    usePatch();

  const { events } =
    useTrendEvents();

  const { ranges } =
    useReferenceRanges();

  const [
    nudgeDismissed,
    setNudgeDismissed,
  ] = useState(false);

  const { subscription } = useSubscription();
  const isPremium = subscription?.plan === "premium" && subscription?.status === "active";

  const [chartMode, setChartMode] = useState<"velocity" | "realtime">("realtime");
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const androgenRange =
    useMemo(() => {
      const range =
        ranges.find(
          (item) =>
            item.hormone ===
            "androgen"
        );

      return range
        ? {
            lower:
              range.lower_normal,
            upper:
              range.upper_normal,
          }
        : {
            lower: 30,
            upper: 70,
          };
    }, [ranges]);

  const progesteroneRange =
    useMemo(() => {
      const range =
        ranges.find(
          (item) =>
            item.hormone ===
            "progesterone"
        );

      return range
        ? {
            lower:
              range.lower_normal,
            upper:
              range.upper_normal,
          }
        : {
            lower: 10,
            upper: 50,
          };
    }, [ranges]);

  const timeInRange =
    useMemo(
      () =>
        calculateTimeInRange(
          readings,
          androgenRange,
          progesteroneRange
        ),
      [
        readings,
        androgenRange,
        progesteroneRange,
      ]
    );

  const latest =
    readings[
      readings.length - 1
    ];

  const previous =
    readings[
      readings.length - 2
    ];

  const androgenChange =
    latest && previous
      ? latest.androgen_value -
        previous.androgen_value
      : 0;

  const progesteroneChange =
    latest && previous
      ? latest.progesterone_value -
        previous.progesterone_value
      : 0;

  const activeEvent =
    events[0];

  const nudgeKey =
    activeEvent
      ? activeEvent.event_type ===
        "high"
        ? "home.nudge.high"
        : activeEvent.event_type ===
          "low"
        ? "home.nudge.low"
        : "home.nudge.increased"
      : "home.nudge.normal";

  const nudgeText = t(
    language,
    nudgeKey
  );

  /*
   * #14 — Calculate whether a patch
   * replacement reminder should appear.
   *
   * This does not change the existing
   * patch status/battery UI.
   */
  const patchReminder =
    getPatchReminder(
      patch?.replacement_due_at
    );

  const now =
    new Date();

  const dateStr =
    now.toLocaleDateString(
      language === "sw"
        ? "sw-KE"
        : "en-GB",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );

  const hour =
    now.getHours();

  const greeting =
    hour < 12
      ? t(
          language,
          "home.greeting"
        )
      : hour < 17
      ? "Good afternoon"
      : "Good evening";

  const firstName =
    profile?.full_name?.split(
      " "
    )[0] ?? "there";

  return (
    <div className="mx-auto max-w-[1250px] px-5 pb-12 pt-6 sm:px-8 lg:px-10">
      {/* Merged 3D Telemetry & Welcome Hero Section */}
      <div className="relative mb-10 overflow-hidden rounded-[36px] border border-slate-300 dark:border-[#243C47] bg-gradient-to-br from-white via-[#F8FAFC] to-[#EFF6F8] dark:from-[#15232A] dark:via-[#111D23] dark:to-[#0D161A] p-6 shadow-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:gap-14">
          {/* Left Column: Telemetry Badges, Greeting, Narrative & Value Grid */}
          <div className="max-w-[650px]">
            {/* Top telemetry badges */}
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400 dark:border-[#F3E308]/70 bg-[#FEE868] dark:bg-[#F3E308]/30 px-3.5 py-1 text-[11px] font-bold text-[#523600] dark:text-[#F3E308] shadow-xs">
                <Sparkles size={12} className="text-[#854D0E] dark:text-[#F3E308]" />
                Micro-needle Telemetry Active
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold transition ${
                isPremium
                  ? "border border-amber-300/80 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 via-teal-50/60 to-emerald-50 dark:from-amber-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 text-amber-900 dark:text-amber-300 shadow-xs"
                  : "border border-slate-300 dark:border-white/20 bg-slate-200/90 dark:bg-[#1C2F38] text-slate-900 dark:text-[#E8F2F6] shadow-xs"
              }`}>
                {isPremium ? (
                  <>
                    <Crown size={12} className="text-amber-500 dark:text-amber-400" />
                    <span>Premium Account</span>
                  </>
                ) : (
                  <span>Free Version</span>
                )}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-[#738C98]">
                {dateStr}
              </span>
            </div>

            {/* Time-based dynamic greeting without static Good morning badge */}
            <div className="mt-1">
              <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-[#2C4C5C] dark:text-[#E8F2F6] sm:text-[26px]">
                {greeting}, {firstName}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-[#A0B4BE]">
                {t(language, "home.overview")} Real-time interstitial hormone sensing is active and recording baseline biomarkers.
              </p>
            </div>

            {/* Live Patch Status Pill */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {patch ? (
                <>
                  <StatusPill icon={<Wifi size={12} />} tone={patch.connected ? "teal" : "coral"}>
                    <span className="text-[12px]">{patch.connected ? t(language, "home.connected") : t(language, "home.disconnected")}</span>
                  </StatusPill>
                  <StatusPill icon={<BatteryMedium size={12} />} tone="purple">
                    <span className="text-[12px] font-medium">Battery {patch.battery_percent ?? "—"}%</span>
                  </StatusPill>
                  <span className="flex items-center gap-1.5 px-1 text-[12px] text-slate-600 dark:text-[#A0B4BE]">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    {t(language, "home.updated")}
                  </span>
                </>
              ) : (
                <StatusPill icon={<Wifi size={12} />} tone="coral">
                  <span className="text-[12px]">{t(language, "home.disconnected")}</span>
                </StatusPill>
              )}
            </div>

            {/* Main Narrative Headline */}
            <h2 className="mt-7 max-w-[620px] font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.055em] text-[#2C4C5C] dark:text-[#E8F2F6] sm:text-[44px] lg:text-[52px]">
              {language === "en" ? "Feel more in tune with your body." : "Elewa mwili wako kwa utulivu."}
            </h2>

            <p className="mt-3.5 max-w-[530px] text-[15px] leading-relaxed text-[#4F6370] dark:text-[#A0B4BE]">
              {language === "en"
                ? "ISF Tracker brings your hormone signals, care team and long-term insights into one calm, clear space."
                : "ISF Tracker huleta ishara zako za homoni, timu ya afya na maarifa ya muda mrefu pamoja katika nafasi moja tulivu na wazi."}
            </p>

            {/* Action Buttons */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("hormone-metrics");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="group flex items-center gap-2 rounded-full bg-[#2C4C5C] dark:bg-[#F3E308] px-5 py-3 text-[12px] font-bold text-white dark:text-[#142229] shadow-[0_8px_20px_rgba(44,76,92,0.2)] dark:shadow-[0_8px_20px_rgba(243,227,8,0.25)] transition hover:-translate-y-0.5"
              >
                <span>{language === "en" ? "Open dashboard" : "Fungua dashibodi"}</span>
                <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>

              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-2 rounded-full border border-yellow-400 dark:border-[#F3E308]/70 bg-[#FEE868] hover:bg-[#FDD835] dark:bg-[#F3E308]/30 dark:hover:bg-[#F3E308]/40 px-5 py-3 text-[12px] font-extrabold text-[#523600] dark:text-[#F3E308] transition hover:-translate-y-0.5 shadow-xs cursor-pointer"
              >
                <FileText size={15} className="text-[#854D0E] dark:text-[#F3E308]" />
                <span>Doctor Report (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setView("chat")}
                className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-[#243C47] bg-slate-100/90 hover:bg-slate-200/90 dark:bg-[#1C2F38] dark:hover:bg-[#243C47] px-5 py-3 text-[12px] font-bold text-slate-900 dark:text-[#E8F2F6] transition hover:-translate-y-0.5 shadow-xs"
              >
                <span>{language === "en" ? "Explore care spaces" : "Gundua huduma za afya"}</span>
                <ChevronRight size={14} className="text-teal-600 dark:text-teal-300" />
              </button>
            </div>

            {/* 3 Core Value Cards */}
            <div className="mt-8 grid max-w-[580px] gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  label: language === "en" ? "Consent first" : "Ridhaa kwanza",
                },
                {
                  icon: Activity,
                  label: language === "en" ? "Clarity" : "Uwazi",
                },
                {
                  icon: MessageCircle,
                  label: language === "en" ? "Care connected" : "Huduma iliyounganishwa",
                },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="welcome-value rounded-2xl border border-slate-300 dark:border-[#243C47] bg-white dark:bg-[#1C2F38] p-3.5 shadow-xs backdrop-blur-xs transition hover:border-[#2C4C5C]/40"
                >
                  <Icon size={16} className="text-[#0EA5A4] dark:text-[#F3E308]" />
                  <p className="mt-3 text-[11px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: The Dark Brand Box With the 3D Animation Inside */}
          <div className="welcome-brand-art relative mx-auto w-full max-w-[430px]">
            <div className="welcome-orbit absolute -inset-4 rounded-[38px] border border-[#F3E308]/15 pointer-events-none" />

            <div className="relative overflow-hidden rounded-[30px] border border-[#B8BFC1]/80 bg-gradient-to-br from-[#15232A] to-[#080D10] p-6 text-white shadow-[0_28px_70px_rgba(44,76,92,0.22)] sm:p-8">
              <div className="relative">
                {/* Header inside the dark card */}
                <div className="flex items-center justify-between">
                  <div className="brand-mark brand-mark-inverse flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Activity size={17} strokeWidth={2.7} />
                  </div>

                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                    ISF Tracker
                  </span>
                </div>

                {/* 3D Animation EMBEDDED INSIDE THIS BOX! */}
                <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-xs">
                  <div className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                      3D Biosensor Patch
                    </span>
                    <span className="text-slate-400">Interactive</span>
                  </div>
                  <ISFPatch3DHero variant="compact" />
                </div>

                {/* Middle Text: A better way to listen / Your care, in a clearer rhythm. */}
                <div className="mt-4 max-w-[300px]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#F3E308]">
                    {language === "en" ? "A better way to listen" : "Njia bora ya kusikiliza"}
                  </p>

                  <p className="mt-2 font-display text-[24px] font-medium leading-[1.1] tracking-[-0.04em] text-white">
                    {language === "en" ? "Your care, in a clearer rhythm." : "Huduma yako, kwa mdundo wazi."}
                  </p>
                </div>

                {/* Bottom Footer: Private by design / Your data stays yours */}
                <div className="mt-6 flex items-end justify-between border-t border-white/15 pt-4">
                  <div>
                    <p className="text-[11px] text-slate-300 font-medium">Private by design</p>
                    <div className="mt-1 flex items-center gap-2 text-[12px] font-medium text-white">
                      <LockKeyhole size={13} className="text-[#F3E308]" />
                      {language === "en" ? "Your data stays yours" : "Taarifa zako ni zako"}
                    </div>
                  </div>

                  <div className="h-12 w-12 rounded-full border border-[#F3E308]/40 bg-[#F3E308]/[0.12] p-1.5 flex items-center justify-center">
                    <div className="h-full w-full rounded-full border border-[#B8BFC1]/35 flex items-center justify-center text-[10px] text-[#F3E308] font-bold">
                      ISF
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="hormone-metrics" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="min-w-0 rounded-[24px] border border-slate-300 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-4 shadow-2xl dark:shadow-[0_14px_45px_rgba(0,0,0,0.4)] sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-[#738C98]">
                  {t(
                    language,
                    "home.snapshot"
                  )}
                </p>

                <h3 className="mt-1 font-display text-[18px] font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
                  {chartMode === "velocity"
                    ? "7-Day Forward Hormone Velocity Forecast"
                    : t(language, "home.hormoneLevels")}
                </h3>
              </div>

              {/* Mode Toggle & Doctor Report Button */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#1C2F38] p-1 border border-slate-300 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setChartMode("velocity")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      chartMode === "velocity"
                        ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xs border border-amber-300/40"
                        : "text-slate-500 hover:text-slate-900 dark:text-[#A0B4BE]"
                    }`}
                  >
                    <Sparkles size={12} className={chartMode === "velocity" ? "text-yellow-200" : ""} /> 7-Day Velocity
                  </button>

                  <button
                    type="button"
                    onClick={() => setChartMode("realtime")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      chartMode === "realtime"
                        ? "bg-white dark:bg-[#15232A] text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:text-[#A0B4BE]"
                    }`}
                  >
                    Real-Time Telemetry
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-yellow-400 dark:border-[#F3E308]/70 bg-[#FEE868] hover:bg-[#FDD835] dark:bg-[#F3E308]/30 dark:hover:bg-[#F3E308]/40 px-3.5 py-1.5 text-xs font-bold text-[#523600] dark:text-[#F3E308] transition shadow-xs cursor-pointer"
                >
                  <FileText size={13} className="text-[#854D0E] dark:text-[#F3E308]" />
                  <span>Doctor PDF</span>
                </button>
              </div>
            </div>

            {chartMode === "velocity" ? (
              <HormoneVelocityForecast onOpenReport={() => setReportModalOpen(true)} />
            ) : (
              <div className="chart-wrap h-[350px] min-h-[300px] w-full overflow-hidden rounded-2xl border border-slate-300 dark:border-[#243C47] bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-[#111D23] dark:via-[#0F191E] dark:to-[#0A1216] p-4 shadow-inner sm:h-[390px] sm:p-6">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-[#A0B4BE]">
                      Live hormone telemetry
                    </p>
                    <p className="mt-1 text-[12px] text-slate-400 dark:text-[#738C98]">
                      Hover over any point to inspect the reading.
                    </p>
                  </div>
                  <span className="rounded-full border border-teal-100 dark:border-teal-500/30 bg-white dark:bg-[#15232A] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700 dark:text-teal-300 shadow-sm">
                    Interactive
                  </span>
                </div>
                <div className="h-[275px] sm:h-[310px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <Activity className="h-5 w-5 animate-pulse" />
                        Loading hormone telemetry...
                      </div>
                    </div>
                  ) : (
                    <HormoneChart
                      readings={readings}
                      androgenRange={androgenRange}
                      progesteroneRange={progesteroneRange}
                      language={language}
                    />
                  )}
                </div>
              </div>
            )}

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
            <ReadingCard
              name={t(
                language,
                "home.androgen"
              )}
              value={
                latest
                  ? latest.androgen_value.toFixed(
                      1
                    )
                  : "—"
              }
              unit="nmol/L"
              color="gold"
              change={
                androgenChange !==
                0
                  ? `${
                      androgenChange >
                      0
                        ? "+"
                        : ""
                    }${androgenChange.toFixed(
                      1
                    )}`
                  : ""
              }
            />

            <ReadingCard
              name={t(
                language,
                "home.progesterone"
              )}
              value={
                latest
                  ? latest.progesterone_value.toFixed(
                      1
                    )
                  : "—"
              }
              unit="nmol/L"
              color="coral"
              change={
                progesteroneChange !==
                0
                  ? `${
                      progesteroneChange >
                      0
                        ? "+"
                        : ""
                    }${progesteroneChange.toFixed(
                      1
                    )}`
                  : ""
              }
            />

            <div className="flex items-center justify-between rounded-2xl border border-slate-300 dark:border-[#243C47] bg-slate-50/80 dark:bg-[#111D23] p-4 sm:px-5 shadow-xs">
              <div>
                <p className="text-[11px] font-medium text-slate-700 dark:text-[#A0B4BE]">
                  {t(
                    language,
                    "home.timeRange"
                  )}
                </p>

                <p className="mt-1 text-[11px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
                  {t(
                    language,
                    "home.normal"
                  )}
                </p>
              </div>

              <div className="relative h-[104px] w-[104px] shrink-0">
                <svg className="h-full w-full -rotate-90">
                  <circle
                    cx="52"
                    cy="52"
                    r="40"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    className="dark:stroke-[#243C47]"
                  />

                  <circle
                    cx="52"
                    cy="52"
                    r="40"
                    fill="none"
                    stroke="#0EA5A4"
                    strokeLinecap="round"
                    strokeWidth="8"
                    strokeDasharray={`${
                      2 *
                      Math.PI *
                      40 *
                      (timeInRange /
                        100)
                    } ${
                      2 *
                      Math.PI *
                      40
                    }`}
                    className="transition-all duration-700 dark:stroke-[#F3E308]"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[24px] font-semibold tracking-[-0.06em] text-[#2C4C5C] dark:text-[#E8F2F6]">
                    {timeInRange}

                    <span className="text-[13px] text-teal-600 dark:text-[#F3E308]">
                      %
                    </span>
                  </span>

                  <span className="text-[10px] text-slate-500 dark:text-[#738C98]">
                    in range
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="flex flex-col gap-5">
          {!nudgeDismissed && (
            <div className="relative overflow-hidden rounded-[24px] border border-teal-200/90 dark:border-[#243C47] bg-gradient-to-br from-teal-50/60 via-white to-violet-50/60 dark:from-[#15232A] dark:via-[#111D23] dark:to-[#0D161A] p-5 shadow-2xl dark:shadow-[0_10px_28px_rgba(0,0,0,0.4)]">
              <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-teal-100/60 dark:bg-teal-900/20 blur-2xl" />

              <div className="relative">
                <div className="mb-8 flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
                    <Sparkles
                      size={16}
                    />
                  </div>

                  <button
                    onClick={() =>
                      setNudgeDismissed(
                        true
                      )
                    }
                    className="text-slate-500 dark:text-slate-400 transition hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <X size={15} />
                  </button>
                </div>

                <p className="max-w-[190px] font-display text-[18px] font-medium leading-[1.25] tracking-[-0.04em] text-[#2C4C5C] dark:text-[#E8F2F6]">
                  {nudgeText}
                </p>

                {(
                  activeEvent?.event_type ===
                    "high" ||
                  activeEvent?.event_type ===
                    "low" ||
                  activeEvent?.event_type ===
                    "increasing"
                ) && (
                  <button
                    onClick={() =>
                      setView(
                        "chat"
                      )
                    }
                    className="mt-5 flex items-center gap-1 text-[13px] font-semibold text-teal-700 dark:text-[#F3E308]"
                  >
                    {t(
                      language,
                      "home.ask"
                    )}

                    <ArrowUpRight
                      size={13}
                    />
                  </button>
                )}
              </div>
            </div>
          )}

          {/*
           * #14 — Patch replacement reminder.
           *
           * This is inserted into the existing right-hand
           * column without replacing the existing nudge
           * or insights card.
           */}
          {patchReminder && (
            <div className="rounded-[24px] border border-slate-300 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300">
                  <BatteryMedium
                    size={16}
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-[#738C98]">
                    Patch reminder
                  </p>

                  <p className="mt-1 text-[13px] font-medium text-[#2C4C5C] dark:text-[#E8F2F6]">
                    {patchReminder.type ===
                    "overdue"
                      ? "Your patch replacement is due."
                      : `Your patch replacement is due in ${
                          patchReminder.daysRemaining
                        } day${
                          patchReminder.daysRemaining ===
                          1
                            ? ""
                            : "s"
                        }.`}
                  </p>

                  {patch?.battery_percent !=
                    null && (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-[#A0B4BE]">
                      Battery:{" "}
                      {
                        patch.battery_percent
                      }
                      %
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-slate-300 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-[#738C98]">
                  {t(
                    language,
                    "home.insights"
                  )}
                </p>

                <p className="mt-1 text-[13px] font-medium text-[#2C4C5C] dark:text-[#E8F2F6]">
                  {activeEvent
                    ? "Requires attention"
                    : "Everything looks balanced"}
                </p>
              </div>

              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  activeEvent
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300"
                    : "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300"
                }`}
              >
                {activeEvent ? (
                  <Activity
                    size={16}
                  />
                ) : (
                  <CheckCircle2
                    size={16}
                  />
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <InsightRow
                label={t(
                  language,
                  "home.androgen"
                )}
                value={
                  latest
                    ? latest.androgen_value >
                      androgenRange.upper
                      ? "Above range"
                      : latest.androgen_value <
                          androgenRange.lower
                        ? "Below range"
                        : "Within range"
                    : "—"
                }
                color="gold"
              />

              <InsightRow
                label={t(
                  language,
                  "home.progesterone"
                )}
                value={
                  latest
                    ? latest.progesterone_value >
                      progesteroneRange.upper
                      ? "Above range"
                      : latest.progesterone_value <
                          progesteroneRange.lower
                        ? "Below range"
                        : "Within range"
                    : "—"
                }
                color="coral"
              />

              <InsightRow
                label="Trend"
                value={
                  activeEvent
                    ? activeEvent.event_type
                    : "Stable"
                }
                color="purple"
              />
            </div>

            <button
              onClick={() =>
                setView(
                  "predictive"
                )
              }
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-slate-300 dark:border-[#243C47] px-3 py-2.5 text-[11px] font-semibold text-slate-700 dark:text-[#E8F2F6] transition hover:bg-slate-100 dark:hover:bg-[#111D23] shadow-xs"
            >
              <span>
                View health
                predictions
              </span>

              <ChevronRight
                size={14}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 3D ISF Molecular Biosensing - Matches Chat Section Size (max-w-6xl mx-auto) */}
      <div className="mt-8 w-full max-w-6xl mx-auto">
        <Hormone3DVisualizer />
      </div>

      <ClinicalReportExportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        patientName={profile?.full_name || "Amina Mwangi"}
        patientRef={profile?.patient_reference || "ISF-PT-2026-8841"}
      />
    </div>
  );
}

function ReadingCard({
  name,
  value,
  unit,
  color,
  change,
}: {
  name: string;
  value: string;
  unit: string;
  color:
    | "gold"
    | "purple"
    | "coral";
  change: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-300 dark:border-[#243C47] bg-white dark:bg-[#111D23] p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[12px] font-medium text-slate-600 dark:text-[#A0B4BE]">
          <span
            className={`h-2 w-2 rounded-full ${
              color === "gold"
                ? "bg-amber-500"
                : color === "purple"
                ? "bg-violet-600"
                : "bg-teal-500"
            }`}
          />

          {name}
        </p>

        {change && (
          <span className="text-[14px] font-semibold text-teal-600 dark:text-teal-400">
            {change}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[24px] font-semibold tracking-[-0.05em] text-[#2C4C5C] dark:text-[#E8F2F6]">
          {value}
        </span>

        <span className="text-[11px] text-slate-500 dark:text-[#738C98]">
          {unit}
        </span>
      </div>
    </div>
  );
}

function InsightRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "gold" | "purple" | "coral" | string;
}) {
  const dotColor =
    color === "gold"
      ? "bg-amber-500"
      : color === "purple"
      ? "bg-violet-600"
      : "bg-teal-500";

  const labelColor =
    color === "gold"
      ? "text-amber-700 dark:text-amber-400 font-medium"
      : color === "purple"
      ? "text-violet-700 dark:text-violet-400 font-medium"
      : "text-slate-600 dark:text-[#A0B4BE]";

  const valueColor =
    color === "gold"
      ? "text-amber-800 dark:text-amber-300 font-semibold"
      : color === "purple"
      ? "text-violet-800 dark:text-violet-300 font-semibold"
      : "font-medium text-slate-800 dark:text-[#E8F2F6]";

  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className={`flex items-center gap-2 ${labelColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {label}
      </span>

      <span className={valueColor}>
        {value}
      </span>
    </div>
  );
}

