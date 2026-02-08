import React from 'react';
import { Label } from '@platform/ui';
import { ValidationMessage } from './ValidationMessage';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}

/**
 * FormField component
 * Wrapper for form inputs with label, error display, and proper ARIA attributes
 */
export function FormField({
  label,
  htmlFor,
  error,
  required = false,
  children,
  hint,
  className = '',
}: FormFieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>
      {hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const elementChild = child as React.ReactElement<any>;
          return React.cloneElement(elementChild, {
            id: htmlFor,
            'aria-invalid': error ? 'true' : 'false',
            'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
            className: `${elementChild.props.className || ''} ${
              error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
            }`,
          });
        }
        return child;
      })}
      <ValidationMessage message={error} id={errorId} />
    </div>
  );
}
