"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ExampleIdea = {
  label: string;
  idea: string;
  preview: string;
};

type ExampleChipProps = {
  example: ExampleIdea;
  disabled?: boolean;
  onSelect: (idea: string) => void;
};

export default function ExampleChip({
  example,
  disabled,
  onSelect,
}: ExampleChipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(example.idea)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onTouchStart={() => {
          clearHold();
          holdTimer.current = setTimeout(() => setOpen(true), 420);
        }}
        onTouchEnd={clearHold}
        onTouchCancel={clearHold}
        aria-describedby={open ? tipId : undefined}
        className="rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent-muted)] hover:text-[var(--accent)] disabled:opacity-40"
      >
        {example.label}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${example.label} preview`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--line)] font-mono text-[10px] text-[#6b8579] transition hover:border-[var(--accent-muted)] hover:text-[var(--accent)] md:hidden"
      >
        i
      </button>
      {open ? (
        <div
          id={tipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-left text-[11px] leading-relaxed text-[var(--muted)] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        >
          {example.preview}
        </div>
      ) : null}
    </div>
  );
}
