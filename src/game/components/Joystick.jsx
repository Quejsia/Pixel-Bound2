import { useRef, useCallback } from 'react'

const RADIUS = 44

export default function Joystick({ onChange }) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const activeTouch = useRef(null)
  const origin = useRef({ x: 0, y: 0 })

  const setKnob = useCallback((dx, dy) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    }
  }, [])

  const handleStart = useCallback((clientX, clientY, id) => {
    const rect = baseRef.current.getBoundingClientRect()
    origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    activeTouch.current = id
  }, [])

  const handleMove = useCallback((clientX, clientY) => {
    let dx = clientX - origin.current.x
    let dy = clientY - origin.current.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob(dx, dy)
    onChange(dx / RADIUS, dy / RADIUS)
  }, [onChange, setKnob])

  const handleEnd = useCallback(() => {
    activeTouch.current = null
    setKnob(0, 0)
    onChange(0, 0)
  }, [onChange, setKnob])

  const onTouchStart = (e) => {
    e.preventDefault()
    const t = e.changedTouches[0]
    handleStart(t.clientX, t.clientY, t.identifier)
    handleMove(t.clientX, t.clientY)
  }
  const onTouchMove = (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) {
      if (t.identifier === activeTouch.current) handleMove(t.clientX, t.clientY)
    }
  }
  const onTouchEnd = (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) {
      if (t.identifier === activeTouch.current) handleEnd()
    }
  }

  // Mouse support for desktop testing
  const onMouseDown = (e) => {
    handleStart(e.clientX, e.clientY, 'mouse')
    handleMove(e.clientX, e.clientY)
    const onMove = (ev) => handleMove(ev.clientX, ev.clientY)
    const onUp = () => {
      handleEnd()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={baseRef}
      className="joystick-base"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      <div ref={knobRef} className="joystick-knob" />
    </div>
  )
}
