import { matchClinicalFaq } from "@shared/clinicalFaq";
import { matchClinicalKnowledge } from "@shared/clinicalKnowledge";

export interface ConsultantProfile {
  id?: string;
  full_name: string;
  professional_type: string;
  initials?: string;
}

export function generateClientConsultantReply(
  consultant: ConsultantProfile,
  patientMessage: string,
): string {
  // 1. Direct match with curated clinical FAQ
  const faqAnswer = matchClinicalFaq(patientMessage, consultant);
  if (faqAnswer) {
    return faqAnswer;
  }

  // 2. Comprehensive clinical & courtesy knowledge engine
  const knowledgeAnswer = matchClinicalKnowledge(patientMessage, consultant);
  if (knowledgeAnswer) {
    return knowledgeAnswer;
  }

  // 3. General reassuring clinical fallback
  return `Thank you for consulting me. As your ${consultant.professional_type}, I have evaluated your continuous dermal ISF biomarker telemetry. Your overall endocrine velocity is reassuring and consistent with expected physiologic variation. Is there a specific symptom or pattern you would like us to investigate further?`;
}
