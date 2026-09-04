import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CotizacionRow, ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import type { TipoContenedorCatalogo } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";
import { TASA_IVA, calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { formatCurrency, formatDate, formatFechaDia } from "@/lib/formatters";
import {
  calcularTotales,
  splitConceptos,
} from "@/generators/cotizacion/conceptosTables";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { TotalesBox, type TotalesMoneda } from "../components/TotalesBox";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { BillToBlock } from "../components/BillToBlock";
import {
  SeccionDatosYMercancia,
  SeccionProspecto,
  SeccionResumenRuta,
} from "./cotizacionSections";

interface Props {
  cotizacion: CotizacionRow;
  tasaIva?: number;
  emisor?: EmisorInfo;
  tiposContenedor?: ReadonlyArray<TipoContenedorCatalogo>;
}

function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVentaCotizacion>[] {
  const base: PdfColumn<ConceptoVentaCotizacion>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return tasa > 0 ? `${r.descripcion}  (+IVA ${(tasa * 100).toFixed(0)}%)` : r.descripcion;
      } },
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
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return tasa > 0 ? formatCurrency(calcularIVA(r.cantidad * r.precio_unitario, tasa), "USD") : "—";
      } },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => {
        const sub = r.cantidad * r.precio_unitario;
        const iva = calcularIVA(sub, resolverTasaConcepto(r, tasaIva));
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
    { key: "iva", title: `IVA`, cellStyle: styles.cellNum,
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return formatCurrency(calcularIVA(r.cantidad * r.precio_unitario, tasa), "MXN");
      } },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return formatCurrency(r.cantidad * r.precio_unitario * (1 + tasa), "MXN");
      } },
  ];
}

export function CotizacionDocument({ cotizacion, tasaIva = TASA_IVA, emisor, tiposContenedor = [] }: Props) {
  const totales = calcularTotales(cotizacion.conceptos_venta, tasaIva);
  const { usd, mxn } = splitConceptos(cotizacion.conceptos_venta);
  const hayIvaUsd = usd.some((c) => c.aplica_iva);
  const tasaPct = Math.round(tasaIva * 100);
  const nombre = cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;

  const bloques: TotalesMoneda[] = [];
  if (usd.length > 0) {
    bloques.push({
      moneda: "USD",
      subtotal: totales.subtotalUSD,
      iva: totales.ivaUSD,
      total: totales.totalUSD,
      tasaIvaPct: totales.ivaUSD > 0 ? tasaPct : undefined,
    });
  }
  if (mxn.length > 0) {
    bloques.push({
      moneda: "MXN",
      subtotal: totales.subtotalMXN,
      iva: totales.ivaMXN,
      total: totales.totalMXN,
      tasaIvaPct: tasaPct,
    });
  }

  const headerMeta = [
    { label: "Estado", value: cotizacion.estado },
    // W-12 (QA r2): `created_at.substring(0,10)` tomaba el día UTC (de 18:00 a
    // 23:59 CDMX ya es "mañana"). `formatFechaDia` formatea en la TZ de negocio.
    { label: "Fecha", value: formatFechaDia(cotizacion.created_at) },
    ...(cotizacion.fecha_vigencia
      ? [{ label: "Vigencia", value: formatDate(cotizacion.fecha_vigencia) }]
      : []),
  ];

  return (
    <Document title={`${cotizacion.folio} - Cotización`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          tipoDocumento="Cotización"
          folio={cotizacion.folio}
          emisor={emisor}
          meta={headerMeta}
        />
        <BillToBlock
          titulo={cotizacion.es_prospecto ? "Destinatario (Prospecto)" : "Destinatario"}
          destinatario={{ nombre }}
        />
        <SeccionResumenRuta c={cotizacion} />
        <SeccionProspecto c={cotizacion} />
        <SeccionDatosYMercancia c={cotizacion} tiposContenedor={tiposContenedor} />

        {/* v13.823.77: el título arrastra al menos el encabezado de la tabla. */}
        <View wrap={false} style={{ marginTop: 10 }} minPresenceAhead={90}>
          <Text style={styles.h3}>Conceptos de Venta</Text>
        </View>

        {usd.length > 0 ? (
          <>
            <Text style={styles.h4} minPresenceAhead={70}>Conceptos en USD</Text>
            <DataTable
              columns={columnasUSD(tasaIva, hayIvaUsd)}
              rows={usd}
              renderSubrow={(r) => r.notas ?? null}
            />
          </>
        ) : null}

        {mxn.length > 0 ? (
          <>
            <Text style={styles.h4} minPresenceAhead={70}>Conceptos en MXN + IVA</Text>
            <DataTable
              columns={columnasMXN(tasaIva)}
              rows={mxn}
              renderSubrow={(r) => r.notas ?? null}
            />
          </>
        ) : null}

        <TotalesBox
          bloques={bloques}
          nota={hayIvaUsd ? "* Los cargos en destino incluyen IVA" : undefined}
        />

        {cotizacion.notas ? (
          <View wrap={false}>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{cotizacion.notas}</Text>
            </View>
          </View>
        ) : null}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
