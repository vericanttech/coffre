# Gemini prompt and redaction logic

This document describes the **redaction** step (raw OCR text is anonymized before leaving the pipeline) and the **Gemini** extraction prompt used in the Cloud Function pipeline. Implementation lives in `functions/src/redact.ts` and `functions/src/pipeline.ts`.

---

## 1. Redaction logic (§5.7)

Raw OCR/text is **never** sent to Gemini as-is. It is redacted first: sensitive patterns are replaced by placeholders, and a **redaction map** (original → placeholder) is kept in memory only for merging back into **keywords** for search; the map is **never stored**.

**Order of application:** patterns are applied in sequence to the raw text. The first match wins for each placeholder key in the map.

| Pattern | Placeholder | Description |
|--------|-------------|-------------|
| **NINEA** | `[NINEA]` | 9 chars: 7 digits + 1 letter + 1 digit (e.g. `1234567A9`). Regex: `\b(\d{7}[A-Za-z]\d)\b` |
| **CNI** | `[NUM_ID]` | Exactly 13 digits. Regex: `\b(\d{13})\b` |
| **Phone (Senegal)** | `[TELEPHONE]` | +221/221 optional, then 7x or 3x + 8 digits, with optional spaces/dots. Regex: `(?:\+221\|221)?\s*[73]\d[\s.]?\d{3}[\s.]?\d{2}[\s.]?\d{2}` |
| **Birth date** | `[DATE_XX/XX/YYYY]` | Full date `d/m/yyyy` or `dd/mm/yyyy`; replaced by placeholder that keeps only the year (e.g. `[DATE_XX/XX/1985]`). Regex: `\b(\d{1,2})/(\d{1,2})/(\d{4})\b` |
| **Address** | `[ADRESSE]` | Line starting with: rue, avenue, av., villa, cité, lot (case-insensitive). Regex: `^(rue\|avenue\|av\.\|villa\|cité\|lot)\s+.+$` (multiline) |
| **Name (after label)** | `[NOM]` | After "Nom :", "Prénom :", "Nom de naissance :" — the value on the same line is replaced. Regex: `(?:Nom\|Prénom\|Nom de naissance)\s*:\s*([^\n]+)` → replace capture with `Nom : [NOM]` |
| **Name (after title)** | `[NOM]` | After "M.", "Mme", "Monsieur", "Madame" — the following name (letters, hyphens, apostrophes, spaces, to next newline or next title). Regex: `\b(M\.\|Mme\|Monsieur\|Madame)\s+([A-Za-zÀ-ÿ\-'\s]+?)(?=\n\|$\|M\.\|…)` → replace with `{prefix} [NOM]` |

**Result:** `redact(rawText)` returns `{ redactedText, redactionMap }`. Only `redactedText` is sent to Gemini. The `redactionMap` is used later to merge original values back into **keywords** for search (see below); the map is not persisted.

---

## 2. Keyword merge (after Gemini)

Gemini returns **keywords** from the redacted text. To improve search, the pipeline **adds** the original redacted values (from `redactionMap`) into the keyword list, so search can still match on e.g. a NINEA or a name, while Gemini never saw the raw value.

- **Logic:** Start with Gemini’s keyword array; add each value from `redactionMap` that is non-empty and length ≤ 50; dedupe; keep at most 15 keywords.
- **Code:** `mergeKeywordsFromMap(extraction.keywords, redactionMap)` in `pipeline.ts`.

---

## 3. Gemini extraction prompt

**Model:** `gemini-2.5-flash-lite` (Vertex AI, no API key; Application Default Credentials).

**Input:** Redacted text only (no raw OCR). The prompt is built by `buildExtractionPrompt()` with:
- **Base categories** (fixed): `famille`, `identite`, `sante`, `ecole`, `business`, `maison`, `vehicule`.
- **Known custom labels**: from the user’s existing docs, **excluding** base categories — sorted list so the model can **reuse** an existing custom name (e.g. "Facture") instead of inventing a new one.
- **Short-OCR note** (when redacted text length &lt; 100 chars): instructs the model to use `category: "custom"`, `customCategory: "À classifier"`, and a short summary so the user can classify or rename manually. Threshold: `SHORT_OCR_CHAR_THRESHOLD` in `pipeline.ts`.

**Prompt (structure):**

```
Tu es un assistant pour des documents administratifs sénégalais. ...
- category (une de: {baseList}, ou "custom")
- customCategory (string, uniquement si category === "custom" — ne renseigne pas sinon)
- title, ocrSummary, keywords, extractedFields ...

Règle pour category et customCategory: Utilise d'abord une catégorie de base quand le document correspond: {baseList}. Si aucune ne correspond, utilise category "custom" et customCategory = soit un libellé personnalisé déjà connu (liste ci-dessous), soit un nouveau libellé court en français (ex: Facture, Reçu). Libellés personnalisés déjà utilisés par l'utilisateur: {customLabelList}. [Si OCR court: NOTE pour "À classifier" si type indéterminable.]

Texte:
---
{redactedText}
---
```

- **Base categories** are always listed; **custom labels** are the user’s existing custom category names (e.g. "Facture", "À classifier") so the model can reuse them when appropriate.
- **Category rule:** (1) Prefer a **base** category when the document fits. (2) If none fits → use `custom` and set `customCategory` to either a **known custom label** from the list (reuse) or a **new** short French label. (3) When OCR text is very short, the prompt adds a NOTE: if the model cannot determine document type, use `custom` + `"À classifier"` and a standard summary.

**Response handling:**

- The reply is parsed by taking the first substring that looks like a JSON object (regex `\{[\s\S]*\}`).
- That object is parsed; missing or invalid keys fall back to defaults.
- **category:** one of the fixed list; default `"custom"`.
- **customCategory:** string if category is custom; else omitted.
- **title:** string, truncated to 80 chars.
- **ocrSummary:** string.
- **keywords:** array of strings.
- **extractedFields:** object with optional `date`, `parties` (array), `amounts` (array), `referenceNumber`, `expiryDate` (ISO YYYY-MM-DD). Only defined fields are written to Firestore.

If parsing fails or Gemini throws, the pipeline uses **fallback extraction**: category `custom`, customCategory `À classifier`, title `Document`, empty ocrSummary/keywords/extractedFields, provider `fallback`.

---

## 4. Pipeline order (recap)

1. **OCR** → raw text (Vision for images, pdf-parse for PDF first page).
2. **Redact** → `redactedText` + `redactionMap` (in memory only).
3. **Gemini** → receives only `redactedText`; returns category, title, ocrSummary, keywords, extractedFields.
4. **Merge keywords** → `mergeKeywordsFromMap(geminiKeywords, redactionMap)` → final keyword list for Firestore (so search can hit original values).
5. **Write Firestore** → category, customCategory, title, ocrSummary, merged keywords, extractedFields, status, etc. The redaction map is **not** stored.
