import React from 'react';

export function QubrixLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        className="fill-sky-600/12 dark:fill-emerald-400/15 stroke-sky-600/40 dark:stroke-emerald-300/40"
        strokeWidth="1.5"
      />
      <path
        d="M16 7.5L23.5 11.8V20.2L16 24.5L8.5 20.2V11.8L16 7.5Z"
        className="stroke-sky-600 dark:stroke-emerald-300"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16 16L23.5 11.8M16 16V24.5M16 16L8.5 11.8"
        className="stroke-sky-500/80 dark:stroke-emerald-400/80"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.2" className="fill-sky-600 dark:fill-emerald-300" />
    </svg>
  );
}
