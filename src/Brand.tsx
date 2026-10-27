/** Marca própria do Forest Flow: folha com o fluxo saindo dela. Não é o logo da Forest Paper. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="36" height="36" rx="9" fill="var(--lime)" />
      <path
        d="M9 26c0-11 6.5-17 18-17 0 11-6.5 17-18 17Z"
        fill="var(--ink-0)"
      />
      <path
        d="M11 26c3.5-6 7.5-10 13-13"
        stroke="var(--lime)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M5 29.5h10"
        stroke="var(--ink-0)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <BrandMark />
      {!compact && (
        <span className="brand-name">
          forest<span className="brand-light">flow</span>
          <small>Forest Paper</small>
        </span>
      )}
    </span>
  );
}
