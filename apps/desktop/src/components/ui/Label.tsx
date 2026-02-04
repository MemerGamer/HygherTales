import { LabelHTMLAttributes, forwardRef } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`block text-sm font-medium text-[var(--color-text)] mb-1.5 ${className}`}
        {...props}
      >
        {children}
        {required && <span className="text-[#f88] ml-1">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";
