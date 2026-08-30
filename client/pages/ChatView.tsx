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
  LockKeyhole,
  MoreHorizontal,
  QrCode,
  Send,
  ShieldCheck,
  X,
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
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAccess, setQrAccess] = useState<QrAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consultant = consultants[activeConsultantIdx];
  const isPremium = subscription?.plan === "premium";
  const FREE_MESSAGE_LIMIT = 50;

  const conversation = conversations.find((c) => c.consultant_id === consultant?.id);
  const { messages, refetch: refetchMessages } = useMessages(conversation?.id ?? null);

  const canChat = consultant?.consent_status === "granted";

  /*
   * Consent is now granted through the authenticated backend route
   * (POST /api/chat/consultants/:consultantId/consent) instead of a
   * direct Supabase insert from the browser.
   *
   * That route independently verifies (using the service-role
   * client, not RLS alone) that an ACTIVE patient_consultants
   * relationship exists before it will create the consent_records
   * row or the conversation, and it writes the "consent_notice"
   * system message itself via the service-role client -- which is
   * the only path allowed to write sender_type = 'system' after the
   * messages RLS fix (see supabase/migrations/
   * 20260829040000_messages_sender_type_rls_fix.sql).
   */
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

  /*
   * Messages are sent through the authenticated backend route
   * (POST /api/chat/messages) instead of a direct Supabase insert.
   *
   * The server sets sender_type = 'patient' itself and enforces the
   * 50-message free limit authoritatively -- the frontend's own
   * messageCount check below is only a UX shortcut, not the source
   * of truth.
   */
  const sendMessage = async () => {
    if (!message.trim() || !canChat || !conversation) return;
    if (!isPremium && messageCount >= FREE_MESSAGE_LIMIT) {
      setError("Free message limit reached. Upgrade to Premium for unlimited messaging.");
      return;
    }
    setError(null);
    const body = message.trim();
    setMessage("");
    try {
      await apiRequest("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversation.id,
          message: body,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
      setMessage(body);
      return;
    }
    await refetchMessages();
    await refetchMessageCount();
  };

  /*
   * QR/temporary-access tokens are created through the authenticated
   * backend route (POST /api/share) instead of a direct Supabase
   * insert.
   *
   * The server -- not the browser -- generates the random token,
   * computes its hash, and fixes the 24-hour expiry
   * (QR_EXPIRATION_HOURS in server/services/qrService.ts), so a
   * patient's own client can no longer request an arbitrarily long
   * expiry or an unreviewed scope for their emergency-access token.
   */
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
          scope: ["readings", "patch_status"],
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
          <p className="mb-2 text-[12px] font-medium text-[#2C4C5C]">Care team</p>
          <h2 className="font-display text-[27px] font-semibold tracking-[-0.055em] text-[#2C4C5C]">{t(language, "chat.title")}</h2>
          <p className="mt-2 text-[13px] text-slate-500">{t(language, "chat.intro")}</p>
        </div>
        <button onClick={generateQr} className="flex items-center gap-2 rounded-xl border border-[#6C8494]/20 bg-[#6C8494]/[0.06] px-3 py-2 text-[11px] font-semibold text-[#2C4C5C]">
          <QrCode size={15} /> <span className="hidden sm:inline">{t(language, "chat.emergencyAccess")}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">{error}</div>
      )}

      <div className="grid overflow-hidden rounded-[24px] border border-slate-200 bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Consultant List */}
        <div className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
          <p className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t(language, "chat.consultants")}</p>
          {consultants.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-slate-500">No consultants assigned yet.</p>
          ) : (
            consultants.map((item, index) => (
              <button key={item.id} onClick={() => setActiveConsultantIdx(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${activeConsultantIdx === index ? "bg-[#2C4C5C]/[0.07]" : "hover:bg-slate-50"}`}>
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: item.color, color: "#FFFFFF" }}>
                  {item.initials || item.full_name.slice(0, 2).toUpperCase()}
                  {item.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#F3E308]" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-900">{item.full_name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 capitalize">{item.professional_type}</p>
                </div>
                {activeConsultantIdx === index && <ChevronRight className="ml-auto text-[#2C4C5C]" size={14} />}
              </button>
            ))
          )}
          <div className="mt-4 rounded-xl border border-slate-200 bg-[#B8BFC1]/[0.10] p-3">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck size={14} className="text-[#2C4C5C]" />
              <span className="text-[12px] font-semibold">{t(language, "chat.dataChoice")}</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{t(language, "chat.dataChoiceDesc")}</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex min-h-[500px] flex-col">
          {consultant && (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
                  {consultant.initials || consultant.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#2C4C5C]">{consultant.full_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${consultant.online ? "bg-[#F3E308]" : "bg-slate-600"}`} />
                    {consultant.online ? t(language, "chat.available") : t(language, "chat.repliesSoon")}
                  </p>
                </div>
                <button className="ml-auto text-slate-500"><MoreHorizontal size={18} /></button>
              </div>

              <div className="flex-1 space-y-4 p-5">
                <div className="mx-auto flex max-w-[340px] items-center gap-2 rounded-lg bg-[#F3E308]/[0.05] px-3 py-2 text-[13px] font-medium leading-relaxed text-[#2C4C5C]">
                  <ShieldCheck size={14} className="shrink-0 text-[#2C4C5C]" />
                  <span className="font-semibold text-[13px]">{t(language, "chat.dataChoice")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06]" />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{t(language, "chat.today")}</span>
                  <div className="h-px flex-1 bg-[#2C4C5C]/[0.06]" />
                </div>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} consultant={consultant} />
                ))}
                {!canChat && (
                  <div className="mx-auto max-w-[360px] rounded-2xl border border-slate-200 bg-[#B8BFC1]/[0.10] p-5 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C8494]/20 text-[#7A6600]">
                      <LockKeyhole size={16} className="text-slate-600" />
                    </div>
                    <p className="mt-3 text-[12px] font-semibold text-[#2C4C5C]">{t(language, "chat.consentTitle")} {consultant.full_name.split(" ").slice(1).join(" ")}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-900 font-medium">{t(language, "chat.consentDesc")}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-xl border border-slate-200 py-2 text-[11px] font-semibold text-slate-600">{t(language, "chat.notNow")}</button>
                      <button onClick={giveConsent} className="flex-1 rounded-xl bg-[#2C4C5C] py-2 text-[11px] font-bold text-white">{t(language, "chat.giveConsent")}</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-4">
                {canChat ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#B8BFC1]/[0.10] px-3 py-1.5">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder={t(language, "chat.writeMessage")}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
                    />
                    <span className="hidden text-[10px] text-slate-600 sm:block">
                      {isPremium ? t(language, "chat.unlimited") : `${FREE_MESSAGE_LIMIT - messageCount} ${t(language, "chat.messagesLeft")}`}
                    </span>
                    <button onClick={sendMessage} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C4C5C] text-white transition hover:bg-[#6C8494]">
                      <Send size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-[12px] font-semibold text-slate-800">
                    <span>{t(language, "chat.consentRequired")}</span>
                    <LockKeyhole size={13} className="text-slate-800" />
                  </div>
                )}
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
    return <div className="chat-message chat-message-outgoing bg-[#6C8494] px-4 py-3 text-[11px] leading-relaxed text-white ml-auto max-w-[70%] rounded-2xl">{msg.body}</div>;
  }
  if (msg.sender_type === "system" || msg.sender_type === "automated_alert") {
    return (
      <div className="chat-message-row flex w-full gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: consultant.color, color: "#FFFFFF" }}>
          {consultant.initials || "IS"}
        </div>
        <div className="chat-message chat-message-incoming bg-[#B8BFC1] px-4 py-3 text-[13px] leading-relaxed text-slate-900 rounded-2xl max-w-[70%]">
          {msg.message_type === "trend_alert" && <p className="mb-1 text-[11px] font-semibold text-[#7A6600]">{msg.sender_type === "automated_alert" ? "ISF Tracker Alert" : "System"}</p>}
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
      <div className="chat-message chat-message-incoming bg-[#B8BFC1] px-4 py-3 text-[13px] leading-relaxed text-slate-900 rounded-2xl max-w-[70%]">{msg.body}</div>
    </div>
  );
}

function QrModal({ access, language, onClose }: { access: QrAccess; language: Language; onClose: () => void }) {
  const qrUrl = `${window.location.origin}/emergency/${access.token}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C4C5C]/35 p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-[360px] rounded-[26px] border border-slate-200 bg-white p-6 text-center shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-500 hover:text-[#2C4C5C]"><X size={17} /></button>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2C4C5C]/10 text-[#2C4C5C]"><QrCode size={22} /></div>
        <h3 className="mt-4 font-display text-[19px] font-semibold text-[#2C4C5C]">{t(language, "chat.temporaryAccess")}</h3>
        <p className="mx-auto mt-2 max-w-[260px] text-[11px] leading-relaxed text-slate-500">{t(language, "chat.qrDesc")}</p>
        <div className="mx-auto mt-5 flex h-40 w-40 items-center justify-center rounded-xl bg-white p-3 border-2 border-[#2C4C5C]">
          <QRCodeSVG
            value={qrUrl}
            size={144}
            level="M"
            bgColor="#ffffff"
            fgColor="#2C4C5C"
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Clock3 size={12} /> Expires {new Date(access.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(qrUrl)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C4C5C] py-3 text-[11px] font-bold text-white shadow-sm"
        >
          <Copy size={14} /> {t(language, "chat.copyLink")}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-600">
          <LockKeyhole size={11} /> {t(language, "chat.noMedicalData")}
        </p>
      </div>
    </div>
  );
}
