"use strict";
/**
 * Coffre Cloud Functions: process vault documents (OCR → redact → Gemini → Firestore).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVaultDocument = exports.expandSearchQuery = void 0;
const app_1 = require("firebase-admin/app");
const functions = __importStar(require("firebase-functions"));
const genai_1 = require("@google/genai");
const pipeline_1 = require("./pipeline");
(0, app_1.initializeApp)();
/** Callable: expand a search query into ~10 related keywords using vault context (AI-Boosted search). */
exports.expandSearchQuery = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const body = request.data;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const vaultContext = body?.vaultContext;
    if (!query) {
        return { keywords: [] };
    }
    const categories = Array.isArray(vaultContext?.categories) ? vaultContext.categories : [];
    const sampleTitles = Array.isArray(vaultContext?.sampleTitles) ? vaultContext.sampleTitles : [];
    const contextStr = [
        categories.length ? `Categories in vault: ${categories.join(", ")}` : "",
        sampleTitles.length ? `Sample document titles: ${sampleTitles.slice(0, 20).join("; ")}` : "",
    ]
        .filter(Boolean)
        .join(". ");
    const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
    if (!project) {
        functions.logger.warn("expandSearchQuery: no GCLOUD_PROJECT");
        return { keywords: [] };
    }
    const ai = new genai_1.GoogleGenAI({
        vertexai: true,
        project,
        location,
        apiVersion: "v1",
    });
    const prompt = `You are a search assistant for a personal document vault (Senegal context, French/English). The user is searching for: "${query}".
${contextStr ? `Vault context: ${contextStr}` : ""}

Generate exactly 10 related search keywords or short phrases that could help find relevant documents. Examples: if the user searches "Istanbul" and the vault has category "Voyage", suggest terms like "Billet d'avion", "Hôtel", "Turkish Airlines", "Voyage", "Réservation". Keep keywords short (1–4 words), in French or English, and relevant to administrative/personal documents.

Return ONLY a JSON array of exactly 10 strings, no markdown, no explanation. Example: ["keyword1", "keyword2", ...]`;
    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
        });
        const text = result.text ?? "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return { keywords: [] };
        }
        const keywords = JSON.parse(jsonMatch[0]);
        const list = Array.isArray(keywords)
            ? keywords.filter((k) => typeof k === "string").map((k) => k.trim()).filter(Boolean).slice(0, 10)
            : [];
        return { keywords: list };
    }
    catch (e) {
        functions.logger.error("expandSearchQuery failed", { error: e.message });
        return { keywords: [] };
    }
});
/**
 * Callable: run the processing pipeline for a vault document.
 * Client calls after uploading the original file and creating the Firestore doc with status 'processing'.
 *
 * Body: { docId: string, originalPath: string, fileType?: 'image' | 'pdf', thumbRef?: string, pageCount?: number }
 */
exports.processVaultDocument = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const userId = request.auth.uid;
    const body = request.data;
    const docId = body?.docId;
    const originalPath = body?.originalPath;
    if (typeof docId !== "string" || typeof originalPath !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "docId et originalPath requis.");
    }
    if (!originalPath.startsWith("vault/")) {
        throw new functions.https.HttpsError("invalid-argument", "originalPath doit commencer par vault/.");
    }
    functions.logger.info("processVaultDocument invoked", {
        userId,
        docId,
        originalPath,
        fileTypeHint: body?.fileType,
    });
    const fileType = (body?.fileType === "pdf" ? "pdf" : "image");
    const thumbRef = typeof body?.thumbRef === "string" ? body.thumbRef : undefined;
    const pageCount = typeof body?.pageCount === "number" ? body.pageCount : undefined;
    const rawLang = typeof body?.language === "string" ? body.language.trim().toLowerCase() : "";
    const language = rawLang === "ar" || rawLang === "fr" ? rawLang : "en";
    const input = {
        userId,
        docId,
        originalPath,
        fileType,
        thumbRef,
        pageCount,
        language,
    };
    functions.logger.info("processVaultDocument: starting pipeline", {
        userId,
        docId,
        originalPath,
        fileType,
        hasThumbRef: !!thumbRef,
        pageCount,
        language,
    });
    try {
        await (0, pipeline_1.runPipeline)(input);
        functions.logger.info("processVaultDocument: pipeline completed", { docId });
        return { ok: true };
    }
    catch (e) {
        functions.logger.error("processVaultDocument: pipeline threw error", {
            docId,
            error: e.message,
        });
        throw new functions.https.HttpsError("internal", "Erreur de traitement du document.");
    }
});
//# sourceMappingURL=index.js.map