import { Fragment } from "react";
import { Text } from "@react-pdf/renderer";
import { INTER_ADVANCES, INTER_UNITS_PER_EM } from "./interAdvanceWidths";

// Commercial descriptions have at least 110pt of inner width; fixed-width
// columns pass their actual inner width. Keep
// ordinary words intact, but offer layout-only breaks for a token over 100pt.
// A tiny space run is a legal break with no visible hyphen or meaningful gap.
// Original characters are never replaced, removed or written back to data.
const BREAK_STYLE = { fontSize: 0.001 };
const graphemes = new Intl.Segmenter("es", { granularity: "grapheme" });

function width(text: string): number {
  return Array.from(text).reduce((sum, char) => {
    const advance = INTER_ADVANCES[char.codePointAt(0)!];
    return sum + (advance != null ? advance / INTER_UNITS_PER_EM : /\p{Mark}/u.test(char) ? 0 : 1.3) * 9;
  }, 0);
}

function pieces(word: string, maxWidth: number): string[] {
  if (width(word) <= maxWidth) return [word];
  const result: string[] = [];
  let part = "";
  for (const { segment } of graphemes.segment(word)) {
    if (part && width(part + segment) > maxWidth * 0.9) {
      result.push(part);
      part = "";
    }
    part += segment;
  }
  if (part) result.push(part);
  return result;
}

export function DescriptionText({ text, maxWidth = 100 }: { text: string; maxWidth?: number }) {
  return <>{text.split(/(\s+)/u).map((word, index) => (
    <Fragment key={index}>{pieces(word, maxWidth).map((part, i) => (
      <Fragment key={i}>{i > 0 ? <Text style={BREAK_STYLE}> </Text> : null}{part}</Fragment>
    ))}</Fragment>
  ))}</>;
}
