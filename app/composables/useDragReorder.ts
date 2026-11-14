/**
 * Minimal touch+mouse drag-to-reorder for a flat list, built on Pointer
 * Events (same approach as useSwipeGallery) rather than pulling in a
 * dependency — and crucially works from a phone, since the admin must be
 * fully usable from a touchscreen (see SPEC).
 *
 * Call `startDrag` from `@pointerdown` on a dedicated "handle" element
 * inside each tile. While dragging, whichever other tile the pointer is
 * currently over swaps places with the dragged one, live — a `pointerup`
 * anywhere then persists the final order via `persist`.
 *
 * `container` must be a template ref to the element wrapping every
 * reorderable tile; each tile needs a `data-drag-key` attribute equal to
 * `getKey(item)` for that item.
 */
export function useDragReorder<T>(
  items: Ref<T[]>,
  getKey: (item: T) => string,
  container: Ref<HTMLElement | null>,
  persist: (orderedKeys: string[]) => void,
) {
  const draggingKey = ref<string | null>(null)

  function onMove(event: PointerEvent) {
    if (!draggingKey.value || !container.value) return
    const dragIndex = items.value.findIndex(item => getKey(item) === draggingKey.value)
    if (dragIndex === -1) return

    const tiles = container.value.querySelectorAll<HTMLElement>('[data-drag-key]')
    for (const tile of tiles) {
      const key = tile.dataset.dragKey
      if (!key || key === draggingKey.value) continue
      const rect = tile.getBoundingClientRect()
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      if (!inside) continue

      const targetIndex = items.value.findIndex(item => getKey(item) === key)
      if (targetIndex === -1 || targetIndex === dragIndex) continue
      const next = [...items.value]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      items.value = next
      break
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    if (draggingKey.value) persist(items.value.map(getKey))
    draggingKey.value = null
  }

  function startDrag(event: PointerEvent, key: string) {
    event.preventDefault()
    draggingKey.value = key
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  return { draggingKey, startDrag }
}
