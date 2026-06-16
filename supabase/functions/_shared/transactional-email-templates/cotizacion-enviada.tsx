// @ts-nocheck — Corre en runtime Deno (Edge Function), no en el bundle web.
import * as React from 'npm:react@18.3.1';
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

const SITE_NAME = 'Libre Carga';
const BRAND_PRIMARY = '#1B2B4B';
const BRAND_ACCENT = '#2563EB';

interface Props {
  folio?: string;
  cliente?: string;
  contacto?: string;
  origen?: string;
  destino?: string;
  incoterm?: string;
  modo?: string;
  vigencia?: string;
  totalMxn?: string;
  totalUsd?: string;
  mensaje?: string;
  enlacePortal?: string;
  enlacePdf?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const CotizacionEnviadaEmail = ({
  folio = 'COT-XXXX',
  cliente = 'Cliente',
  contacto,
  origen = '',
  destino = '',
  incoterm = '',
  modo = '',
  vigencia,
  totalMxn,
  totalUsd,
  mensaje,
  enlacePortal,
  enlacePdf,
  ejecutivoNombre,
  ejecutivoEmail,
  ejecutivoTelefono,
}: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Cotización ${folio} — ${origen} → ${destino}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Cotización {folio}</Heading>
        <Text style={lead}>
          {contacto ? `Hola ${contacto},` : 'Hola,'} adjuntamos la cotización solicitada para <strong>{cliente}</strong>.
        </Text>

        <Section style={card}>
          <Row label="Ruta" value={`${origen} → ${destino}`} />
          {modo && <Row label="Modo" value={modo} />}
          {incoterm && <Row label="Incoterm" value={incoterm} />}
          {vigencia && <Row label="Vigencia" value={vigencia} />}
          {totalMxn && <Row label="Total MXN" value={totalMxn} highlight />}
          {totalUsd && <Row label="Total USD" value={totalUsd} highlight />}
        </Section>

        {mensaje && (
          <Section style={mensajeBox}>
            <Text style={mensajeLabel}>Mensaje</Text>
            <Text style={mensajeText}>{mensaje}</Text>
          </Section>
        )}

        <Section style={{ textAlign: 'center', marginTop: '28px' }}>
          {enlacePortal && (
            <Button href={enlacePortal} style={btnPrimary}>Ver cotización en el portal</Button>
          )}
          {enlacePdf && (
            <div style={{ marginTop: '12px' }}>
              <Button href={enlacePdf} style={btnSecondary}>Descargar PDF</Button>
            </div>
          )}
        </Section>

        <Hr style={hr} />

        {ejecutivoNombre && (
          <Section>
            <Text style={firmaLabel}>Tu ejecutivo de cuenta</Text>
            <Text style={firmaNombre}>{ejecutivoNombre}</Text>
            {ejecutivoEmail && <Text style={firmaLinea}>{ejecutivoEmail}</Text>}
            {ejecutivoTelefono && <Text style={firmaLinea}>{ejecutivoTelefono}</Text>}
          </Section>
        )}

        <Text style={footer}>{SITE_NAME} · Esta cotización se generó automáticamente desde nuestro sistema.</Text>
      </Container>
    </Body>
  </Html>
);

const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ marginBottom: '10px' }}>
    <Text style={rowLabel}>{label}</Text>
    <Text style={highlight ? rowValueStrong : rowValue}>{value}</Text>
  </div>
);

export const template = {
  component: CotizacionEnviadaEmail,
  subject: (data: Record<string, unknown>) => {
    const folio = (data?.folio as string) ?? '';
    const origen = (data?.origen as string) ?? '';
    const destino = (data?.destino as string) ?? '';
    if (origen && destino) return `Cotización ${folio} — ${origen} → ${destino}`;
    return `Cotización ${folio}`;
  },
  displayName: 'Envío de cotización al cliente',
  previewData: {
    folio: 'COT-2026-0042',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    origen: 'CNSHA',
    destino: 'MXVER',
    incoterm: 'FOB',
    modo: 'Marítimo FCL',
    vigencia: '30/06/2026',
    totalMxn: '$ 145,320.00 MXN',
    totalUsd: 'US$ 7,860.00',
    mensaje: 'Adjuntamos la propuesta. Cualquier duda quedamos atentos.',
    enlacePortal: 'https://elogistix.lovable.app/portal/cotizaciones/00000000',
    enlacePdf: 'https://example.com/cot.pdf',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', padding: '24px 0' };
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' };
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: BRAND_PRIMARY, margin: '0 0 12px' };
const lead = { fontSize: '15px', color: '#0F172A', lineHeight: '1.5', margin: '0 0 20px' };
const card = { backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '20px', border: '1px solid #E2E8F0' };
const rowLabel = { fontSize: '11px', fontWeight: 'bold' as const, color: '#64748B', textTransform: 'uppercase' as const, margin: '0 0 2px', letterSpacing: '0.04em' };
const rowValue = { fontSize: '14px', color: '#0F172A', margin: '0' };
const rowValueStrong = { fontSize: '16px', color: BRAND_PRIMARY, margin: '0', fontWeight: 'bold' as const };
const mensajeBox = { backgroundColor: '#EFF6FF', borderRadius: '8px', padding: '16px 20px', margin: '20px 0 0', borderLeft: `3px solid ${BRAND_ACCENT}` };
const mensajeLabel = { fontSize: '11px', fontWeight: 'bold' as const, color: BRAND_ACCENT, textTransform: 'uppercase' as const, margin: '0 0 6px', letterSpacing: '0.04em' };
const mensajeText = { fontSize: '14px', color: '#0F172A', margin: '0', lineHeight: '1.5', whiteSpace: 'pre-wrap' as const };
const btnPrimary = { backgroundColor: BRAND_ACCENT, color: '#ffffff', padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const, display: 'inline-block' };
const btnSecondary = { backgroundColor: '#ffffff', color: BRAND_PRIMARY, padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' as const, border: `1px solid ${BRAND_PRIMARY}`, display: 'inline-block' };
const hr = { borderColor: '#E2E8F0', margin: '32px 0 20px' };
const firmaLabel = { fontSize: '11px', fontWeight: 'bold' as const, color: '#64748B', textTransform: 'uppercase' as const, margin: '0 0 4px', letterSpacing: '0.04em' };
const firmaNombre = { fontSize: '14px', color: BRAND_PRIMARY, fontWeight: 'bold' as const, margin: '0 0 2px' };
const firmaLinea = { fontSize: '13px', color: '#475569', margin: '0' };
const footer = { fontSize: '11px', color: '#94A3B8', textAlign: 'center' as const, margin: '32px 0 0' };
