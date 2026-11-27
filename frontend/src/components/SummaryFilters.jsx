import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchBranchSummary, fetchRoomSummary, fetchSummaryOptions } from '../api/client';

const optionsCache = new Map();
const summaryCache = new Map();

export function useSavedSummary(kind) {
  const [search, setSearch] = useSearchParams();
  const formId = search.get('form_id');
  const examYear = search.get('exam_year') || '';
  const requested = search.get(kind);
  const [attempt, setAttempt] = useState(0);
  const filterKey = JSON.stringify([formId, examYear, attempt]);
  const [optionsResult, setOptionsResult] = useState(() => optionsCache.get(filterKey) || null);
  const options = optionsResult?.key === filterKey ? optionsResult : (optionsCache.get(filterKey) || null);
  const choices = options?.data?.[kind === 'room' ? 'rooms' : 'branches'] ?? [];
  const selected = choices.includes(requested) ? requested : choices[0];
  const summaryKey = JSON.stringify([filterKey, selected]);
  const [summaryResult, setSummaryResult] = useState(() => (selected ? summaryCache.get(summaryKey) || null : null));
  const current = summaryResult?.key === summaryKey ? summaryResult : (selected ? summaryCache.get(summaryKey) || null : null);

  useEffect(() => {
    const cached = optionsCache.get(filterKey);
    if (cached && optionsResult?.key !== filterKey) {
      setOptionsResult(cached);
    }
    const controller = new AbortController();
    fetchSummaryOptions({ form_id: formId || undefined, exam_year: examYear || undefined }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          const entry = { key: filterKey, data };
          optionsCache.set(filterKey, entry);
          setOptionsResult(entry);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !optionsCache.has(filterKey)) {
          setOptionsResult({ key: filterKey, error: error.message });
        }
      });
    return () => controller.abort();
  }, [formId, examYear, filterKey]);

  useEffect(() => {
    if (!selected) return;
    const cached = summaryCache.get(summaryKey);
    if (cached && summaryResult?.key !== summaryKey) {
      setSummaryResult(cached);
    }
    const controller = new AbortController();
    const load = kind === 'room' ? fetchRoomSummary : fetchBranchSummary;
    load(selected, { form_id: formId || undefined, exam_year: examYear || undefined }, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          const entry = { key: summaryKey, data };
          summaryCache.set(summaryKey, entry);
          setSummaryResult(entry);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !summaryCache.has(summaryKey)) {
          setSummaryResult({ key: summaryKey, error: error.message });
        }
      });
    return () => controller.abort();
  }, [kind, selected, formId, examYear, summaryKey]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next);
  };

  return {
    kind,
    formId,
    examYear,
    selected,
    choices,
    years: options?.data?.exam_years ?? [],
    loading: !options || Boolean(selected && !current),
    error: options?.error || current?.error,
    summary: current?.data,
    setFilter,
    retry: () => setAttempt((previous) => previous + 1),
  };
}

export default function SummaryFilters({ view }) {
  const label = view.kind === 'room' ? 'Room' : 'Branch';
  const styles = 'rounded-[9px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]';
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[#64748B]">
          Exam year
          <select value={view.examYear} onChange={(event) => view.setFilter('exam_year', event.target.value)} className={styles}>
            <option value="">All exam years</option>
            {view.examYear && !view.years.includes(Number(view.examYear)) && <option value={view.examYear}>{view.examYear}</option>}
            {view.years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        {view.choices.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[#64748B]">
            {label}
            <select value={view.selected} onChange={(event) => view.setFilter(view.kind, event.target.value)} className={styles}>
              {view.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
        )}
        {view.formId && (
          <button type="button" onClick={() => view.setFilter('form_id', '')} className="px-2 py-2 text-sm font-medium text-[#293F2D] underline">
            Show all Form-Bs
          </button>
        )}
      </div>
      {view.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#F9E4E4] px-4 py-3 text-sm text-[#991B1B]">
          {view.error} <button type="button" className="ml-2 underline" onClick={view.retry}>Retry</button>
        </p>
      ) : view.loading ? (
        <p role="status" className="mt-4 text-sm text-[#64748B]">Loading saved attendance…</p>
      ) : view.choices.length === 0 || !view.summary?.sessions?.length ? (
        <p className="mt-4 text-sm text-[#64748B]">No saved attendance matches these filters.</p>
      ) : null}
    </div>
  );
}
