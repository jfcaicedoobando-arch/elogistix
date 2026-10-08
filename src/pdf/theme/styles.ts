/**
 * StyleSheet centralizado para todos los documentos @react-pdf/renderer.
 * Sistema visual unificado de documentos internos: tokens depurados, jerarquía calmada,
 * tablas con zebra real, totales como tarjeta.
 *
 * Los bloques de estilos viven en `stylesLayout.ts` y `stylesContent.ts` para
 * mantener este archivo bajo el límite Power-of-10 (≤200 líneas).
 * Los tokens (COLORS, FONTS) viven en `tokens.ts`.
 */
import { registerPdfFonts } from "./fonts";
import { reportStyles } from "./stylesReports";
import { StyleSheet } from "@react-pdf/renderer";
import { layoutStyles } from "./stylesLayout";
import { contentStyles } from "./stylesContent";

export { COLORS, FONTS } from "./tokens";

registerPdfFonts();

export const styles = StyleSheet.create({
  ...layoutStyles,
  ...contentStyles,
  ...reportStyles,
});
