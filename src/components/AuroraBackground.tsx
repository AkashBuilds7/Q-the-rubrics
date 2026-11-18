import React from 'react';
import { useTheme } from './ThemeContext';

export function AuroraBackground() {
  const { theme } = useTheme();

  if (theme === 'light') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0 transition-colors duration-300"
        style={{ backgroundColor: '#F3F7FC' }}
      >
        {/* Blob 1 — Top left */}
        <div
          className="aurora-blob-light absolute -top-28 -left-24 w-[640px] h-[640px] rounded-full"
          style={{
            background: 'radial-gradient(circle, #BAE6FD 0%, transparent 70%)',
            filter: 'blur(85px)',
            opacity: 0.42,
          }}
        />
        {/* Blob 2 — Center right */}
        <div
          className="aurora-blob-light absolute top-1/4 -right-32 w-[720px] h-[720px] rounded-full"
          style={{
            background: 'radial-gradient(circle, #DBEAFE 0%, #E0E7FF 45%, transparent 75%)',
            filter: 'blur(85px)',
            opacity: 0.42,
            animationDelay: '-5s',
          }}
        />
        {/* Blob 3 — Bottom center */}
        <div
          className="aurora-blob-light absolute -bottom-36 left-1/3 w-[680px] h-[680px] rounded-full"
          style={{
            background: 'radial-gradient(circle, #CFFAFE 0%, #E0F2FE 50%, transparent 70%)',
            filter: 'blur(85px)',
            opacity: 0.42,
            animationDelay: '-10s',
          }}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0 transition-colors duration-300"
      style={{ backgroundColor: '#101513' }}
    >
      {/* Blob 1 — Top left */}
      <div
        className="aurora-blob-dark absolute -top-28 -left-24 w-[620px] h-[620px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #6EE7B7 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.24,
        }}
      />
      {/* Blob 2 — Center right */}
      <div
        className="aurora-blob-dark absolute top-1/4 -right-32 w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #A7F3D0 0%, #5EEAD4 42%, transparent 75%)',
          filter: 'blur(80px)',
          opacity: 0.24,
          animationDelay: '-4s',
        }}
      />
      {/* Blob 3 — Bottom center */}
      <div
        className="aurora-blob-dark absolute -bottom-36 left-1/3 w-[660px] h-[660px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #86EFAC 0%, #34D399 45%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.24,
          animationDelay: '-9s',
        }}
      />
    </div>
  );
}

const SPARKLE_POSITIONS = [
  { left: '16%', colorLight: '#FF9AA2', colorDark: '#F9A8D4', delay: '0s', size: 10 },
  { left: '31%', colorLight: '#FDE047', colorDark: '#FDE68A', delay: '0.6s', size: 8 },
  { left: '48%', colorLight: '#86EFAC', colorDark: '#A7F3D0', delay: '1.2s', size: 11 },
  { left: '61%', colorLight: '#7DD3FC', colorDark: '#93C5FD', delay: '1.8s', size: 9 },
  { left: '74%', colorLight: '#C4B5FD', colorDark: '#DDD6FE', delay: '2.4s', size: 10 },
  { left: '86%', colorLight: '#86EFAC', colorDark: '#A7F3D0', delay: '3.0s', size: 8 },
];

export function PrismaticDivider({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <div aria-hidden="true" className={`relative w-full py-4 select-none ${className}`}>
      <div
        className="w-full"
        style={{
          height: '1.5px',
          background: 'var(--spectrum-line)',
        }}
      />
      {SPARKLE_POSITIONS.map((s, idx) => (
        <svg
          key={idx}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          className="sparkle-twinkle absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{
            left: s.left,
            animationDelay: s.delay,
            color: theme === 'light' ? s.colorLight : s.colorDark,
          }}
        >
          <path
            fill="currentColor"
            d="M12 0L14.4 9.6L24 12L14.4 14.4L12 24L9.6 14.4L0 12L9.6 9.6L12 0Z"
          />
        </svg>
      ))}
    </div>
  );
}
