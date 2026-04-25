'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button, Input, Label } from './atoms';

export interface PromptField {
  name: string;
  label: string;
  type?: 'text' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  helperText?: string;
}

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'default' | 'destructive';
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'default',
  onSubmit,
}: PromptDialogProps) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      fields.forEach((f) => {
        init[f.name] = f.defaultValue ?? '';
      });
      setValues(init);
      setErrors({});
    }
  }, [open, fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required && !values[f.name]?.trim()) next[f.name] = `${f.label} is required`;
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3 py-3">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={`prompt-${f.name}`}>
                  {f.label}
                  {f.required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>
                {f.type === 'select' ? (
                  <select
                    id={`prompt-${f.name}`}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    aria-invalid={!!errors[f.name]}
                    aria-describedby={errors[f.name] || f.helperText ? `prompt-${f.name}-help` : undefined}
                  >
                    <option value="">Select…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`prompt-${f.name}`}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    aria-invalid={!!errors[f.name]}
                    aria-describedby={errors[f.name] || f.helperText ? `prompt-${f.name}-help` : undefined}
                  />
                )}
                {(errors[f.name] || f.helperText) && (
                  <p
                    id={`prompt-${f.name}-help`}
                    className={errors[f.name] ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
                  >
                    {errors[f.name] ?? f.helperText}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
