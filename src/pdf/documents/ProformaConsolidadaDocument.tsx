import { Document, Page, Text, View } from "@react-pdf/renderer";
import { calcularTotalesProforma } from "@/features/proformas/domain";
import { subtotalLinea, TASA_IVA } from "@/lib/financial/financialUtils";
import { AVISO_IVA_POR_CONFIRMAR, hayLineasIvaPorConfirmar } from "@/lib/financial/lineasPorConfirmarIva";
import { hayIvaEfectivo, tasaEfectivaFila } from "./proformaConceptosColumns";
import { totalesProformaPdf } from "./proformaTotales";
import type { Tables } from "@/integrations/supabase/types";

import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { TotalesBox } from "../components/TotalesBox";
import { NotasSection } from "../components/NotasSection";
import { ProformaHeader } from "./ProformaHeader";
import type { EmisorInfo } from "../components/BrandHeader";
import {
  formatearDescripcionConcepto,
  type ClienteLite,
  type EmbarqueLite,
  type ProformaRow,
} from "./proformaShared";

type ConceptoConsolidado = Tables<"proforma_conceptos_consolidados">;

interface Props {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  cliente?: ClienteLite;
  conceptosConsolidados: ConceptoConsolidado[];
  tasaIva?: number;
  emisor?: EmisorInfo;
}

interface Grupo {
  contenedor: string;
  tipo: string | null;
  items: ConceptoConsolidado[];
}

function agrupar(items: ConceptoConsolidado[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const c of items) {
    const key = `${c.contenedor ?? "Sin contenedor"}|${c.tipo_contenedor ?? ""}`;
    if (!map.has(key)) {
      map.set(key, { contenedor: c.contenedor ?? "Sin contenedor", tipo: c.tipo_contenedor, items: [] });
    }
    map.get(key)!.items.push(c);
  }
  return Array.from(map.values());
}

function totalesFila(fila: ConceptoConsolidado, tasaIva: number) {
  const totales = calcularTotalesProforma([fila], tasaIva);
  return fila.moneda === "USD"
    ? { iva: totales.iva_usd, total: totales.total_usd }
    : { iva: totales.iva_mxn, total: totales.total_mxn };
}

function columnas(moneda: "USD" | "MXN", hayIva: boolean, tasaIva: number): PdfColumn<ConceptoConsolidado>[] {
  const base: PdfColumn<ConceptoConsolidado>[] = [
    { key: "descripcion", title: "Descripción", hyphenate: false, cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), moneda) },
    { key: "importe", title: "Importe", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(subtotalLinea(Number(r.cantidad), Number(r.precio_unitario)), moneda) },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => tasaEfectivaFila(r, tasaIva) > 0 ? formatCurrency(totalesFila(r, tasaIva).iva, moneda) : "—" },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(totalesFila(r, tasaIva).total, moneda) },
  ];
}

function SeccionMoneda({
  grupos, moneda, conceptos, tasaIva,
}: { grupos: Grupo[]; moneda: "USD" | "MXN"; conceptos: ConceptoConsolidado[]; tasaIva: number }) {
  const haySeccion = conceptos.some((c) => c.moneda === moneda);
  if (!haySeccion) return null;
  return (
    <>
      <Text style={styles.h4}>Conceptos en {moneda}</Text>
      {grupos.map((g) => {
        const items = g.items.filter((i) => i.moneda === moneda);
        if (items.length === 0) return null;
        const hayIva = hayIvaEfectivo(items, tasaIva);
        // El snapshot puede guardar `total` como base sin IVA. Igual que en UI,
        // el total visible se deriva de sus cantidades/precios/tratamientos.
        const totalesGrupo = calcularTotalesProforma(items, tasaIva);
        const totalGrupo = moneda === "USD" ? totalesGrupo.total_usd : totalesGrupo.total_mxn;
        return (
          // wrap (default) permite que tablas largas (20+ conceptos) salten de
          // página manteniendo el `tableHeader fixed` de DataTable repetido y
          // el `paddingTop: 40` del page style como resguardo superior uniforme.
          <View key={`${g.contenedor}-${moneda}`}>
            <Text style={styles.containerBlock}>
              Contenedor: {g.contenedor}{g.tipo ? `  ·  ${g.tipo}` : ""}
            </Text>
            <DataTable columns={columnas(moneda, hayIva, tasaIva)} rows={items} />
            <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
              Total del contenedor {moneda}: {formatCurrency(totalGrupo, moneda)}
            </Text>

          </View>
        );
      })}
    </>
  );
}

/**
 * Documento PDF: Proforma Consolidada.
 *
 * Contrato de maquetación multi-página (12.61.10):
 * - Únicos elementos `fixed` permitidos: `topBand` (vía `BrandHeader` dentro de
 *   `ProformaHeader`), referencia de continuación y `Footer`. Viven a nivel raíz de `<Page>`.
 * - Sub-bloques NUNCA usan `fixed` — confunde el motor de cálculo de alturas.
 * - `DataTable.tableHeader fixed` es la excepción documentada: react-pdf usa
 *   este `fixed` para repetir el header de la tabla cuando salta de página.
 */
export function ProformaConsolidadaDocument({
  proforma,
  embarque,
  cliente,
  conceptosConsolidados,
  tasaIva = TASA_IVA,
  emisor,
}: Props) {
  const grupos = agrupar(conceptosConsolidados);
  const { bloques, nota } = totalesProformaPdf(proforma, conceptosConsolidados, tasaIva);
  const hayPorConfirmar = hayLineasIvaPorConfirmar(conceptosConsolidados.filter((c) => tasaEfectivaFila(c, tasaIva) > 0), tasaIva);

  return (
    <Document title={`${proforma.numero} - Proforma Consolidada`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={true} emisor={emisor} />
        <View minPresenceAhead={140}>
          <Text style={styles.h3}>Conceptos por Contenedor</Text>
          <SeccionMoneda grupos={grupos} moneda="USD" conceptos={conceptosConsolidados} tasaIva={tasaIva} />
          <SeccionMoneda grupos={grupos} moneda="MXN" conceptos={conceptosConsolidados} tasaIva={tasaIva} />
        </View>

        {conceptosConsolidados.length === 0 ? <Text style={styles.emptyState}>Sin conceptos para mostrar.</Text> : null}
        {nota ? <Text style={styles.notice}>{nota}</Text> : null}
        {hayPorConfirmar ? <Text style={styles.notice}>{AVISO_IVA_POR_CONFIRMAR}</Text> : null}
        <TotalesBox bloques={bloques} />

        <NotasSection notas={proforma.notas} />

        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
