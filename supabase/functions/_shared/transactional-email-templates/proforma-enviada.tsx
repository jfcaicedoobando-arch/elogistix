// @ts-nocheck — Runtime Deno (Edge Function).
import * as React from 'npm:react@19.2.8';
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, EmailRow, EmailMensaje } from './_layout/EmailLayout.tsx';
import * as S from './_layout/styles.ts';

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
  const {
    numero = 'PRO-XXXX', cliente = 'Cliente', contacto,
    expediente, total, moneda, mensaje, enlacePortal, vigencia,
  } = props;
  return (
    <EmailLayout
      previewText={`Proforma ${numero} — Requiere tu aprobación`}
      documentType={{ tone: 'proforma', label: 'Proforma · Acción requerida' }}
      title={`Proforma ${numero}`}
      greeting={
        <>
          {contacto ? `Hola ${contacto}, ` : 'Hola, '}
          te compartimos la proforma <strong>{numero}</strong> correspondiente a <strong>{cliente}</strong>
          {expediente ? <> (embarque <strong>{expediente}</strong>)</> : null} para tu revisión y aprobación.
        </>
      }
      ejecutivo={{
        ejecutivoNombre: props.ejecutivoNombre,
        ejecutivoEmail: props.ejecutivoEmail,
        ejecutivoTelefono: props.ejecutivoTelefono,
      }}
      footerNote="Guarda el enlace: expira por seguridad."
    >
      <Section style={S.card}>
        {expediente && <EmailRow label="Embarque" value={expediente} />}
        {total && <EmailRow label={`Total ${moneda ?? ''}`.trim()} value={total} highlight />}
        {vigencia && <EmailRow label="Este enlace vence" value={vigencia} />}
      </Section>

      {mensaje && <EmailMensaje mensaje={mensaje} />}

      <Section style={S.ctaWrap}>
        {enlacePortal && <Button href={enlacePortal} style={S.btnPrimary}>Revisar y responder proforma</Button>}
        <Text style={S.ctaHint}>
          Desde ese enlace puedes <strong>aceptar</strong> o <strong>rechazar</strong> la proforma.
          Si tienes dudas, responde directamente a este correo.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export const template = {
  component: ProformaEnviadaEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    return `Proforma ${numero} — Requiere tu aprobación`;
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
