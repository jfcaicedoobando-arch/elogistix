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
    const top = containerRect.top + container.clientTop + (parseFloat(style.scrollPaddingTop) || 0);
    const bottom = containerRect.top + container.clientTop + container.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
    // An oversized editor cannot fit; preserve the browser's caret positioning.
    if (targetRect.height > bottom - top) return;

    const delta = targetRect.top < top ? Math.floor(targetRect.top - top)
      : targetRect.bottom > bottom ? Math.ceil(targetRect.bottom - bottom) : 0;
    if (delta === 0) return;
    // Only this scroll container moves. Round outward to avoid subpixel clips.
    container.scrollTop = Math.max(0, Math.min(
      container.scrollHeight - container.clientHeight, container.scrollTop + delta,
    ));
  });
}
