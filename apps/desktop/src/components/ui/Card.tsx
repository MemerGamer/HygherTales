import { HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ clickable = false, className = "", children, ...props }, ref) => {
    const baseStyles =
      "rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] p-4 transition-colors";

    const clickableStyles = clickable
      ? "cursor-pointer hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] focus-visible:ring-[rgba(255,255,255,0.3)]"
      : "";

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${clickableStyles} ${className}`}
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? "button" : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
