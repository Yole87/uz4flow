import type { SVGProps } from "react";

/**
 * Logo oficial do Instagram em estilo outline com gradiente oficial
 * (rosa → magenta → laranja → amarelo). Usa um gradient único por instância
 * via `gradientId` para evitar colisões de SVG no DOM.
 */
let _gradientCounter = 0;

export function InstagramIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number }) {
  // Unique id per render to avoid <defs> collisions
  const gradientId = `ig-grad-${++_gradientCounter}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F9CE34" />
          <stop offset="50%" stopColor="#EE2A7B" />
          <stop offset="100%" stopColor="#6228D7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
