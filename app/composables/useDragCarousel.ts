/**
 * Drag-to-slide product gallery, built on Pointer Events (not a library) so
 * mouse-drag on desktop and touch-swipe on mobile share one implementation.
 *
 * Unlike a "measure the gesture, then jump" swipe handler, this tracks the
 * pointer live: `trackStyle` exposes a transform that follows the cursor/
 * finger 1:1 while dragging, then eases the rest of the way to the next/
 * previous photo (or back to the current one) on release — so the motion
 * is always a continuous slide, never an instant cut.
 *
 * Usage: bind the pointer handlers to the gallery's outer (clipping)
 * container, point `containerRef` at that same element (its width is the
 * "one photo" unit), and apply `trackStyle` to an inner flex row that has
 * one full-width child per image. Use `goTo` for thumbnail-click
 * navigation so it animates with the same easing as a completed drag.
 */
export function useDragCarousel(
  activeImage: Ref<number>,
  imageCount: Ref<number> | ComputedRef<number>,
  containerRef: Ref<HTMLElement | null>,
) {
  // How far (as a fraction of the gallery's width) you have to drag before
  // it commits to the next/previous photo instead of snapping back.
  const COMMIT_THRESHOLD_FRACTION = 0.18
  // Movement needed before a gesture is classified as horizontal vs. vertical.
  const AXIS_LOCK_PX = 6
  // Drag resistance past the first/last photo (0 = no movement, 1 = full 1:1).
  const RUBBER_BAND_FACTOR = 0.35

  const isDragging = ref(false)
  const dragOffsetPx = ref(0)
  const animated = ref(false)

  let startX = 0
  let startY = 0
  let axis: 'x' | 'y' | null = null
  let containerWidth = 0

  function onPointerDown(event: PointerEvent) {
    if (imageCount.value < 2) return
    isDragging.value = true
    animated.value = false
    axis = null
    startX = event.clientX
    startY = event.clientY
    containerWidth = containerRef.value?.clientWidth || 0
    ;(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging.value) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY

    if (axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis === 'y') {
        // A vertical gesture: back off and let the page scroll normally.
        isDragging.value = false
        return
      }
    }

    event.preventDefault()
    let offset = dx
    const atStart = activeImage.value === 0
    const atEnd = activeImage.value === imageCount.value - 1
    if ((atStart && offset > 0) || (atEnd && offset < 0)) offset *= RUBBER_BAND_FACTOR
    dragOffsetPx.value = offset
  }

  function settle() {
    if (!isDragging.value) return
    isDragging.value = false
    axis = null
    animated.value = true

    const threshold = (containerWidth || 1) * COMMIT_THRESHOLD_FRACTION
    if (dragOffsetPx.value <= -threshold && activeImage.value < imageCount.value - 1) {
      activeImage.value += 1
    }
    else if (dragOffsetPx.value >= threshold && activeImage.value > 0) {
      activeImage.value -= 1
    }
    dragOffsetPx.value = 0
  }

  function onPointerUp() {
    settle()
  }

  function onPointerCancel() {
    settle()
  }

  /** Thumbnail-click navigation — slides to `index` with the same easing as a completed drag. */
  function goTo(index: number) {
    animated.value = true
    dragOffsetPx.value = 0
    activeImage.value = index
  }

  const trackStyle = computed(() => ({
    transform: `translate3d(calc(${-activeImage.value * 100}% + ${dragOffsetPx.value}px), 0, 0)`,
    transition: animated.value ? 'transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
  }))

  return { isDragging, trackStyle, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, goTo }
}
