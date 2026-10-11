/**
 * Conservative layout budget, in points, for deciding whether a row may stay
 * indivisible. Every word is allowed its own line; long tokens and explicit
 * whitespace/newlines are budgeted too. This only controls wrapping, never data.
 * Callers choose a character width below their narrowest relevant cell width.
 */
export function textRowBudget(text: string, charactersPerLine: number): number {
  const lines = text.replace(/\t/g, "        ").split(/\r\n|\r|\n/u).reduce((total, line) => {
    const wordLines = line.trim().split(/\s+/u).filter(Boolean).reduce(
      (sum, word) => sum + Math.ceil(Array.from(word).length / charactersPerLine), 0,
    );
    const characterLines = Math.ceil(Array.from(line).length / charactersPerLine);
    return total + Math.max(1, wordLines, characterLines);
  }, 0);
  // PDF page line-height is inherited as 14pt; ordinary row padding adds 10pt.
  return lines * 14 + 10;
}
