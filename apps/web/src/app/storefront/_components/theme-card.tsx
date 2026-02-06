/**
 * ThemedCard - Card component that respects theme cardStyle
 */
'use client';

import { useThemeLayout } from '@/lib/theme';
import { Card, CardProps } from '@platform/ui';
import { cn } from '@platform/ui';

export function ThemedCard({ className, ...props }: CardProps) {
  const { cardStyle } = useThemeLayout();

  const cardClass = cn(
    cardStyle === 'shadow' && 'shadow-md',
    cardStyle === 'border' && 'border-2',
    cardStyle === 'flat' && 'border-0 shadow-none',
    className
  );

  return <Card className={cardClass} {...props} />;
}
