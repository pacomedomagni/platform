import Link, { LinkProps } from 'next/link';
import { cn } from '@platform/ui';
import { ReactNode } from 'react';

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
};

export const ButtonLink = ({
  children,
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonLinkProps) => {
  const variants = {
    default: 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90 active:scale-[0.98]',
    outline: 'border border-input/80 bg-background hover:bg-accent hover:text-accent-foreground shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3 text-xs',
    icon: 'h-10 w-10',
  };

  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
};
