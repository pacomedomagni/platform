/**
 * ThemedButton - Button component that respects theme buttonStyle
 */
'use client';

import { useThemeLayout } from '@/lib/theme';
import { Button, ButtonProps } from '@platform/ui';
import { cn } from '@platform/ui';

export function ThemedButton({ className, ...props }: ButtonProps) {
  const { buttonStyle } = useThemeLayout();

  const buttonClass = cn(
    buttonStyle === 'pill' && 'rounded-full',
    buttonStyle === 'square' && 'rounded-none',
    buttonStyle === 'rounded' && 'rounded-md',
    className
  );

  return <Button className={buttonClass} {...props} />;
}
