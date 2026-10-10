// Fixed, server-side texts. Never produced by the model.
export type Lang = "fr" | "so" | "ar" | "en";

export const AI_LABEL: Record<Lang, string> = {
  fr: "Résumé généré par IA, à vérifier par un professionnel de santé.",
  so: "Soo koobid ay samaysay AI, waa in uu hubiyaa xirfadle caafimaad.",
  ar: "ملخص تم إنشاؤه بالذكاء الاصطناعي، يجب التحقق منه من قبل أخصائي صحي.",
  en: "AI-generated summary, to be checked by a health professional.",
};

export const SUMMARY_FALLBACK: Record<Lang, string> = {
  fr: "Résumé indisponible — consultez votre dossier ci-dessous",
  so: "Soo koobidda lama heli karo — eeg diiwaankaaga hoose",
  ar: "الملخص غير متوفر — راجع ملفك أدناه",
  en: "Summary unavailable — see your record below",
};

export const ASSISTANT_FALLBACK: Record<Lang, string> = {
  fr: "Je ne peux pas répondre à cette question de façon sûre. Vous pouvez consulter votre dossier dans l'application.",
  so: "Su'aashan si ammaan ah uguma jawaabi karo. Waxaad ka eegi kartaa diiwaankaaga barnaamijka.",
  ar: "لا يمكنني الإجابة على هذا السؤال بشكل آمن. يمكنك الاطلاع على ملفك في التطبيق.",
  en: "I can't answer this question safely. You can look at your record in the app.",
};

/** Shown instead of any model text when the question asks for medical advice or diagnosis. */
export const ASSISTANT_OUT_OF_SCOPE: Record<Lang, string> = {
  fr: "Je ne donne pas d'avis médical, de diagnostic ni de conseil de traitement. Pour cette question, adressez-vous à un professionnel de santé. Je peux vous aider à retrouver des informations de votre dossier.",
  so: "Ma bixiyo talo caafimaad, baaritaan ama talo daaweyn. Su'aashan, fadlan weydii xirfadle caafimaad. Waxaan kaa caawin karaa inaad hesho macluumaadka diiwaankaaga.",
  ar: "لا أقدم رأياً طبياً أو تشخيصاً أو نصيحة علاجية. لهذا السؤال، توجّه إلى أخصائي صحي. يمكنني مساعدتك في العثور على معلومات من ملفك.",
  en: "I don't give medical opinions, diagnoses or treatment advice. For this question, please ask a health professional. I can help you find information in your record.",
};
