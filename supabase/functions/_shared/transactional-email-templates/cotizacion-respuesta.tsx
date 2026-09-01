/**
 * Template de email para respuesta de cotización (Aceptada/Rechazada) desde el portal de clientes.
 *
 * ⚠️ INACTIVO — Fase 2 de Libre Carga.
 *
 * Este template está listo pero NO se envía hasta que se complete la configuración
 * de email en Lovable Cloud. Pasos para activarlo:
 *
 *   1. Configurar dominio de email en Lovable Cloud (Connectors → Emails).
 *   2. Ejecutar `setup_email_infra` para crear la infraestructura (queues, RPCs, cron).
 *   3. Ejecutar `scaffold_transactional_email` (genera `registry.ts` y la edge function
 *      `send-transactional-email`).
 *   4. Mover/copiar este archivo a `supabase/functions/_shared/transactional-email-templates/`
 *      y registrarlo en `registry.ts`:
 *
 *        import { template as cotizacionRespuesta } from './cotizacion-respuesta.tsx'
 *        export const TEMPLATES = {
 *          ...,
 *          'cotizacion-respuesta': cotizacionRespuesta,
 *        }
 *
 *   5. Descomentar el call-site en `src/pages/portal/cotizaciones/CotizacionDetalleCliente.tsx`
 *      (buscar el bloque `// TODO Fase 2.1 — Email`).
 *   6. Deployar la edge function.
 */

// @ts-nocheck — Este archivo se compila en runtime Deno (Edge Function), no en el bundle web.
import * as React from 'npm:react@18.3.1';
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

const SITE_NAME = 'Libre Carga';
const BRAND_PRIMARY = '#1B2B4B';
const BRAND_ACCENT = '#2563EB';

interface CotizacionRespuestaProps {
  folio?: string;
  cliente?: string;
  estado?: 'Aceptada' | 'Rechazada';
  comentario?: string;
  enlace?: string;
}

const CotizacionRespuestaEmail = ({
  folio = 'COT-XXXX',
  cliente = 'Cliente',
  estado = 'Aceptada',
  comentario,
  enlace,
}: CotizacionRespuestaProps) => {
  const esAceptada = estado === 'Aceptada';
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>
        {`Cotización ${folio} ${esAceptada ? 'aceptada' : 'rechazada'} por ${cliente}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            Cotización {esAceptada ? 'aceptada' : 'rechazada'}
          </Heading>
          <Section style={card}>
            <Text style={label}>Folio</Text>
            <Text style={value}>{folio}</Text>
            <Text style={label}>Cliente</Text>
            <Text style={value}>{cliente}</Text>
            <Text style={label}>Estado</Text>
            <Text style={{ ...value, color: esAceptada ? BRAND_ACCENT : '#B91C1C' }}>
              {estado}
            </Text>
            {comentario && (
              <>
                <Text style={label}>Comentario del cliente</Text>
                <Text style={value}>{comentario}</Text>
              </>
            )}
          </Section>
          {enlace && (
            <Section style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button href={enlace} style={btn}>Ver cotización</Button>
            </Section>
          )}
          <Text style={footer}>{SITE_NAME} · Notificación automática</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: CotizacionRespuestaEmail,
  subject: (data: Record<string, unknown>) => {
    const folio = (data?.folio as string) ?? '';
    const estado = (data?.estado as string) ?? 'Aceptada';
    return `Cotización ${folio} ${estado === 'Aceptada' ? 'aceptada' : 'rechazada'}`;
  },
  displayName: 'Respuesta de cotización (portal cliente)',
  previewData: {
    folio: 'COT-2026-0042',
    cliente: 'ACME, S.A. de C.V.',
    estado: 'Aceptada',
    comentario: 'Procedan con el embarque cuanto antes.',
    enlace: 'https://elogistix.lovable.app/cotizaciones/00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry;

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' };
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' };
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: BRAND_PRIMARY, margin: '0 0 16px' };
const card = { backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '16px 20px', border: '1px solid #E2E8F0' };
const label = { fontSize: '11px', fontWeight: 'bold' as const, color: '#64748B', textTransform: 'uppercase' as const, margin: '8px 0 2px', letterSpacing: '0.04em' };
const value = { fontSize: '14px', color: '#0F172A', margin: '0 0 4px' };
const btn = { backgroundColor: BRAND_ACCENT, color: '#ffffff', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const };
const footer = { fontSize: '11px', color: '#94A3B8', textAlign: 'center' as const, margin: '32px 0 0' };
