import React, { useEffect, useState } from 'react';
import { fetchBranchSummary } from '../api/client';

const BRANCHES = [
  { code: 'CY', label: 'Cyber Security (CY)' },
  { code: 'CS', label: 'Computer Science (CS)' },
  { code: 'IS', label: 'Information Science (IS)' },
];

export default function BranchSummariesPage() {
  const [selectedBranch, setSelectedBranch] = useState('CY');
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    setErrorMsg('');
    fetchBranchSummary(selectedBranch)
      .then((res) => {
        if (active) setSummary(res.data);
      })
      .catch((err) => {
        if (active) {
          setSummary({ branch: selectedBranch, sessions: [] });
          setErrorMsg(err?.message || 'Unable to load branch summary.');
        }
      });
    return () => {
      active = false;
    };
  }, [selectedBranch]);

  return (
    <div className="px-5 sm:px-8 lg:px-[42px] pt-[26px] pb-[32px] max-w-[1440px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] text-[#111827] leading-[1.15]">
            Branch Summaries
          </h1>
          <p className="mt-[6px] text-[13.5px] sm:text-[14px] text-[#64748B]">
            Aggregated attendance across examination rooms grouped by student USN branch code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BRANCHES.map((b) => (
            <button
              key={b.code}
              type="button"
              onClick={() => setSelectedBranch(b.code)}
              className={`px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold border transition-colors ${
                selectedBranch === b.code
                  ? 'bg-[#293F2D] text-white border-[#293F2D]'
                  : 'bg-white text-[#111827] border-[#E5E7EB] hover:bg-[#FAF9F7]'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
        {errorMsg && (
          <div className="px-6 py-3 bg-[#F9E4E4] border-b border-[#F1C5C5] text-[12.5px] text-[#991B1B]">
            {errorMsg}
          </div>
        )}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">
              {summary?.branchName || selectedBranch}
            </h2>
            <p className="text-[12px] text-[#64748B] font-mono-tech mt-0.5">
              Branch Code: {selectedBranch}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[11.5px] font-semibold text-[#64748B]">
                <th className="py-3 pl-6 pr-3">Exam Date</th>
                <th className="py-3 px-3">Subject Code</th>
                <th className="py-3 px-3">Total</th>
                <th className="py-3 px-3">Present</th>
                <th className="py-3 px-3">Absent</th>
                <th className="py-3 pl-3 pr-6 text-right">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-[13px]">
              {(summary?.sessions || []).map((s) => (
                <tr key={s.session_id} className="hover:bg-[#FAF9F7]">
                  <td className="py-3.5 pl-6 pr-3 font-mono-tech text-[#374151]">
                    {s.exam_date}
                  </td>
                  <td className="py-3.5 px-3 font-mono-tech font-medium text-[#111827]">
                    {s.subject_code}
                  </td>
                  <td className="py-3.5 px-3 font-mono-tech text-[#111827]">{s.total}</td>
                  <td className="py-3.5 px-3 font-mono-tech text-[#166534] font-semibold">
                    {s.present}
                  </td>
                  <td className="py-3.5 px-3 font-mono-tech text-[#991B1B] font-semibold">
                    {s.absent}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right font-mono-tech font-semibold text-[#111827]">
                    {s.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
