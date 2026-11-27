import React from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck, X } from 'lucide-react';

export default function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="VeriForm Help and Documentation"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] max-w-[560px] w-full overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#111827]">
              Help &amp; documentation
            </h3>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              VeriForm (Roll Call AI) — Form-B extraction guidelines
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help modal"
            className="p-1.5 rounded-[8px] text-[#64748B] hover:bg-[#F7F7F5] hover:text-[#111827]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-[13px] text-[#374151]">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-4 h-4 text-[#293F2D] mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-[#111827]">1. Pre-flight image quality</div>
              <p className="text-[#64748B] mt-0.5 leading-relaxed">
                Upload JPG, PNG, or PDF scans of Form-B sheets. Keep all four margins visible and avoid heavy shadows across student rows and footer totals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#92400E] mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-[#111827]">2. Human-in-the-loop Review Queue</div>
              <p className="text-[#64748B] mt-0.5 leading-relaxed">
                Any cell below 75% confidence, red &ldquo;Ab&rdquo; marks, scribbles, or footer total mismatches are automatically queued instead of silently guessed.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-[#111827]">3. Finalizing &amp; exporting</div>
              <p className="text-[#64748B] mt-0.5 leading-relaxed">
                Forms stay in <span className="font-medium text-[#111827]">Needs Review</span> until all open doubts are resolved, after which room and branch summaries can be exported cleanly.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[#F7F7F5] border-t border-[#E5E7EB] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-[#293F2D] text-white text-[13px] font-medium hover:bg-[#203324]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
