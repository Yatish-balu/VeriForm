import React from 'react';

/**
 * Four-point diamond sparkle outline matching the reference screenshot
 * (Ask VeriForm AI, Ready when you are, Extract Attendance with AI).
 */
export function SparkleIcon({ className = 'w-4 h-4', strokeWidth = 1.65 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.2C12.7 8.1 15.9 11.3 20.8 12C15.9 12.7 12.7 15.9 12 20.8C11.3 15.9 8.1 12.7 3.2 12C8.1 11.3 11.3 8.1 12 3.2Z" />
    </svg>
  );
}

/**
 * Corner focus brackets with check inside — matches "Image sharpness" row icon.
 */
export function FocusCheckIcon({ className = 'w-4 h-4', strokeWidth = 1.65 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </svg>
  );
}

/**
 * Org hierarchy icon matching "Branch Summaries" sidebar item.
 */
export function BranchTreeIcon({ className = 'w-[17px] h-[17px]', strokeWidth = 1.65 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4" />
      <path d="M6 16v-2.5A1.5 1.5 0 0 1 7.5 12h9a1.5 1.5 0 0 1 1.5 1.5V16" />
    </svg>
  );
}

/**
 * Checklist document box matching "Review Queue" sidebar item.
 */
export function QueueListIcon({ className = 'w-[17px] h-[17px]', strokeWidth = 1.65 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="m8.5 9.5 1.2 1.2 2-2.1" />
      <path d="M14 9.5h3" />
      <path d="M8.5 14.5h1.5" />
      <path d="M12.5 14.5h4.5" />
    </svg>
  );
}
