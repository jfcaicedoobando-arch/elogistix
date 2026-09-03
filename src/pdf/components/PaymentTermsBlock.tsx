/**
 * Bloque "Condiciones de pago" para proformas. Renderiza vigencia,
 * método de pago y datos bancarios en formato contable claro.
 * Si no se proveen datos bancarios, muestra un placeholder discreto.
 */
import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS, FONTS } from "../theme/styles";

export interface DatosBancarios {
  banco?: string;
  beneficiario?: string;
  cuenta?: string;
  clabe?: string;
  swift?: string;
  moneda?: string;
}

interface Props {
  vigencia?: string;
  metodoPago?: string;
  diasCredito?: string;
  datosBancarios?: DatosBancarios;
}

function Linea({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: "row", marginBottom: 2 }}>
      <Text style={{ fontSize: 8, color: COLORS.mutedLight, width: 90, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 9, color: COLORS.ink, fontFamily: FONTS.bold }}>{value}</Text>
    </View>
  );
}

export function PaymentTermsBlock({ vigencia, metodoPago, diasCredito, datosBancarios }: Props) {
  const hayBanco = !!(datosBancarios && (datosBancarios.banco || datosBancarios.clabe || datosBancarios.cuenta));
  return (
    <View wrap={false} style={{ marginTop: 10 }}>
      <Text style={[styles.h3, { marginTop: 10, marginBottom: 6 }]}>Condiciones de pago</Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Linea label="Vigencia" value={vigencia} />
          <Linea label="Método" value={metodoPago} />
          <Linea label="Crédito" value={diasCredito} />
        </View>
        {hayBanco ? (
          <View style={{ flex: 1.2, padding: 8, backgroundColor: COLORS.zebra, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: COLORS.primary }}>
            <Text style={{ fontSize: 7.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Datos bancarios
            </Text>
            <Linea label="Banco" value={datosBancarios?.banco} />
            <Linea label="Benef." value={datosBancarios?.beneficiario} />
            <Linea label="Cuenta" value={datosBancarios?.cuenta} />
            <Linea label="CLABE" value={datosBancarios?.clabe} />
            <Linea label="SWIFT" value={datosBancarios?.swift} />
            <Linea label="Moneda" value={datosBancarios?.moneda} />
          </View>
        ) : (
          // Sin datos bancarios configurados: aviso discreto en una línea,
          // sin tarjeta, para no gastar alto vertical de la página.
          <View style={{ flex: 1.2, justifyContent: "flex-start" }}>
            <Linea label="Datos bancarios" value="Solicitar al área de cobranza" />
          </View>
        )}
      </View>
    </View>
  );
}
