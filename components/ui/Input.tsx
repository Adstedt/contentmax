import React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightElement?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightElement, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">{leftIcon}</span>
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'block w-full rounded-md border transition-colors duration-200',
              'px-3 py-2 text-gray-900 placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'disabled:bg-gray-50 disabled:cursor-not-allowed',
              leftIcon && 'pl-10',
              rightElement && 'pr-10',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? 'error-message' : hint ? 'hint-message' : undefined}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p id="error-message" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id="hint-message" className="mt-1 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input