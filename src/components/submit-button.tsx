"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Processando...",
  className = "",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${className} transition disabled:cursor-wait disabled:opacity-70`}
      {...props}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : null}
        <span>{pending ? pendingLabel : children}</span>
      </span>
    </button>
  );
}
