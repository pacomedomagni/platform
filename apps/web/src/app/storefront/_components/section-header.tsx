import { ReactNode } from 'react';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export const SectionHeader = ({ eyebrow, title, description, actions }: SectionHeaderProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600/80">
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
};
