import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { ProformaHeader } from "./ProformaHeader";
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
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.total), moneda) },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => r.aplica_iva ? formatCurrency(Number(r.iva), moneda) : "—" },
  ];
}

function SeccionMoneda({
  grupos, moneda, conceptos, proforma,
}: { grupos: Grupo[]; moneda: "USD" | "MXN"; conceptos: ConceptoConsolidado[]; proforma: ProformaRow }) {
  const haySeccion = conceptos.some((c) => c.moneda === moneda);
  if (!haySeccion) return null;
  const subtotal = Number(moneda === "USD" ? proforma.subtotal_usd : proforma.subtotal_mxn);
  const iva = Number(moneda === "USD" ? proforma.iva_usd : proforma.iva_mxn);
  const total = Number(moneda === "USD" ? proforma.total_usd : proforma.total_mxn);
  return (
    <>
      <Text style={styles.h4}>Conceptos en {moneda}</Text>
      {grupos.map((g) => {
        const items = g.items.filter((i) => i.moneda === moneda);
        if (items.length === 0) return null;
        const hayIva = items.some((i) => i.aplica_iva);
        const sub = items.reduce((s, i) => s + Number(i.total), 0);
        return (
          <View key={`${g.contenedor}-${moneda}`} wrap={false}>
            <Text style={styles.containerBlock}>
              📦 Contenedor: {g.contenedor}{g.tipo ? `  (${g.tipo})` : ""}
            </Text>
            <DataTable columns={columnas(moneda, hayIva)} rows={items} />
            <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
              Subtotal {moneda}: {formatCurrency(sub, moneda)}
            </Text>
          </View>
        );
      })}
      <View style={styles.subtotalBlock} wrap={false}>
        <Text style={styles.subtotalLine}>Subtotal {moneda}: {formatCurrency(subtotal, moneda)}</Text>
        {iva > 0 ? (
          <Text style={styles.subtotalLine}>IVA {moneda}: {formatCurrency(iva, moneda)}</Text>
        ) : null}
        <Text style={styles.subtotalEmphasis}>Total {moneda}: {formatCurrency(total, moneda)}</Text>
      </View>
    </>
  );
}

export function ProformaConsolidadaDocument({ proforma, embarque, cliente, conceptosConsolidados }: Props) {
  const grupos = agrupar(conceptosConsolidados);
  return (
    <Document title={`${proforma.numero} - Proforma Consolidada`} author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={true} />
        <Text style={styles.h3}>Conceptos por Contenedor</Text>
        <SeccionMoneda grupos={grupos} moneda="USD" conceptos={conceptosConsolidados} proforma={proforma} />
        <SeccionMoneda grupos={grupos} moneda="MXN" conceptos={conceptosConsolidados} proforma={proforma} />

        {proforma.notas ? (
          <>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{proforma.notas}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.warningBox}>
          ⚠ Este documento es una proforma consolidada y no tiene validez fiscal
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}
