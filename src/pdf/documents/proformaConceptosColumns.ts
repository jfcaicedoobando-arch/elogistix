import type { Tables } from "@/integrations/supabase/types";
import { calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { type PdfColumn } from "../components/DataTable";
import { formatearDescripcionConcepto } from "./proformaShared";

export type ConceptoVenta = Tables<"conceptos_venta"> & {
  embarque_contenedores?: {
    id: string;
    numero_contenedor: string;
    tipo_contenedor: string;
  } | null;
};

/**
 * R179-01/PDF-A — Tasa efectiva de una fila, con la misma semántica del dominio
 * de proformas (regla B-09): `aplica_iva=false` manda (exento) aunque la fila
 * traiga `tasa_iva_aplicada` heredada del default de la columna. No se toca el
 * resolver global para no afectar a sus otros consumidores.
 */
function tasaEfectivaFila(r: ConceptoVenta, tasaIva: number): number {
  if (r.aplica_iva === false) return 0;
  return resolverTasaConcepto(r, tasaIva);
}

/** IVA de la fila según su tratamiento fiscal guardado. */
function ivaFila(r: ConceptoVenta, tasaIva: number): number {
  const importe = Number(r.cantidad) * Number(r.precio_unitario);
  return calcularIVA(importe, tasaEfectivaFila(r, tasaIva));
}

export function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVenta>[] {
  const base: PdfColumn<ConceptoVenta>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellMoney,
      render: (r) => formatCurrency(Number(r.precio_unitario), "USD") },
    { key: "importe", title: "Importe", cellStyle: styles.cellMoney,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "USD") },
  ];
  if (!hayIva) return base;
  return [
    ...base,
    { key: "iva", title: "IVA", cellStyle: styles.cellMoney,
      render: (r) => r.aplica_iva
        ? formatCurrency(ivaFila(r, tasaIva), "USD")
        : "—" },
    { key: "total", title: "Total", cellStyle: styles.cellMoney,
      render: (r) => {
        const importe = Number(r.cantidad) * Number(r.precio_unitario);
        const iva = r.aplica_iva ? ivaFila(r, tasaIva) : 0;
        return formatCurrency(importe + iva, "USD");
      } },
  ];
}

export function columnasMXN(tasaIva: number): PdfColumn<ConceptoVenta>[] {
  return [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => formatearDescripcionConcepto(r.descripcion) },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellMoney,
      render: (r) => formatCurrency(Number(r.precio_unitario), "MXN") },
    { key: "importe", title: "Importe", cellStyle: styles.cellMoney,
      render: (r) => formatCurrency(Number(r.cantidad) * Number(r.precio_unitario), "MXN") },
    { key: "iva", title: "IVA", cellStyle: styles.cellMoney,
      render: (r) => formatCurrency(ivaFila(r, tasaIva), "MXN") },
    { key: "total", title: "Total", cellStyle: styles.cellMoney,
      render: (r) => {
        const importe = Number(r.cantidad) * Number(r.precio_unitario);
        return formatCurrency(importe + ivaFila(r, tasaIva), "MXN");
      } },
  ];
}


export interface GrupoContenedor {
  contenedorId: string | null; // null = cargo general
  numero: string;
  tipo: string | null;
  items: ConceptoVenta[];
}

/** B-4: agrupa conceptos por contenedor real (FK contenedor_id). Generales al final. */
export function agruparPorContenedor(items: ConceptoVenta[]): GrupoContenedor[] {
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
  return Array.from(map.values()).sort((a, b) => {
    if (a.contenedorId === null) return 1;
    if (b.contenedorId === null) return -1;
    return 0;
  });
}
