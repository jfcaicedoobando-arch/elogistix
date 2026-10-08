import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS } from "../theme/styles";
import { sanitizePdfText } from "../text/sanitizePdfText";
import { BrandIdentity } from "./BrandIdentity";
import { statusTextStyle } from "./statusTextStyle";

export interface EmisorInfo {
  /** Commercial identity read for the document organization; never a fiscal name. */
  organizacionNombre?: string;
  razonSocial?: string;
  subtitulo?: string;
  rfc?: string;
  direccion?: string;
  contacto?: string;
  /** Optional existing issuer image. No app logo is substituted for a tenant. */
  logoUrl?: string;
}
interface Meta { label: string; value: string }
interface Props {
  tipoDocumento: string;
  folio?: string;
  meta?: Meta[];
  emisor?: EmisorInfo;
  /** Commercial tenant identity stays separate from legal issuer fields. */
  organizacionNombre?: string;
  variant?: "commercial" | "report";
  compactIdentity?: boolean;
}

/** Same visual hierarchy for commercial documents and financial reports. */
export function BrandHeader({ tipoDocumento, folio, meta = [], emisor, organizacionNombre, variant = "commercial", compactIdentity = false }: Props) {
  return <>
    <View style={styles.topBand} fixed />
    {variant === "commercial" && folio ? (
      <Text style={styles.continuationReference} fixed
        render={({ pageNumber }) => pageNumber > 1 ? `${tipoDocumento} - ${folio}` : ""} />
    ) : null}
    <View style={styles.header} wrap={false}>
      <BrandIdentity emisor={emisor} organizacionNombre={organizacionNombre} variant={variant} compact={compactIdentity} />
      <View style={styles.documentHeading}>
        <View style={styles.documentTitle}><Text style={styles.docType}>{tipoDocumento}</Text></View>
        {folio ? <View style={styles.documentReference}><Text style={styles.docNumber}>{sanitizePdfText(folio)}</Text></View> : null}
      </View>
      {meta.length ? <View style={styles.headerMeta}>
        {meta.map((m, i) => <Text key={`${m.label}-${i}`} style={styles.headerMetaItem}>
          <Text style={{ color: COLORS.muted }}>{m.label}: </Text>
          <Text style={m.label === "Estado" ? statusTextStyle(m.value) : { color: COLORS.ink }}>{sanitizePdfText(m.value)}</Text>
        </Text>)}
      </View> : null}
    </View>
  </>;
}
