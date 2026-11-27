import React from 'react';
import { Download } from 'lucide-react';
import SummaryFilters, { useSavedSummary } from '../components/SummaryFilters';

export default function RoomSummariesPage() {
  const view = useSavedSummary('room');
  const { selected: selectedRoom, summary } = view;

  const handleDownloadCsv = (session) => {
    const rows = [
      ['Room', 'Date', 'Subject Code', 'USN', 'Name', 'Status'],
      ...session.present_students.map((s) => [
        selectedRoom,
        session.exam_date,
        session.subject_code,
        s.usn,
        s.name,
        'Present',
      ]),
      ...session.absent_students.map((s) => [
        selectedRoom,
        session.exam_date,
        session.subject_code,
        s.usn,
        s.name,
        'Absent',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRoom.replace(/\s+/g, '_')}_${session.subject_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-5 sm:px-8 lg:px-[42px] pt-[26px] pb-[32px] max-w-[1440px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] text-[#111827] leading-[1.15]">
            Room Summaries
          </h1>
          <p className="mt-[6px] text-[13.5px] sm:text-[14px] text-[#64748B]">
            Attendance totals and absentee rosters by exam session.
          </p>
        </div>

      </div>

      <SummaryFilters view={view} />
      {summary?.sessions.length > 0 && (
        <div className="mt-6 space-y-5">
          {(summary?.sessions || []).map((session) => (
            <div
              key={session.session_id}
              className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[16px] font-semibold text-[#111827]">
                      Room {selectedRoom}
                    </span>
                    <span className="font-mono-tech text-[12px] px-2.5 py-0.5 rounded-[6px] bg-[#F1F0EC] text-[#374151]">
                      {session.subject_code}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#64748B] font-mono-tech mt-0.5">
                    {session.exam_date} · {session.verified ? 'Verified' : 'Awaiting review'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadCsv(session)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[12.5px] font-medium text-[#111827] hover:bg-[#F7F7F5]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] bg-[#FAF9F7]">
                <div className="px-6 py-4">
                  <div className="text-[11.5px] text-[#64748B]">Total Students</div>
                  <div className="mt-1 text-[22px] font-bold font-mono-tech text-[#111827]">
                    {session.total}
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="text-[11.5px] text-[#64748B]">Present</div>
                  <div className="mt-1 text-[22px] font-bold font-mono-tech text-[#166534]">
                    {session.present}
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="text-[11.5px] text-[#64748B]">Absent</div>
                  <div className="mt-1 text-[22px] font-bold font-mono-tech text-[#991B1B]">
                    {session.absent}
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="text-[11.5px] text-[#64748B]">Attendance Rate</div>
                  <div className="mt-1 text-[22px] font-bold font-mono-tech text-[#111827]">
                    {session.percentage}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB] border-t border-[#E5E7EB]">
                <div className="p-5">
                  <div className="text-[12px] font-semibold text-[#166534] uppercase tracking-[0.06em] mb-3">
                    Present Students ({session.present_students.length})
                  </div>
                  <div className="space-y-2">
                    {session.present_students.map((st) => (
                      <div
                        key={st.usn}
                        className="flex items-center justify-between text-[12.5px] py-1 border-b border-[#F3F2EE] last:border-0"
                      >
                        <span className="font-mono-tech text-[#374151]">{st.usn}</span>
                        <span className="text-[#111827] font-medium">{st.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-[12px] font-semibold text-[#991B1B] uppercase tracking-[0.06em] mb-3">
                    Absentees ({session.absent_students.length})
                  </div>
                  <div className="space-y-2">
                    {session.absent_students.map((st) => (
                      <div
                        key={st.usn}
                        className="flex items-center justify-between text-[12.5px] py-1 border-b border-[#F3F2EE] last:border-0"
                      >
                        <span className="font-mono-tech text-[#374151]">{st.usn}</span>
                        <span className="text-[#991B1B] font-medium">{st.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
