/** Decorative botanical / scientific line art (original drawings, aria-hidden). */

export function Molecule({ className, size = 120, style }: { className?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" opacity="0.7">
        <path d="M60 20 94 40v40L60 100 26 80V40L60 20Z" />
        <path d="M94 40l18-10M60 100v14M26 40 10 30" />
      </g>
      {[
        [60, 20],
        [94, 40],
        [94, 80],
        [60, 100],
        [26, 80],
        [26, 40],
        [112, 30],
        [10, 30],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="currentColor" opacity="0.75" />
      ))}
    </svg>
  );
}

export function Sprig({ className, size = 220, style }: { className?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.65">
        <path d="M30 200C70 150 110 90 190 20" />
        {[
          [60, 160, -1],
          [85, 128, 1],
          [110, 98, -1],
          [135, 72, 1],
          [158, 48, -1],
        ].map(([x, y, s], i) => (
          <path
            key={i}
            d={`M${x} ${y}c${18 * (s as number)} -6 ${30 * (s as number)} -22 ${28 * (s as number)} -40c${-18 * (s as number)} 4 ${-30 * (s as number)} 20 ${-28 * (s as number)} 40Z`}
            fill="currentColor"
            fillOpacity="0.08"
          />
        ))}
      </g>
    </svg>
  );
}

export function Sparkle({ className, size = 18, style }: { className?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 0c.6 5 4.4 9.4 10 10-5.6.6-9.4 5-10 10C9.4 15 5.6 10.6 0 10 5.6 9.4 9.4 5 10 0Z" fill="currentColor" />
    </svg>
  );
}

/** Fluid divider between sections. `from` = colour above, `to` = colour below. */
export function Wave({ from, to, flip = false }: { from: string; to: string; flip?: boolean }) {
  return (
    <svg
      className="wave"
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ background: from, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path d="M0 40C240 90 480 90 720 55S1200 0 1440 30V90H0Z" fill={to} />
    </svg>
  );
}
