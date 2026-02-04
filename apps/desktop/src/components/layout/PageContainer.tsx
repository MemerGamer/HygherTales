import { ReactNode } from "react";

export interface PageContainerProps {
  children: ReactNode;
  title: string;
  className?: string;
}

export function PageContainer({
  children,
  title,
  className = "",
}: PageContainerProps) {
  return (
    <div className={`max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 ${className}`}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}
