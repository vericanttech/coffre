import { useState, useEffect, useCallback, useRef } from 'react';
import { Share2, GripVertical, Crop as CropIcon, RotateCw, X } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { jsPDF } from 'jspdf';
import { useTheme } from '@/context/ThemeContext';
import { applyCropAndEnhance } from '@/utils/scannerUtils';

const MIN_TOUCH_TARGET = 24;

export interface PdfComposerImageItem {
  id: string;
  ref: string;
  url: string | null;
  enhancedUrl: string | null;
}

interface PdfComposerModalProps {
  documentTitle: string;
  imageRefs: string[];
  getDownloadUrl: (path: string) => Promise<string>;
  getFileBlob: (path: string) => Promise<Blob>;
  onClose: () => void;
}

function SortableThumb({
  item,
  colors,
  onCrop,
}: {
  item: PdfComposerImageItem;
  colors: ReturnType<typeof useTheme>['colors'];
  onCrop: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const displayUrl = item.enhancedUrl ?? item.url;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: colors.surface2,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        marginBottom: 8,
      }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        style={{
          background: 'none',
          border: 'none',
          padding: Math.max(0, (MIN_TOUCH_TARGET - 20) / 2),
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          cursor: 'grab',
          color: colors.text3,
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} strokeWidth={2} />
      </button>
      <div
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: 8,
          overflow: 'hidden',
          background: colors.surface3,
        }}
      >
        {displayUrl && (
          <img
            src={displayUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          onClick={() => onCrop(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            padding: '8px 12px',
            background: colors.surface3,
            color: colors.text2,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <CropIcon size={16} strokeWidth={2} />
          Crop
        </button>
      </div>
    </div>
  );
}

function createRotatedImageDataUrl(imageUrl: string, rotation: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const w = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
      const h = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2d not available'));
        return;
      }
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Convert crop from display coordinates (react-image-crop uses media's getBoundingClientRect)
 * to natural image pixels so we can extract the correct region. Clamps to image bounds.
 */
function displayCropToNaturalCrop(
  crop: PixelCrop,
  displayWidth: number,
  displayHeight: number,
  naturalWidth: number,
  naturalHeight: number
): PixelCrop {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return { unit: 'px', x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  }
  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;
  let x = Math.round(crop.x * scaleX);
  let y = Math.round(crop.y * scaleY);
  let width = Math.round(crop.width * scaleX);
  let height = Math.round(crop.height * scaleY);
  x = Math.max(0, Math.min(x, naturalWidth - 1));
  y = Math.max(0, Math.min(y, naturalHeight - 1));
  width = Math.max(1, Math.min(width, naturalWidth - x));
  height = Math.max(1, Math.min(height, naturalHeight - y));
  return { unit: 'px', x, y, width, height };
}

function CropView({
  imageUrl,
  colors,
  onApply,
  onCancel,
}: {
  imageUrl: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onApply: (croppedAreaPixels: PixelCrop, rotation: number) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [rotation, setRotation] = useState(0);
  const [rotatedSrc, setRotatedSrc] = useState<string | null>(null);
  const [cropReady, setCropReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    setRotatedSrc(null);
    setCropReady(false);
    createRotatedImageDataUrl(imageUrl, rotation).then((dataUrl) => {
      if (!cancelled) {
        setRotatedSrc(dataUrl);
        setCrop(undefined);
      }
    }).catch(() => {
      if (!cancelled) setRotatedSrc(null);
    });
    return () => { cancelled = true; };
  }, [imageUrl, rotation]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    const aspect = naturalWidth / naturalHeight;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight
    );
    setCrop(initialCrop);
    setCropReady(true);
  }, []);

  const handleApply = useCallback(() => {
    const img = imgRef.current;
    if (!img || !crop) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const rect = img.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;
    const pixelCropDisplay =
      crop.unit === '%'
        ? convertToPixelCrop(crop, displayW, displayH)
        : (crop as PixelCrop);
    const pixelCrop = displayCropToNaturalCrop(
      pixelCropDisplay,
      displayW,
      displayH,
      nw,
      nh
    );
    onApply(pixelCrop, rotation);
  }, [crop, rotation, onApply]);

  const rotateBy = (delta: number) => {
    setRotation((r) => (r + delta + 360) % 360);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: colors.text1 }}>Crop document</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          style={{
            background: 'none',
            border: 'none',
            padding: Math.max(0, (MIN_TOUCH_TARGET - 22) / 2),
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            color: colors.text2,
            cursor: 'pointer',
          }}
        >
          <X size={22} strokeWidth={2} />
        </button>
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
        }}
      >
        {rotatedSrc && (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={undefined}
            minWidth={40}
            minHeight={40}
            className="pdf-composer-react-crop"
            style={{ maxHeight: '100%', maxWidth: '100%' }}
          >
            <img
              ref={imgRef}
              src={rotatedSrc}
              alt="Crop"
              style={{ maxHeight: '60vh', width: 'auto', height: 'auto', display: 'block' }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        )}
        {!rotatedSrc && (
          <span style={{ color: colors.text2, fontSize: 14 }}>Loading…</span>
        )}
      </div>
      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${colors.border}`,
          background: colors.surface,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: colors.text2 }}>Rotate</span>
          <button
            type="button"
            onClick={() => rotateBy(-90)}
            aria-label="Rotate left 90°"
            style={{
              minWidth: MIN_TOUCH_TARGET,
              minHeight: MIN_TOUCH_TARGET,
              padding: 8,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.text1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCw size={20} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button
            type="button"
            onClick={() => rotateBy(90)}
            aria-label="Rotate right 90°"
            style={{
              minWidth: MIN_TOUCH_TARGET,
              minHeight: MIN_TOUCH_TARGET,
              padding: 8,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.text1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCw size={20} strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!cropReady || !crop}
          style={{
            width: '100%',
            minHeight: Math.max(48, MIN_TOUCH_TARGET),
            padding: 14,
            background: colors.primary,
            color: colors.bg,
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: cropReady && crop ? 'pointer' : 'not-allowed',
          }}
        >
          Apply Crop
        </button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .pdf-composer-react-crop .ReactCrop__crop-selection {
          border: 2px solid ${colors.primary};
        }
        .pdf-composer-react-crop .ReactCrop__handle {
          width: 24px !important;
          height: 24px !important;
          margin: -12px 0 0 -12px !important;
        }
        .pdf-composer-react-crop .ReactCrop__drag-handle {
          width: 24px !important;
          height: 24px !important;
        }
      `}} />
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function PdfComposerModal({
  documentTitle,
  imageRefs,
  getDownloadUrl,
  getFileBlob,
  onClose,
}: PdfComposerModalProps) {
  const { colors } = useTheme();
  const [items, setItems] = useState<PdfComposerImageItem[]>(() =>
    imageRefs.map((ref, i) => ({
      id: `img-${i}-${ref}`,
      ref,
      url: null,
      enhancedUrl: null,
    }))
  );
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      imageRefs.map((ref, i) =>
        getDownloadUrl(ref).then((url) => ({ id: items[i].id, url }))
      )
    ).then((results) => {
      if (cancelled) return;
      setItems((prev) =>
        prev.map((p) => {
          const r = results.find((x) => x.id === p.id);
          return r ? { ...p, url: r.url } : p;
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const ids = prev.map((p) => p.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleCropApply = useCallback(
    async (id: string, croppedAreaPixels: PixelCrop, rotation: number) => {
      const item = items.find((i) => i.id === id);
      const imageUrl = item?.enhancedUrl ?? item?.url;
      if (!imageUrl) return;
      setApplyBusy(true);
      try {
        const { dataUrl } = await applyCropAndEnhance(imageUrl, croppedAreaPixels, rotation);
        setItems((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enhancedUrl: dataUrl } : p))
        );
        setCropTargetId(null);
      } catch (e) {
        console.error('Crop failed', e);
      } finally {
        setApplyBusy(false);
      }
    },
    [items]
  );

  const cropTargetItem = cropTargetId ? items.find((i) => i.id === cropTargetId) : null;
  const cropImageUrl = cropTargetItem?.enhancedUrl ?? cropTargetItem?.url ?? null;

  const handleSharePdf = useCallback(async () => {
    setShareError(null);
    setShareBusy(true);
    try {
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - 2 * margin;
      const contentH = pageH - 2 * margin;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let dataUrl: string;
        if (item.enhancedUrl?.startsWith('data:')) {
          dataUrl = item.enhancedUrl;
        } else if (item.url?.startsWith('data:')) {
          dataUrl = item.url;
        } else {
          const blob = await getFileBlob(item.ref);
          dataUrl = await blobToDataUrl(blob);
        }
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', margin, margin, contentW, contentH, undefined, 'FAST');
      }

      const blob = pdf.output('blob');
      const fileName = `${documentTitle.replace(/[^\w\s-]/g, '')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: documentTitle });
        onClose();
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setShareBusy(false);
    }
  }, [items, documentTitle, onClose, getFileBlob]);

  const allUrlsLoaded = items.every((i) => i.url !== null);

  return (
    <>
      {cropImageUrl && cropTargetId && (
        <CropView
          imageUrl={cropImageUrl}
          colors={colors}
          onApply={(area, rotation) => handleCropApply(cropTargetId, area, rotation)}
          onCancel={() => setCropTargetId(null)}
        />
      )}
      {applyBusy && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: 14 }}>Applying…</span>
        </div>
      )}
      <div
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-label="Compose PDF"
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '85vh',
            background: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: colors.text1,
              }}
            >
              Compose & Share PDF
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                minWidth: MIN_TOUCH_TARGET,
                minHeight: MIN_TOUCH_TARGET,
                color: colors.text2,
                cursor: 'pointer',
              }}
            >
              <X size={22} strokeWidth={2} />
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: colors.text2,
                marginBottom: 12,
              }}
            >
              Drag to reorder. Tap Crop to adjust each page, then Apply Crop.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item) => (
                  <SortableThumb
                    key={item.id}
                    item={item}
                    colors={colors}
                    onCrop={setCropTargetId}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div
            style={{
              padding: 16,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            {shareError && (
              <p
                style={{
                  fontSize: 12,
                  color: colors.red,
                  marginBottom: 8,
                }}
              >
                {shareError}
              </p>
            )}
            <button
              type="button"
              onClick={handleSharePdf}
              disabled={shareBusy || !allUrlsLoaded}
              style={{
                width: '100%',
                minHeight: Math.max(48, MIN_TOUCH_TARGET),
                padding: 14,
                background: colors.primary,
                color: colors.bg,
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: shareBusy || !allUrlsLoaded ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Share2 size={20} strokeWidth={2} />
              {shareBusy ? 'Preparing…' : 'Share as PDF'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
