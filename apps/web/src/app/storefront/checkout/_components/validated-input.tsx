'use client';

import { forwardRef } from 'react';
import { Input } from '@platform/ui';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@platform/ui';

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  isValid?: boolean;
  showValidation?: boolean;
}

export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ error, isValid, showValidation = true, className, ...props }, ref) => {
    const hasError = !!error;
    const hasSuccess = isValid && !hasError && showValidation && props.value;

    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn(
            className,
            hasError && 'border-red-500 focus-visible:ring-red-500/30',
            hasSuccess && 'border-emerald-500 focus-visible:ring-emerald-500/30'
          )}
          {...props}
        />
        {showValidation && props.value && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {hasError ? (
              <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            ) : isValid ? (
              <Check className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';
