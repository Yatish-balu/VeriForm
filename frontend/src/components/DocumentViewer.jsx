import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Maximize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import FormSheetPreview from './FormSheetPreview';

export default function DocumentViewer({
  documentData,
  uploadedPreviewUrl,
  isPdf,
  onReplaceFile,
  onResetSample,
  zoom,
  rotation,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onResetTransform,
  onOpenFullscreen,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onReplaceFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onReplaceFile(file);
    }
  };

  const warningBanner = documentData?.warningBanner;

  return (
    <div className="flex flex-col h-full">
      <div
        className={`bg-white border ${
          dragOver ? 'border-[#293F2D] ring-2 ring-[#293F2D]/15' : 'border-[#E5E7EB]'
        } rounded-[14px] overflow-hidden flex flex-col flex-1 transition-colors`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={handleFilePicked}
          aria-label="Replace B-Form file"
        />

        {/* Card Header */}
        <div className="px-5 py-3.5 bg-white border-b border-[#E5E7EB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#4B5563] shrink-0">
              <FileText className="w-[18px] h-[18px]" strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-[#111827] truncate">
                {documentData?.fileName || 'No file selected'}
              </div>
              <div className="text-[11.5px] text-[#64748B] font-mono-tech mt-0.5 truncate">
                {documentData?.fileSizeLabel
                  ? `${documentData.fileSizeLabel} · ${documentData.uploadedAtLabel}`
                  : 'Ready for upload'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[12.5px] font-semibold text-[#111827] hover:text-[#293F2D] px-2.5 py-1.5 rounded-[8px] hover:bg-[#F7F7F5] transition-colors"
            >
              {uploadedPreviewUrl ? 'Replace file' : 'Select file'}
            </button>
            {uploadedPreviewUrl && (
              <button
                type="button"
                onClick={onOpenFullscreen}
                title="Open fullscreen preview"
                aria-label="Open fullscreen preview"
                className="p-1.5 rounded-[8px] text-[#374151] hover:text-[#111827] hover:bg-[#F7F7F5] transition-colors"
              >
                <Maximize className="w-[16px] h-[16px]" strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>

        {/* Document Preview Area */}
        <div className="relative group bg-[#EFECE5] flex-1 px-4 sm:px-9 py-4 flex items-center justify-center overflow-auto min-h-[320px]">
          <div
            className="transition-transform duration-200 ease-out origin-center w-full flex justify-center"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            {uploadedPreviewUrl && isPdf ? (
              <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-8 max-w-[460px] w-full text-center shadow-sm">
                <FileText className="w-10 h-10 text-[#293F2D] mx-auto mb-3" strokeWidth={1.6} />
                <div className="text-[14px] font-semibold text-[#111827] truncate">
                  {documentData?.fileName}
                </div>
                <p className="text-[12.5px] text-[#64748B] mt-1">
                  PDF B-Form ready for extraction ({documentData?.fileSizeLabel}).
                </p>
                <a
                  href={uploadedPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[12.5px] font-medium text-[#111827] hover:bg-[#F7F7F5]"
                >
                  Open PDF in tab
                </a>
              </div>
            ) : uploadedPreviewUrl ? (
              <img
                src={uploadedPreviewUrl}
                alt={documentData?.fileName || 'B-Form Sheet'}
                className="max-h-[430px] w-auto rounded-[4px] border border-[#E5E7EB] shadow-[0_10px_28px_-8px_rgba(17,24,39,0.14)] bg-white object-contain"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border-2 border-dashed border-[#D1D5DB] hover:border-[#293F2D] rounded-[12px] p-10 max-w-[460px] w-full text-center cursor-pointer transition-colors shadow-sm"
              >
                <FileText className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-[15px] font-semibold text-[#111827]">
                  No Form-B Uploaded Yet
                </div>
                <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
                  Click or drag and drop a signed exam Form-B sheet (JPG, PNG, or PDF) to start verification.
                </p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-[#293F2D] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#203223] transition-colors pointer-events-none"
                >
                  Choose File
                </button>
              </div>
            )}
          </div>

          {/* Subtle hover-revealed zoom & rotate toolbar (invisible at rest to preserve clean layout) */}
          {uploadedPreviewUrl && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 absolute bottom-3 right-3 flex items-center gap-1 bg-white/95 border border-[#E5E7EB] rounded-[10px] px-1.5 py-1 shadow-sm">
              <button
                type="button"
                onClick={onZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className="p-1.5 rounded-[6px] text-[#374151] hover:bg-[#F1F0EC] hover:text-[#111827]"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono-tech font-medium text-[#374151] min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className="p-1.5 rounded-[6px] text-[#374151] hover:bg-[#F1F0EC] hover:text-[#111827]"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-[#E5E7EB] mx-0.5" />
              <button
                type="button"
                onClick={onRotateLeft}
                title="Rotate left 90°"
                aria-label="Rotate left"
                className="p-1.5 rounded-[6px] text-[#374151] hover:bg-[#F1F0EC] hover:text-[#111827]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRotateRight}
                title="Rotate right 90°"
                aria-label="Rotate right"
                className="p-1.5 rounded-[6px] text-[#374151] hover:bg-[#F1F0EC] hover:text-[#111827]"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button
                  type="button"
                  onClick={onResetTransform}
                  className="ml-0.5 px-2 py-1 rounded-[6px] text-[11px] font-medium text-[#64748B] hover:bg-[#F1F0EC] hover:text-[#111827]"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Warning Strip */}
        {warningBanner && (
          <div className="bg-[#FDF5E4] border-t border-[#F2E2BF] px-5 py-3 flex items-start gap-3">
            <AlertTriangle
              className="w-[17px] h-[17px] text-[#A16207] shrink-0 mt-0.5"
              strokeWidth={1.9}
            />
            <div className="text-[12px] leading-[1.45]">
              <div className="font-semibold text-[#92400E]">{warningBanner.title}</div>
              <div className="text-[#92400E]/85 mt-0.5">{warningBanner.subtitle}</div>
            </div>
          </div>
        )}
      </div>

      {/* Preservation Note Below Card */}
      <p className="mt-3 text-[12px] text-[#64748B]">
        Your original document is preserved. Review all AI results before finalizing.
      </p>
    </div>
  );
}

/**
 * Fullscreen Lightbox Modal with Zoom, Rotate, Reset, and Escape close.
 */
export function DocumentFullscreenModal({
  open,
  onClose,
  documentData,
  uploadedPreviewUrl,
  isPdf,
  zoom,
  rotation,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onResetTransform,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/75 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Document fullscreen viewer"
    >
      {/* Modal Header */}
      <div className="h-14 bg-white border-b border-[#E5E7EB] px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-4 h-4 text-[#374151] shrink-0" />
          <span className="text-[13.5px] font-semibold text-[#111827] truncate">
            {documentData?.fileName || 'No file selected'}
          </span>
          <span className="text-[12px] text-[#64748B] font-mono-tech hidden sm:inline">
            {documentData?.fileSizeLabel || ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-2 rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-[#F7F7F5]"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-[12px] font-mono-tech font-medium text-[#111827] min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-2 rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-[#F7F7F5]"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRotateLeft}
            className="p-2 rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-[#F7F7F5] ml-1"
            aria-label="Rotate counterclockwise"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRotateRight}
            className="p-2 rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-[#F7F7F5]"
            aria-label="Rotate clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onResetTransform}
            className="px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[12px] font-medium text-[#374151] hover:bg-[#F7F7F5] ml-1"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[8px] bg-[#293F2D] text-white hover:bg-[#203324] ml-2"
            aria-label="Close fullscreen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Canvas */}
      <div className="flex-1 overflow-auto bg-[#EFECE5] p-6 sm:p-10 flex items-center justify-center">
        <div
          className="transition-transform duration-200 origin-center"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          {uploadedPreviewUrl && !isPdf ? (
            <img
              src={uploadedPreviewUrl}
              alt={documentData?.fileName || 'Form-B Sheet'}
              className="max-h-[82vh] w-auto rounded-[4px] border border-[#E5E7EB] shadow-lg bg-white"
            />
          ) : (
            <div className="bg-white border-2 border-dashed border-[#D1D5DB] rounded-[12px] p-10 max-w-[460px] text-center">
              <FileText className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" strokeWidth={1.5} />
              <div className="text-[15px] font-semibold text-[#111827]">No file preview available</div>
              <p className="text-[13px] text-[#64748B] mt-1">Upload a Form-B sheet to preview it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
