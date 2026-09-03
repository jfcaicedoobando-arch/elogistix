/**
 * Caja de totales unificada para todos los PDFs financieros.
 * Tarjeta a la derecha (50% ancho) con jerarquía clara:
 *   Subtotal → IVA → TOTAL (última fila con fondo corporativo).
 * Soporta multi-moneda (USD y/o MXN) en una sola caja con separador.
 */
import { View, Text } from "@react-pdf/renderer";
import { COLORS, FONTS } from "../theme/styles";
import { formatCurrency } from "@/lib/formatters";

export interface TotalesMoneda {
  subtotal: number;
  iva: number;
  total: number;
  moneda: "USD" | "MXN";
  tasaIvaPct?: number;
}

interface Props {
  bloques: TotalesMoneda[];
  nota?: string;
}

function Bloque({ b }: { b: TotalesMoneda }) {
  const showIva = b.iva > 0;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 9, color: COLORS.muted }}>Subtotal {b.moneda}</Text>
        <Text style={{ fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink }}>
          {formatCurrency(b.subtotal, b.moneda)}
        </Text>
      </View>
      {showIva ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: COLORS.border }}>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            IVA{b.tasaIvaPct != null ? ` (${b.tasaIvaPct}%)` : ""} {b.moneda}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink }}>
            {formatCurrency(b.iva, b.moneda)}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 10, backgroundColor: COLORS.primary }}>
        <Text style={{ fontSize: 10, fontFamily: FONTS.bold, color: COLORS.primaryFg, letterSpacing: 0.5 }}>
          TOTAL {b.moneda}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primaryFg }}>
          {formatCurrency(b.total, b.moneda)}
        </Text>
      </View>
    </View>
  );
}

export function TotalesBox({ bloques, nota }: Props) {
  const validos = bloques.filter((b) => b.subtotal !== 0 || b.iva !== 0 || b.total !== 0);
  if (validos.length === 0) return null;
  return (
    <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "flex-end" }} wrap={false}>
      <View style={{ width: "55%", borderWidth: 1, borderColor: COLORS.primary, borderRadius: 4, overflow: "hidden" }}>
        {validos.map((b, i) => (
          <View key={b.moneda} style={i > 0 ? { borderTopWidth: 1, borderTopColor: COLORS.primary } : undefined}>
            <Bloque b={b} />
          </View>
        ))}
        {nota ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.zebra }}>
            <Text style={{ fontSize: 7.5, color: COLORS.mutedLight, fontStyle: "italic" }}>{nota}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
