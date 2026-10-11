import { Document, Page, Text, View } from "@react-pdf/renderer";
import { notasParaCliente } from "@/lib/domain/notasVisibilidad";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import {
  AVISO_IVA_POR_CONFIRMAR,
  hayLineasIvaPorConfirmar,
} from "@/lib/financial/lineasPorConfirmarIva";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { TotalesBox } from "../components/TotalesBox";
import { NotasInicio, NotasContinuacion } from "../components/NotasSection";
import { splitNotas } from "../components/notasSplit";

import { ProformaHeader } from "./ProformaHeader";
import type { EmisorInfo } from "../components/BrandHeader";
import type { ClienteLite, EmbarqueLite, ProformaRow } from "./proformaShared";
import { SeccionMonedaPdf } from "./ProformaConceptosSection";
import { agruparPorContenedor, tasaEfectivaFila, type ConceptoVenta } from "./proformaConceptosColumns";
import { totalesProformaPdf } from "./proformaTotales";

interface Props {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
  emisor?: EmisorInfo;
}

function TituloConceptos({ porContenedor }: { porContenedor: boolean }) {
  return <Text style={[styles.h3, { marginTop: 10, marginBottom: 6 }]} minPresenceAhead={porContenedor ? 200 : 140}>
    {porContenedor ? "Conceptos por Contenedor" : "Conceptos"}
  </Text>;
}

export function ProformaDocument({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA, emisor }: Props) {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");
  // B-4: detectar si la proforma cubre N contenedores reales para activar el agrupamiento.
  const idsUnicos = new Set(
    conceptos.map((c) => c.embarque_contenedores?.id).filter((x): x is string => Boolean(x)),
  );
  const multiContenedor = idsUnicos.size >= 2;
  const grupos = agruparPorContenedor(conceptos);
  const hayPorConfirmar = hayLineasIvaPorConfirmar(conceptos.filter((c) => tasaEfectivaFila(c, tasaIva) > 0), tasaIva);

  const { bloques, nota } = totalesProformaPdf(proforma, conceptos, tasaIva);
  const { head, rest } = splitNotas(notasParaCliente(proforma.notas));
  const hayTotales = bloques.some((b) => b.subtotal !== 0 || b.iva !== 0 || b.total !== 0);
  // Subtítulo de moneda sólo cuando conviven USD y MXN.
  const multiMoneda = usd.length > 0 && mxn.length > 0;
  const tituloConceptos = <TituloConceptos porContenedor={multiContenedor} />;

  const cierreConceptos = <>
    {hayPorConfirmar ? <Text style={[styles.notice, { marginTop: 6 }]}>{AVISO_IVA_POR_CONFIRMAR}</Text> : null}
    {nota ? <Text style={styles.notice}>{nota}</Text> : null}
    {/* Keep only the bounded notes opening with the final row and totals.
        The remaining notes stay outside the indivisible table closing row.
        Both columns keep their existing font sizes and the card's 55% width. */}
    {head && hayTotales ? <View style={{ flexDirection: "row" }} wrap={false}>
      <View style={{ width: "45%", paddingRight: 12 }}><NotasInicio texto={head} compacta /></View>
      <View style={{ width: "55%" }}><TotalesBox bloques={bloques} fullWidth /></View>
    </View> : <>
      <TotalesBox bloques={bloques} />
      <NotasInicio texto={head} />
    </>}
  </>;

  return (
    <Document title={`${proforma.numero} - Proforma`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={false} emisor={emisor} />
        {/* Sections keep only height-bounded groups together. Oversized
            descriptions must remain free to flow across pages. */}
        <SeccionMonedaPdf
          grupos={grupos}
          moneda="USD"
          encabezado={tituloConceptos}
          afterLastRow={mxn.length === 0 ? cierreConceptos : undefined}
          tasaIva={tasaIva}
          multiContenedor={multiContenedor}
          mostrarSubtituloMoneda={multiMoneda}
        />
        <SeccionMonedaPdf
          grupos={grupos}
          moneda="MXN"
          encabezado={usd.length === 0 ? tituloConceptos : undefined}
          afterLastRow={cierreConceptos}
          tasaIva={tasaIva}
          multiContenedor={multiContenedor}
          mostrarSubtituloMoneda={multiMoneda}
        />

        {conceptos.length === 0 ? <>
          {tituloConceptos}
          <Text style={styles.emptyState}>Sin conceptos para mostrar.</Text>
          {cierreConceptos}
        </> : null}
        <NotasContinuacion texto={rest} separada />


        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
