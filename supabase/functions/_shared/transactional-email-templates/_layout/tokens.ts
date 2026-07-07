// @ts-nocheck — Runtime Deno (Edge Function).
/**
 * Design tokens únicos para correos transaccionales de Libre Carga.
 * Fuente de verdad para colores, tipografía y espaciado en los 3 correos
 * (Cotización, Proforma, Factura). No importar desde el bundle web.
 */
export const BRAND = {
  primary: '#1B2B4B',
  accent: '#2563EB',
  bg: '#ffffff',
  surface: '#F8FAFC',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#475569',
  border: '#E2E8F0',
  hint: '#94A3B8',
} as const;

export const FONT = 'Inter, -apple-system, "Segoe UI", Arial, sans-serif';

/** Logo público de Libre Carga (URL absoluta obligatoria para clientes de correo). */
export const LOGO_URL = 'https://www.librecarga.com/librecarga-logo.png';

/** Chips por tipo de documento — mismo layout, distinto color. */
export const CHIP_TONES = {
  cotizacion:   { bg: '#DBEAFE', fg: '#1E40AF' },
  proforma:     { bg: '#FEF3C7', fg: '#92400E' },
  factura:      { bg: '#DCFCE7', fg: '#166534' },
  'nota-credito': { bg: '#FEE2E2', fg: '#991B1B' },
  rep:          { bg: '#E0E7FF', fg: '#3730A3' },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;
