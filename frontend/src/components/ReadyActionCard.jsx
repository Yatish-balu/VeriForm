import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { SparkleIcon } from './Icons';

export default function ReadyActionCard({ isExtracting, onExtract }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="bg-[#ECEAE2] border border-[#E2DFD6] rounded-[14px] px-[24px] py-[24px] flex-1 flex flex-col justify-start">
        <div>
          <div className="flex items-center gap-2">
            <SparkleIcon className="w-[17px] h-[17px] text-[#293F2D]" strokeWidth={1.7} />
            <h2 className="text-[17.5px] font-semibold text-[#111827] tracking-[-0.015em]">
              Ready when you are
            </h2>
          </div>

          <p className="mt-2.5 text-[12.5px] text-[#5B6470] leading-[1.55]">
            AI will read USNs and attendance marks, then flag anything that needs a closer look.
          </p>

          {/* Status Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-[4px] rounded-[7px] bg-[#DFEBE0] text-[#166534] text-[11.5px] font-medium">
              Present
            </span>
            <span className="inline-flex items-center px-2.5 py-[4px] rounded-[7px] bg-[#F5DFDF] text-[#991B1B] text-[11.5px] font-medium">
              Absent
            </span>
            <span className="inline-flex items-center px-2.5 py-[4px] rounded-[7px] bg-[#F6E7C8] text-[#92400E] text-[11.5px] font-medium">
              Needs Review
            </span>
          </div>
        </div>

        <div className="mt-[24px]">
          <button
            type="button"
            disabled={isExtracting}
            onClick={onExtract}
            className="w-full h-[46px] px-4 rounded-[10px] bg-[#293F2D] hover:bg-[#203324] disabled:opacity-75 disabled:cursor-wait text-white text-[13.5px] font-semibold flex items-center justify-between transition-colors"
          >
            <span className="inline-flex items-center gap-2.5">
              {isExtracting ? (
                <Loader2 className="w-[16px] h-[16px] animate-spin" />
              ) : (
                <SparkleIcon className="w-[16px] h-[16px]" strokeWidth={1.7} />
              )}
              <span>
                {isExtracting ? 'Extracting Attendance…' : 'Extract Attendance with AI'}
              </span>
            </span>
            <ArrowRight className="w-[16px] h-[16px]" strokeWidth={2} />
          </button>

          <p className="mt-2.5 text-[11.5px] text-[#64748B]">
            Usually takes 15–30 seconds · Review before finalizing
          </p>
        </div>
      </div>

      {/* Footer note aligned beneath right column */}
      <div className="mt-3 text-right text-[12px] text-[#64748B]">
        Powered by Roll Call AI
      </div>
    </div>
  );
}
