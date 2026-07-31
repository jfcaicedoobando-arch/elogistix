import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { Receipt } from "lucide-react";

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
}

interface Props {
  snapshot: unknown;
  moneda: string;
  /** B-104: sin PDF disponible no se invita a "consultar el PDF". */
  pdfDisponible: boolean;
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

export default function PortalFacturaConceptosTable({ snapshot, moneda, pdfDisponible }: Props) {
  const conceptos = parseConceptos(snapshot);

  if (conceptos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Desglose</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Esta factura no incluye un desglose detallado.</p>
            {pdfDisponible && (
              <p className="text-xs mt-1">Consulta el PDF para más información.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Desglose</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {conceptos.map((c, i) => {
            const descripcion = c.descripcion ?? c.concepto ?? "—";
            const importe = c.importe ?? c.total ?? 0;
            return (
              <div key={i} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{descripcion}</p>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Cant: {c.cantidad ?? 1}</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatCurrency(importe, moneda)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right w-20">Cant.</TableHead>
                <TableHead className="text-right w-32">P. Unitario</TableHead>
                <TableHead className="text-right w-32">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((c, i) => {
                const descripcion = c.descripcion ?? c.concepto ?? "—";
                const precio = c.precio_unitario ?? c.precio ?? 0;
                const importe = c.importe ?? c.total ?? 0;
                return (
                  <TableRow key={i}>
                    <TableCell>{descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.cantidad ?? 1}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(precio, moneda)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(importe, moneda)}</TableCell>
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
