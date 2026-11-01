import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useConsultants, useConversations, useMessages, useSubscription, useMessageCount, type ConsultantInfo, type MessageInfo } from "@/hooks/useData";
import { t, type Language } from "@/lib/i18n";
import { apiRequest } from "@/lib/api";
import {
  ChevronRight,
  Clock3,
  Copy,
  Check,
  LockKeyhole,
  MoreHorizontal,
  QrCode,
  Send,
  ShieldCheck,
  X,
  Sparkles,
} from "lucide-react";

interface ChatViewProps {
  language: Language;
}

interface QrAccess {
  token: string;
  expiresAt: string;
}

export default function ChatView({ language }: ChatViewProps) {
  const { user } = useAuth();
  const { consultants, loading: consultantsLoading, refetch: refetchConsultants } = useConsultants();
  const { conversations, refetch: refetchConversations } = useConversations();
  const { subscription } = useSubscription();
  const { messageCount, refetch: refetchMessageCount } = useMessageCount();
  const [activeConsultantIdx, setActiveConsultantIdx] = useState(0);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAccess, setQrAccess] = useState<QrAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consultant = consultants[activeConsultantIdx];
  const isPremium = subscription?.plan === "premium";
  const FREE_MESSAGE_LIMIT = 50;

  const conversation = conversations.find((c) => c.consultant_id === consultant?.id);
  const { messages, refetch: refetchMessages } = useMessages(conversation?.id ?? null);

  const canChat = consultant?.consent_status === "granted";

  const giveConsent = async () => {
    if (!user || !consultant) return;
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
      setError(err instanceof Error ? err.message : "Unable to grant consent.");
      return;
    }

    await refetchConsultants();
    await refetchConversations();
  };

  const sendMessage = async () => {
    if (!message.trim() || !consultant) return;
    if (!isPremium && messageCount >= FREE_MESSAGE_LIMIT) {
      setError("Free message limit reached. Upgrade to Premium for unlimited messaging.");
      return;
    }
    setError(null);
    const body = message.trim();
    setMessage("");
    setSending(true);
    setIsTyping(true);

    try {
      await apiRequest("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversation?.id,
          consultantId: consultant.id,
          message: body,
        }),
      });
      await refetchMessages();
      await refetchConversations();
      await refetchMessageCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
      setMessage(body);
    } finally {
      setSending(false);
      setIsTyping(false);
    }
  };

  const generateQr = async () => {
    if (!user) return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate QR access.");
    }
  };

  if (consultantsLoading) {
    return <div className="flex min-h-[400px] items-center justify-center text-[13px] text-slate-500">{t(language, "common.loading")}</div>;
  }

  return (
    <div className="page-enter mx-auto max-w-[1250px] px-5 pb-10 pt-7 sm:px-8 lg:px-10 lg:pt-9">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[12px] font-medium text-[#2C4C5C] dark:text-[#A0B4BE]">Care team</p>
            <span className="flex items-center gap-1 rounded-full bg-[#0EA5A4]/10 dark:bg-[#0EA5A4]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0EA5A4]">
              <Sparkles size={11} /> AI Clinical Assistants
            </span>
          </div>
          <h2 className="font-display text-[27px] font-semibold tracking-[-0.055em] text-[#2C4C5C] dark:text-[#E8F2F6]">{t(language, "chat.title")}</h2>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-[#A0B4BE]">{t(language, "chat.intro")}</p>
        </div>
        <button onClick={generateQr} className="flex items-center gap-2 rounded-xl border border-[#6C8494]/20 bg-[#6C8494]/[0.06] dark:bg-[#1C2F38] px-3.5 py-2.5 text-[12px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6] hover:bg-[#6C8494]/15 transition">
          <QrCode size={16} /> <span className="hidden sm:inline">{t(language, "chat.emergencyAccess")}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-[12px] font-medium text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="grid overflow-hidden rounded-[24px] border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] lg:grid-cols-[280px_minmax(0,1fr)] shadow-sm">
        {/* Consultant List */}
        <div className="border-b border-slate-200 dark:border-[#243C47] p-3 lg:border-b-0 lg:border-r">
          <p className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-[#738C98]">{t(language, "chat.consultants")}</p>
          {consultants.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-slate-500 dark:text-[#A0B4BE]">No consultants assigned yet.</p>
          ) : (
            consultants.map((item, index) => (
              <button key={item.id} onClick={() => setActiveConsultantIdx(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${activeConsultantIdx === index ? "bg-[#2C4C5C]/[0.07] dark:bg-[#F3E308]/15" : "hover:bg-slate-50 dark:hover:bg-[#1C2F38]"}`}>
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: item.color, color: "#FFFFFF" }}>
                  {item.initials || item.full_name.slice(0, 2).toUpperCase()}
                  {item.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#15232A] bg-[#0EA5A4]" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-[#E8F2F6]">{item.full_name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-[#A0B4BE] capitalize">{item.professional_type}</p>
                </div>
                {activeConsultantIdx === index && <ChevronRight className="ml-auto text-[#2C4C5C] dark:text-[#F3E308]" size={14} />}
              </button>
            ))
          )}
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-[#243C47] bg-[#B8BFC1]/[0.10] dark:bg-[#111D23] p-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-[#A0B4BE]">
              <ShieldCheck size={14} className="text-[#2C4C5C] dark:text-[#F3E308]" />
              <span className="text-[12px] font-semibold">{t(language, "chat.dataChoice")}</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-[#A0B4BE]">{t(language, "chat.dataChoiceDesc")}</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex min-h-[520px] flex-col">
          {consultant && (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-[#243C47] px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
                  {consultant.initials || consultant.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{consultant.full_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#A0B4BE]">
                    <span className={`h-1.5 w-1.5 rounded-full ${consultant.online ? "bg-[#0EA5A4]" : "bg-slate-600"}`} />
                    {consultant.online ? t(language, "chat.available") : t(language, "chat.repliesSoon")}
                  </p>
                </div>
                <button className="ml-auto text-slate-500 dark:text-[#A0B4BE]"><MoreHorizontal size={18} /></button>
              </div>

              <div className="flex-1 space-y-4 p-5 overflow-y-auto">
                <div className="mx-auto flex max-w-[340px] items-center gap-2 rounded-lg bg-[#F3E308]/[0.08] dark:bg-[#F3E308]/15 px-3 py-2 text-[12px] font-medium leading-relaxed text-[#2C4C5C] dark:text-[#E8F2F6]">
                  <ShieldCheck size={14} className="shrink-0 text-[#2C4C5C] dark:text-[#F3E308]" />
                  <span className="font-semibold">{t(language, "chat.dataChoice")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06] dark:bg-[#243C47]" />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600 dark:text-[#738C98]">{t(language, "chat.today")}</span>
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06] dark:bg-[#243C47]" />
                </div>
                {messages.length === 0 && (
                  <div className="mx-auto max-w-md rounded-2xl border border-slate-200/80 dark:border-[#243C47] bg-slate-50/70 dark:bg-[#111D23] p-5 text-center space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm" style={{ background: consultant.color }}>
                      {consultant.initials}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-[#E8F2F6]">
                        Consultation with {consultant.full_name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 dark:text-[#A0B4BE] leading-relaxed">
                        I am your active {consultant.professional_type}. I review your continuous ISF hormone readings and telemetry in real time. Send a message or pick a question below to start our consultation:
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {[
                        "How are my latest hormone readings?",
                        "What do my progesterone levels indicate?",
                        "Can you explain my androgen pattern?",
                      ].map((promptText) => (
                        <button
                          key={promptText}
                          onClick={() => {
                            setMessage(promptText);
                          }}
                          className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C2F38] px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-[#E8F2F6] hover:border-[#0EA5A4] transition shadow-xs cursor-pointer"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} consultant={consultant} />
                ))}

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="chat-message-row flex w-full gap-3 animate-pulse">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
                      {consultant.initials}
                    </div>
                    <div className="chat-message chat-message-incoming bg-[#B8BFC1]/30 dark:bg-[#1C2F38] px-4 py-2.5 text-[12px] leading-relaxed text-slate-600 dark:text-[#A0B4BE] rounded-2xl flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4] animate-bounce [animation-delay:0.4s]" />
                      <span className="ml-1 text-[11px] font-medium">{consultant.full_name} is evaluating your readings...</span>
                    </div>
                  </div>
                )}

                {!canChat && (
                  <div className="mx-auto max-w-[360px] rounded-2xl border border-slate-200 dark:border-[#243C47] bg-[#B8BFC1]/[0.10] dark:bg-[#111D23] p-5 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C8494]/20 text-[#7A6600] dark:text-[#F3E308]">
                      <LockKeyhole size={16} className="text-slate-600 dark:text-[#A0B4BE]" />
                    </div>
                    <p className="mt-3 text-[12px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{t(language, "chat.consentTitle")} {consultant.full_name.split(" ").slice(1).join(" ")}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-900 dark:text-[#A0B4BE] font-medium">{t(language, "chat.consentDesc")}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-xl border border-slate-200 dark:border-[#243C47] py-2 text-[11px] font-semibold text-slate-600 dark:text-[#A0B4BE]">{t(language, "chat.notNow")}</button>
                      <button onClick={giveConsent} className="flex-1 rounded-xl bg-[#2C4C5C] dark:bg-[#F3E308] py-2 text-[11px] font-bold text-white dark:text-[#142229]">{t(language, "chat.giveConsent")}</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-[#243C47] p-4">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#243C47] bg-[#B8BFC1]/[0.10] dark:bg-[#111D23] px-3 py-1.5">
                  <input
                    value={message}
                    disabled={sending}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder={canChat ? t(language, "chat.writeMessage") : "Type message (consent auto-connects)..."}
                    className="min-w-0 flex-1 bg-transparent py-2 text-[12px] text-[#2C4C5C] dark:text-[#E8F2F6] outline-none placeholder:text-slate-500 dark:placeholder:text-[#738C98]"
                  />
                  <span className="hidden text-[10px] text-slate-500 dark:text-[#A0B4BE] sm:block">
                    {isPremium ? t(language, "chat.unlimited") : `${Math.max(0, FREE_MESSAGE_LIMIT - messageCount)} ${t(language, "chat.messagesLeft")}`}
                  </span>
                  <button
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C4C5C] dark:bg-[#0EA5A4] text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {qrOpen && qrAccess && <QrModal access={qrAccess} language={language} onClose={() => setQrOpen(false)} />}
    </div>
  );
}

function MessageBubble({ msg, consultant }: { msg: MessageInfo; consultant: ConsultantInfo }) {
  if (msg.sender_type === "patient") {
    return <div className="chat-message chat-message-outgoing bg-[#2C4C5C] dark:bg-[#0EA5A4] px-4 py-3 text-[12px] leading-relaxed text-white ml-auto max-w-[70%] rounded-2xl shadow-sm">{msg.body}</div>;
  }
  if (msg.sender_type === "system" || msg.sender_type === "automated_alert") {
    return (
      <div className="chat-message-row flex w-full gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
          {consultant.initials || "IS"}
        </div>
        <div className="chat-message chat-message-incoming bg-slate-100 dark:bg-[#1C2F38] px-4 py-3 text-[12px] leading-relaxed text-slate-800 dark:text-[#E8F2F6] rounded-2xl max-w-[70%] border border-slate-200/50 dark:border-white/5">
          {msg.message_type === "trend_alert" && <p className="mb-1 text-[11px] font-semibold text-[#7A6600] dark:text-[#F3E308]">{msg.sender_type === "automated_alert" ? "ISF Tracker Alert" : "System"}</p>}
          {msg.body}
        </div>
      </div>
    );
  }
  return (
    <div className="chat-message-row flex w-full gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
        {consultant.initials}
      </div>
      <div className="chat-message chat-message-incoming bg-slate-100 dark:bg-[#1C2F38] px-4 py-3 text-[12px] leading-relaxed text-slate-800 dark:text-[#E8F2F6] rounded-2xl max-w-[70%] border border-slate-200/50 dark:border-white/5 shadow-sm">
        {msg.body}
      </div>
    </div>
  );
}

function QrModal({ access, language, onClose }: { access: QrAccess; language: Language; onClose: () => void }) {
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
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-500 hover:text-[#2C4C5C] dark:hover:text-[#F3E308]"><X size={17} /></button>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2C4C5C]/10 dark:bg-[#F3E308]/15 text-[#2C4C5C] dark:text-[#F3E308]"><QrCode size={22} /></div>
        <h3 className="mt-4 font-display text-[19px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">{t(language, "chat.temporaryAccess")}</h3>
        <p className="mx-auto mt-2 max-w-[260px] text-[11px] leading-relaxed text-slate-500 dark:text-[#A0B4BE]">{t(language, "chat.qrDesc")}</p>
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
          <Clock3 size={12} /> Expires {new Date(access.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </div>
        <button
          onClick={handleCopy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C4C5C] dark:bg-[#0EA5A4] py-3 text-[11px] font-bold text-white shadow-sm hover:opacity-90 transition"
        >
          {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
          {copied ? "Link Copied!" : t(language, "chat.copyLink")}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 dark:text-[#738C98]">
          <LockKeyhole size={11} /> {t(language, "chat.noMedicalData")}
        </p>
      </div>
    </div>
  );
}
