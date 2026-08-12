/**
 * Estilos compartidos de los correos de autenticación.
 * Toman los tokens de marca de la app (primario #1B2B4B, acento #2563EB,
 * fondo #F8FAFC, tipografía Inter con respaldo web-safe).
 */
export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
}

export const container = {
  padding: '32px 28px',
  maxWidth: '560px',
  backgroundColor: '#F8FAFC',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
}

export const brand = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#1B2B4B',
  margin: '0 0 20px',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1B2B4B',
  margin: '0 0 16px',
}

export const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

export const link = { color: '#2563EB', textDecoration: 'underline' }

export const button = {
  backgroundColor: '#1B2B4B',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const code = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.18em',
  color: '#1B2B4B',
  backgroundColor: '#ffffff',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  padding: '14px 20px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}

export const footer = {
  fontSize: '12px',
  color: '#94A3B8',
  lineHeight: '1.6',
  margin: '28px 0 0',
}
