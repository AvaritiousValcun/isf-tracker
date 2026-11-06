import { useState, useMemo } from "react";
import {
  X,
  Search,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  Stethoscope,
  Activity,
} from "lucide-react";
import { CLINICAL_FAQ_ITEMS, ClinicalFaqItem } from "@shared/clinicalFaq";
import { type ConsultantInfo } from "@/hooks/useData";

interface ClinicalFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultant: ConsultantInfo;
  onSelectQuestion: (question: string) => void;
}

export default function ClinicalFaqModal({
  isOpen,
  onClose,
  consultant,
  onSelectQuestion,
}: ClinicalFaqModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>("latest-readings");

  const categories = useMemo(() => {
    const list = ["All"];
    CLINICAL_FAQ_ITEMS.forEach((item) => {
      if (!list.includes(item.category)) {
        list.push(item.category);
      }
    });
    return list;
  }, []);

  const filteredItems = useMemo(() => {
    return CLINICAL_FAQ_ITEMS.filter((item) => {
      const matchCat =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchSearch =
        search.trim() === "" ||
        item.question.toLowerCase().includes(search.toLowerCase()) ||
        item.summary.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [search, selectedCategory]);

  if (!isOpen) return null;

  const getAnswer = (item: ClinicalFaqItem) => {
    const type = consultant.professional_type.toLowerCase();
    if (type.includes("endocrinologist") && item.answers.endocrinologist) {
      return item.answers.endocrinologist;
    }
    if (type.includes("nutritionist") && item.answers.nutritionist) {
      return item.answers.nutritionist;
    }
    if (
      (type.includes("gynecologist") ||
        type.includes("ob/gyn") ||
        type.includes("obstetrician")) &&
      (item.answers.gynecologist || item.answers.obgyn)
    ) {
      return item.answers.gynecologist || item.answers.obgyn;
    }
    return (
      item.answers.default ||
      item.answers.endocrinologist ||
      item.answers.nutritionist ||
      item.answers.gynecologist ||
      item.answers.obgyn ||
      Object.values(item.answers)[0]
    );
  };

  const handleAsk = (question: string) => {
    onSelectQuestion(question);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-[720px] flex-col rounded-[26px] border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#243C47] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0EA5A4]/10 text-[#0EA5A4]">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[18px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
                  Common Clinical Questions & Instant Answers
                </h3>
                <span className="rounded-full bg-[#0EA5A4]/15 px-2 py-0.5 text-[10px] font-bold text-[#0EA5A4]">
                  Care Team Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">
                Consulting with{" "}
                <span className="font-semibold text-slate-800 dark:text-[#E8F2F6]">
                  {consultant.full_name}
                </span>{" "}
                ({consultant.professional_type})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#1C2F38] dark:hover:text-[#E8F2F6] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="border-b border-slate-200 dark:border-[#243C47] bg-slate-50/50 dark:bg-[#111D23]/50 px-6 py-3.5 space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic, e.g. progesterone, androgen, cycle transition..."
              className="w-full rounded-xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] pl-9 pr-3 py-2 text-[12px] text-slate-800 dark:text-[#E8F2F6] placeholder:text-slate-400 outline-none focus:border-[#0EA5A4] transition"
            />
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#0EA5A4] text-white shadow-xs font-semibold"
                    : "border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C2F38] text-slate-600 dark:text-[#A0B4BE] hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: List of Questions & Verified Answers */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[13px] font-medium">No matching questions found.</p>
              <p className="text-[11px] mt-1">Try another keyword or select "All".</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = expandedId === item.id;
              const answerText = getAnswer(item);

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? "border-[#0EA5A4] bg-[#0EA5A4]/[0.02] dark:border-[#0EA5A4]/60 dark:bg-[#0EA5A4]/[0.03] shadow-sm"
                      : "border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#1C2F38]/40 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex items-start justify-between gap-3 p-4 cursor-pointer select-none"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-md bg-slate-100 dark:bg-[#243C47] px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-[#A0B4BE]">
                          {item.category}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-[#738C98]">
                          •
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-[#738C98] line-clamp-1">
                          {item.summary}
                        </span>
                      </div>
                      <h4 className="font-display text-[14px] font-semibold text-[#2C4C5C] dark:text-[#E8F2F6]">
                        {item.question}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAsk(item.question);
                        }}
                        title="Send this question to active chat"
                        className="flex items-center gap-1.5 rounded-lg bg-[#2C4C5C] dark:bg-[#0EA5A4] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:opacity-90 transition cursor-pointer"
                      >
                        <Send size={11} />
                        <span>Ask Doctor</span>
                      </button>
                      <div className="text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Answer Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-[#111D23]/60 p-4 rounded-b-2xl animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-xs mt-0.5"
                          style={{ background: consultant.color || "#0EA5A4" }}
                        >
                          {consultant.initials || "DR"}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-[#E8F2F6]">
                              {consultant.full_name}{" "}
                              <span className="font-normal text-slate-500 dark:text-[#A0B4BE]">
                                ({consultant.professional_type})
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} /> ISF Patch Verified
                            </span>
                          </div>
                          <p className="text-[12px] leading-relaxed text-slate-700 dark:text-[#E8F2F6]/90">
                            {answerText}
                          </p>

                          <div className="pt-2 flex items-center justify-end">
                            <button
                              onClick={() => handleAsk(item.question)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-[#0EA5A4] hover:underline cursor-pointer"
                            >
                              <Send size={12} /> Post this Q&A into active conversation
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-[#243C47] bg-slate-50 dark:bg-[#111D23] px-6 py-3.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-[#738C98]">
          <div className="flex items-center gap-1.5">
            <Activity size={13} className="text-[#0EA5A4]" />
            <span>Answers dynamically calibrated to your continuous ISF telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15232A] px-4 py-1.5 font-semibold text-slate-700 dark:text-[#E8F2F6] hover:bg-slate-100 transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
