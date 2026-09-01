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
  saldo?: string;
  moneda?: string;
  fechaVencimiento?: string;
  diasVencido?: string;
  mensaje?: string;
  enlacePago?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const RecordatorioCobranzaEmail = (props: Props) => {
  const {
    numero = 'F-XXXX', cliente = 'Cliente', contacto,
    saldo, moneda, fechaVencimiento, diasVencido,
    mensaje, enlacePago,
  } = props;
  const vencida = Number(diasVencido) > 0;
  const tone: 'factura' | 'warning' = vencida ? 'warning' : 'factura';
  const label = vencida ? 'Factura vencida' : 'Recordatorio de pago';
  return (
    <EmailLayout
      previewText={`Recordatorio de pago — Factura ${numero}`}
      documentType={{ tone, label }}
      title={`Factura ${numero}`}
      greeting={
        <>
          {contacto ? `Hola ${contacto}, ` : 'Hola, '}
          te recordamos que la factura <strong>{numero}</strong> de <strong>{cliente}</strong> {vencida ? 'está vencida' : 'tiene un pago próximo'}.
        </>
      }
      ejecutivo={{
        ejecutivoNombre: props.ejecutivoNombre,
        ejecutivoEmail: props.ejecutivoEmail,
        ejecutivoTelefono: props.ejecutivoTelefono,
      }}
      footerNote="Si ya realizaste el pago, favor de hacer caso omiso a este correo."
    >
      <Section style={S.card}>
        {fechaVencimiento && <EmailRow label="Vencimiento" value={fechaVencimiento} />}
        {saldo && <EmailRow label={`Saldo ${moneda ?? ''}`.trim()} value={saldo} highlight />}
        {diasVencido && <EmailRow label={vencida ? 'Días de retraso' : 'Días para vencer'} value={diasVencido} />}
      </Section>

      {mensaje && <EmailMensaje mensaje={mensaje} titulo="Mensaje de tu ejecutivo de cuenta" />}

      <Section style={S.ctaWrap}>
        {enlacePago && <Button href={enlacePago} style={S.btnPrimary}>Realizar pago</Button>}
        <Text style={S.ctaHint}>
          Si tienes dudas o ya liquidaste la factura, responde directamente a este correo.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export const template = {
  component: RecordatorioCobranzaEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    const vencida = Number(data?.diasVencido) > 0;
    return `${vencida ? 'Factura vencida' : 'Recordatorio de pago'} — ${numero}`;
  },
  displayName: 'Recordatorio de cobranza',
  previewData: {
    numero: 'A-1024',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    saldo: '$ 12,540.00',
    moneda: 'MXN',
    fechaVencimiento: '15/10/2026',
    diasVencido: '5',
    mensaje: 'Quedamos atentos a tu pago. Cualquier aclaración, con gusto te apoyamos.',
    enlacePago: 'https://example.com/pago',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;
