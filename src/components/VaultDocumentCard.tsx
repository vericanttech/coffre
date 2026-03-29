import { useState, useEffect } from 'react';
import { FileText, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDownloadUrl } from '@/services/vaultStorage';
import { getCategoryLabel, getCategoryColor } from '@/theme/categories';
import { useTheme } from '@/context/ThemeContext';
import type { VaultDocument } from '@/types/vault';

function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  return exp <= in60 && exp >= new Date();
}

interface VaultDocumentCardProps {
  doc: VaultDocument;
  onClick?: () => void;
  /** 'list' = horizontal row (default), 'gallery' = vertical tile for grid */
  variant?: 'list' | 'gallery';
}

export function VaultDocumentCard({ doc, onClick, variant = 'list' }: VaultDocumentCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const accent = getCategoryColor(doc.category);
  const label = getCategoryLabel(doc.category, doc.customCategory);
  const expiring = isExpiringSoon(doc.extractedFields?.expiryDate);
  const ready = doc.status === 'ready';

  useEffect(() => {
    let cancelled = false;
    getDownloadUrl(doc.thumbRef)
      .then((url) => { if (!cancelled) setThumbUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [doc.thumbRef]);

  const meta = [
    label,
    doc.extractedFields?.date && doc.extractedFields.date,
  ].filter(Boolean).join(' · ');

  if (variant === 'gallery') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          width: '100%',
          padding: 0,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderTop: `3px solid ${accent}`,
          borderRadius: 12,
          overflow: 'hidden',
          textAlign: 'left',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <div
          style={{
            aspectRatio: '4/3',
            background: colors.surface3,
            overflow: 'hidden',
          }}
        >
          {thumbUrl ? (
            <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text3 }}>
              <FileText size={28} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 600, color: colors.text1, fontSize: 13, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          <div style={{ fontSize: 11, color: colors.text2, marginTop: 2 }}>{meta}</div>
          {(ready || expiring) && (
            <span style={{ fontSize: 10, color: expiring ? colors.red : colors.green, marginTop: 4, display: 'inline-block' }}>
              {expiring ? t('vaultCard.expireSoon') : <><Check size={10} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 2 }} />{t('vaultCard.ready')}</>}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 42,
          height: 48,
          borderRadius: 8,
          background: colors.surface3,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text3 }}>
            <FileText size={20} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: colors.text1, fontSize: 14 }}>{doc.title}</div>
        <div style={{ fontSize: 12, color: colors.text2 }}>{meta}</div>
        {(ready || expiring) && (
          <span
            style={{
              fontSize: 11,
              color: expiring ? colors.red : colors.green,
              marginTop: 4,
              display: 'inline-block',
            }}
          >
            {expiring ? t('vaultCard.expireSoon') : <><Check size={12} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 4 }} />{t('vaultCard.ready')}</>}
          </span>
        )}
      </div>
      <ChevronRight size={20} strokeWidth={2} style={{ color: colors.text3, flexShrink: 0 }} />
    </button>
  );
}
