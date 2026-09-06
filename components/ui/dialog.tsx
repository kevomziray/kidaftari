"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

export function Dialog({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        className="app-dialog"
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2>{title}</h2>
            <button
              type="button"
              className="text-button"
              aria-label="Close dialog"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
