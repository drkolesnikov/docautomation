/**
 * Utilities for working with contenteditable elements.
 * All character offsets are in terms of innerText (i.e. \n for line breaks).
 */

/** Normalize line endings to \n, matching how outputText is stored in state. */
function nl(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

/**
 * Measure how many characters (in normalized innerText) are covered by a
 * DOM range that starts at the container's beginning.
 */
function measurePrefixLength(container: HTMLElement, endNode: Node, endOffset: number): number {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(endNode, endOffset);
  const div = document.createElement('div');
  div.appendChild(r.cloneContents());
  return nl(div.innerText).length;
}

/**
 * Get selection start/end offsets within a contenteditable element,
 * measured in innerText character positions (normalized to \n).
 *
 * Both endpoints are measured independently via the temp-div technique so
 * that the result is consistent with outputText regardless of OS line-ending
 * conventions in sel.toString() or innerText.
 */
export function getSelectionOffsets(
  container: HTMLElement
): { start: number; end: number; text: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const rawText = sel.toString();
  if (!rawText.trim()) return null;

  const start = measurePrefixLength(container, range.startContainer, range.startOffset);
  const end   = measurePrefixLength(container, range.endContainer,   range.endOffset);

  // Derive text from the measured span so it is guaranteed consistent with
  // the offsets (normalized newlines, no hidden CR characters).
  const text = nl(rawText);

  return { start, end, text };
}
