import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const GAP = 4
// Open upward when there is less than this much room below the trigger
const MIN_SPACE_BELOW = 260

type MenuProps = {
  trigger: ReactNode
  triggerClassName: string
  label?: string
  align?: 'left' | 'right'
  disabled?: boolean
  children: (close: () => void) => ReactNode
}

function Menu({
  trigger,
  triggerClassName,
  label,
  align = 'right',
  disabled = false,
  children,
}: MenuProps) {
  // Fixed positioning keeps the panel from being clipped by scrolling containers
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const open = position !== null

  useEffect(() => {
    if (!open) return
    const close = () => setPosition(null)
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    function handleScroll(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle() {
    if (open || !rootRef.current) {
      setPosition(null)
      return
    }
    const rect = rootRef.current.getBoundingClientRect()
    const openUp = window.innerHeight - rect.bottom < MIN_SPACE_BELOW
    setPosition({
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
      ...(align === 'right'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {position && (
        <div
          style={position}
          className="fixed z-50 max-h-80 min-w-44 overflow-y-auto rounded-lg bg-white p-1 shadow-lg ring-1 ring-line"
        >
          {children(() => setPosition(null))}
        </div>
      )}
    </div>
  )
}

type MenuItemProps = {
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  children: ReactNode
}

export function MenuItem({
  onSelect,
  destructive = false,
  disabled = false,
  children,
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold whitespace-nowrap transition hover:bg-field focus-visible:bg-field focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        destructive ? 'text-danger' : 'text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export default Menu
