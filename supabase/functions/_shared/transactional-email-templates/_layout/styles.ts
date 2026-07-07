// @ts-nocheck — Runtime Deno (Edge Function).
/**
 * Estilos inline compartidos por los correos transaccionales. React Email no
 * permite `<style>` ni CSS externo — todos los objetos aquí se aplican vía
 * `style={...}` en los componentes.
 */
import { BRAND, FONT } from './tokens.ts';

export const main = {
  backgroundColor: BRAND.bg,
  fontFamily: FONT,
  padding: '24px 0',
  margin: 0,
};

export const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: BRAND.bg,
  padding: '0',
};

export const header = {
  padding: '16px 24px',
  borderBottom: `1px solid ${BRAND.border}`,
  display: 'table',
  width: '100%',
};

export const headerCellLogo = {
  display: 'table-cell',
  verticalAlign: 'middle',
};

export const headerCellChip = {
  display: 'table-cell',
  verticalAlign: 'middle',
  textAlign: 'right' as const,
};

export const logoImg = {
  height: '32px',
  width: 'auto',
  display: 'inline-block',
};

export const chip = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 'bold' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
};

export const bodyWrap = {
  padding: '28px 24px 8px',
};

export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: BRAND.primary,
  margin: '0 0 12px',
  lineHeight: '1.25',
};

export const lead = {
  fontSize: '15px',
  color: BRAND.text,
  lineHeight: '1.55',
  margin: '0 0 20px',
};

export const card = {
  backgroundColor: BRAND.surface,
  borderRadius: '8px',
  padding: '20px',
  border: `1px solid ${BRAND.border}`,
  margin: '0 0 4px',
};

export const rowLabel = {
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: BRAND.muted,
  textTransform: 'uppercase' as const,
  margin: '0 0 2px',
  letterSpacing: '0.04em',
};

export const rowValue = {
  fontSize: '14px',
  color: BRAND.text,
  margin: '0',
};

export const rowValueStrong = {
  fontSize: '16px',
  color: BRAND.primary,
  margin: '0',
  fontWeight: 'bold' as const,
};

export const mensajeBox = {
  backgroundColor: '#EFF6FF',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0 0',
  borderLeft: `3px solid ${BRAND.accent}`,
};

export const mensajeLabel = {
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: BRAND.accent,
  textTransform: 'uppercase' as const,
  margin: '0 0 6px',
  letterSpacing: '0.04em',
};

export const mensajeText = {
  fontSize: '14px',
  color: BRAND.text,
  margin: '0',
  lineHeight: '1.55',
  whiteSpace: 'pre-wrap' as const,
};

export const ctaWrap = {
  textAlign: 'center' as const,
  margin: '28px 0 0',
};

export const btnPrimary = {
  backgroundColor: BRAND.accent,
  color: '#ffffff',
  padding: '12px 26px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  display: 'inline-block',
  margin: '0 4px',
};

export const btnSecondary = {
  backgroundColor: '#ffffff',
  color: BRAND.primary,
  padding: '11px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 'bold' as const,
  border: `1px solid ${BRAND.primary}`,
  display: 'inline-block',
  margin: '0 4px',
};

export const ctaHint = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '14px 0 0',
  lineHeight: '1.5',
};

export const hr = {
  borderColor: BRAND.border,
  margin: '28px 0 20px',
};

export const firmaLabel = {
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: BRAND.muted,
  textTransform: 'uppercase' as const,
  margin: '0 0 4px',
  letterSpacing: '0.04em',
};

export const firmaNombre = {
  fontSize: '14px',
  color: BRAND.primary,
  fontWeight: 'bold' as const,
  margin: '0 0 2px',
};

export const firmaLinea = {
  fontSize: '13px',
  color: BRAND.subtle,
  margin: '0',
};

export const footer = {
  fontSize: '11px',
  color: BRAND.hint,
  textAlign: 'center' as const,
  margin: '20px 0 0',
  lineHeight: '1.5',
  padding: '0 24px 24px',
};

export const brandFallbackText = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: BRAND.primary,
  margin: 0,
};
