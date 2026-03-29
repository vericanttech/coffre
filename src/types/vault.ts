/** §4.2 VaultDocument */
export interface VaultExtractedFields {
  date?: string | null;
  parties?: string[];
  amounts?: string[];
  referenceNumber?: string | null;
  expiryDate?: string | null; // ISO YYYY-MM-DD
}

export interface VaultDocument {
  id: string;
  userId: string;
  originalRef: string;
  thumbRef: string;
  originalRefs?: string[] | null;
  fileType: 'image' | 'pdf';
  category: string;
  customCategory?: string | null;
  title: string;
  ocrSummary: string;
  keywords: string[];
  extractedFields: VaultExtractedFields;
  status: 'processing' | 'ready' | 'ocr_failed' | 'extraction_failed';
  extractionProvider?: string | null;
  pageCount: number;
  createdAt: { seconds: number; nanoseconds?: number } | Date;
  updatedAt: { seconds: number; nanoseconds?: number } | Date;
}

export type DocCategory =
  | 'famille' | 'identite' | 'sante' | 'ecole' | 'business' | 'maison' | 'vehicule' | 'custom';
