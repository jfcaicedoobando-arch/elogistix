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
  total?: string;
  moneda?: string;
  uuid?: string;
  fechaEmision?: string;
  metodoPago?: string;
  formaPago?: string;
  mensaje?: string;
  enlacePdf?: string;
  enlaceXml?: string;
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const FacturaEnviadaEmail = (props: Props) => {
  const {
    numero = 'F-XXXX', cliente = 'Cliente', contacto,
    total, moneda, uuid, fechaEmision, metodoPago, formaPago,
    mensaje, enlacePdf, enlaceXml,
  } = props;
  return (
    <EmailLayout
      previewText={`Factura ${numero} — CFDI de ${cliente}`}
      documentType={{ tone: 'factura', label: 'Factura · CFDI emitido' }}
      title={`Factura ${numero}`}
      greeting={
        <>
          {contacto ? `Hola ${contacto}, ` : 'Hola, '}
          adjuntamos la factura <strong>{numero}</strong> correspondiente a <strong>{cliente}</strong> para tu resguardo.
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
        {total && <EmailRow label={`Total ${moneda ?? ''}`.trim()} value={total} highlight />}
        {metodoPago && <EmailRow label="Método de pago" value={metodoPago} />}
        {formaPago && <EmailRow label="Forma de pago" value={formaPago} />}
        {uuid && <EmailRow label="Folio fiscal (UUID)" value={uuid} />}
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
  component: FacturaEnviadaEmail,
  subject: (data: Record<string, unknown>) => {
    const numero = (data?.numero as string) ?? '';
    return `Factura ${numero}`;
  },
  displayName: 'Envío de factura al cliente',
  previewData: {
    numero: 'A-1024',
    cliente: 'ACME, S.A. de C.V.',
    contacto: 'María López',
    total: '$ 12,540.00',
    moneda: 'MXN',
    fechaEmision: '15/10/2026',
    metodoPago: 'PPD',
    formaPago: '99 - Por definir',
    uuid: '12345678-90AB-CDEF-1234-567890ABCDEF',
    mensaje: 'Adjunto la factura correspondiente al embarque.',
    enlacePdf: 'https://example.com/pdf',
    enlaceXml: 'https://example.com/xml',
    ejecutivoNombre: 'Juan Pérez',
    ejecutivoEmail: 'juan@librecarga.com',
    ejecutivoTelefono: '+52 55 1234 5678',
  },
} satisfies TemplateEntry;
