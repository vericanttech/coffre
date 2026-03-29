import { useState, useEffect, useCallback } from 'react';
import { Download, Share2, Trash2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDownloadUrl, getFileBlob, updateDocument, updateDocumentKeywords, deleteDocument } from '@/services/vaultStorage';
import { updateDocumentInMirror, addPendingWrite } from '@/services/offlineVaultDb';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCategoryLabel } from '@/theme/categories';
import { useTheme } from '@/context/ThemeContext';
import { useOverlayBack } from '@/context/BackHandlerContext';
import { PdfComposerModal } from '@/components/PdfComposerModal';
import type { VaultDocument } from '@/types/vault';

const CATEGORY_KEYS = ['famille', 'identite', 'sante', 'ecole', 'business', 'maison', 'vehicule', 'custom'] as const;

/** §4.2: resolve all page refs for viewing */
function getPageRefs(doc: VaultDocument): string[] {
  if (doc.originalRefs && doc.originalRefs.length > 1) return doc.originalRefs;
  return [doc.originalRef];
}

function getFileExtension(path: string): string {
  const m = path.match(/\.(pdf|jpg|jpeg|png|webp|gif)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

interface DocumentDetailScreenProps {
  doc: VaultDocument;
  userId: string;
  onClose: () => void;
  isDesktop: boolean;
}

export function DocumentDetailScreen({ doc, userId, onClose, isDesktop }: DocumentDetailScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useOnlineStatus();
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.text1,
    fontSize: 13,
  };
  const pageRefs = getPageRefs(doc);
  const [currentIndex, setCurrentIndex] = useState(0);
  /** URL used for display: thumbnail on first page, original on other pages (no thumb per page) */
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadingDisplay, setLoadingDisplay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(doc.title);
  const [shareBusy, setShareBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [shareFallbackMessage, setShareFallbackMessage] = useState<string | null>(null);
  const [categoryValue, setCategoryValue] = useState(doc.category);
  const [customCategoryValue, setCustomCategoryValue] = useState(doc.customCategory ?? '');
  /** User-editable search tags (displayed as comma/space-separated; merged with doc.keywords on save). */
  const [searchTagsInput, setSearchTagsInput] = useState('');
  /** Short-lived message after saving offline */
  const [offlineSavedMessage, setOfflineSavedMessage] = useState(false);
  const [showPdfComposer, setShowPdfComposer] = useState(false);

  useOverlayBack(showPdfComposer && pageRefs.length > 1, useCallback(() => setShowPdfComposer(false), []));

  const currentRef = pageRefs[currentIndex];
  const isFirstPage = currentIndex === 0;
  const displayRef = isFirstPage ? doc.thumbRef : currentRef;

  // Display: thumbnail for first page, original for other pages (no thumb for page 2+)
  useEffect(() => {
    let cancelled = false;
    setLoadingDisplay(true);
    setError(null);
    setDisplayUrl(null);
    getDownloadUrl(displayRef)
      .then((url) => {
        if (!cancelled) {
          setDisplayUrl(url);
          setLoadingDisplay(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('documentDetail.loadError'));
          setLoadingDisplay(false);
        }
      });
    return () => {
      cancelled = true;
      setDisplayUrl(null);
    };
  }, [displayRef]);

  /**
   * Get file as blob via Storage SDK, then share the actual file (no Firebase URL shared).
   * Uses getFileBlob(path) to avoid CORS issues that fetch(downloadURL) can cause when bucket CORS is not set.
   */
  const handleShare = useCallback(async () => {
    setShareFallbackMessage(null);
    setShareBusy(true);
    try {
      const blob = await getFileBlob(currentRef);
      const ext = getFileExtension(currentRef);
      const name = `${doc.title.replace(/[^\w\s-]/g, '')}.${ext}`;
      const file = new File([blob], name, { type: blob.type || (doc.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg') });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: doc.title });
      } else {
        setShareFallbackMessage(t('documentDetail.shareFallback'));
      }
    } catch (err) {
      setShareFallbackMessage(t('documentDetail.shareFallback'));
    } finally {
      setShareBusy(false);
    }
  }, [currentRef, doc.title, doc.fileType]);

  /** Get file as blob via Storage SDK, then download the actual file (no Firebase URL in download). */
  const handleDownload = useCallback(async () => {
    setDownloadBusy(true);
    try {
      const blob = await getFileBlob(currentRef);
      const ext = getFileExtension(currentRef);
      const name = `${doc.title.replace(/[^\w\s-]/g, '')}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadBusy(false);
    }
  }, [currentRef, doc.title]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('documentDetail.confirmDelete'))) return;
    setDeleteBusy(true);
    try {
      await deleteDocument(userId, doc.id);
      onClose();
    } catch (e) {
      console.error('[DocumentDetailScreen] delete failed', e);
      setDeleteBusy(false);
    }
  }, [userId, doc.id, onClose]);

  const handleSaveTitle = useCallback(() => {
    setEditingTitle(false);
    const t = titleValue.trim();
    if (!t || t === doc.title) {
      setTitleValue(doc.title);
      return;
    }
    if (online) {
      updateDocument(doc.id, { title: t }).catch(() => {});
    } else {
      updateDocumentInMirror(userId, doc.id, { title: t }).then(() => {
        addPendingWrite(userId, 'document', doc.id, { title: t }).catch(() => {});
        setOfflineSavedMessage(true);
        setTimeout(() => setOfflineSavedMessage(false), 3000);
      });
    }
  }, [doc.id, doc.title, titleValue, online, userId]);

  const handleSaveCategory = useCallback(() => {
    const cat = categoryValue;
    const custom = cat === 'custom' ? (customCategoryValue.trim() || null) : null;
    if (cat === doc.category && custom === (doc.customCategory ?? null)) return;
    if (online) {
      updateDocument(doc.id, { category: cat, customCategory: custom }).catch(() => {});
    } else {
      updateDocumentInMirror(userId, doc.id, { category: cat, customCategory: custom }).then(() => {
        addPendingWrite(userId, 'document', doc.id, { category: cat, customCategory: custom }).catch(() => {});
        setOfflineSavedMessage(true);
        setTimeout(() => setOfflineSavedMessage(false), 3000);
      });
    }
  }, [doc.id, doc.category, doc.customCategory, categoryValue, customCategoryValue, online, userId]);

  /** Parse search tags from input (split by comma or space), then merge with existing AI keywords and save. */
  const handleSaveSearchTags = useCallback(() => {
    const raw = searchTagsInput.trim();
    const newTags = raw ? raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : [];
    const existing = doc.keywords ?? [];
    const seen = new Set(existing.map((k) => k.toLowerCase()));
    const merged = [...existing];
    for (const tag of newTags) {
      if (!seen.has(tag.toLowerCase())) {
        seen.add(tag.toLowerCase());
        merged.push(tag);
      }
    }
    if (merged.length === existing.length && newTags.length === 0) return;
    setSearchTagsInput('');
    if (online) {
      updateDocumentKeywords(doc.id, merged).catch(() => {});
    } else {
      updateDocumentInMirror(userId, doc.id, { keywords: merged }).then(() => {
        addPendingWrite(userId, 'keywords', doc.id, { keywords: merged }).catch(() => {});
        setOfflineSavedMessage(true);
        setTimeout(() => setOfflineSavedMessage(false), 3000);
      });
    }
  }, [doc.id, doc.keywords, searchTagsInput, online, userId]);

  const isPdf = doc.fileType === 'pdf';

  const viewerSection = (
    <div
      style={{
        position: 'relative',
        flex: isDesktop ? '1 1 60%' : undefined,
        minHeight: isDesktop ? 400 : 280,
        maxHeight: isDesktop ? '70vh' : '50vh',
        background: colors.surface2,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {displayUrl && isFirstPage && (
        <div
          aria-label={t('documentDetail.preview')}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 2,
            padding: '6px 10px',
            background: colors.primary,
            color: colors.text1,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          {t('documentDetail.preview')}
        </div>
      )}
      {loadingDisplay && !displayUrl && (
        <div style={{ color: colors.text2, fontSize: 14 }}>{t('documentDetail.loading')}</div>
      )}
      {error && !displayUrl && (
        <div style={{ color: colors.red, fontSize: 14 }}>{error}</div>
      )}
      {displayUrl && isPdf && (
        <iframe
          src={displayUrl}
          title={doc.title}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 320,
            border: 'none',
          }}
        />
      )}
      {displayUrl && !isPdf && (
        <img
          src={displayUrl}
          alt={doc.title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );

  const metaSection = (
    <div
      style={{
        flex: isDesktop ? '0 0 340px' : undefined,
        padding: isDesktop ? '0 0 0 24px' : '16px 0 0',
      }}
    >
      {offlineSavedMessage && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: colors.surface2,
            border: `1px solid ${colors.primary}`,
            borderRadius: 8,
            fontSize: 12,
            color: colors.text2,
          }}
        >
          {t('documentDetail.savedOffline')}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        {editingTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                background: colors.surface,
                border: `1px solid ${colors.primary}`,
                borderRadius: 8,
                color: colors.text1,
                fontSize: 16,
                fontWeight: 600,
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: colors.text1,
              fontSize: 18,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {titleValue}
          </button>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, color: colors.text3, marginBottom: 6, textTransform: 'uppercase' }}>
          {t('documentDetail.category')}
        </label>
        <select
          value={categoryValue}
          onChange={(e) => setCategoryValue(e.target.value as typeof categoryValue)}
          onBlur={handleSaveCategory}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.text1,
            fontSize: 14,
          }}
        >
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {getCategoryLabel(key)}
            </option>
          ))}
        </select>
        {categoryValue === 'custom' && (
          <input
            type="text"
            value={customCategoryValue}
            onChange={(e) => setCustomCategoryValue(e.target.value)}
            onBlur={handleSaveCategory}
            placeholder={t('documentDetail.placeholderCategory')}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '8px 12px',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text1,
              fontSize: 13,
            }}
          />
        )}
      </div>
      {doc.ocrSummary && (
        <p style={{ fontSize: 13, color: colors.text2, marginBottom: 16 }}>{doc.ocrSummary}</p>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, color: colors.text3, marginBottom: 6, textTransform: 'uppercase' }}>
          {t('documentDetail.searchTags')}
        </label>
        <input
          type="text"
          value={searchTagsInput}
          onChange={(e) => setSearchTagsInput(e.target.value)}
          onBlur={handleSaveSearchTags}
          placeholder={t('documentDetail.searchTagsPlaceholder')}
          style={{
            ...inputStyle,
            minHeight: 40,
          }}
        />
      </div>

      {/* Share actions: Compose & Share PDF (multi-page) + Share current page */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: colors.text3, marginBottom: 8, textTransform: 'uppercase' }}>
          {t('documentDetail.share')}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {pageRefs.length > 1 && (
            <button
              type="button"
              onClick={() => setShowPdfComposer(true)}
              style={{
                padding: '10px 18px',
                background: colors.primary,
                border: 'none',
                borderRadius: 10,
                color: colors.bg,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FileText size={18} strokeWidth={2} /> {t('documentDetail.composeSharePdf')}
            </button>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={shareBusy}
            style={{
              padding: '10px 18px',
              background: pageRefs.length > 1 ? colors.surface2 : '#25D366',
              border: pageRefs.length > 1 ? `1px solid ${colors.border}` : 'none',
              borderRadius: 10,
              color: pageRefs.length > 1 ? colors.text2 : '#fff',
              fontSize: 13,
              cursor: !shareBusy ? 'pointer' : 'wait',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Share2 size={18} strokeWidth={2} />
            {pageRefs.length > 1 ? t('documentDetail.shareCurrentPage') : <span>WhatsApp</span>}
            {shareBusy ? ` ${t('documentDetail.sharing')}` : ''}
          </button>
        </div>
        {pageRefs.length > 1 && (
          <p style={{ fontSize: 12, color: colors.text3, marginTop: 8, marginBottom: 0 }}>
            {t('documentDetail.shareMultiPageHint')}
          </p>
        )}
      </div>

      {/* File actions: Download + Delete */}
      <div>
        <label style={{ display: 'block', fontSize: 11, color: colors.text3, marginBottom: 8, textTransform: 'uppercase' }}>
          {t('documentDetail.fileActions')}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadBusy}
            style={{
              padding: '10px 18px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.text1,
              fontSize: 13,
              cursor: !downloadBusy ? 'pointer' : 'wait',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={18} strokeWidth={2} /> {downloadBusy ? t('documentDetail.downloading') : t('documentDetail.download')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteBusy}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: `1px solid ${colors.red}`,
              borderRadius: 10,
              color: colors.red,
              fontSize: 13,
              cursor: !deleteBusy ? 'pointer' : 'wait',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={18} strokeWidth={2} /> {deleteBusy ? t('documentDetail.deleting') : t('documentDetail.delete')}
          </button>
        </div>
      </div>

      {(shareBusy || shareFallbackMessage) && (
        <div style={{ marginTop: 12 }}>
        {shareBusy && (
          <span style={{ fontSize: 11, color: colors.text3, alignSelf: 'center' }}>
            {t('documentDetail.sharePreparing')}
          </span>
        )}
        {shareFallbackMessage && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: colors.surface3,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              fontSize: 12,
              color: colors.text2,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={{ flex: 1 }}>{shareFallbackMessage}</span>
            <button
              type="button"
              onClick={() => setShareFallbackMessage(null)}
              aria-label={t('common.close')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.text3,
                cursor: 'pointer',
                padding: 0,
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>
        )}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: colors.primary,
            fontSize: 15,
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          ← {t('documentDetail.back')}
        </button>
        <span style={{ color: colors.text2, fontSize: 13 }}>
          {pageRefs.length > 1 ? t('documentDetail.page', { current: currentIndex + 1, total: pageRefs.length }) : t('documentDetail.document')}
        </span>
        <div style={{ width: 72 }} />
      </header>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isDesktop ? 24 : 16,
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
        }}
      >
        {viewerSection}
        {metaSection}
      </div>

      {showPdfComposer && pageRefs.length > 1 && (
        <PdfComposerModal
          documentTitle={doc.title}
          imageRefs={pageRefs}
          getDownloadUrl={getDownloadUrl}
          getFileBlob={getFileBlob}
          onClose={() => window.history.back()}
        />
      )}

      {pageRefs.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            background: colors.surface,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '8px 16px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text1,
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {t('documentDetail.previous')}
          </button>
          <span style={{ color: colors.text2, fontSize: 13 }}>
            {currentIndex + 1} / {pageRefs.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(pageRefs.length - 1, i + 1))}
            disabled={currentIndex === pageRefs.length - 1}
            style={{
              padding: '8px 16px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text1,
              cursor: currentIndex === pageRefs.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            {t('documentDetail.next')}
          </button>
        </div>
      )}
    </div>
  );
}
