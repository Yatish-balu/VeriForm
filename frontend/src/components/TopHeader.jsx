import React from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import { SparkleIcon } from './Icons';

export default function TopHeader({
  pageTitle,
  onOpenAI,
  onOpenMobileNav,
}) {
  return (
    <header className="h-[68px] bg-white border-b border-[#E5E7EB] px-4 sm:px-8 lg:px-[42px] flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open workspace navigation"
          className="lg:hidden p-2 -ml-1.5 rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-[#F7F7F5]"
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center text-[13.5px] min-w-0">
          <span className="text-[#64748B] font-normal">Workspace</span>
          <ChevronRight className="w-[14px] h-[14px] text-[#9CA3AF] mx-2 shrink-0" strokeWidth={1.75} />
          <span className="text-[#111827] font-semibold truncate">{pageTitle}</span>
        </nav>
      </div>

      <button
        type="button"
        onClick={onOpenAI}
        className="inline-flex items-center gap-2 px-[16px] py-[8px] rounded-[10px] bg-white border border-[#E5E7EB] text-[13px] font-medium text-[#111827] hover:bg-[#FAF9F7] hover:border-[#D1D5DB] transition-colors shrink-0"
      >
        <SparkleIcon className="w-[15px] h-[15px] text-[#111827]" strokeWidth={1.6} />
        <span>Ask VeriForm AI</span>
      </button>
    </header>
  );
}
