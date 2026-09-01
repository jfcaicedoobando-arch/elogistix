// @ts-nocheck — Runtime Deno (Edge Function).
import * as React from 'npm:react@18.3.1';
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, EmailRow, EmailMensaje } from './_layout/EmailLayout.tsx';
import * as S from './_layout/styles.ts';

interface Props {
  cliente?: string;
  periodo?: string;
  totalSaldo?: string;
  totalVencido?: string;
  totalFacturas?: string;
  moneda?: string;
  mensaje?: string;
  enlacePortal?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const EstadoCuentaClienteEmail = (props: Props) => {
  const {
    cliente = 'Cliente', periodo, totalSaldo, totalVencido, totalFacturas, moneda, mensaje, enlacePortal,
  } = props;
  return (
    <EmailLayout
      previewText={`Estado de cuenta ${periodo ?? ''} — ${cliente}`.trim()}
      documentType={{ tone: 'info', label: 'Estado de cuenta' }}
      title={`Estado de cuenta — ${cliente}`}
      greeting={
        <>
          Hola, te enviamos el resumen de tu cuenta del periodo <strong>{periodo ?? 'actual'}</strong>.
        </>
      }
      ejecutivo={{
        ejecutivoNombre: props.ejecutivoNombre,
        ejecutivoEmail: props.ejecutivoEmail,
        ejecutivoTelefono: props.ejecutivoTelefono,
      }}
      footerNote="El enlace al portal es privado. Si no puedes acceder, contacta a tu ejecutivo de cuenta."
    >
      <Section style={S.card}>
        {totalFacturas && <EmailRow label={`Total facturas ${moneda ?? ''}`.trim()} value={totalFacturas} />}
        {totalSaldo && <EmailRow label={`Saldo pendiente ${moneda ?? ''}`.trim()} value={totalSaldo} highlight />}
        {totalVencido && <EmailRow label={`Vencido ${moneda ?? ''}`.trim()} value={totalVencido} highlight />}
        {periodo && <EmailRow label="Periodo" value={periodo} />}
      </Section>

      {mensaje && <EmailMensaje mensaje={mensaje} />}

      <Section style={S.ctaWrap}>
        {enlacePortal && <Button href={enlacePortal} style={S.btnPrimary}>Ver estado de cuenta en el portal</Button>}
        <Text style={S.ctaHint}>
          Si tienes dudas o necesitas un pago a plazos, responde directamente a este correo.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export const template = {
  component: EstadoCuentaClienteEmail,
  subject: (data: Record<string, unknown>) => {
    const cliente = (data?.cliente as string) ?? 'Cliente';
    return `Estado de cuenta — ${cliente}`;
  },
  displayName: 'Envío de estado de cuenta al cliente',
  previewData: {
    cliente: 'ACME, S.A. de C.V.',
    periodo: '01/07/2026 – 25/07/2026',
    totalFacturas: '$ 45,120.00',
    totalSaldo: '$ 12,540.00',
    totalVencido: '$ 3,200.00',
    moneda: 'MXN',
    mensaje: 'Te envío el resumen de tu cuenta para tu revisión.',
    enlacePortal: 'https://example.com/portal',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;
