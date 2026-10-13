import { Font } from "@react-pdf/renderer";
import { FONTS } from "./tokens";

// Keep Vite's statically analyzable asset URLs and browser URLs unchanged.
// Node >=22.22 (package engines) supplies a platform-correct file URL decoder
// without importing a Node builtin into the browser bundle.
function fontSource(url: URL): string {
  return url.protocol === "file:"
    ? process.getBuiltinModule("node:url").fileURLToPath(url)
    : url.href;
}

const regular = fontSource(new URL("../assets/Inter-Regular.ttf", import.meta.url));
const semibold = fontSource(new URL("../assets/Inter-SemiBold.ttf", import.meta.url));
const italic = fontSource(new URL("../assets/Inter-Italic.ttf", import.meta.url));

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
