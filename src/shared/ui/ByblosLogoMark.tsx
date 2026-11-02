import React from 'react';

interface ByblosLogoMarkProps {
  className?: string;
  width?: number;
  height?: number;
}

export function ByblosLogoMark({
  className = 'w-8 h-12',
  width = 33,
  height = 52,
}: ByblosLogoMarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 33 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Byblos Logo"
    >
      {/* Primary White Mark */}
      <path
        d="M27.35,0.00L18.24,0.00L17.62,0.40L3.13,24.86L0.95,29.56L0.14,33.12L0.00,36.55L0.41,39.44L1.36,42.33L3.13,45.42L5.44,47.97L8.16,49.92L11.29,51.26L14.29,51.87L18.30,51.87L21.16,51.33L24.63,49.92L27.08,48.24L29.33,45.95L30.75,43.87L32.18,40.58L32.93,36.75L32.80,32.79L31.84,29.09L30.01,25.73L27.83,23.38L24.36,21.23L21.09,20.22L16.60,19.82L27.76,1.07L27.83,0.34ZM17.28,27.95L18.98,28.35L20.34,29.02L22.45,31.04L23.61,33.59L23.75,36.61L23.34,38.23L22.73,39.50L20.89,41.59L18.30,42.86L15.45,43.06L12.59,42.19L10.48,40.44L9.39,38.76L8.98,37.62L8.71,36.01L8.78,34.33L9.73,31.64L10.41,30.64L11.84,29.29L14.29,28.15Z"
        fill="#ffffff"
      />
      {/* Accent Gold Mark */}
      <path
        d="M9.53,0.87L8.57,1.14L1.36,5.58L0.88,6.25L0.27,28.75L2.04,24.79L9.53,12.16L9.87,1.21Z"
        fill="#fdb105"
      />
    </svg>
  );
}

export default ByblosLogoMark;

