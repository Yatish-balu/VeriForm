import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, AlertCircle } from 'lucide-react';
import StepIndicator from '../components/StepIndicator';
import DocumentViewer, { DocumentFullscreenModal } from '../components/DocumentViewer';
import PreFlightCard from '../components/PreFlightCard';
import ReadyActionCard from '../components/ReadyActionCard';
import { exportFormPdf, extractFormAttendance } from '../api/client';
import { analyzeUploadedDocument, formatFileSize } from '../utils/imageQuality';

function groupAttendanceByPaper(form) {
  const papers = new Map((form?.sessions || []).map((session) => [
    session.id,
    { id: session.id, subjectCode: session.subject_code, examDate: session.exam_date, rows: [] },
  ]));
  for (const row of form?.rows || []) {
    const id = row.sessionId ?? '';
    if (!papers.has(id)) {
      papers.set(id, { id, subjectCode: row.subjectCode, examDate: row.examDate, rows: [] });
    }
    papers.get(id).rows.push(row);
  }

  const entries = [...papers.values()];
  const labels = entries.map(({ subjectCode, examDate }) =>
    [subjectCode || 'Subject code unavailable', examDate].filter(Boolean).join(' · ')
  );
  return entries.map((paper, index) => ({
    ...paper,
    rows: paper.rows.sort((first, second) => first.slNo - second.slNo),
    label: labels.indexOf(labels[index]) === labels.lastIndexOf(labels[index])
      ? labels[index]
      : `${labels[index]} · Paper ${index + 1}`,
  }));
}

export default function UploadBFormPage({
  documentData,
  setDocumentData,
  uploadedFile,
  setUploadedFile,
  uploadedPreviewUrl,
  setUploadedPreviewUrl,
  onAddHistoryRecord,
  onNavigateReview,
}) {
  const [workflowStep, setWorkflowStep] = useState(1); // 1 = Upload form (matches screenshot), 2 = Review extraction, 3 = Finalize & export
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [extractError, setExtractError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const extractionInFlight = useRef(false);
  const extractedFile = useRef(null);

  const papers = groupAttendanceByPaper(extractionResult?.form);
  const selectedPaper = papers.find((paper) => paper.id === selectedPaperId) ?? papers[0];

  const isPdf = Boolean(
    uploadedFile &&
      (uploadedFile.type === 'application/pdf' ||
        uploadedFile.name.toLowerCase().endsWith('.pdf'))
  );

  // Keyboard shortcuts in fullscreen mode
  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreenOpen(false);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)));
      if (e.key === '-') setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
      if (e.key.toLowerCase() === 'r') setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenOpen]);

  const handleReplaceFile = async (file) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    const extAllowed = /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extAllowed) {
      setExtractError('Unsupported file format. Please choose a JPG, PNG, or PDF Form-B file.');
      return;
    }

    setExtractError('');
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedPreviewUrl(previewUrl);
    setZoom(1);
    setRotation(0);
    setWorkflowStep(1);
    setExtractionResult(null);

    const analysis = await analyzeUploadedDocument(file);
    setDocumentData({
      id: `upload-${Date.now()}`,
      fileName: file.name,
      fileSizeLabel: formatFileSize(file.size),
      uploadedAtLabel: 'Uploaded just now',
      fileType: file.type || 'image/jpeg',
      isSample: false,
      qualityChecks: analysis.qualityChecks,
      warningBanner: analysis.warningBanner,
      students: [],
    });
  };

  const handleResetSample = () => {
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    setUploadedFile(null);
    setUploadedPreviewUrl(null);
    setDocumentData(null);
    setZoom(1);
    setRotation(0);
    setWorkflowStep(1);
    setExtractionResult(null);
    setExtractError('');
  };

  const handleExtract = async () => {
    if (extractionInFlight.current) return;
    if (!uploadedFile) {
      setExtractError('Please select or drop a Form-B sheet (JPG, PNG, or PDF) first.');
      return;
    }
    if (extractionResult && extractedFile.current === uploadedFile) {
      setWorkflowStep(2);
      return;
    }
    extractionInFlight.current = true;
    setIsExtracting(true);
    setExtractError('');
    try {
      const result = await extractFormAttendance({
        file: uploadedFile,
        documentData,
      });
      extractedFile.current = uploadedFile;
      setExtractionResult(result);
      setSelectedPaperId(null);
      setWorkflowStep(2);
      onAddHistoryRecord?.(result.form, documentData?.fileName || uploadedFile.name);
    } catch (err) {
      setExtractError(err?.message || 'Unable to extract attendance from this sheet.');
    } finally {
      extractionInFlight.current = false;
      setIsExtracting(false);
    }
  };

  const handleRowStatusToggle = (attendanceId, nextStatus) => {
    setExtractionResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        form: {
          ...prev.form,
          rows: prev.form.rows.map((r) =>
            r.id === attendanceId ? { ...r, status: nextStatus, needsReview: false } : r
          ),
        },
      };
    });
  };

  const handleExportCsv = () => {
    if (!extractionResult?.form?.rows) return;
    const header = ['Subject Code', 'Exam Date', 'Sl No', 'USN', 'Student Name', 'Attendance'];
    const lines = papers.flatMap((paper) => paper.rows.map((row) => [
      paper.subjectCode, paper.examDate, row.slNo, row.usn, row.name, row.status,
    ]));
    const csv = [header, ...lines]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentData.fileName.replace(/\.[^.]+$/, '')}_attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    const formId = extractionResult?.form?.id;
    if (!formId) return;
    setIsExportingPdf(true);
    setExtractError('');
    try {
      await exportFormPdf(
        formId,
        `form_b_${extractionResult.form.room_no || 'sheet'}_${formId}.pdf`
      );
    } catch (err) {
      setExtractError(err?.message || 'Unable to export PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const statusPill = isExtracting
    ? { label: 'Extracting attendance…', cls: 'bg-[#FBEFD9] text-[#92400E]' }
    : workflowStep === 2
    ? { label: 'Extraction ready for review', cls: 'bg-[#FBEFD9] text-[#92400E]' }
    : workflowStep === 3
    ? { label: 'Finalized & ready to export', cls: 'bg-[#EAF2E8] text-[#166534]' }
    : { label: 'Ready to extract', cls: 'bg-[#EAF2E8] text-[#166534]' };

  return (
    <div className="px-5 sm:px-8 lg:px-[42px] pt-[24px] pb-[24px] max-w-[1440px]">
      {/* Page Heading Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] text-[#111827] leading-[1.15]">
            Upload B-Form
          </h1>
          <p className="mt-[6px] text-[13.5px] sm:text-[14px] text-[#64748B]">
            One sheet. Every student accounted for.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium mt-1 ${statusPill.cls}`}
        >
          <Check className="w-[13px] h-[13px]" strokeWidth={2.4} />
          <span>{statusPill.label}</span>
        </span>
      </div>

      {/* Three-step progress indicator */}
      <div className="mt-[18px] mb-[20px]">
        <StepIndicator
          currentStep={workflowStep}
          onStepClick={(step) => {
            if (step === 1) setWorkflowStep(1);
            if (step === 2 && extractionResult) setWorkflowStep(2);
          }}
        />
      </div>

      {extractError && (
        <div className="mb-5 bg-[#F9E4E4] border border-[#F1C5C5] rounded-[12px] px-4 py-3 flex items-center gap-2.5 text-[12.5px] text-[#991B1B]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{extractError}</span>
        </div>
      )}

      {/* Step 1: Default Two-Column View (Exact Reference Layout) */}
      {workflowStep === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.87fr)_minmax(340px,1fr)] gap-6 items-stretch">
          <DocumentViewer
            documentData={documentData}
            uploadedPreviewUrl={uploadedPreviewUrl}
            isPdf={isPdf}
            onReplaceFile={handleReplaceFile}
            onResetSample={handleResetSample}
            zoom={zoom}
            rotation={rotation}
            onZoomIn={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
            onZoomOut={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            onRotateLeft={() => setRotation((r) => (r - 90 + 360) % 360)}
            onRotateRight={() => setRotation((r) => (r + 90) % 360)}
            onResetTransform={() => {
              setZoom(1);
              setRotation(0);
            }}
            onOpenFullscreen={() => setFullscreenOpen(true)}
          />

          <div className="flex flex-col gap-5">
            <PreFlightCard qualityChecks={documentData?.qualityChecks} />
            <ReadyActionCard isExtracting={isExtracting} onExtract={handleExtract} />
          </div>
        </div>
      )}

      {/* Step 2: Review Extraction Inline View */}
      {workflowStep === 2 && extractionResult && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[16px] font-semibold text-[#111827]">
                    Extracted Attendance — {extractionResult.form.room_no}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FBEFD9] text-[#92400E] text-[11px] font-medium">
                    {extractionResult.isMockResult ? 'Simulated preview (Mock Mode)' : 'Gemini Vision'}
                  </span>
                </div>
                <p className="text-[12.5px] text-[#64748B] mt-0.5">
                  {extractionResult.sourceLabel} · {extractionResult.form.exam_name} · Branch{' '}
                  {extractionResult.form.department}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setWorkflowStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[12.5px] font-medium text-[#111827] hover:bg-[#F7F7F5]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateReview(extractionResult.form.id)}
                  className="px-3.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[12.5px] font-medium text-[#111827] hover:bg-[#F7F7F5]"
                >
                  Open Review Queue
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowStep(3)}
                  className="px-4 py-2 rounded-[10px] bg-[#293F2D] text-white text-[12.5px] font-semibold hover:bg-[#203324]"
                >
                  Approve &amp; Continue
                </button>
              </div>
            </div>

            {selectedPaper && (
              <div className="border-b border-[#E5E7EB] px-6 py-3">
                {papers.length > 1 ? (
                  <label className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#111827]">
                    Subject
                    <select
                      value={selectedPaper.id}
                      onChange={(event) => setSelectedPaperId(event.target.value)}
                      className="max-w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2"
                    >
                      {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.label}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="text-[13px] font-medium text-[#111827]">{selectedPaper.label}</p>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[11.5px] font-semibold text-[#64748B]">
                    <th className="py-2.5 pl-6 pr-3">No.</th>
                    <th className="py-2.5 px-3">USN</th>
                    <th className="py-2.5 px-3">Student name</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 pr-6 text-right">Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-[13px]">
                  {!selectedPaper?.rows.length && (
                    <tr>
                      <td colSpan={6} className="px-6 py-5 text-center text-[#64748B]">
                        No attendance rows were extracted.
                      </td>
                    </tr>
                  )}
                  {selectedPaper?.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF9F7]">
                      <td className="py-3 pl-6 pr-3 font-mono-tech text-[12px] text-[#64748B]">
                        {row.slNo}
                      </td>
                      <td className="py-3 px-3 font-mono-tech text-[12.5px] font-medium text-[#111827]">
                        {row.usn}
                      </td>
                      <td className="py-3 px-3 text-[#111827] font-medium">{row.name}</td>
                      <td className="py-3 px-3 font-mono-tech text-[12px] text-[#64748B]">
                        {Math.round(row.confidence * 100)}%
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11.5px] font-medium ${
                            row.status === 'Present'
                              ? 'bg-[#EAF2E8] text-[#166534]'
                              : row.status === 'Absent'
                              ? 'bg-[#F9E4E4] text-[#991B1B]'
                              : 'bg-[#FBEFD9] text-[#92400E]'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRowStatusToggle(row.id, 'Present')}
                            className={`px-2.5 py-1 rounded-[7px] text-[11.5px] font-medium border ${
                              row.status === 'Present'
                                ? 'bg-[#EAF2E8] border-[#C6DFC2] text-[#166534]'
                                : 'bg-white border-[#E5E7EB] text-[#64748B] hover:text-[#111827]'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowStatusToggle(row.id, 'Absent')}
                            className={`px-2.5 py-1 rounded-[7px] text-[11.5px] font-medium border ${
                              row.status === 'Absent'
                                ? 'bg-[#F9E4E4] border-[#ECC8C8] text-[#991B1B]'
                                : 'bg-white border-[#E5E7EB] text-[#64748B] hover:text-[#111827]'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Finalize & Export */}
      {workflowStep === 3 && extractionResult && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 sm:p-8 max-w-[720px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF2E8] text-[#166534] text-[12px] font-medium">
            <Check className="w-3.5 h-3.5" />
            <span>Ready to finalize &amp; export</span>
          </div>
          <h2 className="mt-3 text-[20px] font-bold text-[#111827]">
            {documentData.fileName} verified
          </h2>
          <p className="mt-1.5 text-[13.5px] text-[#64748B]">
            {extractionResult.form.rows.filter((r) => r.status === 'Present').length} Present ·{' '}
            {extractionResult.form.rows.filter((r) => r.status === 'Absent').length} Absent ·{' '}
            {extractionResult.form.rows.filter((r) => r.status === 'Unclear').length} Unclear ·{' '}
            {extractionResult.form.rows.length} Attendance records across all papers.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || extractionResult.isMockResult}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#293F2D] text-white text-[13px] font-semibold hover:bg-[#203324] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Exporting PDF…' : 'Export PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#111827] text-[13px] font-semibold hover:bg-[#F7F7F5]"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Record</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkflowStep(2)}
              className="px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[13px] font-medium text-[#111827] hover:bg-[#F7F7F5]"
            >
              Review rows again
            </button>
            <button
              type="button"
              onClick={() => setWorkflowStep(1)}
              className="px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#64748B] hover:text-[#111827]"
            >
              Return to document view
            </button>
          </div>
        </div>
      )}

      <DocumentFullscreenModal
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        documentData={documentData}
        uploadedPreviewUrl={uploadedPreviewUrl}
        isPdf={isPdf}
        zoom={zoom}
        rotation={rotation}
        onZoomIn={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
        onZoomOut={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
        onRotateLeft={() => setRotation((r) => (r - 90 + 360) % 360)}
        onRotateRight={() => setRotation((r) => (r + 90) % 360)}
        onResetTransform={() => {
          setZoom(1);
          setRotation(0);
        }}
      />
    </div>
  );
}
