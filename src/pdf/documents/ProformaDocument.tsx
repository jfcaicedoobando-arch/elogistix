import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Tables } from "@/integrations/supabase/types";
import { calcularIVA, TASA_IVA } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { TotalesBox } from "../components/TotalesBox";
import { ProformaHeader } from "./ProformaHeader";
import {
  formatearDescripcionConcepto,
  type ClienteLite,
  type EmbarqueLite,
  type ProformaRow,
} from "./proformaShared";

type ConceptoVenta = Tables<"conceptos_venta">;

interface Props {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
}

function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVenta>[] {
  const base: PdfColumn<ConceptoVenta>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), "USD") },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "USD") },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => r.aplica_iva
        ? formatCurrency(calcularIVA(Number(r.cantidad) * Number(r.precio_unitario), tasaIva), "USD")
        : "—" },
  ];
}

function columnasMXN(): PdfColumn<ConceptoVenta>[] {
  return [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), "MXN") },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "MXN") },
  ];
}

export function ProformaDocument({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA }: Props) {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");
  const hayIvaUsd = usd.some((c) => c.aplica_iva);
  const tasaPct = Math.round(tasaIva * 100);

  const bloquesTotales = [];
  if (usd.length > 0) {
    bloquesTotales.push({
      moneda: "USD" as const,
      subtotal: Number(proforma.subtotal_usd),
      iva: Number(proforma.iva_usd),
      total: Number(proforma.total_usd),
      tasaIvaPct: Number(proforma.iva_usd) > 0 ? tasaPct : undefined,
    });
  }
  if (mxn.length > 0) {
    bloquesTotales.push({
      moneda: "MXN" as const,
      subtotal: Number(proforma.subtotal_mxn),
      iva: Number(proforma.iva_mxn),
      total: Number(proforma.total_mxn),
      tasaIvaPct: tasaPct,
    });
  }

  return (
    <Document title={`${proforma.numero} - Proforma`} author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={false} />
        <Text style={styles.h3}>Conceptos</Text>

        {usd.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en USD</Text>
            <DataTable columns={columnasUSD(tasaIva, hayIvaUsd)} rows={usd} />
          </>
        ) : null}

        {mxn.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en MXN</Text>
            <DataTable columns={columnasMXN()} rows={mxn} />
          </>
        ) : null}

        <TotalesBox bloques={bloquesTotales} />

        {proforma.notas ? (
          <>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{proforma.notas}</Text>
            </View>
          </>
        ) : null}

        <Footer />
      </Page>
    </Document>
  );
}
