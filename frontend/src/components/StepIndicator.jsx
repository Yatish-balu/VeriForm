import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Upload form' },
  { id: 2, label: 'Review extraction' },
  { id: 3, label: 'Finalize & export' },
];

export default function StepIndicator({ currentStep = 1, onStepClick }) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4" aria-label="Upload workflow progress">
      {STEPS.map((step, idx) => {
        const isCompleted = step.id === 1 ? currentStep >= 1 : step.id < currentStep;
        const isActive = step.id === currentStep && step.id > 1;
        const clickable = typeof onStepClick === 'function' && step.id <= currentStep;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step.id)}
              className={`inline-flex items-center gap-2.5 text-left ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-[#293F2D] text-white'
                    : isActive
                    ? 'bg-[#293F2D] text-white ring-4 ring-[#E2E7DC]'
                    : 'bg-[#ECECE7] text-[#64748B]'
                }`}
              >
                {isCompleted ? <Check className="w-[13px] h-[13px]" strokeWidth={2.6} /> : step.id}
              </span>
              <span
                className={`text-[13px] ${
                  isCompleted || isActive
                    ? 'font-semibold text-[#111827]'
                    : 'font-medium text-[#64748B]'
                }`}
              >
                {step.label}
              </span>
            </button>

            {idx < STEPS.length - 1 && (
              <span className="h-px w-8 sm:w-20 bg-[#E2E2DC] shrink-0" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
