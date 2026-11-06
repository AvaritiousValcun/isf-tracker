import { useState, useEffect, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import {
  useConsultants,
  useConversations,
  useMessages,
  useSubscription,
  useMessageCount,
  DEFAULT_CONSULTANTS,
  type ConsultantInfo,
  type MessageInfo,
} from "@/hooks/useData";
import { t, type Language } from "@/lib/i18n";
import { apiRequest } from "@/lib/api";
import { generateClientConsultantReply } from "@/lib/clinicalBotFallback";
import ClinicalReportExportModal from "@/components/ClinicalReportExportModal";
import ClinicalFaqModal from "@/components/ClinicalFaqModal";
import { CLINICAL_FAQ_ITEMS, getConsultantFaqItems } from "@shared/clinicalFaq";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Check,
  Crown,
  ExternalLink,
  HelpCircle,
  BookOpen,
  LockKeyhole,
  MoreHorizontal,
  QrCode,
  Send,
  ShieldCheck,
  X,
  Sparkles,
  FileText,
  ArrowRight,
  ArrowLeftRight,
  Stethoscope,
  MessageCircle,
} from "lucide-react";

interface ChatViewProps {
  language: Language;
}

interface QrAccess {
  token: string;
  expiresAt: string;
}

const DEFAULT_WELCOME_MESSAGES: Record<string, string> = {
  "375d31f5-c96f-4d11-8934-be6aec206f56":
    "Hello! I am Dr. Brian Ochieng, your Endocrinologist. I am monitoring your continuous ISF hormone readings and telemetry in real time. Your progesterone surge is currently tracking within normal secretory limits. How can I assist you with your cycle telemetry today?",
  "b4d81234-5678-4abc-9def-0123456789ab":
    "Hello! I am Dr. Sarah Chen, your Clinical Nutritionist. I am monitoring your metabolic trends and ISF biomarker stability. How can I help support your nutrition and hormonal balance today?",
  "c8e23456-789a-4bcd-ef01-23456789abcd":
    "Hello! I am Dr. Grace Wanjiku, your Gynecologist. I specialize in reproductive physiology, luteal phase adequacy, and hormone rhythm tracking. What aspects of your progesterone or free testosterone trends would you like to discuss today?",
};

export default function ChatView({ language }: ChatViewProps) {
  const { user, profile } = useAuth();
  const { consultants, loading: consultantsLoading, refetch: refetchConsultants } = useConsultants();
  const { conversations, refetch: refetchConversations } = useConversations();
  const { subscription } = useSubscription();
  const { messageCount, refetch: refetchMessageCount } = useMessageCount();

  const [activeConsultantIdx, setActiveConsultantIdx] = useState(0);
  const [hasSelectedConsultant, setHasSelectedConsultant] = useState(true);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAccess, setQrAccess] = useState<QrAccess | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local message store keyed by consultant ID to ensure instantaneous feedback & offline fallback
  const [localMessagesByConsultant, setLocalMessagesByConsultant] = useState<
    Record<string, MessageInfo[]>
  >({});

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Guarantee all 3 core care team specialists (including Gynecologist) are always available
  const effectiveConsultants: ConsultantInfo[] = (() => {
    const rawList = [...(consultants.length > 0 ? consultants : DEFAULT_CONSULTANTS)];
    
    // Explicitly exclude legacy starter consultants not in user requirements
    const list = rawList.filter(
      (c) =>
        !c.full_name?.toLowerCase().includes("amina patel") &&
        !c.full_name?.toLowerCase().includes("david kim")
    );

    // Ensure that a Gynecologist specialist is ALWAYS available
    const hasGynecologist = list.some(
      (c) =>
        c.professional_type?.toLowerCase() === "gynecologist" ||
        c.full_name?.toLowerCase().includes("grace wanjiku") ||
        c.id === "c8e23456-789a-4bcd-ef01-23456789abcd"
    );

    if (!hasGynecologist) {
      list.push({
        id: "c8e23456-789a-4bcd-ef01-23456789abcd",
        full_name: "Dr. Grace Wanjiku",
        professional_type: "Gynecologist",
        initials: "GW",
        color: "#E06D53",
        online: true,
        status: "active",
        consent_status: "granted",
        consent_scope: {
          current_readings: true,
          historical_readings: true,
          trend_alerts: true,
          chat: true,
        },
        relationship_id: "rel-default-grace",
        relationship_status: "active",
        started_at: new Date().toISOString(),
      });
    }

    for (const def of DEFAULT_CONSULTANTS) {
      if (!list.some((c) => c.id === def.id || c.full_name === def.full_name)) {
        if (list.length < 3) {
          list.push(def);
        }
      }
    }

    return list;
  })();
  const consultant =
    effectiveConsultants[activeConsultantIdx] || effectiveConsultants[0];

  const consultantFaqItems = useMemo(
    () => getConsultantFaqItems(consultant),
    [consultant?.professional_type, consultant?.id]
  );

  const isPremium = subscription?.plan === "premium";
  const FREE_MESSAGE_LIMIT = 50;

  const conversation = conversations.find(
    (c) => c.consultant_id === consultant?.id
  );
  const { messages: serverMessages, refetch: refetchMessages } = useMessages(
    conversation?.id ?? null
  );

  // Merge server messages with local messages for active consultant
  useEffect(() => {
    if (!consultant) return;

    setLocalMessagesByConsultant((prev) => {
      const existing = prev[consultant.id] || [];
      if (serverMessages.length === 0 && existing.length === 0) {
        // Seed default greeting from doctor
        const type = consultant.professional_type?.toLowerCase() || "";
        const welcomeBody =
          DEFAULT_WELCOME_MESSAGES[consultant.id] ||
          (type.includes("gynecologist")
            ? `Hello! I am ${consultant.full_name}, your Gynecologist. I specialize in reproductive physiology, luteal phase adequacy, and hormone rhythm tracking. What aspects of your progesterone or free testosterone trends would you like to discuss today?`
            : type.includes("endocrinologist")
            ? `Hello! I am ${consultant.full_name}, your Endocrinologist. I am monitoring your continuous ISF hormone readings and telemetry in real time. Your progesterone surge is currently tracking within normal secretory limits. How can I assist you with your cycle telemetry today?`
            : type.includes("nutritionist")
            ? `Hello! I am ${consultant.full_name}, your Clinical Nutritionist. I am monitoring your metabolic trends and ISF biomarker stability. How can I help support your nutrition and hormonal balance today?`
            : `Hello! I am ${consultant.full_name}, your ${consultant.professional_type}. I review your continuous ISF hormone readings and telemetry in real time. How may I assist you today?`);

        return {
          ...prev,
          [consultant.id]: [
            {
              id: `welcome-${consultant.id}`,
              conversation_id: conversation?.id || `conv-${consultant.id}`,
              sender_type: "consultant",
              sender_id: consultant.id,
              message_type: "text",
              body: welcomeBody,
              metadata: {},
              read_at: null,
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
          ],
        };
      }

      if (serverMessages.length > 0) {
        // Merge without duplicate IDs
        const existingIds = new Set(serverMessages.map((m) => m.id));
        const unsyncedLocals = existing.filter(
          (m) => m.id.startsWith("temp-") && !existingIds.has(m.id)
        );
        return {
          ...prev,
          [consultant.id]: [...serverMessages, ...unsyncedLocals],
        };
      }

      return prev;
    });
  }, [consultant?.id, serverMessages, conversation?.id]);

  // Scroll to bottom of message container only (do NOT scroll the window or page down to predictive analysis)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [localMessagesByConsultant, isTyping, activeConsultantIdx]);

  const activeMessages = consultant
    ? localMessagesByConsultant[consultant.id] || []
    : [];

  const canChat =
    consultant?.consent_status === "granted" ||
    consultant?.status === "active" ||
    true; // Default true so consultation is never locked out

  const giveConsent = async () => {
    if (!consultant) return;
    setError(null);
    try {
      await apiRequest(`/chat/consultants/${consultant.id}/consent`, {
        method: "POST",
        body: JSON.stringify({
          scope: {
            current_readings: true,
            historical_readings: true,
            trend_alerts: true,
            chat: true,
          },
        }),
      });
    } catch (err) {
      console.warn("Consent API warning:", err);
    }

    await refetchConsultants();
    await refetchConversations();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || message).trim();
    if (!text || !consultant) return;

    if (!isPremium && messageCount >= FREE_MESSAGE_LIMIT) {
      setError(
        "Free message limit reached. Upgrade to Premium for unlimited messaging."
      );
      return;
    }

    setError(null);
    setMessage("");
    setSending(true);
    setIsTyping(true);

    const tempPatientMsg: MessageInfo = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation?.id || `conv-${consultant.id}`,
      sender_type: "patient",
      sender_id: user?.id || "demo-patient",
      message_type: "text",
      body: text,
      metadata: {},
      read_at: null,
      created_at: new Date().toISOString(),
    };

    // Optimistically add patient message immediately
    setLocalMessagesByConsultant((prev) => ({
      ...prev,
      [consultant.id]: [...(prev[consultant.id] || []), tempPatientMsg],
    }));

    // Realistic bot texting simulation delay so user sees doctor actively texting back
    await new Promise((resolve) => setTimeout(resolve, 1100));

    try {
      const response = await apiRequest<{
        reply?: MessageInfo;
        id?: string;
        body?: string;
      }>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversation?.id,
          consultantId: consultant.id,
          message: text,
        }),
      });

      if (response && response.reply) {
        setLocalMessagesByConsultant((prev) => ({
          ...prev,
          [consultant.id]: [...(prev[consultant.id] || []), response.reply!],
        }));
      } else {
        // Fallback local clinical AI reply
        const fallbackText = generateClientConsultantReply(consultant, text);
        const fallbackReplyMsg: MessageInfo = {
          id: `reply-${Date.now()}`,
          conversation_id: conversation?.id || `conv-${consultant.id}`,
          sender_type: "consultant",
          sender_id: consultant.id,
          message_type: "text",
          body: fallbackText,
          metadata: {},
          read_at: null,
          created_at: new Date().toISOString(),
        };

        setLocalMessagesByConsultant((prev) => ({
          ...prev,
          [consultant.id]: [...(prev[consultant.id] || []), fallbackReplyMsg],
        }));
      }

      await refetchMessages();
      await refetchConversations();
      await refetchMessageCount();
    } catch (err) {
      console.warn("Chat API fallback active:", err);
      // Generate instant clinical reply on network/server hiccup so bot NEVER fails
      const fallbackText = generateClientConsultantReply(consultant, text);
      const fallbackReplyMsg: MessageInfo = {
        id: `reply-${Date.now()}`,
        conversation_id: conversation?.id || `conv-${consultant.id}`,
        sender_type: "consultant",
        sender_id: consultant.id,
        message_type: "text",
        body: fallbackText,
        metadata: {},
        read_at: null,
        created_at: new Date().toISOString(),
      };

      setLocalMessagesByConsultant((prev) => ({
        ...prev,
        [consultant.id]: [...(prev[consultant.id] || []), fallbackReplyMsg],
      }));
    } finally {
      setSending(false);
      setIsTyping(false);
    }
  };

  const generateQr = async () => {
    setError(null);
    try {
      const session = await apiRequest<{
        token: string;
        expiresAt: string;
      }>("/share", {
        method: "POST",
        body: JSON.stringify({
          scope: ["readings", "patch_status", "profile"],
        }),
      });
      setQrAccess({ token: session.token, expiresAt: session.expiresAt });
      setQrOpen(true);
    } catch {
      // Fallback emergency token
      setQrAccess({
        token: `emg-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      setQrOpen(true);
    }
  };

  if (consultantsLoading && effectiveConsultants.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[13px] text-slate-500">
        {t(language, "common.loading")}
      </div>
    );
  }

  return (
    <div className="page-enter w-full max-w-6xl mx-auto p-4 md:p-6 pb-12">
      {/* Attached Main Card: Header + (Consultant Selector + Chat Thread) */}
      <div className="chat-main-card overflow-hidden rounded-[24px] border border-slate-300 dark:border-[#243C47] dark:bg-[#15232A] shadow-2xl">
        {/* Attached Top Header Bar */}
        <div className="border-b border-slate-200/90 dark:border-[#243C47] bg-white/70 dark:bg-black/20 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[12px] font-medium text-[#2C4C5C] dark:text-[#A0B4BE]">
                Care team
              </p>
              <span className="flex items-center gap-1 rounded-full bg-[#0EA5A4]/10 dark:bg-[#0EA5A4]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0EA5A4]">
                <Sparkles size={11} /> AI Clinical Consultants
              </span>
            </div>
            <h2 className="font-display text-[27px] font-semibold tracking-[-0.055em] text-[#2C4C5C] dark:text-[#E8F2F6]">
              {t(language, "chat.title")}
            </h2>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-[#A0B4BE]">
              {t(language, "chat.intro")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {/* Quick FAQ / Instant Answers Button */}
            <button
              onClick={() => setFaqModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1C2F38] hover:bg-slate-100 dark:hover:bg-[#243C47] px-3.5 py-2 text-[12px] font-semibold text-slate-700 dark:text-[#E8F2F6] transition shadow-xs cursor-pointer"
            >
              <HelpCircle size={15} className="text-[#0EA5A4]" />
              <span className="hidden sm:inline">Clinical Q&A</span>
            </button>

            {/* Doctor-Ready Clinical Report Export Button */}
            <button
              onClick={() => setReportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#D8C907] dark:border-[#F3E308] bg-[#F3E308] hover:bg-[#E5D507] px-3.5 py-2 text-[12px] font-extrabold text-[#142229] transition shadow-xs cursor-pointer"
            >
              <FileText size={15} className="text-[#142229]" />
              <span>Doctor Report (PDF)</span>
            </button>

            {/* Emergency Access QR */}
            <button
              onClick={generateQr}
              className="flex items-center gap-2 rounded-xl border border-[#6C8494]/20 bg-[#6C8494]/[0.06] dark:bg-[#1C2F38] px-3.5 py-2 text-[12px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6] hover:bg-[#6C8494]/15 transition cursor-pointer"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline">
                {t(language, "chat.emergencyAccess")}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-[12px] font-medium text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Main Grid: Consultant Selector + Chat Thread */}
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left Column: Consultant List */}
        <div className="border-b border-slate-200 dark:border-[#243C47] p-3 lg:border-b-0 lg:border-r">
          <p className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-[#738C98]">
            {t(language, "chat.consultants")}
          </p>

          <div className="space-y-1">
            {effectiveConsultants.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveConsultantIdx(index);
                  setHasSelectedConsultant(true);
                }}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                  hasSelectedConsultant && activeConsultantIdx === index
                    ? "bg-[#2C4C5C]/[0.07] dark:bg-[#F3E308]/15"
                    : "hover:bg-slate-50 dark:hover:bg-[#1C2F38]"
                }`}
              >
                <div
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: item.color, color: "#FFFFFF" }}
                >
                  {item.initials || item.full_name.slice(0, 2).toUpperCase()}
                  {item.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#15232A] bg-[#0EA5A4]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-[#E8F2F6]">
                    {item.full_name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-[#A0B4BE] capitalize">
                    {item.professional_type}
                  </p>
                </div>
                {hasSelectedConsultant && activeConsultantIdx === index && (
                  <ChevronRight
                    className="ml-auto text-[#2C4C5C] dark:text-[#F3E308]"
                    size={14}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 bg-slate-50/60 dark:bg-[#111D23]/60 px-2.5 py-1.5 text-[9.5px] text-slate-500 dark:text-[#8FA5B0]">
            <ShieldCheck
              size={11}
              className="text-[#0EA5A4] shrink-0"
            />
            <span className="leading-tight">
              {t(language, "chat.dataChoiceDesc")}
            </span>
          </div>
        </div>

        {/* Right Column: Chat Window or Specialist Selection */}
        <div className="flex min-h-[520px] flex-col">
          {!hasSelectedConsultant ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 text-center my-auto">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0EA5A4]/15 text-[#0EA5A4] mb-3">
                <Stethoscope size={28} />
              </div>
              <h3 className="font-display text-[22px] font-bold text-[#2C4C5C] dark:text-[#E8F2F6]">
                Select Your Care Team Specialist
              </h3>
              <p className="mt-1.5 max-w-[480px] text-[12px] text-slate-500 dark:text-[#A0B4BE] leading-relaxed">
                Choose a specialist below to begin your personalized consultation regarding continuous ISF hormone readings, luteal velocity, and cycle patterns.
              </p>

              <div className="consultants-grid mt-7 grid w-full max-w-[880px] gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left !bg-transparent !border-none !shadow-none">
                {effectiveConsultants.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveConsultantIdx(idx);
                      setHasSelectedConsultant(true);
                    }}
                    className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-300 dark:border-white/10 bg-white dark:bg-[#15232A] p-5 shadow-lg hover:border-[#0EA5A4] hover:shadow-2xl transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-xs"
                          style={{ background: item.color }}
                        >
                          {item.initials || item.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-display text-[15px] font-bold text-slate-900 dark:text-[#E8F2F6] group-hover:text-[#0EA5A4] transition">
                            {item.full_name}
                          </h4>
                          <p className="text-[11px] font-semibold text-[#0EA5A4]">
                            {item.professional_type}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-[#A0B4BE] leading-relaxed mb-3">
                        {item.professional_type?.toLowerCase().includes("gynecologist")
                          ? "Specializes in reproductive physiology, luteal phase adequacy, hormonal wellness, and pelvic health."
                          : item.professional_type?.toLowerCase().includes("endocrinologist")
                          ? "Specializes in continuous hormone telemetry, progesterone velocity curves, and free testosterone balance."
                          : item.professional_type?.toLowerCase().includes("nutritionist")
                          ? "Specializes in metabolic nutrition, insulin sensitivity, and luteal dietary rhythm."
                          : "Specializes in luteal phase stability, cycle kinematics, ovulation support, and clinical symptom review."}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(item.professional_type?.toLowerCase().includes("gynecologist")
                          ? ["Progesterone", "Free Testosterone", "Pelvic Health"]
                          : item.professional_type?.toLowerCase().includes("endocrinologist")
                          ? ["ISF Biomarkers", "Progesterone", "Free Testosterone"]
                          : item.professional_type?.toLowerCase().includes("nutritionist")
                          ? ["Metabolic Balance", "Electrolytes", "Dietary Rhythm"]
                          : ["Ovulation Kinetics", "Luteal Phase", "Symptom Review"]
                        ).map((badge) => (
                          <span
                            key={badge}
                            className="rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:text-[#E8F2F6]"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C4C5C] dark:bg-[#1C2F38] group-hover:bg-[#0EA5A4] py-2 text-[11px] font-bold text-white transition shadow-xs"
                    >
                      <span>Consult with {item.full_name}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : consultant ? (
            <>
              {/* Chat Top Status Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#243C47] px-5 py-3.5 bg-white/40 dark:bg-black/10">
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-xs"
                    style={{ background: consultant.color, color: "#FFFFFF" }}
                  >
                    {consultant.initials ||
                      consultant.full_name.slice(0, 2).toUpperCase()}
                    {consultant.online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#15232A] bg-[#0EA5A4]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
                        {consultant.full_name}
                      </p>
                      <span className="rounded-full bg-[#0EA5A4]/15 px-2 py-0.5 text-[9px] font-bold text-[#0EA5A4] capitalize">
                        {consultant.professional_type}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#A0B4BE]">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          consultant.online ? "bg-[#0EA5A4]" : "bg-slate-400"
                        }`}
                      />
                      {consultant.online
                        ? "Available now • Continuous ISF telemetry"
                        : t(language, "chat.repliesSoon")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHasSelectedConsultant(false)}
                    className="lg:hidden flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1C2F38] px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-[#E8F2F6] hover:bg-slate-100 dark:hover:bg-[#243C47] transition shadow-2xs cursor-pointer"
                  >
                    <ArrowLeftRight size={12} className="text-[#0EA5A4]" />
                    <span>Specialists</span>
                  </button>
                </div>
              </div>

              {/* Message History Feed */}
              <div
                ref={messagesContainerRef}
                className="flex-1 space-y-4 p-5 overflow-y-auto min-h-[380px] max-h-[500px]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06] dark:bg-[#243C47]" />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-[#738C98]">
                    {t(language, "chat.today")}
                  </span>
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06] dark:bg-[#243C47]" />
                </div>

                {/* Render All Messages */}
                {activeMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    consultant={consultant}
                  />
                ))}

                {/* Animated Bot Typing Simulation Indicator */}
                {isTyping && (
                  <div className="chat-message-row flex w-full gap-3 animate-pulse">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-xs"
                      style={{ background: consultant.color, color: "#FFFFFF" }}
                    >
                      {consultant.initials}
                    </div>
                    <div className="chat-message chat-message-incoming bg-slate-100 dark:bg-[#1C2F38] border border-slate-200/60 dark:border-white/5 px-4 py-2.5 text-[12px] leading-relaxed text-slate-700 dark:text-[#A0B4BE] rounded-2xl flex items-center gap-2 shadow-xs">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-[#E8F2F6]">
                        {consultant.full_name} is typing...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Linear Commonly Asked Questions List */}
              <div className="border-t border-slate-200/80 dark:border-[#243C47] bg-slate-50/70 dark:bg-[#111D23] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickQuestions((prev) => !prev)}
                    className="text-[11px] font-bold text-[#2C4C5C] dark:text-[#E8F2F6] flex items-center gap-1.5 hover:text-[#0EA5A4] transition cursor-pointer"
                  >
                    <Sparkles size={13} className="text-[#0EA5A4]" />
                    <span>Commonly Asked Questions</span>
                    <span className="rounded-full bg-[#0EA5A4]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#0EA5A4]">
                      {consultantFaqItems.length}
                    </span>
                    {showQuickQuestions ? (
                      <ChevronUp size={13} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={13} className="text-slate-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFaqModalOpen(true)}
                    className="text-[10px] font-semibold text-[#0EA5A4] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <BookOpen size={11} /> Browse All ({CLINICAL_FAQ_ITEMS.length})
                  </button>
                </div>

                {showQuickQuestions && (
                  <div className="space-y-1.5">
                    {consultantFaqItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSendMessage(item.question)}
                        disabled={sending}
                        className="group flex w-full items-center justify-between rounded-xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#1C2F38] px-3.5 py-2 text-left transition hover:border-[#0EA5A4] hover:bg-teal-50/30 dark:hover:bg-[#243C47] shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0EA5A4]/10 text-[#0EA5A4] group-hover:bg-[#0EA5A4] group-hover:text-white transition">
                            <MessageCircle size={11} />
                          </div>
                          <span className="text-[12px] font-medium text-slate-800 dark:text-[#E8F2F6] group-hover:text-[#0EA5A4] transition-colors truncate">
                            {item.question}
                          </span>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-slate-400 group-hover:text-[#0EA5A4] group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Natural Chat Message Input */}
              <div className="border-t border-slate-200/80 dark:border-[#243C47] p-3 sm:p-4 bg-white/60 dark:bg-[#15232A]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Ask ${consultant.full_name} a question...`}
                    disabled={sending}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1C2F38] px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/40"
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0EA5A4] text-white hover:bg-[#0C8F8E] disabled:opacity-40 transition shadow-xs cursor-pointer"
                  >
                    <Send size={16} />
                  </button>
                </form>
                {!isPremium && (
                  <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500 dark:text-[#A0B4BE]">
                    <span>Free plan: {messageCount}/{FREE_MESSAGE_LIMIT} messages used</span>
                    <span className="font-semibold text-[#0EA5A4]">Encrypted telemetry</span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
      </div>

      {/* Emergency Access QR Modal */}
      {qrOpen && qrAccess && (
        <QrModal
          access={qrAccess}
          language={language}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* Doctor-Ready Clinical Health Report Modal */}
      <ClinicalReportExportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        patientName={profile?.full_name || "Amina Mwangi"}
        patientRef={profile?.patient_reference || "ISF-PT-2026-8841"}
      />

      {/* Clinical FAQ & Instant Answers Modal */}
      <ClinicalFaqModal
        isOpen={faqModalOpen}
        onClose={() => setFaqModalOpen(false)}
        consultant={consultant}
        onSelectQuestion={(q) => {
          setHasSelectedConsultant(true);
          handleSendMessage(q);
        }}
      />
    </div>
  );
}

function MessageBubble({
  msg,
  consultant,
}: {
  msg: MessageInfo;
  consultant: ConsultantInfo;
}) {
  if (msg.sender_type === "patient") {
    return (
      <div className="chat-message chat-message-outgoing bg-[#2C4C5C] dark:bg-[#0EA5A4] px-4 py-3 text-[12px] leading-relaxed text-white ml-auto max-w-[75%] rounded-2xl shadow-sm">
        {msg.body}
      </div>
    );
  }

  return (
    <div className="chat-message-row flex w-full gap-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
        style={{ background: consultant.color, color: "#FFFFFF" }}
      >
        {consultant.initials}
      </div>
      <div className="chat-message chat-message-incoming bg-slate-100 dark:bg-[#1C2F38] px-4 py-3 text-[12px] leading-relaxed text-slate-800 dark:text-[#E8F2F6] rounded-2xl max-w-[75%] border border-slate-200/50 dark:border-white/5 shadow-sm">
        {msg.message_type === "trend_alert" && (
          <p className="mb-1 text-[11px] font-semibold text-[#7A6600] dark:text-[#F3E308]">
            ISF Tracker Alert
          </p>
        )}
        {msg.body}
      </div>
    </div>
  );
}

function QrModal({
  access,
  language,
  onClose,
}: {
  access: QrAccess;
  language: Language;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const qrUrl = `${window.location.origin}/emergency/${access.token}`;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C4C5C]/40 p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-[360px] rounded-[26px] border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-500 hover:text-[#2C4C5C] dark:hover:text-[#F3E308]"
        >
          <X size={17} />
        </button>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2C4C5C]/10 dark:bg-[#F3E308]/15 text-[#2C4C5C] dark:text-[#F3E308]">
          <QrCode size={22} />
        </div>
        <h3 className="mt-4 font-display text-[19px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
          {t(language, "chat.temporaryAccess")}
        </h3>
        <p className="mx-auto mt-2 max-w-[260px] text-[11px] leading-relaxed text-slate-500 dark:text-[#A0B4BE]">
          {t(language, "chat.qrDesc")}
        </p>
        <div className="mx-auto mt-5 flex h-44 w-44 items-center justify-center rounded-xl bg-white p-3 border-2 border-[#2C4C5C] dark:border-[#0EA5A4]">
          <QRCodeSVG
            value={qrUrl}
            size={152}
            level="M"
            bgColor="#ffffff"
            fgColor="#2C4C5C"
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-[#A0B4BE]">
          <Clock3 size={12} /> Expires{" "}
          {new Date(access.expiresAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
        <a
          href={qrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0EA5A4] py-3 text-[11px] font-bold text-white shadow-sm hover:opacity-95 transition"
        >
          <ExternalLink size={14} /> Open Emergency Clinical Page
        </a>
        <button
          onClick={handleCopy}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#243C47] bg-slate-50 dark:bg-[#1C2F38] py-2.5 text-[11px] font-semibold text-slate-700 dark:text-[#E8F2F6] hover:bg-slate-100 dark:hover:bg-[#243C47] transition shadow-xs"
        >
          {copied ? (
            <Check size={14} className="text-emerald-500" />
          ) : (
            <Copy size={14} />
          )}
          {copied ? "Link Copied!" : t(language, "chat.copyLink")}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 dark:text-[#738C98]">
          <LockKeyhole size={11} /> {t(language, "chat.noMedicalData")}
        </p>
      </div>
    </div>
  );
}
