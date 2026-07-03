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
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Receipt } from "lucide-react";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
  tipo_iva?: TipoIvaConcepto | null;
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
  }>;
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

function IvaCell({ tipo }: { tipo: TipoIvaConcepto | null }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  const label = tipo === "gravado_16" ? "16%" : tipo === "tasa_0" ? "0%" : "Exento";
  const variant: "default" | "secondary" | "outline" =
    tipo === "gravado_16" ? "default" : tipo === "tasa_0" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

export function FacturaConceptosTable({ snapshot, moneda, conceptos: propConceptos }: Props) {
  const conceptos: ConceptoSnapshot[] = propConceptos && propConceptos.length > 0
    ? propConceptos.map((c) => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        importe: c.total,
        tipo_iva: c.tipo_iva,
      }))
    : parseConceptos(snapshot);

  if (conceptos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Desglose de conceptos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Esta factura no incluye un desglose detallado.</p>
            <p className="text-xs mt-1">Consulta el PDF para más información.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Desglose de conceptos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="md:hidden space-y-2">
          {conceptos.map((c, i) => {
            const descripcion = c.descripcion ?? c.concepto ?? "—";
            const importe = c.importe ?? c.total ?? 0;
            const tipoIva = inferirTipoIva(c);
            return (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{descripcion}</p>
                  <IvaCell tipo={tipoIva} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Cant: {c.cantidad ?? 1}</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatCurrency(Number(importe), moneda)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right w-20">Cant.</TableHead>
                <TableHead className="text-right w-32">P. Unitario</TableHead>
                <TableHead className="text-center w-24">IVA</TableHead>
                <TableHead className="text-right w-32">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((c, i) => {
                const descripcion = c.descripcion ?? c.concepto ?? "—";
                const precio = c.precio_unitario ?? c.precio ?? 0;
                const importe = c.importe ?? c.total ?? 0;
                const tipoIva = inferirTipoIva(c);
                return (
                  <TableRow key={i}>
                    <TableCell>{descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.cantidad ?? 1}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(precio), moneda)}
                    </TableCell>
                    <TableCell className="text-center"><IvaCell tipo={tipoIva} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(Number(importe), moneda)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
