// @ts-nocheck — Runtime Deno (Edge Function), no bundle web.
import * as React from 'npm:react@18.3.1';
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, EmailRow, EmailMensaje } from './_layout/EmailLayout.tsx';
import * as S from './_layout/styles.ts';

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

const CotizacionEnviadaEmail = (props: Props) => {
  const {
    folio = 'COT-XXXX', cliente = 'Cliente', contacto,
    origen = '', destino = '', modo, incoterm, vigencia, totalMxn, totalUsd,
    mensaje, enlacePortal, enlacePdf,
  } = props;
  return (
    <EmailLayout
      previewText={`Cotización ${folio} — ${origen} → ${destino}`}
      documentType={{ tone: 'cotizacion', label: 'Cotización' }}
      title={`Cotización ${folio}`}
      greeting={
        <>{contacto ? `Hola ${contacto}, ` : 'Hola, '}adjuntamos la cotización solicitada para <strong>{cliente}</strong>.</>
      }
      ejecutivo={{
        ejecutivoNombre: props.ejecutivoNombre,
        ejecutivoEmail: props.ejecutivoEmail,
        ejecutivoTelefono: props.ejecutivoTelefono,
      }}
    >
      <Section style={S.card}>
        <EmailRow label="Ruta" value={`${origen} → ${destino}`} />
        {modo && <EmailRow label="Modo" value={modo} />}
        {incoterm && <EmailRow label="Incoterm" value={incoterm} />}
        {vigencia && <EmailRow label="Vigencia" value={vigencia} />}
        {totalMxn && <EmailRow label="Total MXN" value={totalMxn} highlight />}
        {totalUsd && <EmailRow label="Total USD" value={totalUsd} highlight />}
      </Section>

      {mensaje && <EmailMensaje mensaje={mensaje} />}

      <Section style={S.ctaWrap}>
        {enlacePortal && <Button href={enlacePortal} style={S.btnPrimary}>Ver cotización en el portal</Button>}
        {enlacePdf && <Button href={enlacePdf} style={S.btnSecondary}>Descargar PDF</Button>}
        <Text style={S.ctaHint}>
          Cualquier duda, responde directamente a este correo.
        </Text>
      </Section>
    </EmailLayout>
  );
};

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
