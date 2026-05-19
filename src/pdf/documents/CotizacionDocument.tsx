import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CotizacionRow, ConceptoVentaCotizacion } from "@/types/cotizacion";
import { TASA_IVA, calcularIVA } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import {
  calcularTotales,
  splitConceptos,
} from "@/generators/cotizacion/conceptosTables";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { ResumenBox } from "../components/ResumenBox";
import {
  HeaderCotizacion,
  SeccionDatosYMercancia,
  SeccionProspecto,
} from "./cotizacionSections";

interface Props {
  cotizacion: CotizacionRow;
  tasaIva?: number;
}

function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVentaCotizacion>[] {
  const base: PdfColumn<ConceptoVentaCotizacion>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => r.aplica_iva ? `${r.descripcion}  (+IVA ${(tasaIva * 100).toFixed(0)}%)` : r.descripcion },
    { key: "unidad", title: "Unidad", cellStyle: { width: 55, fontSize: 9 } as never,
      render: (r) => r.unidad_medida || "—" },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.precio_unitario, "USD") },
    { key: "subtotal", title: "Subtotal", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.cantidad * r.precio_unitario, "USD") },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: `IVA`, cellStyle: styles.cellNum,
      render: (r) => r.aplica_iva ? formatCurrency(calcularIVA(r.cantidad * r.precio_unitario, tasaIva), "USD") : "—" },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => {
        const sub = r.cantidad * r.precio_unitario;
        const iva = r.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
        return formatCurrency(sub + iva, "USD");
      } },
  ];
}

function columnasMXN(tasaIva: number): PdfColumn<ConceptoVentaCotizacion>[] {
  return [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc, render: (r) => r.descripcion },
    { key: "unidad", title: "Unidad", cellStyle: { width: 55, fontSize: 9 } as never,
      render: (r) => r.unidad_medida || "—" },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.precio_unitario, "MXN") },
    { key: "subtotal", title: "Subtotal", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.cantidad * r.precio_unitario, "MXN") },
    { key: "iva", title: `IVA ${(tasaIva * 100).toFixed(0)}%`, cellStyle: styles.cellNum,
      render: (r) => formatCurrency(calcularIVA(r.cantidad * r.precio_unitario, tasaIva), "MXN") },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(r.cantidad * r.precio_unitario * (1 + tasaIva), "MXN") },
  ];
}

export function CotizacionDocument({ cotizacion, tasaIva = TASA_IVA }: Props) {
  const totales = calcularTotales(cotizacion.conceptos_venta);
  const { usd, mxn } = splitConceptos(cotizacion.conceptos_venta);
  const hayIvaUsd = usd.some((c) => c.aplica_iva);
  return (
    <Document title={`${cotizacion.folio} - Cotización`} author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        <HeaderCotizacion c={cotizacion} />
        <SeccionProspecto c={cotizacion} />
        <SeccionDatosYMercancia c={cotizacion} />

        {/* Salto de página antes de Conceptos */}
        <View break />
        <Text style={styles.h3}>Conceptos de Venta</Text>

        {usd.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en USD</Text>
            <DataTable
              columns={columnasUSD(tasaIva, hayIvaUsd)}
              rows={usd}
              renderSubrow={(r) => r.notas ?? null}
            />
            <View style={styles.subtotalBlock}>
              <Text style={styles.subtotalEmphasis}>Total USD: {formatCurrency(totales.totalUSD, "USD")}</Text>
            </View>
          </>
        ) : null}

        {mxn.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en MXN + IVA</Text>
            <DataTable
              columns={columnasMXN(tasaIva)}
              rows={mxn}
              renderSubrow={(r) => r.notas ?? null}
            />
            <View style={styles.subtotalBlock}>
              <Text style={styles.subtotalLine}>
                Subtotal MXN: {formatCurrency(totales.subtotalMXN, "MXN")}   ·   IVA: {formatCurrency(totales.ivaMXN, "MXN")}
              </Text>
              <Text style={styles.subtotalEmphasis}>Total MXN: {formatCurrency(totales.totalMXN, "MXN")}</Text>
            </View>
          </>
        ) : null}

        <ResumenBox totales={totales} hayMxn={mxn.length > 0} />

        {cotizacion.notas ? (
          <>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{cotizacion.notas}</Text>
            </View>
          </>
        ) : null}

        <Footer />
      </Page>
    </Document>
  );
}
