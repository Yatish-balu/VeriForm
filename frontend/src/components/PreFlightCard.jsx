import React, { useState } from 'react';
import { Files, Sun } from 'lucide-react';
import { FocusCheckIcon } from './Icons';

const ICON_MAP = {
  sharpness: FocusCheckIcon,
  lighting: Sun,
  coverage: Files,
};

const PILL_STYLES = {
  success: 'bg-[#E8F2E6] text-[#166534]',
  warning: 'bg-[#FBEFD9] text-[#92400E]',
  error: 'bg-[#F9E4E4] text-[#991B1B]',
};

export default function PreFlightCard({ qualityChecks }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] px-[24px] py-[26px]">
      <div className="pb-[18px] border-b border-[#EFECE6]">
        <h2 className="text-[17.5px] font-semibold text-[#111827] tracking-[-0.015em] leading-snug">
          Pre-flight quality check
        </h2>
        <p className="mt-1.5 text-[12.5px] text-[#64748B]">
          A quick check before AI takes over.
        </p>
      </div>

      <div className="pt-[22px] space-y-[22px]">
        {qualityChecks && qualityChecks.length > 0 ? (
          qualityChecks.map((check) => {
            const Icon = ICON_MAP[check.id] || FocusCheckIcon;
            const pillStyle = PILL_STYLES[check.tone] || PILL_STYLES.success;
            const showTooltip = hoveredId === check.id;

            return (
              <div
                key={check.id}
                className="relative flex items-center justify-between gap-3 py-0.5 rounded-[8px]"
                onMouseEnter={() => setHoveredId(check.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(check.id)}
                onBlur={() => setHoveredId(null)}
                tabIndex={0}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 text-[#4B5563] shrink-0">
                    <Icon className="w-[16px] h-[16px]" strokeWidth={1.65} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#111827] leading-snug">
                      {check.label}
                    </div>
                    <div className="text-[11.5px] text-[#64748B] leading-snug mt-0.5">
                      {check.description}
                    </div>
                  </div>
                </div>

                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-[3px] rounded-full text-[11.5px] font-medium ${pillStyle}`}
                >
                  {check.statusLabel}
                </span>

                {showTooltip && (
                  <div
                    role="tooltip"
                    className="absolute right-0 bottom-full mb-2 w-[260px] bg-[#111827] text-white text-[11.5px] leading-[1.45] px-3 py-2 rounded-[8px] shadow-lg z-30 pointer-events-none"
                  >
                    {check.tooltip}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-[12.5px] text-[#64748B]">
            Upload a Form-B image to view automatic pre-flight checks (sharpness, lighting, coverage).
          </div>
        )}
      </div>
    </div>
  );
}
