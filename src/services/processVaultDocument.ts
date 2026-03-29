import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export interface ProcessVaultDocumentParams {
  docId: string;
  originalPath: string;
  fileType: 'image' | 'pdf';
  thumbRef?: string;
  pageCount?: number;
  /** Preferred language for LLM extraction (title, summary, keywords). e.g. 'en' | 'fr' | 'ar'. */
  language?: string;
}

/**
 * Invoke the Cloud Function to run OCR → redaction → Gemini and update the Firestore doc.
 * Call after uploading the original file and creating the document with status 'processing'.
 */
export async function processVaultDocument(params: ProcessVaultDocumentParams): Promise<void> {
  // Debug logging to understand callable invocations and failures during integration.
  // Remove or reduce once the pipeline is stable.
  console.log('[processVaultDocument] calling callable with:', params);

  const process = httpsCallable<ProcessVaultDocumentParams, { ok: boolean }>(
    functions,
    'processVaultDocument'
  );

  try {
    const res = await process(params);
    console.log('[processVaultDocument] callable success:', res.data);
  } catch (e) {
    console.error('[processVaultDocument] callable ERROR:', e);
    throw e;
  }
}
