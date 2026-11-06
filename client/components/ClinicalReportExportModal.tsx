import React, { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  X,
  Check,
  ShieldCheck,
  Activity,
  Calendar,
  User,
  Stethoscope,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { downloadClinicalSummaryPdf } from "@/lib/pdfGenerator";

interface ClinicalReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  patientRef?: string;
}

export default function ClinicalReportExportModal({
  isOpen,
  onClose,
  patientName = "Amina Mwangi",
  patientRef = "ISF-PT-2026-8841",
}: ClinicalReportExportModalProps) {
  const [downloaded, setDownloaded] = useState(false);
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const documentId = `KMPDC-ISF-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSummary = () => {
    downloadClinicalSummaryPdf({
      patientName,
      patientRef,
      documentId,
      reportDate,
      reportTime,
      attendingDoctor: "Dr. Grace Wanjiku",
      doctorSpecialty: "Gynecologist & Reproductive Health",
    });
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-[#243C47] bg-white dark:bg-[#15232A] shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#243C47] px-6 py-4 bg-slate-50 dark:bg-[#15232A] print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0EA5A4]/15 text-[#0EA5A4]">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8F2F6]">
                Doctor-Ready Clinical Health Report
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">
                KMPDC / Endocrine Society Clinical Summary for your Gynecologist or Endocrinologist
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSummary}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 transition shadow-xs cursor-pointer"
            >
              {downloaded ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Download size={14} className="text-amber-600 dark:text-amber-400" />
              )}
              <span>{downloaded ? "PDF Downloaded" : "Download PDF"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-[#0EA5A4] hover:bg-[#0C8F8E] text-white px-4 py-2 text-xs font-bold transition shadow-sm"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Sheet */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 text-slate-900 dark:text-[#E8F2F6] print:p-8 print:text-black print:overflow-visible">
          
          {/* Official Clinical Header */}
          <div className="border-b-2 border-[#0EA5A4] pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0EA5A4] text-white font-bold text-xs">
                  ISF
                </span>
                <span className="font-display text-lg font-bold tracking-tight text-[#2C4C5C] dark:text-[#E8F2F6] print:text-black">
                  ISF TRACKER CLINICAL BIO-TELEMETRY
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#A0B4BE] print:text-slate-600">
                Continuous Dermal Interstitial Fluid Hormone Monitoring System
              </p>
              <p className="text-[10px] text-slate-400 dark:text-[#738C98] print:text-slate-500">
                Standard: KMPDC Endocrine Review Guidelines &bull; Verifiable ID: <code className="font-mono font-semibold">{documentId}</code>
              </p>
            </div>

            <div className="text-left sm:text-right text-xs">
              <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 font-semibold text-emerald-800 dark:text-emerald-300 print:border print:border-emerald-600">
                &bull; Verified Sensor Telemetry
              </span>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-[#A0B4BE] print:text-slate-600">
                Date: <strong>{reportDate}</strong> at {reportTime}
              </p>
            </div>
          </div>

          {/* Patient and Device Profile Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-2xl bg-slate-50 dark:bg-[#15232A] p-4 border border-slate-200/80 dark:border-[#243C47] print:bg-slate-50 print:border-slate-300">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Patient Name</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">{patientName}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">Ref: {patientRef}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Cycle Timeline</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">Cycle Day 21 (Luteal)</p>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">Ovulation confirmed: Day 14</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Biosensor Patch</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">ISF Patch Rev 3.2</p>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">14 Days Active Sampling (99.4%)</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#738C98]">Care Team Review</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">Dr. Grace Wanjiku</p>
              <p className="text-[11px] text-slate-500 dark:text-[#A0B4BE]">Gynecology &amp; Reproductive Health</p>
            </div>
          </div>

          {/* 14-Day Continuous Biomarker Profile Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A0B4BE] flex items-center gap-1.5">
                <Activity size={14} className="text-[#0EA5A4]" /> 1. Continuous Biomarker Telemetry Summary (14-Day Sampling)
              </h4>
              <span className="text-[10px] text-slate-400">Sample Frequency: 15 Minutes</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#243C47] print:border-slate-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-[#15232A] text-slate-600 dark:text-[#A0B4BE] font-semibold border-b border-slate-200 dark:border-[#243C47]">
                  <tr>
                    <th className="py-2.5 px-3">Biomarker</th>
                    <th className="py-2.5 px-3">14-Day Mean</th>
                    <th className="py-2.5 px-3">Observed Peak</th>
                    <th className="py-2.5 px-3">Clinical Target Range</th>
                    <th className="py-2.5 px-3">Time in Range</th>
                    <th className="py-2.5 px-3">Velocity &amp; Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#243C47] text-slate-800 dark:text-[#E8F2F6] print:text-black">
                  <tr className="hover:bg-slate-50 dark:hover:bg-[#15232A]/50">
                    <td className="py-2.5 px-3 font-semibold text-[#0EA5A4]">Progesterone (P4)</td>
                    <td className="py-2.5 px-3">16.4 ng/mL</td>
                    <td className="py-2.5 px-3 font-medium">24.8 ng/mL</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-[#A0B4BE]">5.0 &ndash; 25.0 ng/mL (Luteal)</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        88.5%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-[#A0B4BE]">
                      &minus;1.8 ng/mL/day (Luteal descent)
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 dark:hover:bg-[#15232A]/50">
                    <td className="py-2.5 px-3 font-semibold text-[#D97706]">Free Testosterone</td>
                    <td className="py-2.5 px-3">38.2 ng/dL</td>
                    <td className="py-2.5 px-3 font-medium">41.6 ng/dL</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-[#A0B4BE]">&lt; 45.0 ng/dL (Normal)</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        94.2%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-[#A0B4BE]">
                      +0.2 ng/dL/day (Stable baseline)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 7-Day Forward Hormone Velocity Forecast Summary */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#243C47] bg-slate-50/70 dark:bg-[#111D23] p-5 space-y-3 print:bg-white print:border-slate-300">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A0B4BE] flex items-center gap-1.5">
              <TrendingUp size={14} className="text-[#0EA5A4]" /> 2. 7-Day Forward Hormone Velocity Forecast
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#15232A] p-3 print:border-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Progesterone Velocity</span>
                <p className="text-base font-bold text-[#0EA5A4] mt-0.5">&minus;1.8 ng/mL/day</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Expected late-luteal decline. Secretory phase sustained.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#15232A] p-3 print:border-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Free Testosterone Velocity</span>
                <p className="text-base font-bold text-[#D97706] mt-0.5">+0.2 ng/dL/day</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Stable non-escalating baseline profile within normal safety margins.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#15232A] p-3 print:border-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Luteal Adequacy</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">13.1 Days</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Confidence interval: &plusmn; 1.1 days (Normal secretory duration &gt;11 days).
                </p>
              </div>
            </div>
          </div>

          {/* Predictive Health Risk Stratification */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A0B4BE] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#0EA5A4]" /> 3. Predictive Health Risk Stratification (Calibrated Models)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-[#243C47] p-3 bg-white dark:bg-[#15232A] print:border-slate-200">
                <p className="text-[10px] font-semibold text-slate-400">PCOS / FT Balance</p>
                <p className="text-xl font-bold text-amber-500 dark:text-[#F3E308] mt-1">31.0%</p>
                <span className="text-[10px] text-amber-600 font-medium">Moderate (Monitoring)</span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#243C47] p-3 bg-white dark:bg-[#15232A] print:border-slate-200">
                <p className="text-[10px] font-semibold text-slate-400">Insulin Resistance Index</p>
                <p className="text-xl font-bold text-amber-500 dark:text-[#F3E308] mt-1">24.0%</p>
                <span className="text-[10px] text-amber-600 font-medium">Mild-Moderate Correlation</span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#243C47] p-3 bg-white dark:bg-[#15232A] print:border-slate-200">
                <p className="text-[10px] font-semibold text-slate-400">Non-Alcoholic Liver Disease</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">9.0%</p>
                <span className="text-[10px] text-emerald-600 font-medium">Low Risk Baseline</span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#243C47] p-3 bg-white dark:bg-[#15232A] print:border-slate-200">
                <p className="text-[10px] font-semibold text-slate-400">Type 2 Diabetes</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">12.0%</p>
                <span className="text-[10px] text-emerald-600 font-medium">Low Risk Baseline</span>
              </div>
            </div>
          </div>

          {/* Doctor Signature & Attending Physician Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-[#243C47] grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Attending Clinician / Reviewing Physician:</p>
              <div className="mt-8 border-b border-slate-400 dark:border-slate-600 w-3/4" />
              <p className="mt-1 text-[11px] text-slate-500">Physician Name &amp; KMPDC Registration Number</p>
            </div>

            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Clinic / Hospital Official Stamp &amp; Date:</p>
              <div className="mt-3 h-16 w-40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                Official Clinic Stamp
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-[10px] text-slate-400 dark:text-[#738C98] print:text-slate-500 text-center pt-2">
            ISF Continuous Dermal Telemetry System &bull; Compliant with Kenya Medical Practitioners and Dentists Council clinical telemetry guidelines &bull; Page 1 of 1
          </div>

        </div>
      </div>
    </div>
  );
}
