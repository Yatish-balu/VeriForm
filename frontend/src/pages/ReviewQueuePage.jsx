import React, { useState } from 'react';
import { Check, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { finalizeFormRequest, resolveDoubtDecision } from '../api/client';

const FINALIZE_BATCH_SIZE = 4;

function groupDoubts(doubts) {
  const byKey = new Map();
  for (const doubt of doubts) {
    const key = JSON.stringify(doubt.type === 'unreadable_usn'
      ? [doubt.form_id, doubt.type, doubt.attendance_id]
      : doubt.attendance_id
        ? [doubt.form_id, 'attendance', doubt.attendance_id]
        : [doubt.form_id, doubt.type, doubt.message]);
    const entries = byKey.get(key) || [];
    entries.push(doubt);
    byKey.set(key, entries);
  }
  return Array.from(byKey, ([key, entries]) => ({
    key,
    entries,
    current: entries.find((doubt) => !doubt.resolved) || entries[0],
  }));
}

export default function ReviewQueuePage({
  doubts, setDoubts, doubtsLoading, doubtsError, onRetryDoubts,
  forms, formsLoading, formsError, onRefreshForms, onFormFinalized,
}) {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('form_id');
  const [filter, setFilter] = useState('open');
  const [savingDecisions, setSavingDecisions] = useState({});
  const [finalizingId, setFinalizingId] = useState(null);
  const [finalizeMsg, setFinalizeMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const scopedForms = formId ? forms.filter((form) => form.id === formId) : forms;
  const scopedForm = formId ? scopedForms[0] : null;
  const readyForms = scopedForms.filter((form) => form.can_finalize);
  const blockedForms = scopedForms.filter((form) =>
    form.status === 'needs_review' && form.open_doubts === 0 && form.can_finalize === false
  );
  const finalizing = finalizingId !== null;
  const groups = groupDoubts(formId ? doubts.filter((doubt) => doubt.form_id === formId) : doubts);
  const openDoubts = groups.filter(({ current }) => !current.resolved);
  const hasPendingSaves = Object.keys(savingDecisions).length > 0;
  const finalizeDisabled = formsLoading || Boolean(formsError) || hasPendingSaves || finalizing;
  const resolvedDoubts = groups.filter(({ current }) => current.resolved);
  const visible = filter === 'open' ? openDoubts : filter === 'resolved' ? resolvedDoubts : groups;

  const handleResolve = async (doubtId, resolution) => {
    if (savingDecisions[doubtId] || finalizing) return;
    if (!resolution) {
      setErrorMsg('Enter a review note before saving.');
      return;
    }
    setSavingDecisions((prev) => ({ ...prev, [doubtId]: resolution }));
    setFinalizeMsg('');
    setErrorMsg('');
    try {
      const res = await resolveDoubtDecision(doubtId, resolution);
      const updated = res?.data;
      if (!updated?.resolved) throw new Error('The server did not confirm this decision.');
      const resolvedIds = new Set(updated.resolved_doubt_ids || [updated.id]);
      setDoubts((prev) =>
        prev.map((d) =>
          resolvedIds.has(d.id)
            ? { ...d, resolved: updated.resolved, resolution: updated.resolution }
            : d
        )
      );
      onRefreshForms();
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to resolve doubt.');
    } finally {
      setSavingDecisions((prev) => {
        const next = { ...prev };
        delete next[doubtId];
        return next;
      });
    }
  };

  const handleFinalize = async (selectedForms) => {
    if (finalizeDisabled || selectedForms.length === 0) return;
    setFinalizingId(selectedForms.length === 1 ? selectedForms[0].id : 'all');
    setFinalizeMsg('');
    setErrorMsg('');
    let finalizedCount = 0;
    const failures = [];
    try {
      for (let start = 0; start < selectedForms.length; start += FINALIZE_BATCH_SIZE) {
        await Promise.all(selectedForms.slice(start, start + FINALIZE_BATCH_SIZE).map(async (form) => {
          try {
            const { data } = await finalizeFormRequest(form.id);
            if (data?.id !== form.id || data.status !== 'final') {
              throw new Error('The server did not confirm finalization.');
            }
            onFormFinalized(form.id);
            finalizedCount += 1;
          } catch (err) {
            failures.push(`Room ${form.room_no}: ${err?.message || 'Unable to finalize form.'}`);
          }
        }));
      }
      if (finalizedCount > 0) {
        setFinalizeMsg(finalizedCount === 1 ? 'Form-B finalized.' : `${finalizedCount} Form-Bs finalized.`);
      }
      if (failures.length) {
        setErrorMsg(failures.join(' '));
        onRefreshForms();
      }
    } finally {
      setFinalizingId(null);
    }
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
          {!doubtsLoading && !doubtsError && <span
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
          </span>}

          {(readyForms.length > 1 || finalizingId === 'all') && <button
            type="button"
            disabled={finalizeDisabled}
            onClick={() => handleFinalize(readyForms)}
            className="px-4 py-2 rounded-[10px] bg-[#293F2D] text-white text-[12.5px] font-semibold hover:bg-[#203324] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {finalizingId === 'all' ? 'Finalizing…' : `Finalize ${readyForms.length} verified forms`}
          </button>}
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="mt-4 bg-[#F9E4E4] border border-[#F1C5C5] rounded-[12px] px-4 py-3 text-[12.5px] text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {finalizeMsg && (
        <div className="mt-4 bg-[#EAF2E8] border border-[#C6DFC2] rounded-[12px] px-4 py-3 text-[12.5px] text-[#166534] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span role="status">{finalizeMsg}</span>
        </div>
      )}

      {formId && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          {scopedForm && <span className="font-medium text-[#111827]">
            Room {scopedForm.room_no} · {scopedForm.exam_name}
          </span>}
          <Link className="text-[#293F2D] underline" to="/review">View full Review Queue</Link>
        </div>
      )}

      {formsError ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#F9E4E4] px-4 py-3 text-sm text-[#991B1B]">
          Unable to load form statuses. {formsError}
          <button type="button" className="ml-2 underline" onClick={onRefreshForms}>Retry</button>
        </p>
      ) : (
        <>
          {formsLoading && <p role="status" className="mt-4 text-[13px] text-[#64748B]">Checking form status…</p>}
          {!formsLoading && blockedForms.length > 0 && (
            <p className="mt-4 rounded-xl bg-[#FBEFD9] px-4 py-3 text-[13px] text-[#92400E]">
              {blockedForms.length === 1 ? 'One form has' : `${blockedForms.length} forms have`} unclear attendance without an open review item. Finalization is unavailable for those forms.
            </p>
          )}
          {!formsLoading && formId && !scopedForm && (
            <p className="mt-4 text-[13px] text-[#64748B]">Form-B could not be found.</p>
          )}
          {!formsLoading && scopedForm?.status === 'final' && !finalizeMsg && (
            <p className="mt-4 text-[13px] text-[#166534]">This Form-B is finalized.</p>
          )}
          {!formsLoading && scopedForm?.status === 'processing' && (
            <p className="mt-4 text-[13px] text-[#64748B]">This Form-B is still processing.</p>
          )}
          {readyForms.length > 0 && (
            <section aria-labelledby="ready-heading" className="mt-5">
              <h2 id="ready-heading" className="text-[16px] font-semibold text-[#111827]">Ready to Finalize</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">These forms have zero open doubts.</p>
              <ul className="mt-3 space-y-2.5">
                {readyForms.map((form) => (
                  <li key={form.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E5E7EB] bg-white px-5 py-4">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">Room {form.room_no} · {form.exam_name}</p>
                      <p className="mt-1 text-[12px] text-[#64748B]">Uploaded {new Date(form.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      disabled={finalizeDisabled}
                      onClick={() => handleFinalize([form])}
                      className="rounded-[8px] bg-[#293F2D] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#203324] disabled:opacity-40"
                    >
                      {finalizingId === form.id ? 'Finalizing…' : 'Finalize form'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {doubtsLoading ? (
        <p role="status" className="mt-5 text-[13px] text-[#64748B]">Loading review items…</p>
      ) : doubtsError ? (
        <p role="alert" className="mt-5 rounded-xl bg-[#F9E4E4] px-4 py-3 text-sm text-[#991B1B]">
          Unable to load review items. {doubtsError}
          <button type="button" className="ml-2 underline" onClick={onRetryDoubts}>Retry</button>
        </p>
      ) : <>
      {/* Filter tabs */}
      <div className="mt-6 flex items-center gap-2">
        {[
          { key: 'open', label: `Open (${openDoubts.length})` },
          { key: 'resolved', label: `Resolved (${resolvedDoubts.length})` },
          { key: 'all', label: `All (${groups.length})` },
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
          </div>
        ) : (
          visible.map(({ key, current: d, entries }) => {
            const isIdentity = d.type === 'unreadable_usn';
            const isAttendance = d.attendance_id && !isIdentity;
            const reasons = [...new Set(entries.map((entry) => entry.message))];
            const saving = savingDecisions[d.id];
            const uploadLabel = d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : null;
            return (
              <div
                key={key}
                className="bg-white border border-[#E5E7EB] rounded-[14px] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-tech text-[11.5px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#F1F0EC] text-[#111827]">
                      {d.room_no}
                    </span>
                    <span className="font-mono-tech text-[12px] font-medium text-[#111827]">
                      {d.sl_no != null && `Row ${d.sl_no}`}
                      {d.sl_no != null && d.usn && ' · '}
                      {d.usn}
                    </span>
                    <span className="text-[13px] font-semibold text-[#111827]">
                      {d.student_name || (isIdentity && !d.attendance_id ? 'Check student identities' : '')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        d.resolved
                          ? 'bg-[#EAF2E8] text-[#166534]'
                          : 'bg-[#FBEFD9] text-[#92400E]'
                      }`}
                    >
                      {d.resolved
                        ? `Resolved: ${d.resolution}`
                        : isIdentity ? 'Verify USN or name' : entries.length > 1 ? 'Attendance review' : (d.type || 'review').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {(uploadLabel || (isAttendance && d.exam_date)) && (
                    <p className="text-[11.5px] text-[#64748B]">
                      {[isAttendance && d.subject_code, isAttendance && d.exam_date, uploadLabel && `Uploaded ${uploadLabel}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {reasons.map((reason) => <p key={reason} className="text-[13px] text-[#4B5563]">{reason}</p>)}
                  {isIdentity && !d.attendance_id && (
                    <div className="mt-2 text-[12px] text-[#4B5563]">
                      {d.identity_review_rows?.length ? (
                        <>
                          <p>Check these saved rows against the original sheet.</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {d.identity_review_rows.map((row) => (
                              <li key={`${row.sl_no}-${row.student_id}`}>
                                {[row.sl_no != null ? `Row ${row.sl_no}` : null, row.name, row.usn].filter(Boolean).join(' · ')}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : <p>Check the student identities on the original sheet.</p>}
                    </div>
                  )}
                  {d.image_url && (
                    <a href={d.image_url} target="_blank" rel="noreferrer" className="inline-block text-[12px] text-[#293F2D] underline">
                      Open original sheet
                    </a>
                  )}
                  {isAttendance && d.confidence != null && (
                    <p className="text-[11.5px] text-[#64748B] font-mono-tech">
                      AI confidence: {Math.round(d.confidence * 100)}% · Initial guess:{' '}
                      {d.ai_guess || 'none'}
                    </p>
                  )}
                </div>

                {!d.resolved && (
                  <div className="flex items-center gap-2 shrink-0">
                    {saving ? (
                      <span role="status" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#64748B]">
                        <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                        {isAttendance ? `Saving as ${saving}…` : 'Saving review note…'}
                      </span>
                    ) : isAttendance ? (
                      <>
                        <button
                          type="button"
                          disabled={finalizing}
                          onClick={() => handleResolve(d.id, 'present')}
                          className="px-3 py-1.5 rounded-[8px] bg-[#EAF2E8] text-[#166534] text-[12px] font-semibold hover:bg-[#DCEBD9] transition-colors"
                        >
                          Mark Present
                        </button>
                        <button
                          type="button"
                          disabled={finalizing}
                          onClick={() => handleResolve(d.id, 'absent')}
                          className="px-3 py-1.5 rounded-[8px] bg-[#F9E4E4] text-[#991B1B] text-[12px] font-semibold hover:bg-[#F3D3D3] transition-colors"
                        >
                          Mark Absent
                        </button>
                      </>
                    ) : (
                      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                        event.preventDefault();
                        handleResolve(d.id, new FormData(event.currentTarget).get('note').trim());
                      }}>
                        <label className="flex flex-col gap-1 text-xs text-[#64748B]">
                          Review note
                          <input name="note" required className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs text-[#111827]" />
                        </label>
                        <button type="submit" disabled={finalizing} className="rounded-[8px] bg-[#293F2D] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">
                          {isIdentity ? 'Confirm identity check' : 'Resolve check'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>}
    </div>
  );
}
