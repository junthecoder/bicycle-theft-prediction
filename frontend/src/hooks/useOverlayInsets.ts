import { useLayoutEffect, useState } from 'react'

/** Pixels of the map covered by the overlay panels along each edge. */
export interface OverlayInsets {
  top: number
  right: number
  bottom: number
}

const NO_INSETS: OverlayInsets = { top: 0, right: 0, bottom: 0 }

/**
 * Measures how much of the map the overlay panels cover: the controls panel takes the top strip,
 * the side panel the right edge, or the bottom edge when the narrow layout moves it there.
 * Map.tsx turns these into map padding and extra pan room. Takes the elements themselves (from
 * callback refs held in state) because the panels mount after the loading screen, and an effect
 * keyed on ref objects would measure nothing.
 */
export function useOverlayInsets(controls: HTMLElement | null, side: HTMLElement | null): OverlayInsets {
  const [insets, setInsets] = useState(NO_INSETS)
  useLayoutEffect(() => {
    const measure = () => {
      const { innerWidth: width, innerHeight: height } = window
      const next = { ...NO_INSETS }
      next.top = Math.round(controls?.getBoundingClientRect().bottom ?? 0)
      const sideRect = side?.getBoundingClientRect()
      if (sideRect) {
        if (sideRect.top > height / 2) next.bottom = Math.round(height - sideRect.top)
        else next.right = Math.round(width - sideRect.left)
      }
      setInsets((current) =>
        current.top === next.top && current.right === next.right && current.bottom === next.bottom ? current : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (controls) observer.observe(controls)
    if (side) observer.observe(side)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [controls, side])
  return insets
}
