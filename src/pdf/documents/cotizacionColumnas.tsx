/**
 * Columnas y bloques de totales del PDF de cotización (extraídos de
 * `CotizacionDocument.tsx` para respetar el límite de 200 líneas).
 */
import { notasParaCliente } from "@/lib/domain/notasVisibilidad";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { tasasEfectivas } from "@/lib/financial/etiquetaTasaIva";
import { formatCurrency } from "@/lib/formatters";
import { calcularTotales } from "@/generators/cotizacion/conceptosTables";
import { styles } from "../theme/styles";
import type { PdfColumn } from "../components/DataTable";
import type { TotalesMoneda } from "../components/TotalesBox";

/**
 * v13.823.77: dentro de las tablas el código de moneda ya está en el título
 * del bloque ("Conceptos en USD"). Repetirlo en cada celda partía el importe
 * en dos renglones ("USD" / "1,200.00"). Aquí se imprime sólo el número.
 */
function montoTabla(valor: number, moneda: string): string {
  return formatCurrency(valor, moneda).replace(/^([A-Z]{3})\s/, "");
}

/** Columnas de IVA + total cuando el bloque tiene IVA efectivo. */
function columnasIva(moneda: string, tasaIva: number): PdfColumn<ConceptoVentaCotizacion>[] {
  return [
    { key: "iva", title: "IVA", cellStyle: styles.cellNum,
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return tasa > 0 ? montoTabla(calcularIVA(r.cantidad * r.precio_unitario, tasa), moneda) : "—";
      } },
    { key: "total", title: "Total", cellStyle: styles.cellNum,
      render: (r) => montoTabla(r.cantidad * r.precio_unitario * (1 + resolverTasaConcepto(r, tasaIva)), moneda) },
  ];
}

export function columnasUSD(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVentaCotizacion>[] {
  const base: PdfColumn<ConceptoVentaCotizacion>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc,
      render: (r) => {
        const tasa = resolverTasaConcepto(r, tasaIva);
        return tasa > 0 ? `${r.descripcion}  (+IVA ${(tasa * 100).toFixed(0)}%)` : r.descripcion;
      } },
    { key: "unidad", title: "Unidad", cellStyle: { width: 68, fontSize: 9 } as never,
      render: (r) => r.unidad_medida || "—" },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum, render: (r) => montoTabla(r.precio_unitario, "USD") },
    { key: "subtotal", title: "Subtotal", cellStyle: styles.cellNum, render: (r) => montoTabla(r.cantidad * r.precio_unitario, "USD") },
  ];
  return hayIva ? [...base, ...columnasIva("USD", tasaIva)] : base;
}

/**
 * v13.823.342 — las columnas de IVA en MXN salen de la tasa real de los
 * renglones (igual que `TablaConceptosGenerico`). Antes se imprimía siempre la
 * columna IVA y el título "MXN + IVA" aunque todo estuviera a tasa 0%/exento.
 */
export function columnasMXN(tasaIva: number, hayIva: boolean): PdfColumn<ConceptoVentaCotizacion>[] {
  const base: PdfColumn<ConceptoVentaCotizacion>[] = [
    { key: "descripcion", title: "Descripción", cellStyle: styles.cellDesc, render: (r) => r.descripcion },
    { key: "unidad", title: "Unidad", cellStyle: { width: 68, fontSize: 9 } as never,
      render: (r) => r.unidad_medida || "—" },
    { key: "cantidad", title: "Cant.", cellStyle: styles.cellQty, render: (r) => String(r.cantidad) },
    { key: "precio", title: "P. Unit.", cellStyle: styles.cellNum, render: (r) => montoTabla(r.precio_unitario, "MXN") },
    { key: "subtotal", title: "Subtotal", cellStyle: styles.cellNum, render: (r) => montoTabla(r.cantidad * r.precio_unitario, "MXN") },
  ];
  return hayIva ? [...base, ...columnasIva("MXN", tasaIva)] : base;
}

/** Porcentaje único de IVA a mostrar en totales; `undefined` si hay tasas mixtas. */
function pctUnico(filas: ReadonlyArray<ConceptoVentaCotizacion>, tasaIva: number): number | undefined {
  const tasas = tasasEfectivas(filas, tasaIva);
  return tasas.length === 1 ? tasas[0] : undefined;
}

/**
 * v13.823.342 — las notas por renglón también pasan por el filtro de notas
 * internas; antes un "[interno] …" o residuos "QA SMOKE" llegaban al PDF.
 */
export function subnotaCliente(r: ConceptoVentaCotizacion): string | null {
  return notasParaCliente(r.notas) || null;
}

/** Bloques de la caja de totales; la tasa sólo se imprime si hay IVA real. */
export function armarBloques(
  usd: ConceptoVentaCotizacion[],
  mxn: ConceptoVentaCotizacion[],
  totales: ReturnType<typeof calcularTotales>,
  tasaIva: number,
): TotalesMoneda[] {
  const bloques: TotalesMoneda[] = [];
  if (usd.length > 0) {
    bloques.push({
      moneda: "USD",
      subtotal: totales.subtotalUSD,
      iva: totales.ivaUSD,
      total: totales.totalUSD,
      tasaIvaPct: totales.ivaUSD > 0 ? pctUnico(usd, tasaIva) : undefined,
    });
  }
  if (mxn.length > 0) {
    bloques.push({
      moneda: "MXN",
      subtotal: totales.subtotalMXN,
      iva: totales.ivaMXN,
      total: totales.totalMXN,
      tasaIvaPct: totales.ivaMXN > 0 ? pctUnico(mxn, tasaIva) : undefined,
    });
  }
  return bloques;
}
