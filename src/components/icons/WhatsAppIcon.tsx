import type { SVGProps } from "react";

/**
 * Versão sólida para melhor nitidez em tamanhos pequenos.
 */
export function WhatsAppIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path fill="currentColor" d="M27.2 16a11.2 11.2 0 0 1-16.83 9.69L4 27.2l1.55-6.07A11.2 11.2 0 1 1 27.2 16z" />
      <path fill="hsl(var(--background))" d="M12.06 11.5c.2-.45.42-.46.6-.47l.5-.01c.17 0 .44.06.67.5.23.45.78 1.94.85 2.08.07.14.12.3.02.49-.1.18-.15.3-.3.46-.15.16-.31.37-.45.49-.15.13-.3.27-.13.55.17.27.74 1.23 1.6 1.99 1.1.97 2.04 1.27 2.32 1.41.28.14.45.12.62-.07.17-.18.71-.83.9-1.11.18-.28.37-.23.62-.14.25.09 1.59.75 1.86.89.27.13.45.2.52.31.07.11.07.66-.16 1.3-.23.64-1.32 1.22-1.84 1.27-.52.05-1.01.23-3.4-.7-2.88-1.13-4.7-4.07-4.84-4.27-.14-.2-1.16-1.55-1.16-2.95 0-1.4.74-2.09 1.0-2.38z" />
    </svg>
  );
}
