import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Tables } from "@/integrations/supabase/types";
import { calcularIVA, TASA_IVA } from "@/lib/financial/financialUtils";
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

function BloqueTotales({
  subtotal, iva, total, moneda, mostrarIva,
}: { subtotal: number; iva: number; total: number; moneda: "USD" | "MXN"; mostrarIva: boolean }) {
  return (
    <View style={styles.subtotalBlock} wrap={false}>
      <Text style={styles.subtotalLine}>
        Subtotal {moneda}: {formatCurrency(subtotal, moneda)}
      </Text>
      {mostrarIva ? (
        <Text style={styles.subtotalLine}>IVA {moneda}: {formatCurrency(iva, moneda)}</Text>
      ) : null}
      <Text style={styles.subtotalEmphasis}>Total {moneda}: {formatCurrency(total, moneda)}</Text>
    </View>
  );
}

export function ProformaDocument({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA }: Props) {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");
  const hayIvaUsd = usd.some((c) => c.aplica_iva);
  return (
    <Document title={`${proforma.numero} - Proforma`} author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={false} />
        <Text style={styles.h3}>Conceptos</Text>

        {usd.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en USD</Text>
            <DataTable columns={columnasUSD(tasaIva, hayIvaUsd)} rows={usd} />
            <BloqueTotales
              moneda="USD"
              subtotal={Number(proforma.subtotal_usd)}
              iva={Number(proforma.iva_usd)}
              total={Number(proforma.total_usd)}
              mostrarIva={Number(proforma.iva_usd) > 0}
            />
          </>
        ) : null}

        {mxn.length > 0 ? (
          <>
            <Text style={styles.h4}>Conceptos en MXN</Text>
            <DataTable columns={columnasMXN()} rows={mxn} />
            <BloqueTotales
              moneda="MXN"
              subtotal={Number(proforma.subtotal_mxn)}
              iva={Number(proforma.iva_mxn)}
              total={Number(proforma.total_mxn)}
              mostrarIva={true}
            />
          </>
        ) : null}

        {proforma.notas ? (
          <>
            <Text style={styles.h3}>Notas</Text>
            <View style={styles.notesBox}>
              <Text>{proforma.notas}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.warningBox}>
          ⚠ Este documento es una proforma y no tiene validez fiscal
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}
