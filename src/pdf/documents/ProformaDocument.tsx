import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Tables } from "@/integrations/supabase/types";
import { calcularIVA, TASA_IVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
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

type ConceptoVenta = Tables<"conceptos_venta"> & {
  embarque_contenedores?: {
    id: string;
    numero_contenedor: string;
    tipo_contenedor: string;
  } | null;
};

interface Props {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
  emisor?: EmisorInfo;
}

function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVenta>[] {
  const base: PdfColumn<ConceptoVenta>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), "USD") },
    { key: "importe", title: "Importe", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "USD") },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => r.aplica_iva
        ? formatCurrency(calcularIVA(Number(r.cantidad) * Number(r.precio_unitario), resolverTasaConcepto(r, tasaIva)), "USD")
        : "—" },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => {
        const importe = Number(r.cantidad) * Number(r.precio_unitario);
        const iva = r.aplica_iva ? calcularIVA(importe, resolverTasaConcepto(r, tasaIva)) : 0;
        return formatCurrency(importe + iva, "USD");
      } },
  ];
}

function columnasMXN(tasaIva: number): PdfColumn<ConceptoVenta>[] {
  return [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.precio_unitario), "MXN") },
    { key: "importe", title: "Importe", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "MXN") },
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => formatCurrency(calcularIVA(Number(r.cantidad) * Number(r.precio_unitario), resolverTasaConcepto(r, tasaIva)), "MXN") },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => {
        const importe = Number(r.cantidad) * Number(r.precio_unitario);
        const iva = calcularIVA(importe, resolverTasaConcepto(r, tasaIva));
        return formatCurrency(importe + iva, "MXN");
      } },
  ];
}

interface GrupoContenedor {
  contenedorId: string | null; // null = cargo general
  numero: string;
  tipo: string | null;
  items: ConceptoVenta[];
}

/** B-4: agrupa conceptos por contenedor real (FK contenedor_id). Generales al final. */
function agruparPorContenedor(items: ConceptoVenta[]): GrupoContenedor[] {
  const map = new Map<string, GrupoContenedor>();
  for (const c of items) {
    const ec = c.embarque_contenedores;
    const key = ec?.id ?? "__general__";
    if (!map.has(key)) {
      map.set(key, {
        contenedorId: ec?.id ?? null,
        numero: ec?.numero_contenedor ?? "Cargos generales",
        tipo: ec?.tipo_contenedor ?? null,
        items: [],
      });
    }
    map.get(key)!.items.push(c);
  }
  // Generales al final
  return Array.from(map.values()).sort((a, b) => {
    if (a.contenedorId === null) return 1;
    if (b.contenedorId === null) return -1;
    return 0;
  });
}

interface SeccionProps {
  grupos: GrupoContenedor[];
  moneda: "USD" | "MXN";
  tasaIva: number;
  multiContenedor: boolean;
}

function SeccionMonedaPdf({ grupos, moneda, tasaIva, multiContenedor }: SeccionProps) {
  const filtrados = grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => i.moneda === moneda) }))
    .filter((g) => g.items.length > 0);
  if (filtrados.length === 0) return null;

  return (
    <>
      <Text style={styles.h4}>Conceptos en {moneda}</Text>
      {filtrados.map((g) => {
        const hayIva = moneda === "USD" ? g.items.some((c) => c.aplica_iva) : true;
        const sub = g.items.reduce(
          (s, i) => s + Number(i.cantidad) * Number(i.precio_unitario),
          0,
        );
        const cols = moneda === "USD" ? columnasUSD(tasaIva, hayIva) : columnasMXN();
        return (
          <View key={`${g.contenedorId ?? "gen"}-${moneda}`} wrap={false}>
            {multiContenedor ? (
              <Text style={styles.containerBlock}>
                {g.contenedorId
                  ? `Contenedor: ${g.numero}${g.tipo ? `  ·  ${g.tipo}` : ""}`
                  : "Cargos generales del embarque"}
              </Text>
            ) : null}
            <DataTable columns={cols} rows={g.items} />
            {multiContenedor ? (
              <Text style={[styles.subtotalLine, { textAlign: "right", marginTop: 2 }]}>
                Subtotal {moneda}: {formatCurrency(sub, moneda)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

export function ProformaDocument({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA, emisor }: Props) {
  const usd = conceptos.filter((c) => c.moneda === "USD");
  const mxn = conceptos.filter((c) => c.moneda === "MXN");
  const tasaPct = Math.round(tasaIva * 100);

  // B-4: detectar si la proforma cubre N contenedores reales para activar el agrupamiento.
  const idsUnicos = new Set(
    conceptos.map((c) => c.embarque_contenedores?.id).filter((x): x is string => Boolean(x)),
  );
  const multiContenedor = idsUnicos.size >= 2;
  const grupos = agruparPorContenedor(conceptos);

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
    <Document title={`${proforma.numero} - Proforma`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <ProformaHeader proforma={proforma} cliente={cliente ?? null} embarque={embarque} esConsolidada={false} emisor={emisor} />
        <Text style={styles.h3}>{multiContenedor ? "Conceptos por Contenedor" : "Conceptos"}</Text>

        <SeccionMonedaPdf grupos={grupos} moneda="USD" tasaIva={tasaIva} multiContenedor={multiContenedor} />
        <SeccionMonedaPdf grupos={grupos} moneda="MXN" tasaIva={tasaIva} multiContenedor={multiContenedor} />

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
