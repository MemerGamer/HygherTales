import { SelectHTMLAttributes, forwardRef } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md" | "lg";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", size = "md", children, ...props }, ref) => {
    const baseStyles =
      "w-full px-3 bg-[rgba(255,255,255,0.1)] border border-[var(--color-border)] rounded text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] focus:ring-[rgba(100,160,100,0.6)] disabled:opacity-60 disabled:cursor-not-allowed";

    const sizeStyles = {
      sm: "h-8 text-sm",
      md: "h-10 text-base",
      lg: "h-12 text-lg",
    };

    return (
      <select
        ref={ref}
        className={`${baseStyles} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
