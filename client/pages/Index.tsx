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
  onReturnToHome,
}: {
  view: View;

  language: Language;

  setView: (
    view: View,
  ) => void;

  onOpenAccessibility: () => void;
  onReturnToHome?: () => void;
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
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] px-5 py-5 backdrop-blur-sm sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Return to overview"
          onClick={() => {
            if (onReturnToHome) onReturnToHome();
            else setView("home");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#1C2F38] text-[#2C4C5C] dark:text-[#E8F2F6] transition hover:bg-[#2C4C5C]/[0.07] dark:hover:bg-[#243C47]"
        >
          <House size={17} />
        </button>

        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="hidden lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-slate-700 dark:text-[#A0B4BE]">
            Patient portal
          </p>

          <h1 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] text-[#2C4C5C] dark:text-[#E8F2F6]">
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
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#1C2F38] text-[#172033] dark:text-[#E8F2F6] transition hover:border-[#6C8494] hover:bg-[#6C8494]/[0.05]"
        >
          <Accessibility size={18} />
        </button>

        <button
          type="button"
          aria-label="View notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#1C2F38] text-[#172033] dark:text-[#E8F2F6] transition hover:border-[#6C8494] hover:bg-[#6C8494]/[0.05]"
        >
          <Bell size={17} />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#F3E308]" />
        </button>

        <div className="hidden h-6 w-px bg-slate-200 dark:bg-[#243C47] sm:block" />

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

interface IndexProps {
  onReturnToHome?: () => void;
}

export default function Index({ onReturnToHome }: IndexProps = {}) {
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
        ? "home"
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

              if (id === "home") {
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
          onReturnToHome={onReturnToHome}
        />

        <section
          id="home"
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
          className="scroll-mt-20 border-t border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#0E181D]"
        >
          <ChatView
            language={
              language
            }
          />
        </section>

        <section
          id="predictive"
          className="scroll-mt-20 border-t border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#0E181D]"
        >
          <PredictiveView />
        </section>

        <section
          id="settings"
          className="scroll-mt-20 border-t border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#0E181D]"
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
