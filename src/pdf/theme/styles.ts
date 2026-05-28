/**
 * StyleSheet centralizado para todos los documentos @react-pdf/renderer.
 * Sistema visual unificado de facturación: tokens depurados, jerarquía calmada,
 * tablas con zebra real, totales como tarjeta.
 *
 * Los bloques de estilos viven en `stylesLayout.ts` y `stylesContent.ts` para
 * mantener este archivo bajo el límite Power-of-10 (≤200 líneas).
 * Los tokens (COLORS, FONTS) viven en `tokens.ts`.
 */
import { StyleSheet } from "@react-pdf/renderer";
import { layoutStyles } from "./stylesLayout";
import { contentStyles } from "./stylesContent";

export { COLORS, FONTS } from "./tokens";

export const styles = StyleSheet.create({
  ...layoutStyles,
  ...contentStyles,
});
