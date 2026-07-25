type SparkLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
};

/** Geometric ignition mark — idea catching into a build. */
export default function SparkLogo({
  className = "",
  markClassName = "h-9 w-9",
  showWordmark = true,
}: SparkLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        className={markClassName}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="10"
          className="fill-[var(--surface)] stroke-[var(--accent)]"
          strokeWidth="1.5"
        />
        {/* Core ember */}
        <circle cx="20" cy="20" r="3.2" className="fill-[var(--accent)]" />
        {/* Sharp spark rays */}
        <path
          d="M20 6.5 L21.4 14.2 L20 13.2 L18.6 14.2 Z"
          className="fill-[var(--accent)]"
        />
        <path
          d="M33.5 20 L25.8 21.4 L26.8 20 L25.8 18.6 Z"
          className="fill-[var(--accent-soft)]"
        />
        <path
          d="M20 33.5 L18.6 25.8 L20 26.8 L21.4 25.8 Z"
          className="fill-[var(--accent)]"
        />
        <path
          d="M6.5 20 L14.2 18.6 L13.2 20 L14.2 21.4 Z"
          className="fill-[var(--accent-soft)]"
        />
        <path
          d="M29.2 10.8 L23.4 16.1 L24.6 15.2 L24.1 16.8 Z"
          className="fill-[var(--accent-muted)]"
        />
        <path
          d="M10.8 29.2 L16.1 23.4 L15.2 24.6 L16.8 24.1 Z"
          className="fill-[var(--accent-muted)]"
        />
      </svg>
      {showWordmark ? (
        <div className="leading-none">
          <p className="font-display text-xl font-semibold tracking-tight text-[var(--ink)]">
            Spark
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            idea → mvp
          </p>
        </div>
      ) : null}
    </div>
  );
}
