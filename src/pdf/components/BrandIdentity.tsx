import { Image, View, Text } from "@react-pdf/renderer";
import { styles } from "../theme/styles";
import { sanitizePdfText } from "../text/sanitizePdfText";
import type { EmisorInfo } from "./BrandHeader";

function issuerName(value?: string) {
  const name = value?.trim();
  return name && name !== "Empresa" ? name : undefined;
}

function IssuerDetails({ emisor }: { emisor: EmisorInfo }) {
  const lines = [
    { value: emisor.subtitulo, style: styles.brandSub },
    { value: emisor.rfc ? `RFC: ${emisor.rfc}` : undefined, style: styles.brandLine },
    { value: emisor.direccion, style: styles.brandLine },
    { value: emisor.contacto, style: styles.brandLine },
  ];
  return <>{lines.filter((line) => line.value).map((line, i) => (
    <Text key={i} style={line.style}>{sanitizePdfText(line.value)}</Text>
  ))}</>;
}

interface Props {
  emisor?: EmisorInfo;
  organizacionNombre?: string;
  variant: "commercial" | "report";
  compact?: boolean;
}

export function BrandIdentity({ emisor = {}, organizacionNombre, variant, compact = false }: Props) {
  const nombre = issuerName(emisor.razonSocial);
  const comercial = organizacionNombre?.trim() || emisor.organizacionNombre?.trim();
  const marca = comercial || nombre || "Documento interno";
  return <View style={styles.headerIdentity}>
    {emisor.logoUrl ? <Image src={emisor.logoUrl} style={styles.issuerLogo} /> : null}
    <View style={styles.brandBlock}>
      <Text style={styles.brandMark}>{sanitizePdfText(marca)}</Text>
      {comercial && nombre && comercial !== nombre ? <Text style={styles.brandLine}>{sanitizePdfText(nombre)}</Text> : null}
      {compact ? null : <IssuerDetails emisor={emisor} />}
    </View>
    <Text style={styles.headerCategory}>{variant === "report" ? "Información financiera" : "Gestión comercial"}</Text>
  </View>;
}
