// components/ui/Input.tsx
import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  error?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    error = false,
    leftIcon,
    rightIcon,
    type = 'text',
    ...props 
  }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full rounded-lg font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:text-gray-400',
            {
              // Variants
              'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600': 
                variant === 'default',
              'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500':
                variant === 'outline',
              'bg-transparent border-none text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800':
                variant === 'ghost',
              
              // Sizes
              'px-3 py-1.5 text-sm': size === 'sm',
              'px-4 py-2.5 text-base': size === 'md',
              'px-6 py-3 text-lg': size === 'lg',
              
              // Error state
              'border-red-500 dark:border-red-500 focus-visible:ring-red-500': error,
              
              // With icons
              'pl-10': leftIcon,
              'pr-10': rightIcon,
            },
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }