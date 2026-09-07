import { Document, Page, Text, View } from "@react-pdf/renderer";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { TotalesBox } from "../components/TotalesBox";
import { NotasSection } from "../components/NotasSection";

import { ProformaHeader } from "./ProformaHeader";
import type { EmisorInfo } from "../components/BrandHeader";
import type { ClienteLite, EmbarqueLite, ProformaRow } from "./proformaShared";
import { SeccionMonedaPdf } from "./ProformaConceptosSection";
import { agruparPorContenedor, type ConceptoVenta } from "./proformaConceptosColumns";

interface Props {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
  emisor?: EmisorInfo;
}

export function ProformaDocument({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA, emisor }: Props) {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");
  // Subtítulo de moneda sólo cuando conviven USD y MXN.
  const multiMoneda = usd.length > 0 && mxn.length > 0;

  // B-4: detectar si la proforma cubre N contenedores reales para activar el agrupamiento.
  const idsUnicos = new Set(
    conceptos.map((c) => c.embarque_contenedores?.id).filter((x): x is string => Boolean(x)),
  );
  const multiContenedor = idsUnicos.size >= 2;
  const grupos = agruparPorContenedor(conceptos);

  // R179-01/PDF-B: etiqueta neutra "IVA <moneda>". No se rotula la tasa global
  // porque las filas pueden tributar a 0/8/16% y mezclarse en una misma moneda.
  const bloquesTotales = [];
  if (usd.length > 0) {
    bloquesTotales.push({
      moneda: "USD" as const,
      subtotal: Number(proforma.subtotal_usd),
      iva: Number(proforma.iva_usd),
      total: Number(proforma.total_usd),
    });
  }
  if (mxn.length > 0) {
    bloquesTotales.push({
      moneda: "MXN" as const,
      subtotal: Number(proforma.subtotal_mxn),
      iva: Number(proforma.iva_mxn),
      total: Number(proforma.total_mxn),
    });
  }


  return (
    <Document title={`${proforma.numero} - Proforma`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={false} emisor={emisor} />
        {/*
          El título nunca queda huérfano (minPresenceAhead propio) y los bloques
          de conceptos fluyen libremente: no se envuelve todo en un contenedor
          con minPresenceAhead grande, que provocaba saltos de página completos.
        */}
        <Text style={[styles.h3, { marginTop: 10, marginBottom: 6 }]} minPresenceAhead={70}>
          {multiContenedor ? "Conceptos por Contenedor" : "Conceptos"}
        </Text>
        <SeccionMonedaPdf
          grupos={grupos}
          moneda="USD"
          tasaIva={tasaIva}
          multiContenedor={multiContenedor}
          mostrarSubtituloMoneda={multiMoneda}
        />
        <SeccionMonedaPdf
          grupos={grupos}
          moneda="MXN"
          tasaIva={tasaIva}
          multiContenedor={multiContenedor}
          mostrarSubtituloMoneda={multiMoneda}
        />

        {/* La caja de totales es indivisible (wrap=false) y sólo salta de
            página si realmente no cabe completa. */}
        <TotalesBox bloques={bloquesTotales} />
        <NotasSection notas={proforma.notas} />


        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
