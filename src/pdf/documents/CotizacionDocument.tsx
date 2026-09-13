import { Document, Page, Text, View } from "@react-pdf/renderer";
import { notasParaCliente } from "@/lib/domain/notasVisibilidad";
import type { CotizacionRow } from "@/features/cotizacion/types";
import type { TipoContenedorCatalogo } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { tasasEfectivas } from "@/lib/financial/etiquetaTasaIva";
import { formatDate, formatFechaDia } from "@/lib/formatters";
import { calcularTotales, splitConceptos } from "@/generators/cotizacion/conceptosTables";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable } from "../components/DataTable";
import { TotalesBox } from "../components/TotalesBox";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { BillToBlock } from "../components/BillToBlock";
import { columnasUSD, columnasMXN, subnotaCliente, armarBloques } from "./cotizacionColumnas";
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

export function CotizacionDocument({ cotizacion, tasaIva = TASA_IVA, emisor, tiposContenedor = [] }: Props) {
  const totales = calcularTotales(cotizacion.conceptos_venta, tasaIva);
  const { usd, mxn } = splitConceptos(cotizacion.conceptos_venta);
  const hayIvaUsd = tasasEfectivas(usd, tasaIva).length > 0 || totales.ivaUSD > 0;
  const hayIvaMxn = tasasEfectivas(mxn, tasaIva).length > 0 || totales.ivaMXN > 0;
  const notasCliente = notasParaCliente(cotizacion.notas);
  const nombre = cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;

  const bloques = armarBloques(usd, mxn, totales, tasaIva);

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
              renderSubrow={subnotaCliente}
            />
          </>
        ) : null}

        {mxn.length > 0 ? (
          <>
            <Text style={styles.h4} minPresenceAhead={70}>
              Conceptos en MXN{hayIvaMxn ? " + IVA" : ""}
            </Text>
            <DataTable
              columns={columnasMXN(tasaIva, hayIvaMxn)}
              rows={mxn}
              renderSubrow={subnotaCliente}
            />
          </>
        ) : null}

        <TotalesBox
          bloques={bloques}
          nota={hayIvaUsd ? "* Los cargos en destino incluyen IVA" : undefined}
        />

        {/* v13.823.341: sólo las notas dirigidas al cliente llegan al PDF. */}
        {notasCliente ? (
          <View wrap={false}>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{notasCliente}</Text>
            </View>
          </View>
        ) : null}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
