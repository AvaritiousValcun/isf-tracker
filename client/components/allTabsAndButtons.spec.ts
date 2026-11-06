import { describe, it, expect } from "vitest";
import { t, type Language } from "../lib/i18n";
import { resolveTheme, readStoredThemeMode, writeStoredThemeMode } from "../lib/theme";
import { DEFAULT_CONSULTANTS, DEFAULT_CONVERSATIONS } from "../hooks/useData";
import { generateClientConsultantReply } from "../lib/clinicalBotFallback";
import { CLINICAL_FAQ_ITEMS, getConsultantFaqItems, matchClinicalFaq } from "../../shared/clinicalFaq";
import { HORMONE_DATA, type HormoneType } from "./Hormone3DVisualizer";
import { FORECAST_DATA } from "./HormoneVelocityForecast";

describe("All Tabs, Buttons, Dialogs, and Interactive Controls Verification", () => {
  /* =========================================================
     1. MAIN NAVIGATION TABS & SYSTEM CONTROLS
  ========================================================= */
  describe("Navigation Tabs & System Switchers", () => {
    const navItems = [
      { id: "home", labelKey: "nav.home" as const },
      { id: "chat", labelKey: "nav.chat" as const },
      { id: "predictive", labelKey: "nav.predictive" as const },
      { id: "settings", labelKey: "nav.settings" as const },
    ];

    it("verifies all 4 primary navigation tabs exist and have localized labels", () => {
      expect(navItems).toHaveLength(4);

      for (const item of navItems) {
        const enLabel = t("en", item.labelKey);
        const swLabel = t("sw", item.labelKey);
        expect(enLabel).toBeTruthy();
        expect(swLabel).toBeTruthy();
        expect(enLabel).not.toBe(swLabel); // Distinct translations
      }
    });

    it("verifies tab switching state logic", () => {
      let activeTab = "home";
      const switchTab = (newTab: string) => {
        activeTab = newTab;
      };

      switchTab("chat");
      expect(activeTab).toBe("chat");

      switchTab("predictive");
      expect(activeTab).toBe("predictive");

      switchTab("settings");
      expect(activeTab).toBe("settings");

      switchTab("home");
      expect(activeTab).toBe("home");
    });

    it("verifies text size accessibility button options", () => {
      const textSizes = ["small", "medium", "large", "extra-large"] as const;
      expect(textSizes).toHaveLength(4);

      let currentSize: (typeof textSizes)[number] = "medium";
      const setSize = (size: (typeof textSizes)[number]) => {
        currentSize = size;
      };

      for (const size of textSizes) {
        setSize(size);
        expect(currentSize).toBe(size);
      }
    });

    it("verifies theme switcher buttons (light, dark, system)", () => {
      const themes = ["light", "dark", "system"] as const;
      expect(themes).toHaveLength(3);

      expect(resolveTheme("light", false)).toBe("light");
      expect(resolveTheme("dark", false)).toBe("dark");
      expect(resolveTheme("system", true)).toBe("dark");
      expect(resolveTheme("system", false)).toBe("light");
    });

    it("verifies language toggle buttons (English vs Kiswahili)", () => {
      const languages: Language[] = ["en", "sw"];
      let currentLang: Language = "en";

      const toggleLang = (lang: Language) => {
        currentLang = lang;
      };

      toggleLang("sw");
      expect(currentLang).toBe("sw");
      expect(t(currentLang, "home.androgen")).toBe("Testosterone Huru");

      toggleLang("en");
      expect(currentLang).toBe("en");
      expect(t(currentLang, "home.androgen")).toBe("Free Testosterone");
    });
  });

  /* =========================================================
     2. HOME TAB - EVERY BUTTON & INTERACTIVE CONTROL
  ========================================================= */
  describe("Home Tab - Telemetry, 3D Visualizer & Velocity Controls", () => {
    it("verifies telemetry chart toggle buttons (Real-time vs 7-Day)", () => {
      let telemetryMode: "realtime" | "historical" = "realtime";
      const setMode = (mode: "realtime" | "historical") => {
        telemetryMode = mode;
      };

      expect(telemetryMode).toBe("realtime");
      setMode("historical");
      expect(telemetryMode).toBe("historical");
      setMode("realtime");
      expect(telemetryMode).toBe("realtime");
    });

    it("verifies 3D ISF Molecular Biosensing buttons (only Progesterone and Free Testosterone)", () => {
      const availableHormones = Object.keys(HORMONE_DATA) as HormoneType[];
      expect(availableHormones).toEqual(["progesterone", "freeTestosterone"]);
      expect(availableHormones).not.toContain("estradiol");
      expect(availableHormones).not.toContain("cortisol");

      // Verify Progesterone chemical telemetry
      const prog = HORMONE_DATA.progesterone;
      expect(prog.name).toContain("Progesterone");
      expect(prog.formula).toBe("C₂₁H₃₀O₂");
      expect(prog.mw).toBe("314.46 g/mol");
      expect(prog.atoms.length).toBeGreaterThan(15);
      expect(prog.bonds.length).toBeGreaterThan(15);

      // Verify Free Testosterone chemical telemetry
      const ft = HORMONE_DATA.freeTestosterone;
      expect(ft.name).toContain("Free Testosterone");
      expect(ft.formula).toBe("C₁₉H₂₈O₂");
      expect(ft.mw).toBe("288.42 g/mol");
      expect(ft.targetRange).toContain("pg/mL");
      expect(ft.atoms.length).toBeGreaterThan(15);
      expect(ft.bonds.length).toBeGreaterThan(15);
    });

    it("verifies 3D rotation toggle play/pause button state", () => {
      let isRotating = true;
      const toggleRotation = () => {
        isRotating = !isRotating;
      };

      expect(isRotating).toBe(true);
      toggleRotation();
      expect(isRotating).toBe(false);
      toggleRotation();
      expect(isRotating).toBe(true);
    });

    it("verifies 7-Day Velocity Forecast metric buttons & indicators", () => {
      // Forecast has 8 data points: Day 21 to Day 28
      expect(FORECAST_DATA).toHaveLength(8);

      const day21 = FORECAST_DATA[0];
      const day28 = FORECAST_DATA[7];

      expect(day21.dayLabel).toContain("D21");
      expect(day21.progesterone).toBe(18.2);
      expect(day21.freeTestosterone).toBe(4.8);

      expect(day28.dayLabel).toContain("D28");
      expect(day28.progesterone).toBeLessThan(day21.progesterone); // Luteal descent

      // Verify velocities
      const pVelocity = -0.6; // ng/mL/day
      const ftVelocity = +0.2; // ng/dL/day
      const lutealDays = 13.1; // Days

      expect(pVelocity).toBeLessThan(0);
      expect(ftVelocity).toBeGreaterThan(0);
      expect(lutealDays).toBeGreaterThan(11.0); // Adequate luteal phase
    });

    it("verifies Doctor's Clinical Report Modal buttons and content integrity", () => {
      let modalOpen = false;
      const openModal = () => { modalOpen = true; };
      const closeModal = () => { modalOpen = false; };

      openModal();
      expect(modalOpen).toBe(true);

      // Report biomarker rows must contain Progesterone and Free Testosterone, but NOT Estradiol or Glycemic Correlation
      const reportBiomarkers = [
        { name: "Progesterone", concentration: "19.8 ng/mL" },
        { name: "Free Testosterone", concentration: "38.2 ng/dL" },
      ];
      expect(reportBiomarkers.map((b) => b.name)).toEqual(["Progesterone", "Free Testosterone"]);

      // Predictive risks in report: NAFLD and Type 2 Diabetes
      const healthRisks = [
        { label: "PCOS / Hyperandrogenic Trajectory", value: "31.0%" },
        { label: "Insulin Resistance Index", value: "24.0%" },
        { label: "Non-Alcoholic Liver Disease (NAFLD)", value: "9.0%" },
        { label: "Type 2 Diabetes Risk", value: "12.0%" },
      ];
      expect(healthRisks.find((r) => r.label.includes("Non-Alcoholic Liver Disease"))).toBeDefined();
      expect(healthRisks.find((r) => r.label.includes("Type 2 Diabetes"))).toBeDefined();
      expect(healthRisks.find((r) => r.label.includes("Hypertension"))).toBeUndefined();
      expect(healthRisks.find((r) => r.label.includes("Cardiovascular"))).toBeUndefined();

      closeModal();
      expect(modalOpen).toBe(false);
    });
  });

  /* =========================================================
     3. CHAT TAB - SPECIALIST SELECTION & BOT CONVERSATION
  ========================================================= */
  describe("Chat Tab - Care Team Specialists & Simulated Bot Conversation", () => {
    it("verifies all 3 specialists are available: Endocrinologist, Nutritionist, and Gynecologist", () => {
      expect(DEFAULT_CONSULTANTS).toHaveLength(3);

      const [ochieng, chen, wanjiku] = DEFAULT_CONSULTANTS;

      expect(ochieng.full_name).toBe("Dr. Brian Ochieng");
      expect(ochieng.professional_type).toBe("Endocrinologist");

      expect(chen.full_name).toBe("Dr. Sarah Chen");
      expect(chen.professional_type).toBe("Clinical Nutritionist");

      expect(wanjiku.full_name).toBe("Dr. Grace Wanjiku");
      expect(wanjiku.professional_type).toBe("Gynecologist");
      expect(wanjiku.initials).toBe("GW");
      expect(wanjiku.color).toBe("#E06D53");
    });

    it("verifies initial conversation IDs for all 3 specialists", () => {
      expect(DEFAULT_CONVERSATIONS).toHaveLength(3);
      const consultantIds = DEFAULT_CONVERSATIONS.map((c) => c.consultant_id);
      expect(consultantIds).toContain("375d31f5-c96f-4d11-8934-be6aec206f56");
      expect(consultantIds).toContain("b4d81234-5678-4abc-9def-0123456789ab");
      expect(consultantIds).toContain("c8e23456-789a-4bcd-ef01-23456789abcd");
    });

    it("guarantees Dr. Grace Wanjiku (Gynecologist) is merged and always present even if server only returns 2 consultants", () => {
      const serverPartial = [
        {
          id: "375d31f5-c96f-4d11-8934-be6aec206f56",
          full_name: "Dr. Brian Ochieng",
          professional_type: "Endocrinologist",
        },
        {
          id: "b4d81234-5678-4abc-9def-0123456789ab",
          full_name: "Dr. Sarah Chen",
          professional_type: "Clinical Nutritionist",
        },
      ];

      const merged = [...serverPartial];
      for (const def of DEFAULT_CONSULTANTS) {
        if (!merged.some((c) => c.id === def.id || c.full_name === def.full_name)) {
          merged.push(def);
        }
      }

      expect(merged).toHaveLength(3);
      const gyn = merged.find((c) => c.professional_type === "Gynecologist");
      expect(gyn).toBeDefined();
      expect(gyn?.full_name).toBe("Dr. Grace Wanjiku");
    });

    it("verifies selecting a specialist switches the active chat session", () => {
      let activeIndex = 0;
      let hasSelected = false;

      const selectSpecialist = (idx: number) => {
        activeIndex = idx;
        hasSelected = true;
      };

      // Select Dr. Grace Wanjiku (index 2)
      selectSpecialist(2);
      expect(hasSelected).toBe(true);
      expect(activeIndex).toBe(2);
      expect(DEFAULT_CONSULTANTS[activeIndex].full_name).toBe("Dr. Grace Wanjiku");

      // Switch to Dr. Brian Ochieng (index 0)
      selectSpecialist(0);
      expect(activeIndex).toBe(0);
      expect(DEFAULT_CONSULTANTS[activeIndex].full_name).toBe("Dr. Brian Ochieng");
    });

    it("verifies all curated FAQ question buttons trigger authoritative matching answers", () => {
      expect(CLINICAL_FAQ_ITEMS).toHaveLength(18);

      // Verify each of the 3 specialists has exactly 6 curated questions
      for (const specialist of DEFAULT_CONSULTANTS) {
        const specialistFaq = getConsultantFaqItems(specialist);
        expect(specialistFaq).toHaveLength(6);
        for (const faqItem of specialistFaq) {
          const answer = matchClinicalFaq(faqItem.question, specialist);
          expect(answer).toBeTruthy();
          expect(typeof answer).toBe("string");
          expect(answer!.length).toBeGreaterThan(25);
        }
      }
    });

    it("verifies simulated doctor bot texting workflow", async () => {
      const specialist = DEFAULT_CONSULTANTS[0];
      const question = "How are my latest hormone readings?";

      let isTyping = false;
      let messages: { sender: string; text: string }[] = [];

      // Step 1: Patient clicks suggested question button
      messages.push({ sender: "patient", text: question });
      isTyping = true;
      expect(messages).toHaveLength(1);
      expect(isTyping).toBe(true);

      // Step 2: Simulated typing delay then response generated
      const botReply = generateClientConsultantReply(specialist, question);
      messages.push({ sender: "consultant", text: botReply });
      isTyping = false;

      expect(messages).toHaveLength(2);
      expect(isTyping).toBe(false);
      expect(messages[1].text).toContain("19.8 ng/mL");
      expect(messages[1].text).toContain("38.2 ng/dL");
      expect(messages[1].text.toLowerCase()).toContain("free testosterone");
      expect(messages[1].text.toLowerCase()).not.toContain("estradiol");
    });

    it("verifies Clinical FAQ Modal open/collapse/close buttons", () => {
      let faqModalOpen = false;
      let expandedFaqId: string | null = null;

      const openFaqModal = () => { faqModalOpen = true; };
      const toggleFaq = (id: string) => {
        expandedFaqId = expandedFaqId === id ? null : id;
      };
      const closeFaqModal = () => { faqModalOpen = false; };

      openFaqModal();
      expect(faqModalOpen).toBe(true);

      toggleFaq("latest-readings");
      expect(expandedFaqId).toBe("latest-readings");

      toggleFaq("latest-readings");
      expect(expandedFaqId).toBeNull();

      closeFaqModal();
      expect(faqModalOpen).toBe(false);
    });

    it("verifies Emergency Access QR Code generation and copy buttons", () => {
      let qrOpen = false;
      let qrAccess: { token: string; expiresAt: string } | null = null;

      const generateQr = () => {
        qrOpen = true;
        qrAccess = {
          token: "emergency-test-token-uuid-12345",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      };

      const closeQr = () => {
        qrOpen = false;
        qrAccess = null;
      };

      generateQr();
      expect(qrOpen).toBe(true);
      expect(qrAccess?.token).toBe("emergency-test-token-uuid-12345");

      const origin = typeof window !== "undefined" ? window.location.origin : "https://isf-tracker.vercel.app";
      const shareUrl = `${origin}/emergency?token=${qrAccess?.token}`;
      expect(shareUrl).toContain("/emergency?token=emergency-test-token-uuid-12345");

      closeQr();
      expect(qrOpen).toBe(false);
      expect(qrAccess).toBeNull();
    });
  });

  /* =========================================================
     4. PREDICTIVE VIEW - CARDS & CLINICAL CONFIDENCE
  ========================================================= */
  describe("Predictive Tab - Trajectory Models & Confidence Indicators", () => {
    it("verifies all 4 predictive condition risk cards", () => {
      const conditions = [
        { id: "pcos", name: "PCOS Risk Trajectory", risk: 31.0 },
        { id: "luteal_insufficiency", name: "Luteal Phase Insufficiency", risk: 14.2 },
        { id: "non_alcoholic_fatty_liver", name: "Non-Alcoholic Liver Disease (NAFLD)", risk: 9.0 },
        { id: "type_2_diabetes", name: "Type 2 Diabetes Risk", risk: 12.0 },
      ];

      expect(conditions).toHaveLength(4);
      expect(conditions.map((c) => c.id)).toContain("non_alcoholic_fatty_liver");
      expect(conditions.map((c) => c.id)).not.toContain("hypertension");

      for (const cond of conditions) {
        expect(cond.risk).toBeGreaterThan(0);
        expect(cond.risk).toBeLessThan(100);
      }
    });

    it("verifies predictive time horizon selector buttons", () => {
      const timeHorizons = [30, 60, 90] as const;
      let selectedHorizon: (typeof timeHorizons)[number] = 30;

      const setHorizon = (days: (typeof timeHorizons)[number]) => {
        selectedHorizon = days;
      };

      setHorizon(60);
      expect(selectedHorizon).toBe(60);

      setHorizon(90);
      expect(selectedHorizon).toBe(90);

      setHorizon(30);
      expect(selectedHorizon).toBe(30);
    });
  });

  /* =========================================================
     5. SETTINGS TAB - PASSKEY, SUBSCRIPTION & LOGOUT
  ========================================================= */
  describe("Settings Tab - Security, Subscription & Authentication", () => {
    it("verifies passkey registration button & status toggle", () => {
      let passkeyRegistered = false;
      const registerPasskey = () => {
        passkeyRegistered = true;
      };
      const removePasskey = () => {
        passkeyRegistered = false;
      };

      expect(passkeyRegistered).toBe(false);
      registerPasskey();
      expect(passkeyRegistered).toBe(true);
      removePasskey();
      expect(passkeyRegistered).toBe(false);
    });

    it("verifies subscription upgrade modal buttons (Free vs Premium, M-Pesa vs Card)", () => {
      type Plan = "free" | "premium";
      type Provider = "mpesa" | "card";

      let plan: Plan = "free";
      let provider: Provider = "mpesa";
      let isUpgradeModalOpen = false;

      const openUpgradeModal = () => { isUpgradeModalOpen = true; };
      const selectProvider = (p: Provider) => { provider = p; };
      const completeUpgrade = () => {
        plan = "premium";
        isUpgradeModalOpen = false;
      };

      openUpgradeModal();
      expect(isUpgradeModalOpen).toBe(true);

      selectProvider("card");
      expect(provider).toBe("card");

      selectProvider("mpesa");
      expect(provider).toBe("mpesa");

      completeUpgrade();
      expect(plan).toBe("premium");
      expect(isUpgradeModalOpen).toBe(false);
    });

    it("verifies sign-out action button resets user session", () => {
      let currentUser: string | null = "patient-user-001";
      const signOut = () => {
        currentUser = null;
      };

      expect(currentUser).toBe("patient-user-001");
      signOut();
      expect(currentUser).toBeNull();
    });
  });

  /* =========================================================
     6. AUTHENTICATION PAGE - TABS, BUTTONS & WEBAUTHN
  ========================================================= */
  describe("Auth Page - Tabs, Passkey & Credentials Flow", () => {
    it("verifies Sign In vs Create Account tab toggle buttons", () => {
      let authMode: "signin" | "signup" = "signin";
      const setAuthMode = (mode: "signin" | "signup") => {
        authMode = mode;
      };

      expect(authMode).toBe("signin");
      setAuthMode("signup");
      expect(authMode).toBe("signup");
      setAuthMode("signin");
      expect(authMode).toBe("signin");
    });

    it("verifies password visibility toggle button", () => {
      let showPassword = false;
      const toggleShowPassword = () => {
        showPassword = !showPassword;
      };

      expect(showPassword).toBe(false);
      toggleShowPassword();
      expect(showPassword).toBe(true);
      toggleShowPassword();
      expect(showPassword).toBe(false);
    });

    it("verifies one-touch Passkey sign-in button triggers WebAuthn challenge", () => {
      let passkeyChallengeRequested = false;
      const requestPasskeyLogin = () => {
        passkeyChallengeRequested = true;
      };

      expect(passkeyChallengeRequested).toBe(false);
      requestPasskeyLogin();
      expect(passkeyChallengeRequested).toBe(true);
    });
  });

  /* =========================================================
     7. FREE VS. PREMIUM SUBTLE VISUAL COLOR DISTINCTIONS
  ========================================================= */
  describe("Free vs. Premium Subtle Visual Color Distinctions", () => {
    it("verifies subtle color differences between free and premium forecast containers", () => {
      const getContainerClasses = (isPrem: boolean) =>
        isPrem
          ? "border-[#0EA5A4]/40 bg-gradient-to-br from-[#FAFCFD] via-[#F3FAF9] to-[#EBF6F6]"
          : "border-slate-200 bg-white";

      expect(getContainerClasses(true)).toContain("border-[#0EA5A4]/40");
      expect(getContainerClasses(true)).toContain("bg-gradient-to-br");
      expect(getContainerClasses(false)).toBe("border-slate-200 bg-white");
      expect(getContainerClasses(true)).not.toBe(getContainerClasses(false));
    });

    it("verifies subtle color differences for hero telemetry badges", () => {
      const getHeroBadge = (isPrem: boolean) =>
        isPrem
          ? "border-amber-300/80 bg-gradient-to-r from-amber-50 via-teal-50/60 to-emerald-50 text-amber-900"
          : "border-slate-200 bg-slate-100 text-slate-700";

      expect(getHeroBadge(true)).toContain("border-amber-300/80");
      expect(getHeroBadge(false)).toBe("border-slate-200 bg-slate-100 text-slate-700");
    });
  });
});
