/**
 * Utilities for working with contenteditable elements.
 * All character offsets are in terms of innerText (i.e. \n for line breaks).
 */

/**
 * Get selection start/end offsets within a contenteditable element,
 * measured in innerText character positions.
 *
 * Uses a temp-div approach to measure the prefix via innerText so that
 * <br> elements and block-element newlines are counted correctly.
 */
export function getSelectionOffsets(
  container: HTMLElement
): { start: number; end: number; text: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = sel.toString();
  if (!text.trim()) return null;

  // Clone the DOM from container start to selection start into a temp div,
  // then use innerText to get the character count (handles <br>, <div> etc.)
  const prefixRange = document.createRange();
  prefixRange.setStart(container, 0);
  prefixRange.setEnd(range.startContainer, range.startOffset);

  const tempDiv = document.createElement('div');
  tempDiv.appendChild(prefixRange.cloneContents());
  const start = tempDiv.innerText.length;
  const end = start + text.length;

  return { start, end, text };
}
