/** Native focus can reveal only a textarea's caret, leaving its box clipped. */
export function keepDialogControlVisible(container: HTMLElement, target: EventTarget) {
  // React focus events also bubble through portals, including SelectContent.
  if (!(target instanceof HTMLElement) || !container.contains(target)) return;

  requestAnimationFrame(() => {
    // Let native focus scrolling finish, and never act on an obsolete focus.
    if (!container.isConnected || !container.contains(target) || container.ownerDocument.activeElement !== target) return;
    if (container.clientHeight === 0 || container.scrollHeight <= container.clientHeight) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const style = getComputedStyle(container);
    // Entrance animations scale DOMRects, but client sizes and scrollTop stay
    // in layout pixels. Convert both edges before calculating the scroll delta.
    const scaleY = containerRect.height / container.offsetHeight;
    if (!Number.isFinite(scaleY) || scaleY <= 0) return;
    const targetTop = (targetRect.top - containerRect.top) / scaleY;
    const targetBottom = (targetRect.bottom - containerRect.top) / scaleY;
    const top = container.clientTop + (parseFloat(style.scrollPaddingTop) || 0);
    const bottom = container.clientTop + container.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
    // An oversized editor cannot fit; preserve the browser's caret positioning.
    if (targetBottom - targetTop > bottom - top) return;

    const delta = targetTop < top ? Math.floor(targetTop - top)
      : targetBottom > bottom ? Math.ceil(targetBottom - bottom) : 0;
    if (delta === 0) return;
    // Only this scroll container moves. Round outward to avoid subpixel clips.
    container.scrollTop = Math.max(0, Math.min(
      container.scrollHeight - container.clientHeight, container.scrollTop + delta,
    ));
  });
}
