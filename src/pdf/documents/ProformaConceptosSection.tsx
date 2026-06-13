import { Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { DataTable } from "../components/DataTable";
import {
  agruparPorContenedor,
  columnasUSD,
  columnasMXN,
  type ConceptoVenta,
  type GrupoContenedor,
} from "./proformaConceptosColumns";

interface SeccionProps {
  grupos: GrupoContenedor[];
  moneda: "USD" | "MXN";
  tasaIva: number;
  multiContenedor: boolean;
}

export function SeccionMonedaPdf({ grupos, moneda, tasaIva, multiContenedor }: SeccionProps) {
  const filtrados = grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => i.moneda === moneda) }))
    .filter((g) => g.items.length > 0);
  if (filtrados.length === 0) return null;

  return (
    <>
      <Text style={styles.h4}>Conceptos en {moneda}</Text>
      {filtrados.map((g) => {
        const hayIva = moneda === "USD" ? g.items.some((c) => c.aplica_iva) : true;
        const sub = g.items.reduce(
          (s, i) => s + Number(i.cantidad) * Number(i.precio_unitario),
          0,
        );
        const cols = moneda === "USD" ? columnasUSD(tasaIva, hayIva) : columnasMXN(tasaIva);
        return (
          <View key={`${g.contenedorId ?? "gen"}-${moneda}`} wrap={false}>
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
