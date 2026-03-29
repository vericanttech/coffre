import { useState, useRef } from 'react';
import { Image as ImageIcon, FileText, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { newDocId, uploadFile, createDocument, getExistingCategories, storagePath } from '@/services/vaultStorage';
import { processVaultDocument } from '@/services/processVaultDocument';
import { logUploadStart, logUploadSuccess, logUploadFailure } from '@/lib/analytics';
import { useTheme } from '@/context/ThemeContext';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { renderPdfFirstPageThumb } from '@/utils/pdfThumb';
import { UNCLASSIFIED_CATEGORY_KEY } from '@/theme/categories';
import i18n from '@/i18n';
import type { TFunction } from 'i18next';

/** Current app language for LLM extraction: en | fr | ar */
function getAppLanguage(): string {
  const l = i18n.language;
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('fr')) return 'fr';
  return 'en';
}

interface UploadModalProps {
  userId: string;
  onClose: () => void;
}

type Step = 'options' | 'review' | 'processing' | 'error';

export function UploadModal({ userId, onClose }: UploadModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isDesktop = useIsDesktop();
  const [step, setStep] = useState<Step>('options');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(() => t('upload.preparing'));
  const [files, setFiles] = useState<File[]>([]);
  const [groupTogether, setGroupTogether] = useState(false);
  const inputImagesRef = useRef<HTMLInputElement>(null);
  const inputPdfRef = useRef<HTMLInputElement>(null);

  const isPdf = (f: File) => f.type === 'application/pdf';
  const isImage = (f: File) => /^image\//.test(f.type);

  function openImages() {
    logUploadStart('images');
    inputImagesRef.current?.click();
  }

  function openPdfs() {
    logUploadStart('pdf');
    inputPdfRef.current?.click();
  }

  function onImagesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []).filter(isImage);
    e.target.value = '';
    if (chosen.length === 0) return;
    setFiles((prev) => {
      const merged = step === 'review' ? [...prev, ...chosen] : chosen;
      return merged.slice(0, 10);
    });
    if (step !== 'review') setStep('review');
  }

  function onPdfsSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []).filter(isPdf);
    e.target.value = '';
    if (chosen.length === 0) return;
    setError(null);
    setStep('processing');
    setMessage(t('upload.preparing'));
    uploadPdfs(userId, chosen, setMessage, () => {
      setStep('options');
      onClose();
    }, (err) => {
      setError(err);
      setStep('error');
    }, t, getAppLanguage());
  }

  async function startUpload() {
    setError(null);
    setStep('processing');
    setMessage(t('upload.savingToVault'));
    try {
      const categories = await getExistingCategories(userId);
      const language = getAppLanguage();
      if (groupTogether && files.length >= 2) {
        await uploadMultiPage(userId, files, categories, setMessage, t, language);
      } else {
        await uploadImagesOneByOne(userId, files, categories, setMessage, t, language);
      }
      logUploadSuccess('images');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.error');
      setError(msg);
      setStep('error');
      logUploadFailure(msg);
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: isDesktop ? 'center' : 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const panelStyle: React.CSSProperties = {
    background: colors.surface,
    ...(isDesktop ? { borderRadius: 20 } : { borderTopLeftRadius: 20, borderTopRightRadius: 20 }),
    padding: isDesktop ? 32 : 24,
    width: '100%',
    maxWidth: isDesktop ? 520 : 480,
    minWidth: isDesktop ? 400 : undefined,
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const optionBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '16px 18px',
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    color: colors.text1,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 10,
  };

  if (step === 'options') {
    return (
      <div
        style={overlayStyle}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ marginBottom: 20, fontSize: 20 }}>{t('upload.addDocument')}</h2>
          <input
            ref={inputImagesRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onImagesSelected}
          />
          <input
            ref={inputPdfRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={onPdfsSelected}
          />
          <button type="button" style={optionBtn} onClick={openImages}>
            <ImageIcon size={24} strokeWidth={2} />
            {t('upload.images')}
          </button>
          <button type="button" style={optionBtn} onClick={openPdfs}>
            <FileText size={24} strokeWidth={2} />
            {t('upload.pdfs')}
          </button>
          <button
            type="button"
            style={{ ...optionBtn, background: 'transparent', color: colors.text2 }}
            onClick={onClose}
          >
            {t('upload.cancel')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div
        style={overlayStyle}
        onClick={(e) => {
          if (e.target === e.currentTarget && step !== 'review') onClose();
        }}
      >
        <input
          ref={inputImagesRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onImagesSelected}
        />
        <div
          style={{
            ...panelStyle,
            ...(!isDesktop && { minHeight: '55vh', maxHeight: '85vh' }),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginBottom: 16 }}>{t('upload.saveImages', { count: files.length })}</h2>
          {files.length >= 2 && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 20,
                padding: '14px 16px',
                minHeight: 52,
                borderRadius: 12,
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={groupTogether}
                onChange={(e) => setGroupTogether(e.target.checked)}
                style={{ width: 22, height: 22, accentColor: colors.primary, flexShrink: 0 }}
              />
              <span style={{ fontSize: 16, fontWeight: 500, color: colors.text1 }}>{t('upload.linkAsOne')}</span>
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-start' }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    background: colors.surface3,
                    overflow: 'hidden',
                  }}
                >
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={t('upload.remove')}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    background: colors.red,
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {files.length < 10 && (
              <button
                type="button"
                onClick={() => inputImagesRef.current?.click()}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  border: `2px dashed ${colors.border}`,
                  background: colors.surface2,
                  color: colors.text2,
                  fontSize: 12,
                  cursor: 'pointer',
                  lineHeight: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
                title={t('upload.addImage')}
              >
                <Plus size={20} strokeWidth={2.5} />
                <span>{t('upload.add')}</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <button type="button" style={{ ...optionBtn, flex: 0, width: 'auto', minWidth: 100 }} onClick={() => { setFiles([]); setStep('options'); }}>
              {t('upload.back')}
            </button>
            <button
              type="button"
              style={{ ...optionBtn, flex: 1, background: colors.primary, color: colors.bg, border: 'none' }}
              onClick={startUpload}
              disabled={files.length === 0}
            >
              {t('upload.saveButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ marginBottom: 12, fontSize: 15, color: colors.text1 }}>{message}</div>
            <div style={{ width: 32, height: 32, border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 8, color: colors.red }}>{t('upload.errorTitle')}</h2>
        <p style={{ color: colors.text2, marginBottom: 20 }}>{error}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={optionBtn} onClick={() => { setError(null); setStep('options'); }}>{t('upload.retry')}</button>
          <button type="button" style={optionBtn} onClick={onClose}>{t('upload.close')}</button>
        </div>
      </div>
    </div>
  );
}

async function uploadPdfs(
  userId: string,
  pdfs: File[],
  setMessage: (m: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  t: TFunction,
  language: string
) {
  for (let i = 0; i < pdfs.length; i++) {
    setMessage(t('upload.savingPdf', { current: i + 1, total: pdfs.length }));
    console.log('[uploadPdfs] handling PDF', {
      index: i,
      total: pdfs.length,
      name: pdfs[i].name,
      type: pdfs[i].type,
      size: pdfs[i].size,
    });
    const docId = newDocId();
    try {
      // Parallel: create thumb and upload original (PDF needs no resize)
      const [thumbBlob] = await Promise.all([
        renderPdfFirstPageThumb(pdfs[i], 800),
        uploadFile(userId, docId, 'original.pdf', pdfs[i]),
      ]);
      const thumbPath = await uploadFile(userId, docId, 'thumb.jpg', thumbBlob);
      // Fire-and-forget Firestore doc; backend pipeline will also upsert.
      createDocument(userId, docId, {
        originalRef: `vault/${userId}/${docId}/original.pdf`,
        thumbRef: thumbPath,
        fileType: 'pdf',
        category: 'custom',
        customCategory: UNCLASSIFIED_CATEGORY_KEY,
        title: pdfs[i].name.replace(/\.pdf$/i, '') || 'Document',
        ocrSummary: '',
        keywords: [],
        extractedFields: {},
        status: 'processing',
        pageCount: 1,
      })
        .then(() => {
          console.log('[uploadPdfs] createDocument done', { docId });
        })
        .catch((e) => {
          console.error('[uploadPdfs] createDocument ERROR', e);
        });

      console.log('[uploadPdfs] about to call processVaultDocument', {
        docId,
        originalPath: storagePath(userId, docId, 'original.pdf'),
      });
      processVaultDocument({
        docId,
        originalPath: storagePath(userId, docId, 'original.pdf'),
        fileType: 'pdf',
        thumbRef: thumbPath,
        pageCount: 1,
        language,
      }).catch((e) => {
        // Temporary: surface callable errors in the browser console for debugging.
        // You can remove this once everything is stable.
        console.error('processVaultDocument(pdf) failed', e);
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
      return;
    }
  }
  onDone();
}

async function uploadImagesOneByOne(
  userId: string,
  files: File[],
  _categories: string[],
  setMessage: (m: string) => void,
  t: TFunction,
  language: string
) {
  for (let i = 0; i < files.length; i++) {
    try {
      setMessage(t('upload.savingCount', { current: i + 1, total: files.length }));
      console.log('[uploadImagesOneByOne] handling image', {
        index: i,
        total: files.length,
        name: files[i].name,
        type: files[i].type,
        size: files[i].size,
      });
      const docId = newDocId();
      // Parallel create, then parallel upload
      const [thumb, originalBlob] = await Promise.all([
        resizeImage(files[i], 800),
        resizeImage(files[i], 1920),
      ]);
      await Promise.all([
        uploadFile(userId, docId, 'thumb.jpg', thumb),
        uploadFile(userId, docId, 'original.jpg', originalBlob),
      ]);
      console.log('[uploadImagesOneByOne] before createDocument', { docId });
      // Fire-and-forget Firestore doc; backend pipeline will also upsert.
      createDocument(userId, docId, {
        originalRef: `vault/${userId}/${docId}/original.jpg`,
        thumbRef: `vault/${userId}/${docId}/thumb.jpg`,
        fileType: 'image',
        category: 'custom',
        customCategory: UNCLASSIFIED_CATEGORY_KEY,
        title: 'Document',
        ocrSummary: '',
        keywords: [],
        extractedFields: {},
        status: 'processing',
        pageCount: 1,
      })
        .then(() => {
          console.log('[uploadImagesOneByOne] createDocument done', { docId });
        })
        .catch((e) => {
          console.error('[uploadImagesOneByOne] createDocument ERROR', e);
        });

      console.log('[uploadImagesOneByOne] about to call processVaultDocument', {
        docId,
        originalPath: storagePath(userId, docId, 'original.jpg'),
      });
      processVaultDocument({
        docId,
        originalPath: storagePath(userId, docId, 'original.jpg'),
        fileType: 'image',
        thumbRef: storagePath(userId, docId, 'thumb.jpg'),
        pageCount: 1,
        language,
      }).catch((e) => {
        console.error('processVaultDocument(image) failed (inner catch)', e);
      });
    } catch (e) {
      console.error('[uploadImagesOneByOne] ERROR in loop', e);
      throw e;
    }
  }
}

async function uploadMultiPage(
  userId: string,
  files: File[],
  _categories: string[],
  setMessage: (m: string) => void,
  t: TFunction,
  language: string
) {
  const docId = newDocId();
  setMessage(t('upload.assembling'));
  console.log('[uploadMultiPage] starting multipage upload', {
    docId,
    count: files.length,
    files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  });
  // Parallel create: thumb + all page blobs
  const [thumbBlob, ...pageBlobs] = await Promise.all([
    resizeImage(files[0], 800),
    ...files.map((f) => resizeImage(f, 1920)),
  ]);
  // Parallel upload: thumb + all pages
  setMessage(t('upload.sendingFiles', { count: files.length + 1 }));
  const [thumbPath, ...pagePaths] = await Promise.all([
    uploadFile(userId, docId, 'thumb.jpg', thumbBlob),
    ...pageBlobs.map((blob, i) => uploadFile(userId, docId, `page_${i}.jpg`, blob)),
  ]);
  const paths = pagePaths as string[];
  // Fire-and-forget Firestore doc; backend pipeline will also upsert.
  createDocument(userId, docId, {
    originalRef: paths[0],
    thumbRef: thumbPath,
    originalRefs: paths,
    fileType: 'image',
    category: 'custom',
    customCategory: UNCLASSIFIED_CATEGORY_KEY,
    title: 'Document multi-pages',
    ocrSummary: '',
    keywords: [],
    extractedFields: {},
    status: 'processing',
    pageCount: paths.length,
  })
    .then(() => {
      console.log('[uploadMultiPage] createDocument done', { docId });
    })
    .catch((e) => {
      console.error('[uploadMultiPage] createDocument ERROR', e);
    });

  console.log('[uploadMultiPage] about to call processVaultDocument', {
    docId,
    originalPath: paths[0],
  });
  processVaultDocument({
    docId,
    originalPath: paths[0],
    fileType: 'image',
    thumbRef: storagePath(userId, docId, 'thumb.jpg'),
    pageCount: paths.length,
    language,
  }).catch((e) => {
    console.error('processVaultDocument(multipage) failed', e);
  });
}

function resizeImage(file: File, maxEdge: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = maxEdge / Math.max(w, h);
      const W = Math.round(w * scale);
      const H = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('load'));
    img.src = url;
  });
}
