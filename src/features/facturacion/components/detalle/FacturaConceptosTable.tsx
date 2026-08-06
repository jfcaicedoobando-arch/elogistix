/**
 * FacturaConceptosTable — muestra los conceptos de una factura en modo
 * sólo-lectura. Prioridad:
 *   1. Prop `conceptos` (borradores: se leen en vivo de `conceptos_factura`).
 *   2. `snapshot_emision.conceptos` (facturas ya timbradas).
 *   3. Empty state.
 *
 * Cada renglón muestra un badge indicando su régimen de IVA
 * (16% / 0% / Exento). Para facturas timbradas se infiere del snapshot
 * de Facturapi (`product.taxes[].factor` + `rate`).
 *
 * v13.308.16: si se pasan `subtotal / iva / total`, se renderiza un
 * footer con Subtotal · IVA · Total dentro del mismo card, evitando la
 * card separada "Totales" que fragmentaba la lectura.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";
import { formatCurrency } from "@/lib/formatters";
import { MoneyCell } from "@/components/shared/MoneyCell";
import {
  ConceptosMobileList,
  ConceptosDesktopTable,
  type ConceptoRow,
} from "./FacturaConceptosRows";

interface ConceptoSnapshot extends ConceptoRow {
  /** Snapshot Facturapi: `product.taxes: [{ type, rate, factor }]` */
  product?: {
    taxes?: Array<{ type?: string; rate?: number; factor?: string }>;
  };
  taxes?: Array<{ type?: string; rate?: number; factor?: string }>;
}

interface Props {
  snapshot: unknown;
  moneda: string;
  /** Conceptos vivos (borrador). Si viene, tiene prioridad sobre el snapshot. */
  conceptos?: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
    tipo_iva?: TipoIvaConcepto;
    embarque_id?: string | null;
    embarque_expediente?: string | null;
  }>;
  subtotal?: number;
  iva?: number;
  total?: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseConceptos(snapshot: unknown): ConceptoSnapshot[] {
  if (!isRecord(snapshot)) return [];
  const list = snapshot.conceptos;
  if (!Array.isArray(list)) return [];
  return list.filter(isRecord) as ConceptoSnapshot[];
}

/** Infiere el régimen IVA de un concepto — borrador o snapshot Facturapi. */
function inferirTipoIva(c: ConceptoSnapshot): TipoIvaConcepto | null {
  if (c.tipo_iva === "gravado_16" || c.tipo_iva === "tasa_0" || c.tipo_iva === "exento") {
    return c.tipo_iva;
  }
  const taxes = c.product?.taxes ?? c.taxes;
  if (Array.isArray(taxes) && taxes.length > 0) {
    const iva = taxes.find((t) => (t.type ?? "").toUpperCase() === "IVA") ?? taxes[0];
    const factor = (iva.factor ?? "").toLowerCase();
    if (factor === "exento") return "exento";
    const rate = Number(iva.rate ?? 0);
    if (rate === 0) return "tasa_0";
    return "gravado_16";
  }
  return null;
}

function TotalesFooter({ subtotal, iva, total, moneda }: { subtotal: number; iva: number; total: number; moneda: string }) {
  return (
    <div className="border-t pt-4 mt-4">
      <div className="grid grid-cols-3 gap-3">
        <MoneyCell label="Subtotal" value={formatCurrency(subtotal, moneda)} />
        <MoneyCell label="IVA" value={formatCurrency(iva, moneda)} />
        <MoneyCell label="Total" value={formatCurrency(total, moneda)} highlight />
      </div>
    </div>
  );
}

export function FacturaConceptosTable({ snapshot, moneda, conceptos: propConceptos, subtotal, iva, total }: Props) {
  const conceptos: ConceptoSnapshot[] = propConceptos && propConceptos.length > 0
    ? propConceptos.map((c) => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        importe: c.total,
        tipo_iva: c.tipo_iva,
        embarque_id: c.embarque_id ?? null,
        embarque_expediente: c.embarque_expediente ?? null,
      }))
    : parseConceptos(snapshot);
  const mostrarEmbarque = conceptos.some((c) => c.embarque_expediente);
  const mostrarTotales = typeof subtotal === "number" && typeof iva === "number" && typeof total === "number";

  if (conceptos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" /> Desglose de conceptos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Esta factura no incluye un desglose detallado.</p>
            <p className="text-xs mt-1">Consulta el PDF para más información.</p>
          </div>
          {mostrarTotales && (
            <TotalesFooter subtotal={subtotal!} iva={iva!} total={total!} moneda={moneda} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" /> Desglose de conceptos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConceptosMobileList
          conceptos={conceptos}
          moneda={moneda}
          mostrarEmbarque={mostrarEmbarque}
          inferirTipoIva={inferirTipoIva}
        />
        <ConceptosDesktopTable
          conceptos={conceptos}
          moneda={moneda}
          mostrarEmbarque={mostrarEmbarque}
          inferirTipoIva={inferirTipoIva}
        />
        {mostrarTotales && (
          <TotalesFooter subtotal={subtotal!} iva={iva!} total={total!} moneda={moneda} />
        )}
      </CardContent>
    </Card>
  );
}
