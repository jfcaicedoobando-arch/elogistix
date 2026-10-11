import { Fragment, type ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { DataTable } from "../components/DataTable";
import { keepProformaGroupTogether, proformaRowCanFlow } from "./proformaPagination";
import {
  columnasUSD,
  columnasMXN,
  hayIvaEfectivo,
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
  /** Keep closing notes and totals with the final concept, without changing values. */
  afterLastRow?: ReactNode;
  /** Optional overall heading belongs to the first visible currency section. */
  encabezado?: ReactNode;
}

export function SeccionMonedaPdf({
  grupos,
  moneda,
  tasaIva,
  multiContenedor,
  mostrarSubtituloMoneda = true,
  afterLastRow,
  encabezado,
}: SeccionProps) {
  const filtrados = grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => i.moneda === moneda) }))
    .filter((g) => g.items.length > 0);
  if (filtrados.length === 0) return null;

  const introduccion = <>
    {encabezado}
    {mostrarSubtituloMoneda ? (
      <Text style={styles.h4} minPresenceAhead={multiContenedor ? 140 : 100}>
        Conceptos en {moneda}
      </Text>
    ) : null}
  </>;

  const contenido = (
    <>
      {multiContenedor ? null : introduccion}
      {filtrados.map((g, index) => {
        // v13.823.345: ambas monedas miran la TASA efectiva. Antes MXN forzaba
        // hayIva=true y una proforma 100% exenta imprimía columnas IVA/Total.
        const hayIva = hayIvaEfectivo(g.items, tasaIva);
        const sub = sumarSubtotales(g.items, (i) => ({
          cantidad: Number(i.cantidad), precioUnitario: Number(i.precio_unitario),
        }));
        const cierre = index === filtrados.length - 1 ? afterLastRow : undefined;
        const cols = moneda === "USD" ? columnasUSD(tasaIva, hayIva) : columnasMXN(tasaIva, hayIva);
        const cierreGrupo = <>
          {multiContenedor ? (
            <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
              Subtotal {moneda}: {formatCurrency(sub, moneda)}
            </Text>
          ) : null}
          {cierre}
        </>;
        const contenidoGrupo = <>
            {multiContenedor && index === 0 ? introduccion : null}
            {multiContenedor ? (
              <Text style={styles.containerBlock} minPresenceAhead={80}>
                {g.contenedorId
                  ? `Contenedor: ${g.numero}${g.tipo ? `  ·  ${g.tipo}` : ""}`
                  : "Cargos generales del embarque"}
              </Text>
            ) : null}
            <DataTable columns={cols} rows={g.items} allowRowWrap={proformaRowCanFlow} afterLastRow={cierreGrupo} />
        </>;
        const key = `${g.contenedorId ?? "gen"}-${moneda}`;
        // Flowing groups stay at sibling level so the chip's presence hint
        // can move its heading with the first row without binding all rows.
        return multiContenedor && keepProformaGroupTogether(g.items)
          ? <View key={key} wrap={false}>{contenidoGrupo}</View>
          : <Fragment key={key}>{contenidoGrupo}</Fragment>;
      })}
    </>
  );
  // Keep a one-row heading with its closing summary only within the bounded
  // budget. Otherwise the row and summary must be allowed to flow.
  return filtrados.length === 1 && filtrados[0].items.length === 1 && keepProformaGroupTogether(filtrados[0].items)
    ? <View wrap={false}>{contenido}</View>
    : contenido;
}
