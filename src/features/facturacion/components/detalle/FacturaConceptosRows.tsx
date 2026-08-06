/**
 * Sub-vistas (mobile card + desktop table) del desglose de conceptos.
 * Extraído de `FacturaConceptosTable` para respetar el límite Power-of-10
 * de 200 líneas por archivo.
 */
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Link } from "react-router-dom";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

export interface ConceptoRow {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
  tipo_iva?: TipoIvaConcepto | null;
  embarque_id?: string | null;
  embarque_expediente?: string | null;
}

export function IvaCell({ tipo }: { tipo: TipoIvaConcepto | null }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  const label = tipo === "gravado_16" ? "16%" : tipo === "tasa_0" ? "0%" : "Exento";
  const variant: "default" | "secondary" | "outline" =
    tipo === "gravado_16" ? "default" : tipo === "tasa_0" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

interface ViewProps {
  conceptos: ConceptoRow[];
  moneda: string;
  mostrarEmbarque: boolean;
  inferirTipoIva: (c: ConceptoRow) => TipoIvaConcepto | null;
}

export function ConceptosMobileList({ conceptos, moneda, inferirTipoIva }: ViewProps) {
  return (
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
            {c.embarque_expediente && c.embarque_id && (
              <Link
                to={`/embarques/${c.embarque_id}`}
                className="mt-1 inline-block text-xs text-accent hover:underline"
              >
                {c.embarque_expediente}
              </Link>
            )}
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
  );
}

export function ConceptosDesktopTable({ conceptos, moneda, mostrarEmbarque, inferirTipoIva }: ViewProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <DetailTableHead>Concepto</DetailTableHead>
            {mostrarEmbarque && <DetailTableHead className="w-32">Embarque</DetailTableHead>}
            <DetailTableHead className="text-right w-20">Cant.</DetailTableHead>
            <DetailTableHead className="text-right w-32">P. Unitario</DetailTableHead>
            <DetailTableHead className="text-center w-24">IVA</DetailTableHead>
            <DetailTableHead className="text-right w-32">Importe</DetailTableHead>
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
                {mostrarEmbarque && (
                  <TableCell className="text-xs">
                    {c.embarque_expediente && c.embarque_id ? (
                      <Link
                        to={`/embarques/${c.embarque_id}`}
                        className="text-accent hover:underline"
                      >
                        {c.embarque_expediente}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
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
  );
}
