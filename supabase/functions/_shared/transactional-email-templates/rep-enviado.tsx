// @ts-nocheck — Runtime Deno (Edge Function).
import * as React from 'npm:react@19.2.8';
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, EmailRow, EmailMensaje } from './_layout/EmailLayout.tsx';
import * as S from './_layout/styles.ts';

interface Props {
  numero?: string;
  facturaNumero?: string;
  cliente?: string;
  contacto?: string;
  monto?: string;
  moneda?: string;
  uuid?: string;
  uuidFacturaOriginal?: string;
  fechaPago?: string;
  formaPago?: string;
  mensaje?: string;
  enlacePdf?: string;
  enlaceXml?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const RepEnviadoEmail = (props: Props) => {
  const {
    numero = 'REP-XXXX', facturaNumero, cliente = 'Cliente', contacto,
    monto, moneda, uuid, uuidFacturaOriginal, fechaPago, formaPago,
    mensaje, enlacePdf, enlaceXml,
  } = props;
  return (
    <EmailLayout
      previewText={`Complemento de pago ${numero} — CFDI emitido`}
      documentType={{ tone: 'rep', label: 'Complemento de pago · CFDI emitido' }}
      title={`Complemento de pago ${numero}`}
      greeting={
        <>
          {contacto ? `Hola ${contacto}, ` : 'Hola, '}
          adjuntamos el complemento de pago <strong>{numero}</strong> emitido a <strong>{cliente}</strong>
          {facturaNumero ? <> por el pago aplicado a la factura <strong>{facturaNumero}</strong></> : null} para tu resguardo.
        </>
      }
      ejecutivo={{
        ejecutivoNombre: props.ejecutivoNombre,
        ejecutivoEmail: props.ejecutivoEmail,
        ejecutivoTelefono: props.ejecutivoTelefono,
      }}
      footerNote="Los enlaces al PDF y XML son privados y expiran por seguridad."
    >
      <Section style={S.card}>
        {fechaPago && <EmailRow label="Fecha de pago" value={fechaPago} />}
        {facturaNumero && <EmailRow label="Factura relacionada" value={facturaNumero} />}
        {monto && <EmailRow label={`Monto ${moneda ?? ''}`.trim()} value={monto} highlight />}
        {formaPago && <EmailRow label="Forma de pago" value={formaPago} />}
        {uuid && <EmailRow label="Folio fiscal (UUID)" value={uuid} />}
        {uuidFacturaOriginal && <EmailRow label="UUID factura original" value={uuidFacturaOriginal} />}
      </Section>

      {mensaje && <EmailMensaje mensaje={mensaje} />}

      <Section style={S.ctaWrap}>
        {enlacePdf && <Button href={enlacePdf} style={S.btnPrimary}>Descargar PDF</Button>}
        {enlaceXml && <Button href={enlaceXml} style={S.btnSecondary}>Descargar XML</Button>}
        <Text style={S.ctaHint}>
          Si tienes dudas responde directamente a este correo.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export const template = {
  component: RepEnviadoEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    return `Complemento de pago ${numero}`;
  },
  displayName: 'Envío de complemento de pago (REP) al cliente',
  previewData: {
    numero: 'P-42',
    facturaNumero: 'A-1024',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    monto: '$ 12,540.00',
    moneda: 'MXN',
    fechaPago: '18/10/2026',
    formaPago: '03 - Transferencia electrónica',
    uuid: '12345678-90AB-CDEF-1234-567890ABCDEF',
    uuidFacturaOriginal: 'ABCDEF12-3456-7890-ABCD-EF1234567890',
    mensaje: 'Adjunto el complemento de pago correspondiente.',
    enlacePdf: 'https://example.com/pdf',
    enlaceXml: 'https://example.com/xml',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;
