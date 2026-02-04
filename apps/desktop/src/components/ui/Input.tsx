import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    const baseStyles =
      "w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border rounded text-[var(--color-text)] placeholder:text-[rgba(255,255,255,0.4)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed";

    const errorStyles = error
      ? "border-[rgba(220,80,80,0.6)] focus:ring-[rgba(200,60,60,0.6)]"
      : "border-[var(--color-border)] focus:ring-[rgba(100,160,100,0.6)]";

    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`${baseStyles} ${errorStyles} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[#ffb3b3]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
