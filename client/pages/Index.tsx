import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";

import { t, type Language } from "@/lib/i18n";

import {
  resolveTheme,
  applyResolvedTheme,
  readStoredThemeMode,
  writeStoredThemeMode,
} from "@/lib/theme";

import {
  Accessibility,
  Activity,
  ArrowUpRight,
  Bell,
  ChevronRight,
  House,
  MessageCircle,
  BarChart3,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
  LockKeyhole,
} from "lucide-react";

import HomeView from "./HomeView";
import ChatView from "./ChatView";
import PredictiveView from "./PredictiveView";
import SettingsView from "./SettingsView";

type View =
  | "home"
  | "chat"
  | "predictive"
  | "settings";

type ThemeMode =
  | "light"
  | "dark"
  | "system";

type TextSize =
  | "small"
  | "medium"
  | "large"
  | "extra-large";

const navItems: {
  id: View;

  icon: typeof House;

  labelKey:
    | "nav.home"
    | "nav.chat"
    | "nav.predictive"
    | "nav.settings";
}[] = [
  {
    id: "home",
    icon: House,
    labelKey: "nav.home",
  },
  {
    id: "chat",
    icon: MessageCircle,
    labelKey: "nav.chat",
  },
  {
    id: "predictive",
    icon: BarChart3,
    labelKey: "nav.predictive",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    labelKey: "nav.settings",
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark">
        <Activity
          size={17}
          strokeWidth={2.7}
        />
      </div>

      <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C4C5C]">
        ISF
        <span className="text-[#7A6600]">
          .
        </span>
      </span>
    </div>
  );
}

function UserAvatar({
  small = false,
}: {
  small?: boolean;
}) {
  const { profile } = useAuth();

  const initials =
    profile?.full_name
      ?.slice(0, 2)
      .toUpperCase() ??
    "AM";

  return (
    <div
      className={`user-avatar ${
        small
          ? "user-avatar-sm"
          : ""
      }`}
    >
      <span>{initials}</span>
    </div>
  );
}

function Header({
  view,
  language,
  setView,
  onOpenAccessibility,
}: {
  view: View;

  language: Language;

  setView: (
    view: View,
  ) => void;

  onOpenAccessibility: () => void;
}) {
  const titleMap: Record<
    View,
    | "nav.home"
    | "nav.chat"
    | "nav.predictive"
    | "nav.settings"
  > = {
    home: "nav.home",
    chat: "nav.chat",
    predictive:
      "nav.predictive",
    settings: "nav.settings",
  };

  const title = t(
    language,
    titleMap[view],
  );

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-5 backdrop-blur-sm sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Return to dashboard"
          onClick={() =>
            setView("home")
          }
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#2C4C5C] transition hover:bg-[#2C4C5C]/[0.07]"
        >
          <House size={17} />
        </button>

        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="hidden lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-slate-700">
            Patient portal
          </p>

          <h1 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] text-[#2C4C5C]">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Open accessibility tools"
          onClick={
            onOpenAccessibility
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#172033] transition hover:border-[#6C8494] hover:bg-[#6C8494]/[0.05]"
        >
          <Accessibility size={18} />
        </button>

        <button
          type="button"
          aria-label="View notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#172033] transition hover:border-[#6C8494] hover:bg-[#6C8494]/[0.05]"
        >
          <Bell size={17} />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#F3E308]" />
        </button>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />

        <UserAvatar />
      </div>
    </header>
  );
}

function DashboardRail({
  open,
  pinned,
  view,
  language,
  onToggle,
  onReveal,
  onOpen,
  onClose,
}: {
  open: boolean;
  pinned: boolean;
  view: View;
  language: Language;

  onToggle: () => void;
  onReveal: () => void;
  onOpen: (
    view: View,
  ) => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`dashboard-rail ${
        open
          ? "dashboard-rail-open"
          : ""
      }`}
      onMouseEnter={onReveal}
      onMouseLeave={() => {
        if (!pinned) {
          onClose();
        }
      }}
    >
      <aside className="dashboard-rail-panel">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B8BFC1]/60">
              Workspace
            </p>

            <p className="mt-1 font-display text-[18px] font-semibold text-white">
              Dashboard
            </p>
          </div>

          <Activity
            size={18}
            className="text-[#B8BFC1]"
          />
        </div>

        <nav className="space-y-1">
          {navItems.map(
            ({
              id,
              icon: Icon,
              labelKey,
            }) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onOpen(id)
                }
                className={`dashboard-rail-item ${
                  view === id
                    ? "dashboard-rail-item-active"
                    : ""
                }`}
              >
                <Icon size={17} />

                <span>
                  {t(
                    language,
                    labelKey,
                  )}
                </span>

                {id === "chat" && (
                  <span className="dashboard-rail-badge">
                    2
                  </span>
                )}
              </button>
            ),
          )}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#B8BFC1]/15 bg-white p-4">
          <p className="text-[12px] font-semibold text-slate-900">
            Find your next step
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
            Move through each
            space when you are
            ready.
          </p>
        </div>
      </aside>

      <button
        type="button"
        onClick={onToggle}
        aria-label={
          open
            ? "Hide dashboard navigation"
            : "Show dashboard navigation"
        }
        className="dashboard-rail-trigger"
      >
        <ChevronRight
          size={13}
          className={
            open
              ? "rotate-180"
              : ""
          }
        />

        <span className="hidden sm:inline">
          {open ? "Close" : "Menu"}
        </span>
      </button>
    </div>
  );
}

function WelcomeView({
  language,
  setView,
}: {
  language: Language;
  setView: (
    view: View,
  ) => void;
}) {
  return (
    <div className="welcome-section page-enter flex min-h-[calc(100vh-72px)] items-center px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
      <div className="mx-auto grid w-full max-w-[1250px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)] lg:gap-20">
        <div className="max-w-[650px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F3E308]/35 bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2C4C5C]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F3E308]" />

            {t(
              language,
              "home.greeting" as never,
            )}
          </div>

          <h2 className="max-w-[620px] font-display text-[42px] font-semibold leading-[1.04] tracking-[-0.065em] text-[#2C4C5C] sm:text-[58px] lg:text-[72px]">
            {language ===
            "en"
              ? "Feel more in tune with your body."
              : "Elewa mwili wako kwa utulivu."}
          </h2>

          <p className="mt-6 max-w-[510px] text-[15px] leading-7 text-[#4F6370] sm:text-[17px]">
            {language ===
            "en"
              ? "ISF Tracker brings your hormone signals, care team and long-term insights into one calm, clear space."
              : "ISF Tracker huleta ishara zako za homoni, timu ya afya na maarifa ya muda mrefu pamoja katika nafasi moja tulivu na wazi."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setView("home")
              }
              className="group flex items-center gap-2 rounded-full bg-[#2C4C5C] px-5 py-3 text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(44,76,92,0.2)] transition hover:-translate-y-0.5"
            >
              {language ===
              "en"
                ? "Open dashboard"
                : "Fungua dashibodi"}

              <ArrowUpRight
                size={15}
                className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setView("chat")
              }
              className="flex items-center gap-2 rounded-full border border-[#B8BFC1] bg-white px-5 py-3 text-[12px] font-semibold text-[#2C4C5C] transition hover:-translate-y-0.5 hover:border-[#F3E308]/40"
            >
              {language ===
              "en"
                ? "Explore care spaces"
                : "Gundua huduma za afya"}

              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mt-10 grid max-w-[580px] gap-3 sm:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                label:
                  language ===
                  "en"
                    ? "Consent first"
                    : "Ridhaa kwanza",
              },
              {
                icon: Activity,
                label:
                  language ===
                  "en"
                    ? "Clarity"
                    : "Uwazi",
              },
              {
                icon: MessageCircle,
                label:
                  language ===
                  "en"
                    ? "Care connected"
                    : "Huduma iliyounganishwa",
              },
            ].map(
              ({
                icon: Icon,
                label,
              }) => (
                <div
                  key={label}
                  className="welcome-value rounded-2xl border border-[#B8BFC1]/70 bg-white p-4"
                >
                  <Icon
                    size={17}
                    className="text-[#F3E308]"
                  />

                  <p className="mt-5 text-[11px] font-semibold text-[#2C4C5C]">
                    {label}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="welcome-brand-art relative mx-auto w-full max-w-[430px]">
          <div className="welcome-orbit absolute -inset-5 rounded-[38px] border border-[#F3E308]/10" />

          <div className="relative overflow-hidden rounded-[30px] border border-[#B8BFC1]/80 bg-gradient-to-br from-[#15232A] to-[#080D10] p-6 text-white shadow-[0_28px_70px_rgba(44,76,92,0.2)] sm:p-8">
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="brand-mark brand-mark-inverse">
                  <Activity
                    size={17}
                    strokeWidth={2.7}
                  />
                </div>

                <span className="rounded-full border border-[#B8BFC1]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  ISF Tracker
                </span>
              </div>

              <div className="mt-20 max-w-[280px]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#F3E308]">
                  {language ===
                  "en"
                    ? "A better way to listen"
                    : "Njia bora ya kusikiliza"}
                </p>

                <p className="mt-3 font-display text-[28px] font-medium leading-[1.08] tracking-[-0.05em]">
                  {language ===
                  "en"
                    ? "Your care, in a clearer rhythm."
                    : "Huduma yako, kwa mdundo wazi."}
                </p>
              </div>

              <div className="mt-20 flex items-end justify-between">
                <div>
                  <p className="text-[12px] text-white">
                    Private by design
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-[12px] font-medium text-white">
                    <LockKeyhole
                      size={13}
                      className="text-[#B8BFC1]"
                    />

                    {language ===
                    "en"
                      ? "Your data stays yours"
                      : "Taarifa zako ni zako"}
                  </div>
                </div>

                <div className="h-14 w-14 rounded-full border border-[#F3E308]/40 bg-[#F3E308]/[0.14] p-2">
                  <div className="h-full w-full rounded-full border border-[#B8BFC1]/35" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistiveTools({
  language,
  open,
  onClose,
  textSize,
  setTextSize,
  highContrast,
  setHighContrast,
  reduceMotion,
  setReduceMotion,
}: {
  language: Language;
  open: boolean;
  onClose: () => void;
  textSize: TextSize;
  setTextSize: (
    size: TextSize,
  ) => void;
  highContrast: boolean;
  setHighContrast: (
    value: boolean,
  ) => void;
  reduceMotion: boolean;
  setReduceMotion: (
    value: boolean,
  ) => void;
}) {
  if (!open) {
    return null;
  }

  const sizes: {
    value: TextSize;
    label: string;
  }[] = [
    {
      value: "small",
      label: "A",
    },
    {
      value: "medium",
      label: "A+",
    },
    {
      value: "large",
      label: "A++",
    },
    {
      value: "extra-large",
      label: "A+++",
    },
  ];

  return (
    <div
      className="assistive-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistive-title"
    >
      <button
        type="button"
        aria-label={t(
          language,
          "settings.close",
        )}
        onClick={onClose}
        className="assistive-backdrop"
      />

      <aside className="assistive-panel">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2C4C5C]">
              {t(
                language,
                "settings.accessibility",
              )}
            </p>

            <h2
              id="assistive-title"
              className="mt-2 font-display text-2xl font-semibold text-[#172033]"
            >
              {t(
                language,
                "settings.assistiveTools",
              )}
            </h2>
          </div>

          <button
            type="button"
            aria-label={t(
              language,
              "settings.close",
            )}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#475569] hover:bg-[#F7FAFC]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-[#172033]">
            {t(
              language,
              "settings.textSize",
            )}
          </p>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {sizes.map(
              ({
                value,
                label,
              }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={
                    textSize ===
                    value
                  }
                  onClick={() =>
                    setTextSize(
                      value,
                    )
                  }
                  className={`text-size-option ${
                    textSize ===
                    value
                      ? "text-size-option-active"
                      : ""
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-semibold text-[#172033]">
            {t(
              language,
              "settings.contrast",
            )}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={
                !highContrast
              }
              onClick={() =>
                setHighContrast(
                  false,
                )
              }
              className={`assistive-choice ${
                !highContrast
                  ? "assistive-choice-active"
                  : ""
              }`}
            >
              {t(
                language,
                "settings.standard",
              )}
            </button>

            <button
              type="button"
              aria-pressed={
                highContrast
              }
              onClick={() =>
                setHighContrast(
                  true,
                )
              }
              className={`assistive-choice ${
                highContrast
                  ? "assistive-choice-active"
                  : ""
              }`}
            >
              {t(
                language,
                "settings.highContrast",
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={
            reduceMotion
          }
          onClick={() =>
            setReduceMotion(
              !reduceMotion,
            )
          }
          className={`assistive-toggle mt-7 flex w-full items-center justify-between border p-4 text-left ${
            reduceMotion
              ? "assistive-toggle-active"
              : ""
          }`}
        >
          <span>
            <span className="block text-sm font-semibold">
              {t(
                language,
                "settings.reduceMotion",
              )}
            </span>

            <span className="mt-1 block text-xs text-[#64748B]">
              {t(
                language,
                "settings.reduceMotionDesc",
              )}
            </span>
          </span>

          <span className="h-5 w-9 border border-current p-0.5">
            <span
              className={`block h-full w-1/2 bg-current transition-transform ${
                reduceMotion
                  ? "translate-x-full"
                  : ""
              }`}
            />
          </span>
        </button>
      </aside>
    </div>
  );
}

export default function Index() {
  const { profile } =
    useAuth();

  const [view, setView] =
    useState<View>("home");

  const [language, setLanguage] =
    useState<Language>("en");

  const [
    dashboardOpen,
    setDashboardOpen,
  ] = useState(false);

  const [
    dashboardPinned,
    setDashboardPinned,
  ] = useState(false);

  const [
    themeMode,
    setThemeMode,
  ] =
    useState<ThemeMode>(
      "light",
    );

  const [
    textSize,
    setTextSize,
  ] =
    useState<TextSize>(
      "medium",
    );

  const [
    highContrast,
    setHighContrast,
  ] =
    useState(false);

  const [
    reduceMotion,
    setReduceMotion,
  ] =
    useState(false);

  const [
    assistiveOpen,
    setAssistiveOpen,
  ] =
    useState(false);

  const navigateTo = (
    nextView: View,
  ) => {
    setView(nextView);

    const sectionId =
      nextView === "home"
        ? "dashboard"
        : nextView;

    window.setTimeout(
      () => {
        const section =
          document.getElementById(
            sectionId,
          );

        if (section) {
          section.scrollIntoView(
            {
              behavior:
                reduceMotion
                  ? "auto"
                  : "smooth",

              block: "start",
            },
          );
        }
      },
      0,
    );
  };

  useEffect(() => {
    if (
      profile?.language
    ) {
      setLanguage(
        profile.language as Language,
      );
    }
  }, [profile]);

  useEffect(() => {
    const savedTheme =
      readStoredThemeMode(
        localStorage,
      );

    if (savedTheme) {
      setThemeMode(
        savedTheme,
      );
    }
  }, []);

  useEffect(() => {
    const root =
      document.documentElement;

    const media =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      );

    const applyTheme =
      () => {
        applyResolvedTheme(
          root,
          resolveTheme(
            themeMode,
            media.matches,
          ),
        );
      };

    applyTheme();

    media.addEventListener(
      "change",
      applyTheme,
    );

    writeStoredThemeMode(
      localStorage,
      themeMode,
    );

    root.dataset.textSize =
      textSize;

    root.classList.toggle(
      "high-contrast",
      highContrast,
    );

    root.classList.toggle(
      "reduce-motion",
      reduceMotion,
    );

    return () => {
      media.removeEventListener(
        "change",
        applyTheme,
      );
    };
  }, [
    themeMode,
    textSize,
    highContrast,
    reduceMotion,
  ]);

  useEffect(() => {
    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach(
            (entry) => {
              if (
                !entry.isIntersecting
              ) {
                return;
              }

              const id =
                entry.target.id;

              if (
                id === "home" ||
                id === "dashboard"
              ) {
                setView("home");
              } else if (
                id === "chat" ||
                id ===
                  "predictive" ||
                id ===
                  "settings"
              ) {
                setView(
                  id as View,
                );
              }
            },
          );
        },
        {
          rootMargin:
            "-18% 0px -64% 0px",
        },
      );

    const sectionIds = [
      "home",
      "dashboard",
      "chat",
      "predictive",
      "settings",
    ];

    const sections =
      sectionIds
        .map((id) =>
          document.getElementById(
            id,
          ),
        )
        .filter(
          (
            section,
          ): section is HTMLElement =>
            Boolean(section),
        );

    sections.forEach(
      (section) =>
        observer.observe(
          section,
        ),
    );

    return () =>
      observer.disconnect();
  }, []);

  return (
    <div className="app-shell min-h-screen text-[#2C4C5C]">
      <DashboardRail
        open={
          dashboardOpen ||
          dashboardPinned
        }
        pinned={
          dashboardPinned
        }
        view={view}
        language={language}
        onToggle={() =>
          setDashboardPinned(
            !dashboardPinned,
          )
        }
        onReveal={() =>
          setDashboardOpen(
            true,
          )
        }
        onOpen={(
          nextView,
        ) => {
          navigateTo(
            nextView,
          );

          setDashboardPinned(
            false,
          );
        }}
        onClose={() =>
          setDashboardOpen(
            false,
          )
        }
      />

      <main className="min-h-screen">
        <Header
          view={view}
          language={language}
          setView={navigateTo}
          onOpenAccessibility={() =>
            setAssistiveOpen(
              true,
            )
          }
        />

        <section
          id="home"
          className="scroll-mt-20"
        >
          <WelcomeView
            language={
              language
            }
            setView={
              navigateTo
            }
          />
        </section>

        <section
          id="dashboard"
          className="scroll-mt-20"
        >
          <HomeView
            language={
              language
            }
            setView={
              navigateTo
            }
          />
        </section>

        <section
          id="chat"
          className="scroll-mt-20 border-t border-slate-200 bg-white"
        >
          <ChatView
            language={
              language
            }
          />
        </section>

        <section
          id="predictive"
          className="scroll-mt-20 border-t border-slate-200 bg-white"
        >
          <PredictiveView />
        </section>

        <section
          id="settings"
          className="scroll-mt-20 border-t border-slate-200 bg-white"
        >
          <SettingsView
            language={
              language
            }
            setLanguage={
              setLanguage
            }
            themeMode={
              themeMode
            }
            setThemeMode={
              setThemeMode
            }
            onOpenAccessibility={() =>
              setAssistiveOpen(
                true,
              )
            }
          />
        </section>
      </main>

      <AssistiveTools
        language={language}
        open={
          assistiveOpen
        }
        onClose={() =>
          setAssistiveOpen(
            false,
          )
        }
        textSize={
          textSize
        }
        setTextSize={
          setTextSize
        }
        highContrast={
          highContrast
        }
        setHighContrast={
          setHighContrast
        }
        reduceMotion={
          reduceMotion
        }
        setReduceMotion={
          setReduceMotion
        }
      />
    </div>
  );
}
