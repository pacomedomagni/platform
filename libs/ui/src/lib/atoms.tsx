import React from 'react';
import { cn } from './utils';

// --- ATOMS ---

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary', size?: 'default' | 'sm' | 'icon' }>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
      const variants = {
          default: "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90 active:scale-[0.98]",
          destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
          outline: "border border-input/80 bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
          secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85",
          ghost: "hover:bg-accent hover:text-accent-foreground"
      }
      
      const sizes = {
          default: "h-10 px-4 py-2",
          sm: "h-9 rounded-md px-3 text-xs",
          icon: "h-10 w-10"
      }

      return (
        <button
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
            variants[variant],
            sizes[size],
            className
          )}
          ref={ref}
          {...props}
        />
      )
    }
)
Button.displayName = "Button"

export const Badge = ({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }) => {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground",
    success: "border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400",
    warning: "border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
  }
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1", variants[variant], className)} {...props} />
  )
}

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
}

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      />
    )
)
Label.displayName = "Label"

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-2.5 pointer-events-none opacity-50">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  )
)
NativeSelect.displayName = "NativeSelect"

export const Spinner = ({ className, size = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'default' | 'lg' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    default: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }
  return (
    <div 
      className={cn("animate-spin rounded-full border-solid border-primary border-t-transparent", sizes[size], className)} 
      {...props} 
    />
  )
}
