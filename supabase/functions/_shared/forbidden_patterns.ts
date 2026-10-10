// Advice / diagnosis / prognosis patterns that must never appear in an AI output (CLAUDE.md §7, rule 4).
// Patterns are matched against normalize()d text: lowercase, no accents, no Arabic diacritics,
// hyphens/punctuation as spaces. Somali and Arabic lists are machine-drafted — see OPEN_QUESTIONS.md.

export interface ForbiddenPattern {
  lang: "fr" | "en" | "so" | "ar";
  kind: "advice" | "diagnosis" | "risk" | "dosage_change" | "urgency";
  re: RegExp;
}

const p = (lang: ForbiddenPattern["lang"], kind: ForbiddenPattern["kind"], source: string): ForbiddenPattern => ({
  lang,
  kind,
  re: new RegExp(source, "u"),
});

export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  // ---- French
  p("fr", "advice", "\\bvous devriez\\b"),
  p("fr", "advice", "\\bvous devez\\b"),
  p("fr", "advice", "\\bil faut (que vous|prendre|arreter|eviter|consulter)"),
  p("fr", "advice", "\\bje (vous )?(conseille|recommande)"),
  p("fr", "advice", "\\bnous (vous )?(conseillons|recommandons)"),
  p("fr", "advice", "\\bil est (conseille|recommande|preferable|important de)"),
  p("fr", "advice", "\\b(pensez a|n oubliez pas de|veillez a|evitez)\\b"),
  p("fr", "urgency", "\\bconsult(ez|er) (immediatement|rapidement|en urgence|un medecin|votre medecin)"),
  p("fr", "urgency", "\\b(allez|rendez vous) (aux urgences|a l hopital)"),
  p("fr", "dosage_change", "\\b(augmente[rz]?|diminue[rz]?|arrete[rz]?|double[rz]?|reduise[zt]?) (la dose|le traitement|votre traitement|vos medicaments|la posologie)"),
  p("fr", "dosage_change", "\\b(arretez|cessez|ne prenez plus)\\b"),
  p("fr", "diagnosis", "\\b(vous avez probablement|vous souffrez sans doute|cela (pourrait|peut) (indiquer|signifier|etre))"),
  p("fr", "diagnosis", "\\b(diagnostic|diagnostique) (probable|possible|suggere)"),
  p("fr", "risk", "\\b(risque (de|d|accru)|vous risquez|complications? (possibles?|graves?))"),
  p("fr", "risk", "\\b(pronostic|guerison|gueri(r|ra))\\b"),
  p("fr", "risk", "\\b(dangereux|grave pour)"),

  // ---- English
  p("en", "advice", "\\byou (should|must|need to|ought to|have to)\\b"),
  p("en", "advice", "\\b(i|we) (recommend|advise|suggest)"),
  p("en", "advice", "\\bit is (recommended|advisable|important to|best to)"),
  p("en", "advice", "\\b(make sure|remember to|don t forget|avoid)\\b"),
  p("en", "urgency", "\\b(see|consult|call|contact) (a|your) (doctor|physician|nurse|midwife)"),
  p("en", "urgency", "\\b(go to|seek) (the )?(hospital|emergency|medical (help|attention|care))"),
  p("en", "urgency", "\\bconsult (immediately|urgently)"),
  p("en", "dosage_change", "\\b(increase|decrease|reduce|stop|double|change) (the|your) (dose|dosage|medication|medicine|treatment)"),
  p("en", "dosage_change", "\\b(stop taking|start taking|keep taking)\\b"),
  p("en", "diagnosis", "\\b(you (probably|likely|may) have|this (may|might|could) (indicate|mean|suggest)|is (likely|probably) caused)"),
  p("en", "risk", "\\b(risk of|at risk|increased risk|higher risk|complications?|prognosis|could lead to|may lead to)\\b"),
  p("en", "risk", "\\b(dangerous|life threatening|serious condition)"),

  // ---- Somali (machine-drafted, to validate)
  p("so", "advice", "\\bwaa inaad\\b"),
  p("so", "advice", "\\b(waxaan|waxaanu|waxaynu) (kugula|idinkula) talin"),
  p("so", "advice", "\\bkugula talin"),
  p("so", "advice", "\\bwaxaa (fiican|wanaagsan|muhiim ah) inaad\\b"),
  p("so", "advice", "\\bha (illaawin|ilaawin)\\b"),
  p("so", "urgency", "\\b(la xiriir|la tasho|u tag|booqo) (dhakhtar|dhaqtar|isbitaal|cisbitaal)"),
  p("so", "urgency", "\\bdegdeg\\b"),
  p("so", "dosage_change", "\\b(joooji|jooji|kordhi|yaree|labalaabo)\\b"),
  p("so", "risk", "\\b(khatar|halis) (ah|ku jirta|weyn)\\b"),
  p("so", "diagnosis", "\\b(waxay u badan tahay|malaha waxaad qabtaa|waxaa laga yaabaa inaad)"),

  // ---- Arabic (machine-drafted, to validate) — matched after diacritics/alef normalisation
  p("ar", "advice", "يجب (عليك|ان)"),
  p("ar", "advice", "(انصحك|ننصحك|ننصح|نوصي|اوصي|ينصح)"),
  p("ar", "advice", "(عليك ان|من الافضل ان|من المهم ان|لا تنس)"),
  p("ar", "advice", "(تجنب|احرص على)"),
  p("ar", "urgency", "(استشر|استشيري|راجع|راجعي|اتصل ب|اذهب الى) (الطبيب|طبيبك|طبيبتك|المستشفى|الطوارئ)"),
  p("ar", "urgency", "(فورا|على الفور|بشكل عاجل)"),
  p("ar", "dosage_change", "(توقف|توقفي|زد|زيدي|قلل|قللي|ضاعف) (عن )?(الجرعه|الدواء|العلاج|تناول)"),
  p("ar", "risk", "(خطر الاصابه|خطر حدوث|معرض لخطر|معرضه لخطر|مضاعفات|قد يؤدي|خطير)"),
  p("ar", "diagnosis", "(من المحتمل انك|ربما تعاني|قد يشير|قد يدل)"),
];

/** Units that make a number a dose. Matched on normalize()d text. */
export const DOSE_UNIT_RE =
  /(\d+(?:[.,]\d+)?)\s?(mg|g|mcg|µg|ug|ml|ui|iu|unites?|units?|cp|comprimes?|tablets?|gelules?|capsules?|bouffees?|puffs?|gouttes|drops|ملغ|مغ|مل|حبه|حبات|قرص|اقراص|kaniini|kiniin|garaam)(?![\p{L}\p{N}])/gu;
