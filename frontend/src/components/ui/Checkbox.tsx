// components/ui/Checkbox.tsx
import React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string
    error?: boolean
    onChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, error, onChange, checked, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e.target.checked)
        }

        return (
            <div className="flex items-center space-x-2">
                <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        ref={ref}
                        checked={checked}
                        onChange={handleChange}
                        className={cn(
                            'peer h-4 w-4 shrink-0 rounded border border-gray-700 bg-gray-800 text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50',
                            {
                                'border-red-500': error,
                                'accent-emerald-500': true
                            },
                            className
                        )}
                        {...props}
                    />
                </div>
                {label && (
                    <label
                        className={cn(
                            'text-sm font-medium leading-none text-gray-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                            { 'text-red-400': error }
                        )}
                        onClick={() => {
                            // Focus the input when clicking the label
                            const input = (ref as any)?.current || document.getElementById(props.id || '')
                            if (input) input.click()
                        }}
                    >
                        {label}
                    </label>
                )}
            </div>
        )
    }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
