// @ts-nocheck — Runtime Deno (Edge Function).
/**
 * Shell visual único para los 3 correos transaccionales al cliente
 * (Cotización, Proforma, Factura). Garantiza mismo header con logo,
 * mismo footer y misma tipografía sin duplicar estilos por template.
 */
import * as React from 'npm:react@19.2.8';
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22';
import * as S from './styles.ts';
import { LOGO_URL, CHIP_TONES, CHIP_TONE_FALLBACK, type ChipTone } from './tokens.ts';

const SITE_NAME = 'Libre Carga';

interface ChipProps { tone: ChipTone; label: string; }
const EmailChip = ({ tone, label }: ChipProps) => {
  // Blindaje: un tono no registrado no debe tumbar el render del correo.
  const colors = CHIP_TONES[tone] ?? CHIP_TONE_FALLBACK;
  return (
    <span style={{ ...S.chip, backgroundColor: colors.bg, color: colors.fg }}>{label}</span>
  );
};


interface Ejecutivo {
  ejecutivoNombre?: string;
  ejecutivoEmail?: string;
  ejecutivoTelefono?: string;
}

const EmailFirma = ({ ejecutivoNombre, ejecutivoEmail, ejecutivoTelefono }: Ejecutivo) => {
  if (!ejecutivoNombre) return null;
  return (
    <Section>
      <Text style={S.firmaLabel}>Tu ejecutivo de cuenta</Text>
      <Text style={S.firmaNombre}>{ejecutivoNombre}</Text>
      {ejecutivoEmail && <Text style={S.firmaLinea}>{ejecutivoEmail}</Text>}
      {ejecutivoTelefono && <Text style={S.firmaLinea}>{ejecutivoTelefono}</Text>}
    </Section>
  );
};

interface LayoutProps {
  previewText: string;
  documentType: { tone: ChipTone; label: string };
  title: string;
  greeting: React.ReactNode;
  children: React.ReactNode;
  ejecutivo?: Ejecutivo;
  footerNote?: string;
}

export const EmailLayout = ({
  previewText, documentType, title, greeting, children, ejecutivo, footerNote,
}: LayoutProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={S.main}>
      <Container style={S.container}>
        <Section style={S.header}>
          <div style={S.headerCellLogo}>
            <Img src={LOGO_URL} alt={SITE_NAME} style={S.logoImg} />
          </div>
          <div style={S.headerCellChip}>
            <EmailChip tone={documentType.tone} label={documentType.label} />
          </div>
        </Section>

        <Section style={S.bodyWrap}>
          <Heading style={S.h1}>{title}</Heading>
          <Text style={S.lead}>{greeting}</Text>
          {children}
          <Hr style={S.hr} />
          {ejecutivo && <EmailFirma {...ejecutivo} />}
        </Section>

        <Text style={S.footer}>
          {SITE_NAME} · Correo transaccional generado automáticamente.
          {footerNote ? ` ${footerNote}` : ''}
        </Text>
      </Container>
    </Body>
  </Html>
);

/** Fila etiqueta/valor reutilizable para el `Card` de detalles. */
export const EmailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ marginBottom: '10px' }}>
    <Text style={S.rowLabel}>{label}</Text>
    <Text style={highlight ? S.rowValueStrong : S.rowValue}>{value}</Text>
  </div>
);

/** Bloque de mensaje libre del ejecutivo (opcional). */
export const EmailMensaje = ({ mensaje, titulo = 'Mensaje de tu ejecutivo' }: { mensaje: string; titulo?: string }) => (
  <Section style={S.mensajeBox}>
    <Text style={S.mensajeLabel}>{titulo}</Text>
    <Text style={S.mensajeText}>{mensaje}</Text>
  </Section>
);
