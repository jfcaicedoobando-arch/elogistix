// @ts-nocheck — Runtime Deno (Edge Function).
import * as React from 'npm:react@18.3.1';
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

const SITE_NAME = 'Libre Carga';
const BRAND_PRIMARY = '#1B2B4B';
const BRAND_ACCENT = '#2563EB';

interface Props {
  numero?: string;
  cliente?: string;
  contacto?: string;
  expediente?: string;
  total?: string;
  moneda?: string;
  mensaje?: string;
  enlacePortal?: string;
  vigencia?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const ProformaEnviadaEmail = (props: Props) => {
  const { numero = 'PRO-XXXX', cliente = 'Cliente', contacto, expediente, total, moneda, mensaje, enlacePortal, vigencia } = props;
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Proforma ${numero} para su aprobación`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Proforma {numero}</Heading>
          <Text style={lead}>
            {contacto ? `Hola ${contacto},` : 'Hola,'} te compartimos la proforma <strong>{numero}</strong> correspondiente a <strong>{cliente}</strong>{expediente ? ` (embarque ${expediente})` : ''} para tu revisión y aprobación.
          </Text>

          <Section style={card}>
            {expediente && <Row label="Embarque" value={expediente} />}
            {total && <Row label={`Total ${moneda ?? ''}`.trim()} value={total} highlight />}
            {vigencia && <Row label="Este enlace vence" value={vigencia} />}
          </Section>

          {mensaje && (
            <Section style={mensajeBox}>
              <Text style={mensajeLabel}>Mensaje de tu ejecutivo</Text>
              <Text style={mensajeText}>{mensaje}</Text>
            </Section>
          )}

          <Section style={{ textAlign: 'center', marginTop: '28px' }}>
            {enlacePortal && (
              <Button href={enlacePortal} style={btnPrimary}>
                Revisar y responder proforma
              </Button>
            )}
            <Text style={ayuda}>
              Desde ese enlace puedes <strong>aceptar</strong> o <strong>rechazar</strong> la proforma. Si tienes dudas, responde directamente a este correo.
            </Text>
          </Section>

          <Hr style={hr} />

          {props.ejecutivoNombre && (
            <Section>
              <Text style={firmaLabel}>Tu ejecutivo de cuenta</Text>
              <Text style={firmaNombre}>{props.ejecutivoNombre}</Text>
              {props.ejecutivoEmail && <Text style={firmaLinea}>{props.ejecutivoEmail}</Text>}
              {props.ejecutivoTelefono && <Text style={firmaLinea}>{props.ejecutivoTelefono}</Text>}
            </Section>
          )}

          <Text style={footer}>{SITE_NAME} · Este correo se generó automáticamente. Guarda el enlace: expira por seguridad.</Text>
        </Container>
      </Body>
    </Html>
  );
};

const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ marginBottom: '10px' }}>
    <Text style={rowLabel}>{label}</Text>
    <Text style={highlight ? rowValueStrong : rowValue}>{value}</Text>
  </div>
);

export const template = {
  component: ProformaEnviadaEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    return `Proforma ${numero} para su aprobación`;
  },
  displayName: 'Envío de proforma al cliente',
  previewData: {
    numero: 'PRO-2026-0949',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    expediente: 'ELIMP00285',
    total: '$ 12,540.00',
    moneda: 'MXN',
    vigencia: '30/06/2026',
    mensaje: 'Adjunto proforma correspondiente a la importación. Cualquier duda quedo atento.',
    enlacePortal: 'https://elogistix.lovable.app/portal/proformas/00000000-0000-0000-0000-000000000000',
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
const ayuda = { fontSize: '12px', color: '#64748B', margin: '14px 0 0' };
const hr = { borderColor: '#E2E8F0', margin: '32px 0 20px' };
const firmaLabel = { fontSize: '11px', fontWeight: 'bold' as const, color: '#64748B', textTransform: 'uppercase' as const, margin: '0 0 4px', letterSpacing: '0.04em' };
const firmaNombre = { fontSize: '14px', color: BRAND_PRIMARY, fontWeight: 'bold' as const, margin: '0 0 2px' };
const firmaLinea = { fontSize: '13px', color: '#475569', margin: '0' };
const footer = { fontSize: '11px', color: '#94A3B8', textAlign: 'center' as const, margin: '32px 0 0' };
