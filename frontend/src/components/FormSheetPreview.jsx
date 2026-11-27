import React from 'react';

/**
 * Renders the realistic Form-B attendance sheet centered in the Document Viewer.
 * Matches the typography, metadata grid, USN monospace column, and color-coded status entries.
 */
export default function FormSheetPreview({
  sheetMeta,
  students,
  compact = false,
}) {
  return (
    <div
      className={`form-sheet-paper w-full ${
        compact ? 'max-w-[700px] px-8 py-7' : 'max-w-[552px] px-6 sm:px-8 py-5 sm:py-[22px]'
      } border border-[#E7E5DF] rounded-[4px] text-[#111827]`}
    >
      {/* Sheet Top Header */}
      <div className="text-center pb-3 border-b border-[#E5E7EB]">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-[#64748B] uppercase">
          {sheetMeta.institutionHeader}
        </div>
        <h3 className="mt-1 text-[15px] sm:text-[15.5px] font-bold tracking-[0.01em] text-[#111827]">
          {sheetMeta.formTitle}
        </h3>
        <div className="mt-0.5 text-[11.5px] font-medium text-[#374151]">
          {sheetMeta.examName}
        </div>
      </div>

      {/* Metadata 2x2 Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 py-2.5 text-[11.5px] sm:text-[12px]">
        <div className="text-left">
          <span className="font-semibold text-[#111827]">Room: {sheetMeta.roomNo}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-[#111827]">Branch: {sheetMeta.branch}</span>
        </div>
        <div className="text-left text-[#64748B]">
          <span>Semester: {sheetMeta.semester}</span>
        </div>
        <div className="text-right text-[#64748B]">
          <span>Session: {sheetMeta.sessionTime}</span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="mt-1 border border-[#E5E7EB] rounded-[4px] overflow-hidden bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#F2F1ED] border-b border-[#E5E7EB] text-[10.5px] font-semibold text-[#64748B]">
              <th className="py-2 pl-3 pr-2 w-[42px]">No.</th>
              <th className="py-2 px-2 w-[135px]">USN</th>
              <th className="py-2 px-2">Student name</th>
              <th className="py-2 pl-2 pr-4 text-right w-[100px]">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE6] text-[11.5px]">
            {students.map((student) => {
              const isAbsent = student.status === 'Absent';
              const isNeedsReview = student.status === 'Needs Review' || student.status === 'Unclear';
              return (
                <tr key={student.usn} className="bg-white">
                  <td className="py-[6px] pl-3 pr-2 text-[#94A3B8] font-mono-tech text-[11px]">
                    {student.slNo}
                  </td>
                  <td className="py-[6px] px-2 font-mono-tech text-[11px] font-medium text-[#1F2937] tracking-[-0.01em]">
                    {student.usn}
                  </td>
                  <td className="py-[6px] px-2 text-[#111827] font-normal">
                    {student.name}
                  </td>
                  <td
                    className={`py-[6px] pl-2 pr-4 text-right font-medium ${
                      isAbsent
                        ? 'text-[#991B1B]'
                        : isNeedsReview
                        ? 'text-[#92400E]'
                        : 'text-[#166534]'
                    }`}
                  >
                    {student.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sheet Footer */}
      <div className="mt-4 pt-1 flex items-center justify-between text-[10.5px] text-[#64748B]">
        <span>{sheetMeta.footerLeft}</span>
        <span>{sheetMeta.footerRight}</span>
      </div>
    </div>
  );
}
