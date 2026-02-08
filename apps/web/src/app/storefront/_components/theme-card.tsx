/**
 * ThemedCard - Card component that respects theme cardStyle
 */
'use client';

import { useComponentStyles } from '@/lib/theme';
import { Card } from '@platform/ui';
import { cn } from '@platform/ui';

type CardProps = React.ComponentPropsWithoutRef<typeof Card>;

export function ThemedCard({ className, ...props }: CardProps) {
  const { cardStyle } = useComponentStyles();

  const cardClass = cn(
    cardStyle === 'shadow' && 'shadow-md',
    cardStyle === 'border' && 'border-2',
    cardStyle === 'flat' && 'border-0 shadow-none',
    className
  );

  return <Card className={cardClass} {...props} />;
}
