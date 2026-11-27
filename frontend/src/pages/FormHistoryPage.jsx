import React, { useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { exportFormPdf } from '../api/client';

export default function FormHistoryPage({ forms, onOpenUpload, onOpenReview }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportingId, setExportingId] = useState(null);
  const [exportError, setExportError] = useState('');

  const filtered =
    statusFilter === 'all' ? forms : forms.filter((f) => f.status === statusFilter);

  const handleExportPdf = async (form) => {
    setExportingId(form.id);
    setExportError('');
    try {
      await exportFormPdf(form.id, `form_b_${form.room_no || 'sheet'}_${form.id}.pdf`);
    } catch (err) {
      setExportError(err?.message || 'Unable to export PDF.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 lg:px-[42px] pt-[26px] pb-[32px] max-w-[1440px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] text-[#111827] leading-[1.15]">
            Form History
          </h1>
          <p className="mt-[6px] text-[13.5px] sm:text-[14px] text-[#64748B]">
            Audit log of uploaded Form-B attendance sheets and verification status.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="px-4 py-2 rounded-[10px] bg-[#293F2D] text-white text-[13px] font-semibold hover:bg-[#203324]"
        >
          Upload New Form-B
        </button>
      </div>

      {exportError && (
        <div className="mt-4 bg-[#F9E4E4] border border-[#F1C5C5] rounded-[12px] px-4 py-3 text-[12.5px] text-[#991B1B]">
          {exportError}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        {[
          { key: 'all', label: 'All Forms' },
          { key: 'needs_review', label: 'Needs Review' },
          { key: 'final', label: 'Finalized' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-[9px] text-[12.5px] font-medium border transition-colors ${
              statusFilter === tab.key
                ? 'bg-[#293F2D] text-white border-[#293F2D]'
                : 'bg-white text-[#64748B] border-[#E5E7EB] hover:text-[#111827]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[11.5px] font-semibold text-[#64748B]">
                <th className="py-3 pl-6 pr-3">File / Sheet</th>
                <th className="py-3 px-3">Room</th>
                <th className="py-3 px-3">Exam</th>
                <th className="py-3 px-3">Open Doubts</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-[13px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B] text-[13px]">
                    No Form-B attendance records found. Upload a signed exam sheet to begin.
                  </td>
                </tr>
              ) : (
                filtered.map((form) => {
                  const isFinal = form.status === 'final';
                  return (
                    <tr key={form.id} className="hover:bg-[#FAF9F7]">
                      <td className="py-3.5 pl-6 pr-3 font-medium text-[#111827]">
                        {form.file_name || `${form.room_no}_FormB.jpg`}
                      </td>
                      <td className="py-3.5 px-3 font-mono-tech text-[#374151]">
                        {form.room_no}
                      </td>
                      <td className="py-3.5 px-3 text-[#4B5563]">{form.exam_name}</td>
                      <td className="py-3.5 px-3 font-mono-tech text-[#111827]">
                        {form.open_doubts ?? 0}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11.5px] font-medium ${
                            isFinal
                              ? 'bg-[#EAF2E8] text-[#166534]'
                              : 'bg-[#FBEFD9] text-[#92400E]'
                          }`}
                        >
                          {isFinal ? 'Final' : 'Needs Review'}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleExportPdf(form)}
                            disabled={exportingId === form.id}
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#475569] hover:text-[#111827] disabled:opacity-40"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{exportingId === form.id ? 'Exporting…' : 'Export PDF'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={isFinal ? onOpenUpload : onOpenReview}
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#293F2D] hover:underline"
                          >
                            <span>{isFinal ? 'View' : 'Review'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
