import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "info" | "neutral";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "neutral", className = "", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold";

    const variantStyles = {
      success: "bg-[#7ed67e] text-[#1a1a1a]",
      warning: "bg-[#f59e0b] text-[#1a1a1a]",
      info: "bg-[#3b82f6] text-white",
      neutral: "bg-[rgba(255,255,255,0.15)] text-[var(--color-text)]",
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
