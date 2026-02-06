import { AlertCircle } from 'lucide-react';

interface ValidationMessageProps {
  message?: string;
  id?: string;
}

/**
 * ValidationMessage component
 * Displays field-level error messages with proper ARIA attributes
 */
export function ValidationMessage({ message, id }: ValidationMessageProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600"
    >
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
