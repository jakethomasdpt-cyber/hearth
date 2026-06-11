"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Modal rendered through a portal to <body>. This keeps the fixed-position
 * overlay anchored to the viewport even when the trigger button sits inside
 * an element with a CSS transform/animation (which would otherwise become
 * the containing block for position: fixed).
 */
export function Modal({
  trigger,
  title,
  children,
  triggerClassName = "btn-primary",
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll and close on Escape while open
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overlay =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="card fade-up max-h-[90vh] w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-semibold">{title}</h3>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {typeof children === "function" ? children(close) : children}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>
      {overlay}
    </>
  );
}
