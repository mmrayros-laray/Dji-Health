# DEMO_SCRIPT.md — 7-minute Ministry walkthrough

> Two devices make the strongest demo: **a phone** (Amina, then Fatouma) and **a laptop on the projector** (Dr Hassan, then the Ministry). Everything also works on one laptop in two browser windows.
> Before going on stage: open each screen once (warms the cache), keep the fallback screen recording ready (see end).

**Reset before each run** (fresh data, nothing cached): `npx supabase db reset` → then on the phone, sign out of any previous session.

---

### 0:00 — Opening (30 s) · laptop
- Home screen: point to the gold banner **"DÉMO — données fictives"** (on every screen) and the language switcher.
- Tap **العربية**: the whole layout flips right-to-left. Back to **Français**.
- Say: *"Every person you will see is invented. Every time a record is opened, it is logged."*

### 0:30 — Amina's vault (1 min) · phone
- **Commencer la démo → Amina** (pregnant, 24 weeks, Balbala).
- Profile card: age, blood group **O+**. Tiles with icons + text (low-literacy design).
- Tap **Allergies**: *Pénicilline — Allergie grave*, badge **"Saisi par un professionnel"**.
- Tap **Maladies → Ajouter** "Migraine" → saved as **"Déclaré par le patient"**: the system always shows who entered what.

### 1:30 — Emergency card scanned (1 min 15 s) · phone + laptop
- **Urgence** tab → **Créer ma carte** (wallet-card with QR) → mention *Imprimer*.
- Say: *"The QR contains no medical data — only a link with a random secret."*
- Scan the QR **with the laptop's or any phone's camera** → the **emergency view** opens without login: first name, age, blood group in huge type, the penicillin allergy in red, current medicine, emergency contact with a call button.
- Back on Amina's phone, **Dossier**: red notice **"Votre carte d'urgence a été consultée"**.
- (Optional) **Révoquer** → refresh the emergency page → **"Carte révoquée"**.

### 2:45 — Consent and a new visit (1 min 30 s) · phone + laptop
- Amina: **Partager → Créer un code** → 8-character code + QR, valid 24 h.
- Laptop: sign in as **Dr Hassan**. Say: *"Without the patient's code, the database itself refuses access."*
- Enter the code, reason **"Consultation prénatale"** → **Ouvrir le dossier** (banner: *"Accès enregistré — motif…"*).
- **Ajouter une visite**: weight 62.4, BP 110/70 → **Enregistrer la visite**.
- Amina's phone: **Dossier → Visites**: the new visit, **"Saisi par un professionnel"**. **Qui a vu mon dossier ?** shows Dr Hassan, the reason, and the flagged emergency scan.
- **Partager → Retirer l'accès**: the doctor's list empties.

### 4:15 — Amina's AI summary in Somali (1 min) · phone
- **Dossier → Voir mon résumé → Soomaali**.
- Point to: the label **"Résumé généré par IA, à vérifier par un professionnel de santé"**, the **source chips** (tap one: it opens the exact record item).
- Read the 4 guarantees under it: only the record, no advice, no name/phone/birth date sent, automatic validator.
- (Optional, 20 s) **Assistant** tab → *"Est-ce que je peux arrêter mon traitement ?"* → the assistant declines and refers to a professional.

### 5:15 — Fatouma's child vaccination calendar (45 s) · phone
- Sign out → **Fatouma** → **Famille** tab → Ilyas, 18 months.
- Red **"1 vaccin en retard"** with text and icon (not colour alone) and the reminder.
- Calendar: **Fait / En retard / À faire**, every row from the schedule table marked **"à valider par le Ministère"**. Growth curve below.

### 6:00 — Ministry dashboard (1 min) · laptop / projector
- Sign in as **Ministère**. KPIs, enrolled by region, vaccination coverage per vaccine, pregnancies by trimester, complete antenatal follow-up, top 5 chronic conditions — each chart labelled **"Données fictives — démonstration"**.
- Filter **Obock**: small groups appear as **"< 5"** — no re-identification.
- Close: *"The Ministry sees trends, never a person."*

### 7:00 — End

---

## If something goes wrong
- **No network at the venue:** the patient vault still opens from the phone's cache ("Hors ligne — dernières données enregistrées"). For the rest, switch to the **fallback screen recording**.
- **AI summary shows "Résumé indisponible"**: that is the safety fallback (API unreachable or a draft rejected). Say so — it is the guarantee working — and show the admin screen **Contrôle de l'IA**.
- **Camera can't scan:** on Amina's card tap **"Voir ce que voit le soignant"**.

## Fallback recording
Record the full script once on the final environment (screen capture of phone mirror + laptop), ≤ 7 min, and keep it offline on the presentation laptop.
