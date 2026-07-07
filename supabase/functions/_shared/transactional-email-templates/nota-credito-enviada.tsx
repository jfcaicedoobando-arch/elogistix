// @ts-nocheck — Runtime Deno (Edge Function).
import * as React from 'npm:react@18.3.1';
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, EmailRow, EmailMensaje } from './_layout/EmailLayout.tsx';
import * as S from './_layout/styles.ts';

interface Props {
  numero?: string;
  facturaNumero?: string;
  cliente?: string;
  contacto?: string;
  total?: string;
  moneda?: string;
  uuid?: string;
  uuidFacturaOriginal?: string;
  fechaEmision?: string;
  motivo?: string;
  mensaje?: string;
  enlacePdf?: string;
  enlaceXml?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const NotaCreditoEnviadaEmail = (props: Props) => {
  const {
    numero = 'NC-XXXX', facturaNumero, cliente = 'Cliente', contacto,
    total, moneda, uuid, uuidFacturaOriginal, fechaEmision, motivo,
    mensaje, enlacePdf, enlaceXml,
  } = props;
  return (
    <EmailLayout
      previewText={`Nota de crédito ${numero} — CFDI emitido`}
      documentType={{ tone: 'nota-credito', label: 'Nota de crédito · CFDI emitido' }}
      title={`Nota de crédito ${numero}`}
      greeting={
        <>
          {contacto ? `Hola ${contacto}, ` : 'Hola, '}
          adjuntamos la nota de crédito <strong>{numero}</strong> emitida a <strong>{cliente}</strong>
          {facturaNumero ? <> en relación con la factura <strong>{facturaNumero}</strong></> : null} para tu resguardo.
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
        {fechaEmision && <EmailRow label="Fecha de emisión" value={fechaEmision} />}
        {facturaNumero && <EmailRow label="Factura relacionada" value={facturaNumero} />}
        {total && <EmailRow label={`Total ${moneda ?? ''}`.trim()} value={total} highlight />}
        {motivo && <EmailRow label="Motivo" value={motivo} />}
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
  component: NotaCreditoEnviadaEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    return `Nota de crédito ${numero}`;
  },
  displayName: 'Envío de nota de crédito al cliente',
  previewData: {
    numero: 'A-25',
    facturaNumero: 'A-1024',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    total: '$ 1,540.00',
    moneda: 'MXN',
    fechaEmision: '20/10/2026',
    motivo: 'Ajuste por diferencia en flete',
    uuid: '12345678-90AB-CDEF-1234-567890ABCDEF',
    uuidFacturaOriginal: 'ABCDEF12-3456-7890-ABCD-EF1234567890',
    mensaje: 'Adjunto la nota de crédito aplicada a la factura original.',
    enlacePdf: 'https://example.com/pdf',
    enlaceXml: 'https://example.com/xml',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;
