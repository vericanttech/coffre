/**
 * Pipeline: download from Storage → OCR → redact → Gemini → update Firestore.
 * Spec §5.10.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { GoogleGenAI } from "@google/genai";
import * as functions from "firebase-functions";
import { redact } from "./redact";

const VAULT_COLLECTION = "vault_documents";

/** Base categories (suggested). AI can use these or "custom" + a descriptive label. */
const BASE_CATEGORIES = [
  "famille",
  "identite",
  "sante",
  "ecole",
  "business",
  "maison",
  "vehicule",
] as const;

/** Threshold below which we consider OCR text too short to classify reliably. */
const SHORT_OCR_CHAR_THRESHOLD = 100;

// Lazily get Firestore for the non-default database id so we don't touch
// admin.app() before initializeApp() runs in index.ts.
function getDb() {
  return getFirestore(admin.app(), "coffre-ios");
}

export interface ProcessInput {
  userId: string;
  docId: string;
  originalPath: string;
  fileType: "image" | "pdf";
  thumbRef?: string;
  pageCount?: number;
  /** Preferred language for extraction output: "en" | "fr" | "ar". Default "en". */
  language?: string;
}

interface ExtractionResult {
  category: string;
  customCategory?: string;
  title: string;
  ocrSummary: string;
  keywords: string[];
  extractedFields: {
    date?: string;
    parties?: string[];
    amounts?: string[];
    referenceNumber?: string;
    expiryDate?: string;
  };
  provider: "gemini" | "fallback";
}

const FALLBACK_BY_LANG: Record<string, { title: string }> = {
  en: { title: "Document" },
  fr: { title: "Document" },
  ar: { title: "مستند" },
};

/** App key for unclassified so the UI can translate. */
const UNCLASSIFIED_KEY = "aClassifier";

function fallbackExtraction(language: string = "en"): ExtractionResult {
  const lang = language === "ar" || language === "fr" ? language : "en";
  const { title } = FALLBACK_BY_LANG[lang] ?? FALLBACK_BY_LANG.en;
  return {
    category: "custom",
    customCategory: UNCLASSIFIED_KEY,
    title,
    ocrSummary: "",
    keywords: [],
    extractedFields: {},
    provider: "fallback",
  };
}

/** Download file from Storage and return buffer. */
async function downloadFromStorage(path: string): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  functions.logger.info("pipeline: downloading from storage", { path, bucket: bucket.name });
  const [data] = await bucket.file(path).download();
  functions.logger.info("pipeline: storage download complete", { path, size: data.length });
  return data;
}

/** OCR image with Cloud Vision. */
async function ocrImage(buffer: Buffer): Promise<string> {
  const client = new ImageAnnotatorClient();
  functions.logger.info("pipeline: starting image OCR");
  const [result] = await client.documentTextDetection({
    image: { content: buffer },
  });
  const text = result.fullTextAnnotation?.text?.trim() ?? "";
  const normalized = text.replace(/\r\n/g, "\n");
  functions.logger.info("pipeline: image OCR complete", { length: normalized.length });
  functions.logger.info("pipeline: OCR result (image)", {
    preview: normalized.slice(0, 500),
    fullLength: normalized.length,
  });
  return normalized;
}

/** Extract text from first page of PDF (pdf-parse). */
async function ocrPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  functions.logger.info("pipeline: starting pdf OCR");
  const data = await pdfParse(buffer, { max: 1 });
  const normalized = (data.text ?? "").trim().replace(/\r\n/g, "\n");
  functions.logger.info("pipeline: pdf OCR complete", { length: normalized.length });
  functions.logger.info("pipeline: OCR result (pdf)", {
    preview: normalized.slice(0, 500),
    fullLength: normalized.length,
  });
  return normalized;
}

const LANGUAGE_INSTRUCTIONS: Record<string, { outputLang: string; noneYet: string; shortNote: string; unclassifiedLabel: string }> = {
  en: {
    outputLang: "Respond in English only: title, ocrSummary, keywords, and customCategory must be in English.",
    noneYet: "none yet",
    shortNote:
      "\n\nNOTE: OCR returned very little text. If the document type is unclear (e.g. handwritten, image with no text), set category \"custom\", customCategory \"To classify\", and ocrSummary \"Document saved — to classify if needed.\"",
    unclassifiedLabel: "To classify",
  },
  fr: {
    outputLang: "Réponds en français uniquement : title, ocrSummary, keywords et customCategory doivent être en français.",
    noneYet: "aucune pour l'instant",
    shortNote:
      "\n\nNOTE: L'OCR a retourné très peu de texte. Si le type de document est indéterminable (ex: manuscrit, image sans texte), mets category \"custom\", customCategory \"À classifier\", et ocrSummary \"Document enregistré — à classifier si besoin.\"",
    unclassifiedLabel: "À classifier",
  },
  ar: {
    outputLang: "Respond in Arabic only: title, ocrSummary, keywords, and customCategory must be in Arabic.",
    noneYet: "لا يوجد بعد",
    shortNote:
      "\n\nNOTE: If the document type is unclear, set category \"custom\", customCategory \"للتصنيف\", and ocrSummary accordingly in Arabic.",
    unclassifiedLabel: "للتصنيف",
  },
};

/** Build extraction prompt: flexible category choice based on content; reuse existing labels when relevant. */
function buildExtractionPrompt(
  existingCustomLabels: string[],
  redactedText: string,
  ocrTextShort: boolean,
  language: string = "en"
): string {
  const lang = language === "ar" || language === "fr" ? language : "en";
  const instr = LANGUAGE_INSTRUCTIONS[lang] ?? LANGUAGE_INSTRUCTIONS.en;

  const baseList = BASE_CATEGORIES.join(", ");
  const existingList =
    existingCustomLabels.length > 0
      ? existingCustomLabels.filter((l) => l && l.trim()).join(", ")
      : instr.noneYet;

  const shortNote = ocrTextShort ? instr.shortNote : "";

  return `You are an assistant for administrative documents (Senegal context). From the following text (already anonymized), return ONE valid JSON object, no markdown, with exactly these keys:
- category (string: one of ${baseList} if the document clearly fits, otherwise "custom")
- customCategory (string, required if category === "custom": short descriptive label. Otherwise omit.)
- title (short, max 6 words)
- ocrSummary (one descriptive sentence)
- keywords (array of 5 to 8 keywords)
- extractedFields (object with: date, parties array, amounts array, referenceNumber, expiryDate in ISO YYYY-MM-DD if relevant)

${instr.outputLang}

Rules for category and customCategory:
- Choose the category that best describes the content. Base categories (${baseList}) are suggestions; use them when they clearly match.
- If no base category fits well, use category "custom" and give a precise customCategory. You may reuse a label already used by the user if it matches: ${existingList}.
- Avoid "${instr.unclassifiedLabel}" unless the content is truly unreadable or ambiguous. Prefer a descriptive label when possible.${shortNote}

Text:
---
${redactedText}
---`;
}

/** Build prompt for vision-based extraction (no or very little OCR text). */
function buildVisionExtractionPrompt(
  existingCustomLabels: string[],
  language: string = "en"
): string {
  const lang = language === "ar" || language === "fr" ? language : "en";
  const instr = LANGUAGE_INSTRUCTIONS[lang] ?? LANGUAGE_INSTRUCTIONS.en;
  const baseList = BASE_CATEGORIES.join(", ");
  const existingList =
    existingCustomLabels.length > 0
      ? existingCustomLabels.filter((l) => l && l.trim()).join(", ")
      : instr.noneYet;

  return `You are an assistant for administrative documents (Senegal context). The image provided could not be read reliably by OCR (text is missing or too short).

Analyze the image visually to determine:
- Document type (e.g. "Carte d'Identité", "Facture Senelec", "Permis de conduire", "Reçu", "Contrat", handwritten note, photo, etc.)
- Any visible layout, logos, stamps, or headings that indicate what the document is

Return ONE valid JSON object, no markdown, with exactly these keys:
- category (string: one of ${baseList} if the document clearly fits, otherwise "custom")
- customCategory (string, required if category === "custom": short descriptive label based on what you see. Otherwise omit.)
- title (short, max 6 words, based on visual cues — e.g. "Carte d'identité", "Facture Senelec")
- ocrSummary (one descriptive sentence summarizing what the document appears to be, from visual analysis)
- keywords (array of 5 to 8 keywords you can infer from the document type/layout)
- extractedFields (object with: date, parties array, amounts array, referenceNumber, expiryDate — use empty arrays/omit if not visible)

${instr.outputLang}

Rules:
- Base categories: ${baseList}. Use "custom" with a precise customCategory when no base category fits.
- You may reuse an existing user label if it matches what you see: ${existingList}.
- Be descriptive; avoid "${instr.unclassifiedLabel}" unless the image is truly unreadable.`;
}

/** Call Gemini with the document image/PDF for vision-based extraction when OCR text is empty or too short. */
async function extractWithGeminiVision(
  buffer: Buffer,
  fileType: "image" | "pdf",
  userId: string,
  language: string = "en"
): Promise<ExtractionResult> {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  if (!project) {
    functions.logger.warn("pipeline: no GCLOUD_PROJECT, using fallback for vision");
    return fallbackExtraction(language);
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    apiVersion: "v1",
  });

  const existingCustomLabels = await getExistingCustomCategoryLabels(userId);
  const prompt = buildVisionExtractionPrompt(existingCustomLabels, language);

  const mimeType = fileType === "pdf" ? "application/pdf" : "image/jpeg";
  const b64 = buffer.toString("base64");

  const contents = [
    { inlineData: { data: b64, mimeType } },
    { text: prompt },
  ];

  try {
    functions.logger.info("pipeline: calling gemini vision extraction (no/short OCR text)");
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
    });
    const text = (result as { text?: string }).text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackExtraction(language);
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    functions.logger.info("pipeline: gemini vision extraction success");

    const rawCategory = String(parsed.category ?? "custom").trim().toLowerCase();
    const isBaseCategory = (BASE_CATEGORIES as readonly string[]).includes(rawCategory);
    const category = isBaseCategory ? rawCategory : "custom";
    const fallbackLabel = (LANGUAGE_INSTRUCTIONS[language === "ar" || language === "fr" ? language : "en"] ?? LANGUAGE_INSTRUCTIONS.en).unclassifiedLabel;
    let customCategory =
      category === "custom"
        ? String(
            parsed.customCategory ?? (isBaseCategory ? undefined : rawCategory) ?? fallbackLabel
          ).trim().slice(0, 80) || fallbackLabel
        : undefined;
    const norm = customCategory?.trim() ?? "";
    const isUnclassified =
      norm.toLowerCase() === "to classify" ||
      norm.toLowerCase() === "à classifier" ||
      norm === "للتصنيف";
    if (customCategory && isUnclassified) {
      customCategory = UNCLASSIFIED_KEY;
    }

    return {
      category,
      customCategory: customCategory || undefined,
      title: String(parsed.title ?? "Document").slice(0, 80),
      ocrSummary: String(parsed.ocrSummary ?? ""),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      extractedFields: toExtractedFields(parsed),
      provider: "gemini",
    };
  } catch (e) {
    functions.logger.error("pipeline: gemini vision extraction failed, falling back", {
      error: (e as Error).message,
    });
    return fallbackExtraction(language);
  }
}

/** Call Gemini via Vertex AI (Firebase AI). Uses Application Default Credentials — no API key. */
async function extractWithGemini(
  redactedText: string,
  userId: string,
  ocrTextShort: boolean,
  language: string = "en"
): Promise<ExtractionResult> {
  if (!redactedText || redactedText.length < 10) return fallbackExtraction(language);

  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  if (!project) {
    functions.logger.warn("pipeline: no GCLOUD_PROJECT, using fallback");
    return fallbackExtraction(language);
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    apiVersion: "v1",
  });

  const existingCustomLabels = await getExistingCustomCategoryLabels(userId);
  const prompt = buildExtractionPrompt(existingCustomLabels, redactedText, ocrTextShort, language);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    const text = (result as { text?: string }).text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackExtraction(language);
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    functions.logger.info("pipeline: gemini extraction success");

    const rawCategory = String(parsed.category ?? "custom").trim().toLowerCase();
    const isBaseCategory = (BASE_CATEGORIES as readonly string[]).includes(rawCategory);
    const category = isBaseCategory ? rawCategory : "custom";
    const fallbackLabel = (LANGUAGE_INSTRUCTIONS[language === "ar" || language === "fr" ? language : "en"] ?? LANGUAGE_INSTRUCTIONS.en).unclassifiedLabel;
    let customCategory =
      category === "custom"
        ? String(
            parsed.customCategory ?? (isBaseCategory ? undefined : rawCategory) ?? fallbackLabel
          ).trim().slice(0, 80) || fallbackLabel
        : undefined;
    // Normalize unclassified labels to app key so the UI can translate
    const norm = customCategory?.trim() ?? "";
    const isUnclassified =
      norm.toLowerCase() === "to classify" ||
      norm.toLowerCase() === "à classifier" ||
      norm === "للتصنيف";
    if (customCategory && isUnclassified) {
      customCategory = UNCLASSIFIED_KEY;
    }

    return {
      category,
      customCategory: customCategory || undefined,
      title: String(parsed.title ?? "Document").slice(0, 80),
      ocrSummary: String(parsed.ocrSummary ?? ""),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      extractedFields: toExtractedFields(parsed),
      provider: "gemini",
    };
  } catch (e) {
    functions.logger.error("pipeline: gemini extraction failed, falling back", { error: (e as Error).message });
    return fallbackExtraction(language);
  }
}

function toExtractedFields(parsed: Record<string, unknown>): ExtractionResult["extractedFields"] {
  const ef = parsed.extractedFields;
  if (!ef || typeof ef !== "object") return {};
  const o = ef as Record<string, unknown>;
  return {
    date: o.date != null ? String(o.date) : undefined,
    parties: Array.isArray(o.parties) ? o.parties.map(String) : undefined,
    amounts: Array.isArray(o.amounts) ? o.amounts.map(String) : undefined,
    referenceNumber: o.referenceNumber != null ? String(o.referenceNumber) : undefined,
    expiryDate: o.expiryDate != null ? String(o.expiryDate) : undefined,
  };
}

/** Firestore does not accept undefined. Return object with only defined values. */
function extractedFieldsForFirestore(
  fields: ExtractionResult["extractedFields"]
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (fields.date !== undefined) out.date = fields.date;
  if (fields.parties !== undefined) out.parties = fields.parties;
  if (fields.amounts !== undefined) out.amounts = fields.amounts;
  if (fields.referenceNumber !== undefined) out.referenceNumber = fields.referenceNumber;
  if (fields.expiryDate !== undefined) out.expiryDate = fields.expiryDate;
  return out;
}

/** Get existing custom category labels (customCategory) for user, to suggest reuse. */
async function getExistingCustomCategoryLabels(userId: string): Promise<string[]> {
  const snap = await getDb()
    .collection(VAULT_COLLECTION)
    .where("userId", "==", userId)
    .limit(500)
    .get();
  const set = new Set<string>();
  snap.docs.forEach((d) => {
    if (d.get("category") !== "custom") return;
    const label = d.get("customCategory");
    if (label && typeof label === "string" && label.trim()) set.add(label.trim());
  });
  return Array.from(set).sort();
}

/** Merge redaction map values into keywords (for search); map is not stored. */
function mergeKeywordsFromMap(keywords: string[], redactionMap: Record<string, string>): string[] {
  const added = new Set(keywords);
  Object.values(redactionMap).forEach((v) => {
    if (v && v.length <= 50) added.add(v);
  });
  return Array.from(added).slice(0, 15);
}

export async function runPipeline(input: ProcessInput): Promise<void> {
  const { userId, docId, originalPath, fileType, thumbRef, pageCount, language = "en" } = input;
  const db = getDb();
  const docRef = db.collection(VAULT_COLLECTION).doc(docId);

  functions.logger.info("pipeline: runPipeline start", {
    userId,
    docId,
    originalPath,
    fileType,
    hasThumbRef: !!thumbRef,
    pageCount,
    language,
  });

  let rawText: string;
  let buffer: Buffer | null = null;
  try {
    buffer = await downloadFromStorage(originalPath);
    rawText = fileType === "pdf" ? await ocrPdf(buffer) : await ocrImage(buffer);
  } catch (e) {
    functions.logger.error("pipeline: OCR step failed, marking ocr_failed", {
      error: (e as Error).message,
      originalPath,
    });
    const fallback = FALLBACK_BY_LANG[language === "ar" || language === "fr" ? language : "en"] ?? FALLBACK_BY_LANG.en;
    await docRef.set(
      {
        status: "ocr_failed",
        customCategory: UNCLASSIFIED_KEY,
        title: fallback.title,
        ocrSummary: "",
        keywords: [],
        extractedFields: {},
        extractionProvider: "fallback",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const emptyOrFailed = !rawText || rawText.length < 3;
  const { redactedText, redactionMap } = redact(rawText);
  functions.logger.info("pipeline: redaction complete", {
    rawLength: rawText.length,
    redactedLength: redactedText.length,
  });

  let extraction: ExtractionResult;
  const useVisionFallback =
    (emptyOrFailed || !redactedText || redactedText.length < SHORT_OCR_CHAR_THRESHOLD) &&
    buffer != null;

  if (useVisionFallback) {
    functions.logger.info("pipeline: using vision fallback (empty/short OCR text)");
    extraction = await extractWithGeminiVision(buffer, fileType, userId, language);
  } else if (emptyOrFailed || !redactedText) {
    functions.logger.info("pipeline: using fallback extraction due to empty/failed OCR (no buffer)");
    extraction = fallbackExtraction(language);
  } else {
    const ocrTextShort = redactedText.length < SHORT_OCR_CHAR_THRESHOLD;
    functions.logger.info("pipeline: calling gemini extraction", { userId, ocrTextShort, language });
    extraction = await extractWithGemini(redactedText, userId, ocrTextShort, language);
  }

  const keywords = mergeKeywordsFromMap(extraction.keywords, redactionMap);
  const status = emptyOrFailed ? "ocr_failed" : extraction.provider === "fallback" ? "extraction_failed" : "ready";

  functions.logger.info("pipeline: updating firestore document", {
    docId,
    status,
    category: extraction.category,
    provider: extraction.provider,
    keywordCount: keywords.length,
  });

  await docRef.set(
    {
      category: extraction.category,
      customCategory: extraction.customCategory ?? null,
      title: extraction.title,
      ocrSummary: extraction.ocrSummary,
      keywords,
      extractedFields: extractedFieldsForFirestore(extraction.extractedFields),
      status,
      extractionProvider: extraction.provider,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(thumbRef != null ? { thumbRef } : {}),
      ...(pageCount != null ? { pageCount } : {}),
    },
    { merge: true }
  );

  functions.logger.info("pipeline: runPipeline finished", { docId, status });
}
