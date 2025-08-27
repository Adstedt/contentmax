'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1'
  }

  const arrowStyles = {
    top: { borderTop: '4px solid #1f2937', borderLeft: '4px solid transparent', borderRight: '4px solid transparent' },
    bottom: { borderBottom: '4px solid #1f2937', borderLeft: '4px solid transparent', borderRight: '4px solid transparent' },
    left: { borderLeft: '4px solid #1f2937', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' },
    right: { borderRight: '4px solid #1f2937', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }
  }

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-sm text-white bg-gray-800 rounded-md shadow-lg whitespace-nowrap pointer-events-none',
            'transition-opacity duration-200',
            positionClasses[position],
            className
          )}
        >
          {content}
          <div
            className={cn('absolute w-0 h-0', arrowClasses[position])}
            style={arrowStyles[position]}
          />
        </div>
      )}
    </div>
  )
}

export default Tooltip