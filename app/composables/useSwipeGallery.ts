/**
 * Minimal left/right swipe-to-navigate for a product gallery's main photo.
 * Built on Pointer Events (not a library) since those unify mouse, touch, and
 * pen into one API — the same handlers give desktop click-drag and mobile
 * touch swipe for free.
 *
 * Pair with `style="touch-action: pan-y"` on the element these handlers are
 * bound to: it tells the browser to keep handling vertical scrolling itself,
 * while handing horizontal gestures to us instead of trying to pan/zoom them.
 */
export function useSwipeGallery(activeImage: Ref<number>, imageCount: Ref<number> | ComputedRef<number>) {
  // Ignores incidental taps/jitter — only a deliberate horizontal drag counts.
  const SWIPE_THRESHOLD_PX = 40

  let startX = 0
  let startY = 0
  let tracking = false

  function onPointerDown(event: PointerEvent) {
    tracking = true
    startX = event.clientX
    startY = event.clientY
  }

  function onPointerUp(event: PointerEvent) {
    if (!tracking) return
    tracking = false

    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return

    const count = imageCount.value
    if (count < 2) return
    if (dx < 0) activeImage.value = Math.min(activeImage.value + 1, count - 1)
    else activeImage.value = Math.max(activeImage.value - 1, 0)
  }

  function onPointerCancel() {
    tracking = false
  }

  return { onPointerDown, onPointerUp, onPointerCancel }
}
