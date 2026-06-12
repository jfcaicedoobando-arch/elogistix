import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Tables } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { TotalesBox } from "../components/TotalesBox";
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

function columnas(moneda: "USD" | "MXN", hayIva: boolean): PdfColumn<ConceptoConsolidado>[] {
  const base: PdfColumn<ConceptoConsolidado>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), moneda) },
    { key: "importe", title: "Importe", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), moneda) },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => r.aplica_iva ? formatCurrency(Number(r.iva), moneda) : "—" },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.total), moneda) },
  ];
}

function SeccionMoneda({
  grupos, moneda, conceptos,
}: { grupos: Grupo[]; moneda: "USD" | "MXN"; conceptos: ConceptoConsolidado[] }) {
  const haySeccion = conceptos.some((c) => c.moneda === moneda);
  if (!haySeccion) return null;
  return (
    <>
      <Text style={styles.h4}>Conceptos en {moneda}</Text>
      {grupos.map((g) => {
        const items = g.items.filter((i) => i.moneda === moneda);
        if (items.length === 0) return null;
        const hayIva = items.some((i) => i.aplica_iva);
        const sub = items.reduce((s, i) => s + Number(i.total), 0);
        return (
          // wrap (default) permite que tablas largas (20+ conceptos) salten de
          // página manteniendo el `tableHeader fixed` de DataTable repetido y
          // el `paddingTop: 40` del page style como resguardo superior uniforme.
          <View key={`${g.contenedor}-${moneda}`}>
            <Text style={styles.containerBlock}>
              Contenedor: {g.contenedor}{g.tipo ? `  ·  ${g.tipo}` : ""}
            </Text>
            <DataTable columns={columnas(moneda, hayIva)} rows={items} />
            <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
              Subtotal {moneda}: {formatCurrency(sub, moneda)}
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
 *   `ProformaHeader`) y `Footer`. Ambos viven a nivel raíz de `<Page>`.
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
  const tasaPct = Math.round(tasaIva * 100);
  const hayUSD = conceptosConsolidados.some((c) => c.moneda === "USD");
  const hayMXN = conceptosConsolidados.some((c) => c.moneda === "MXN");

  const bloquesTotales = [];
  if (hayUSD) {
    bloquesTotales.push({
      moneda: "USD" as const,
      subtotal: Number(proforma.subtotal_usd),
      iva: Number(proforma.iva_usd),
      total: Number(proforma.total_usd),
      tasaIvaPct: Number(proforma.iva_usd) > 0 ? tasaPct : undefined,
    });
  }
  if (hayMXN) {
    bloquesTotales.push({
      moneda: "MXN" as const,
      subtotal: Number(proforma.subtotal_mxn),
      iva: Number(proforma.iva_mxn),
      total: Number(proforma.total_mxn),
      tasaIvaPct: tasaPct,
    });
  }

  return (
    <Document title={`${proforma.numero} - Proforma Consolidada`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={true} emisor={emisor} />
        <Text style={styles.h3}>Conceptos por Contenedor</Text>
        <SeccionMoneda grupos={grupos} moneda="USD" conceptos={conceptosConsolidados} />
        <SeccionMoneda grupos={grupos} moneda="MXN" conceptos={conceptosConsolidados} />

        <TotalesBox bloques={bloquesTotales} />

        {proforma.notas ? (
          <>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{proforma.notas}</Text>
            </View>
          </>
        ) : null}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
