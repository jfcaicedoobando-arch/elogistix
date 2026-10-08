import { Font } from "@react-pdf/renderer";
import { FONTS } from "./tokens";

// Vite emits same-origin, content-hashed assets. The file URL branch lets the
// real Node renderer use the identical files in PDF regression tests.
const regular = new URL("../assets/Inter-Regular.ttf", import.meta.url).href.replace(/^file:\/\//, "");
const semibold = new URL("../assets/Inter-SemiBold.ttf", import.meta.url).href.replace(/^file:\/\//, "");
const italic = new URL("../assets/Inter-Italic.ttf", import.meta.url).href.replace(/^file:\/\//, "");

let registered = false;

/** Explicit call survives package sideEffects tree-shaking. */
export function registerPdfFonts() {
  if (registered) return;
  Font.register({ family: FONTS.regular, fonts: [
    { src: regular, fontWeight: 400 },
    { src: semibold, fontWeight: 600 },
    { src: semibold, fontWeight: 700 },
    { src: italic, fontStyle: "italic" },
  ] });
  Font.register({ family: FONTS.bold, fonts: [
    { src: semibold }, { src: semibold, fontWeight: 700 }, { src: italic, fontStyle: "italic" },
  ] });
  Font.register({ family: FONTS.oblique, src: italic });
  registered = true;
}
