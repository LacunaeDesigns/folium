import { describe, it, expect, vi } from 'vitest'
import { createPointerDragGesture, GestureState, MutableRef, PointerEventLike } from './usePointerDragGesture'

function makeRef<TData>(): MutableRef<GestureState<TData> | null> {
  return { current: null }
}

/** Minimal fake pointer event — only the fields the state machine reads. */
function fakeEvent(patch: Partial<PointerEventLike> = {}): PointerEventLike {
  return {
    clientX: 0,
    clientY: 0,
    buttons: 1,
    pointerId: 1,
    ctrlKey: false,
    shiftKey: false,
    currentTarget: document.createElement('div'),
    preventDefault: vi.fn(),
    ...patch,
  }
}

describe('createPointerDragGesture', () => {
  it('does not fire any drag callback while under the threshold', () => {
    const onDragStart = vi.fn()
    const onDragMove = vi.fn()
    const onDragEnd = vi.fn()
    const stateRef = makeRef<undefined>()
    const gesture = createPointerDragGesture({ threshold: 8, onDragStart, onDragMove, onDragEnd }, stateRef)

    gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), undefined)
    gesture.onPointerMove(fakeEvent({ clientX: 3, clientY: 3 })) // hypot ~4.24 < 8

    expect(onDragStart).not.toHaveBeenCalled()
    expect(onDragMove).not.toHaveBeenCalled()
    expect(stateRef.current).not.toBeNull()
    expect(stateRef.current!.dragging).toBe(false)
  })

  it('runs the normal drag lifecycle once the threshold is crossed', () => {
    const onDragStart = vi.fn()
    const onDragMove = vi.fn()
    const onDragEnd = vi.fn()
    const onDragCancel = vi.fn()
    const stateRef = makeRef<{ ids: string[] }>()
    const data = { ids: ['a'] }
    const gesture = createPointerDragGesture(
      { threshold: 8, onDragStart, onDragMove, onDragEnd, onDragCancel },
      stateRef,
    )

    gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), data)
    expect(onDragStart).not.toHaveBeenCalled() // threshold not crossed yet

    // crosses the threshold (hypot(10, 0) = 10 >= 8)
    const crossingMove = fakeEvent({ clientX: 10, clientY: 0 })
    gesture.onPointerMove(crossingMove)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledWith(crossingMove, data, { x: 0, y: 0 })
    expect(onDragMove).toHaveBeenCalledTimes(1)
    expect(onDragMove).toHaveBeenCalledWith(crossingMove, data, { x: 0, y: 0 })
    expect(stateRef.current!.dragging).toBe(true)

    // a further move only fires onDragMove, not onDragStart again
    const secondMove = fakeEvent({ clientX: 20, clientY: 0 })
    gesture.onPointerMove(secondMove)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragMove).toHaveBeenCalledTimes(2)
    expect(onDragMove).toHaveBeenLastCalledWith(secondMove, data, { x: 0, y: 0 })

    const upEvent = fakeEvent({ clientX: 20, clientY: 0 })
    gesture.onPointerUp(upEvent)
    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith(upEvent, data, { x: 0, y: 0 })
    expect(onDragCancel).not.toHaveBeenCalled()
    expect(stateRef.current).toBeNull()
  })

  it('starts dragging immediately when threshold is 0 (resize/connect-handle style)', () => {
    const onDragStart = vi.fn()
    const onDragMove = vi.fn()
    const onDragEnd = vi.fn()
    const stateRef = makeRef<undefined>()
    const gesture = createPointerDragGesture({ onDragStart, onDragMove, onDragEnd }, stateRef)

    const downEvent = fakeEvent({ clientX: 5, clientY: 5 })
    gesture.start(downEvent, undefined)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledWith(downEvent, undefined, { x: 5, y: 5 })
    expect(stateRef.current!.dragging).toBe(true)

    const moveEvent = fakeEvent({ clientX: 6, clientY: 5 })
    gesture.onPointerMove(moveEvent)
    expect(onDragMove).toHaveBeenCalledWith(moveEvent, undefined, { x: 5, y: 5 })
  })

  it('captures the pointer via setPointerCapture when the drag really starts', () => {
    const target = document.createElement('div')
    const setPointerCapture = vi.fn()
    target.setPointerCapture = setPointerCapture
    const stateRef = makeRef<undefined>()
    const gesture = createPointerDragGesture({ onDragMove: vi.fn(), onDragEnd: vi.fn() }, stateRef)

    gesture.start(fakeEvent({ currentTarget: target, pointerId: 42 }), undefined)
    expect(setPointerCapture).toHaveBeenCalledWith(42)
  })

  it('fires onClick (not onDragEnd) on pointerup before the threshold was crossed', () => {
    const onDragEnd = vi.fn()
    const onClick = vi.fn()
    const stateRef = makeRef<undefined>()
    const gesture = createPointerDragGesture({ threshold: 8, onDragMove: vi.fn(), onDragEnd, onClick }, stateRef)

    gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), undefined)
    const upEvent = fakeEvent({ clientX: 2, clientY: 0 }) // never moved past threshold
    gesture.onPointerUp(upEvent)

    expect(onDragEnd).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith(upEvent, undefined)
    expect(stateRef.current).toBeNull()
  })

  describe('buttons-lost recovery (capture silently dropped)', () => {
    it('finishes the drag via onDragEnd when a move reports the button already released while dragging', () => {
      const onDragEnd = vi.fn()
      const onClick = vi.fn()
      const stateRef = makeRef<undefined>()
      const gesture = createPointerDragGesture({ onDragMove: vi.fn(), onDragEnd, onClick }, stateRef)

      gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), undefined) // threshold 0 -> dragging immediately
      const lostEvent = fakeEvent({ clientX: 15, clientY: 0, buttons: 0 })
      gesture.onPointerMove(lostEvent)

      expect(onDragEnd).toHaveBeenCalledTimes(1)
      expect(onDragEnd).toHaveBeenCalledWith(lostEvent, undefined, { x: 0, y: 0 })
      expect(onClick).not.toHaveBeenCalled()
      expect(stateRef.current).toBeNull()
    })

    it('treats a buttons-lost move as a click when the threshold was never crossed', () => {
      const onDragEnd = vi.fn()
      const onClick = vi.fn()
      const stateRef = makeRef<undefined>()
      const gesture = createPointerDragGesture({ threshold: 8, onDragMove: vi.fn(), onDragEnd, onClick }, stateRef)

      gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), undefined)
      const lostEvent = fakeEvent({ clientX: 2, clientY: 0, buttons: 0 }) // under threshold, button already gone
      gesture.onPointerMove(lostEvent)

      expect(onDragEnd).not.toHaveBeenCalled()
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith(lostEvent, undefined)
      expect(stateRef.current).toBeNull()
    })
  })

  describe('pointercancel', () => {
    it('resets and fires onDragCancel without a commit when cancelled mid-drag', () => {
      const onDragEnd = vi.fn()
      const onDragCancel = vi.fn()
      const stateRef = makeRef<{ tag: string }>()
      const data = { tag: 'x' }
      const gesture = createPointerDragGesture({ onDragMove: vi.fn(), onDragEnd, onDragCancel }, stateRef)

      gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), data) // threshold 0 -> dragging immediately
      gesture.onPointerCancel()

      expect(onDragCancel).toHaveBeenCalledTimes(1)
      expect(onDragCancel).toHaveBeenCalledWith(data)
      expect(onDragEnd).not.toHaveBeenCalled()
      expect(stateRef.current).toBeNull()
    })

    it('does not fire onDragCancel when cancelled before the threshold was ever crossed', () => {
      const onDragCancel = vi.fn()
      const stateRef = makeRef<undefined>()
      const gesture = createPointerDragGesture({ threshold: 8, onDragMove: vi.fn(), onDragEnd: vi.fn(), onDragCancel }, stateRef)

      gesture.start(fakeEvent({ clientX: 0, clientY: 0 }), undefined)
      gesture.onPointerCancel()

      expect(onDragCancel).not.toHaveBeenCalled()
      expect(stateRef.current).toBeNull()
    })

    it('is a no-op when there is no in-progress gesture at all', () => {
      const onDragCancel = vi.fn()
      const stateRef = makeRef<undefined>()
      const gesture = createPointerDragGesture({ onDragMove: vi.fn(), onDragEnd: vi.fn(), onDragCancel }, stateRef)

      expect(() => gesture.onPointerCancel()).not.toThrow()
      expect(onDragCancel).not.toHaveBeenCalled()
    })
  })

  it('threads a mutable data object through every callback by reference', () => {
    const stateRef = makeRef<{ ids: string[] }>()
    const data = { ids: ['a'] }
    const onDragStart = vi.fn((_e, d: { ids: string[] }) => {
      d.ids = ['dup1', 'dup2'] // e.g. alt-drag duplicating the selection
    })
    const onDragMove = vi.fn()
    const onDragEnd = vi.fn()
    const gesture = createPointerDragGesture({ onDragStart, onDragMove, onDragEnd }, stateRef)

    gesture.start(fakeEvent(), data)
    gesture.onPointerMove(fakeEvent())
    expect(onDragMove).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ids: ['dup1', 'dup2'] }),
      expect.anything(),
    )

    gesture.onPointerUp(fakeEvent())
    expect(onDragEnd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ids: ['dup1', 'dup2'] }),
      expect.anything(),
    )
  })
})
