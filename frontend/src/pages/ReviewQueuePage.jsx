import React, { useState } from 'react';
import { Check, CheckCircle2, AlertTriangle } from 'lucide-react';
import { resolveDoubtDecision, finalizeFormRequest } from '../api/client';

export default function ReviewQueuePage({ doubts, setDoubts, onMarkFormFinal }) {
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState(null);
  const [finalizeMsg, setFinalizeMsg] = useState('');

  const openDoubts = doubts.filter((d) => !d.resolved);
  const resolvedDoubts = doubts.filter((d) => d.resolved);
  const visible = filter === 'open' ? openDoubts : filter === 'resolved' ? resolvedDoubts : doubts;

  const handleResolve = async (doubtId, resolution) => {
    setBusyId(doubtId);
    setFinalizeMsg('');
    try {
      await resolveDoubtDecision(doubtId, resolution);
      setDoubts((prev) =>
        prev.map((d) =>
          d.id === doubtId ? { ...d, resolved: true, resolution } : d
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleFinalizeAll = async () => {
    if (openDoubts.length > 0) return;
    await finalizeFormRequest('11111111-1111-1111-1111-111111111111');
    onMarkFormFinal?.('11111111-1111-1111-1111-111111111111');
    setFinalizeMsg('All queued forms have zero open doubts and are marked Final.');
  };

  return (
    <div className="px-5 sm:px-8 lg:px-[42px] pt-[26px] pb-[32px] max-w-[1440px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] text-[#111827] leading-[1.15]">
            Review Queue
          </h1>
          <p className="mt-[6px] text-[13.5px] sm:text-[14px] text-[#64748B]">
            Verify flagged entries before any Form-B sheet can be finalized.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium ${
              openDoubts.length > 0
                ? 'bg-[#FBEFD9] text-[#92400E]'
                : 'bg-[#EAF2E8] text-[#166534]'
            }`}
          >
            {openDoubts.length > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>
              {openDoubts.length} {openDoubts.length === 1 ? 'item' : 'items'} pending review
            </span>
          </span>

          <button
            type="button"
            disabled={openDoubts.length > 0}
            onClick={handleFinalizeAll}
            className="px-4 py-2 rounded-[10px] bg-[#293F2D] text-white text-[12.5px] font-semibold hover:bg-[#203324] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Finalize Verified Forms
          </button>
        </div>
      </div>

      {finalizeMsg && (
        <div className="mt-4 bg-[#EAF2E8] border border-[#C6DFC2] rounded-[12px] px-4 py-3 text-[12.5px] text-[#166534] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{finalizeMsg}</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mt-6 flex items-center gap-2">
        {[
          { key: 'open', label: `Open (${openDoubts.length})` },
          { key: 'resolved', label: `Resolved (${resolvedDoubts.length})` },
          { key: 'all', label: `All (${doubts.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`px-3.5 py-1.5 rounded-[9px] text-[12.5px] font-medium border transition-colors ${
              filter === t.key
                ? 'bg-[#293F2D] text-white border-[#293F2D]'
                : 'bg-white text-[#64748B] border-[#E5E7EB] hover:text-[#111827]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Doubt Cards */}
      <div className="mt-5 space-y-3.5">
        {visible.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#166534] mx-auto mb-2.5" strokeWidth={1.6} />
            <div className="text-[15px] font-semibold text-[#111827]">
              No {filter === 'open' ? 'open doubts remaining' : 'items in this filter'}
            </div>
            <p className="text-[13px] text-[#64748B] mt-1">
              All flagged attendance entries in this view have been verified.
            </p>
          </div>
        ) : (
          visible.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-[#E5E7EB] rounded-[14px] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-tech text-[11.5px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#F1F0EC] text-[#111827]">
                    {d.room_no}
                  </span>
                  <span className="font-mono-tech text-[12px] font-medium text-[#111827]">
                    {d.usn}
                  </span>
                  <span className="text-[13px] font-semibold text-[#111827]">
                    {d.student_name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      d.resolved
                        ? 'bg-[#EAF2E8] text-[#166534]'
                        : 'bg-[#FBEFD9] text-[#92400E]'
                    }`}
                  >
                    {d.resolved ? `Resolved: ${d.resolution}` : d.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[13px] text-[#4B5563]">{d.message}</p>
                {d.confidence && (
                  <p className="text-[11.5px] text-[#64748B] font-mono-tech">
                    AI confidence: {Math.round(d.confidence * 100)}% · Initial guess:{' '}
                    {d.ai_guess || 'none'}
                  </p>
                )}
              </div>

              {!d.resolved && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => handleResolve(d.id, 'present')}
                    className="px-3 py-1.5 rounded-[8px] bg-[#EAF2E8] text-[#166534] text-[12px] font-semibold hover:bg-[#DCEBD9] transition-colors"
                  >
                    Mark Present
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => handleResolve(d.id, 'absent')}
                    className="px-3 py-1.5 rounded-[8px] bg-[#F9E4E4] text-[#991B1B] text-[12px] font-semibold hover:bg-[#F3D3D3] transition-colors"
                  >
                    Mark Absent
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
