/**
 * ThemedButton - Button component that respects theme buttonStyle
 */
'use client';

import { useComponentStyles } from '@/lib/theme';
import { Button } from '@platform/ui';
import { cn } from '@platform/ui';

type ButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export function ThemedButton({ className, ...props }: ButtonProps) {
  const { buttonStyle } = useComponentStyles();

  const buttonClass = cn(
    buttonStyle === 'pill' && 'rounded-full',
    buttonStyle === 'square' && 'rounded-none',
    buttonStyle === 'rounded' && 'rounded-md',
    className
  );

  return <Button className={buttonClass} {...props} />;
}
