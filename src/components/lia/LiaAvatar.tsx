export function LiaAvatar({ size = 40, animate = false }: { size?: number; animate?: boolean }) {
  const uniqueId = `lia-${Math.random().toString(36).slice(2, 8)}`;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <defs>
        {/* Neon gradient for hexagon fill */}
        <linearGradient id={`${uniqueId}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(338, 100%, 53%)" />
          <stop offset="0.5" stopColor="hsl(272, 100%, 50%)" />
          <stop offset="1" stopColor="hsl(180, 100%, 50%)" />
        </linearGradient>
        {/* Glow for border */}
        <linearGradient id={`${uniqueId}-glow`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(180, 100%, 60%)" />
          <stop offset="0.5" stopColor="hsl(272, 100%, 60%)" />
          <stop offset="1" stopColor="hsl(338, 100%, 60%)" />
        </linearGradient>
        {/* Eye glow */}
        <radialGradient id={`${uniqueId}-eye`} cx="50%" cy="50%" r="50%">
          <stop stopColor="hsl(180, 100%, 70%)" />
          <stop offset="1" stopColor="hsl(180, 100%, 50%)" />
        </radialGradient>
        {/* Drop shadow for depth */}
        <filter id={`${uniqueId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="hsl(272, 100%, 50%)" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Hexagon background */}
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill={`url(#${uniqueId}-bg)`}
        filter={`url(#${uniqueId}-shadow)`}
      />
      
      {/* Hexagon border with glow */}
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="none"
        stroke={`url(#${uniqueId}-glow)`}
        strokeWidth="1.5"
        opacity="0.8"
      />

      {/* Left eye */}
      <circle cx="24" cy="28" r="4" fill={`url(#${uniqueId}-eye)`} />
      <circle cx="25" cy="27" r="1.2" fill="white" opacity="0.9" />
      
      {/* Right eye */}
      <circle cx="40" cy="28" r="4" fill={`url(#${uniqueId}-eye)`} />
      <circle cx="41" cy="27" r="1.2" fill="white" opacity="0.9" />

      {/* Friendly smile */}
      <path
        d="M24 38 Q32 45 40 38"
        fill="none"
        stroke="hsl(180, 100%, 60%)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Circuit lines from hexagon edges */}
      <g className={animate ? "lia-circuits" : ""} opacity={animate ? undefined : 0.5}>
        {/* Top-right circuit */}
        <line x1="50" y1="14" x2="58" y2="8" stroke="hsl(180, 100%, 50%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="58" cy="8" r="1.5" fill="hsl(180, 100%, 60%)" />
        
        {/* Top-left circuit */}
        <line x1="14" y1="14" x2="6" y2="8" stroke="hsl(338, 100%, 53%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="6" cy="8" r="1.5" fill="hsl(338, 100%, 60%)" />
        
        {/* Right circuit */}
        <line x1="58" y1="32" x2="63" y2="32" stroke="hsl(272, 100%, 60%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="63" cy="32" r="1.2" fill="hsl(272, 100%, 70%)" />
        
        {/* Left circuit */}
        <line x1="6" y1="32" x2="1" y2="32" stroke="hsl(272, 100%, 60%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="1" cy="32" r="1.2" fill="hsl(272, 100%, 70%)" />
        
        {/* Bottom-right circuit */}
        <line x1="50" y1="50" x2="58" y2="56" stroke="hsl(180, 100%, 50%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="58" cy="56" r="1.5" fill="hsl(180, 100%, 60%)" />
        
        {/* Bottom-left circuit */}
        <line x1="14" y1="50" x2="6" y2="56" stroke="hsl(338, 100%, 53%)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="6" cy="56" r="1.5" fill="hsl(338, 100%, 60%)" />
      </g>
    </svg>
  );
}
