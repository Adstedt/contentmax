'use client'

import React, { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          aria-hidden="true"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />

        <div
          className={cn(
            'relative bg-white rounded-lg shadow-xl transform transition-all w-full',
            sizeClasses[size]
          )}
        >
          {(title || showCloseButton) && (
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                {title && (
                  <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="ml-auto p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal