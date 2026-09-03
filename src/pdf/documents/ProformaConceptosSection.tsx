import { Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { DataTable } from "../components/DataTable";
import {
  columnasUSD,
  columnasMXN,
  type GrupoContenedor,
} from "./proformaConceptosColumns";

interface SeccionProps {
  grupos: GrupoContenedor[];
  moneda: "USD" | "MXN";
  tasaIva: number;
  multiContenedor: boolean;
  /**
   * Muestra el subtítulo "Conceptos en <moneda>". Se omite cuando la proforma
   * tiene una sola moneda: cada importe ya viene etiquetado con la divisa.
   */
  mostrarSubtituloMoneda?: boolean;
}

export function SeccionMonedaPdf({
  grupos,
  moneda,
  tasaIva,
  multiContenedor,
  mostrarSubtituloMoneda = true,
}: SeccionProps) {
  const filtrados = grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => i.moneda === moneda) }))
    .filter((g) => g.items.length > 0);
  if (filtrados.length === 0) return null;

  return (
    <>
      {mostrarSubtituloMoneda ? (
        <Text style={styles.h4} minPresenceAhead={48}>
          Conceptos en {moneda}
        </Text>
      ) : null}
      {filtrados.map((g) => {
        const hayIva = moneda === "USD" ? g.items.some((c) => c.aplica_iva) : true;
        const sub = g.items.reduce(
          (s, i) => s + Number(i.cantidad) * Number(i.precio_unitario),
          0,
        );
        const cols = moneda === "USD" ? columnasUSD(tasaIva, hayIva) : columnasMXN(tasaIva);
        return (
          // Multi-contenedor: el chip + su tabla + subtotal se mantienen juntos.
          // Caso simple: se permite que una tabla larga se parta por filas
          // (el encabezado se repite) en vez de saltar completa de página.
          <View
            key={`${g.contenedorId ?? "gen"}-${moneda}`}
            wrap={!multiContenedor}
            minPresenceAhead={60}
          >

            {multiContenedor ? (
              <Text style={styles.containerBlock}>
                {g.contenedorId
                  ? `Contenedor: ${g.numero}${g.tipo ? `  ·  ${g.tipo}` : ""}`
                  : "Cargos generales del embarque"}
              </Text>
            ) : null}
            <DataTable columns={cols} rows={g.items} />
            {multiContenedor ? (
              <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
                Subtotal {moneda}: {formatCurrency(sub, moneda)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}
