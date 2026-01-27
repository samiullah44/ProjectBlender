// components/ui/Badge.tsx
import React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-semibold transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          {
            // Variants
            'bg-gradient-to-r from-blue-600 to-purple-600 text-white': variant === 'default',
            'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100': variant === 'secondary',
            'bg-red-500 text-white': variant === 'destructive',
            'border border-gray-300 dark:border-gray-600 bg-transparent': variant === 'outline',
            'bg-emerald-500 text-white': variant === 'success',
            'bg-amber-500 text-white': variant === 'warning',
            'bg-blue-500 text-white': variant === 'info',
            
            // Sizes
            'px-2 py-0.5 text-xs': size === 'sm',
            'px-3 py-1 text-sm': size === 'md',
            'px-4 py-1.5 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }