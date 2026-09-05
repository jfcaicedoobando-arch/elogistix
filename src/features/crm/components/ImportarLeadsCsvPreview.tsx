/**
 * Preview de filas parseadas para importación CSV de leads.
 * Sub-componente extraído de `ImportarLeadsCsvDialog` en 11.60.0 (Bloque B2).
 * v13.630.0 (Ola A): muestra duplicados detectados contra la base y el archivo.
 */
import { FileText, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ParsedLeadRow } from "@/lib/csv/leadsCsv";
import type { Coincidencia } from "@/features/crm/domain/leadsDedupe";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  rows: ParsedLeadRow[];
  validCount: number;
  errorCount: number;
  /** Una coincidencia por fila, en el mismo orden que `rows`. */
  duplicados?: Coincidencia[];
  duplicadosCargando?: boolean;
  /** La revisión de duplicados falló: ninguna fila es "Nuevo" comprobado. */
  duplicadosError?: boolean;
}

const PREVIEW_LIMIT = 50;

function DuplicadoCelda({ c, revisionFallo }: { c?: Coincidencia; revisionFallo?: boolean }) {
  if (!c) {
    return revisionFallo ? (
      <span className="text-destructive">Sin revisar</span>
    ) : (
      <span className="text-muted-foreground">Nuevo</span>
    );
  }
  if (c.nivel === "nuevo") return <span className="text-muted-foreground">Nuevo</span>;
  return (
    <Badge variant={c.nivel === "exacto" ? "destructive" : "secondary"} className="gap-1">
      <Copy className="h-3 w-3" />
      {c.nivel === "exacto" ? "Duplicado" : "Posible"} · {c.campos.join(", ")}
    </Badge>
  );
}

export function ImportarLeadsCsvPreview({
  rows, validCount, errorCount, duplicados, duplicadosCargando, duplicadosError,
}: Props) {
  if (rows.length === 0) return null;
  const exactos = (duplicados ?? []).filter((c) => c.nivel === "exacto").length;
  const posibles = (duplicados ?? []).filter((c) => c.nivel === "posible").length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-body">
        <FileText className="h-4 w-4" />
        <span>{rows.length} filas leídas</span>
        <Badge variant="default">{validCount} válidas</Badge>
        {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
        {duplicadosCargando && (
          <span className="text-body-sm text-muted-foreground">Revisando duplicados…</span>
        )}
        {exactos > 0 && <Badge variant="destructive">{exactos} duplicados (se omiten)</Badge>}
        {posibles > 0 && <Badge variant="secondary">{posibles} posibles duplicados</Badge>}
      </div>
      <div className="border rounded max-h-64 overflow-auto text-body-sm">
        <Table className="w-full">
          <TableHeader className="bg-muted sticky top-0">
            <TableRow>
              <DetailTableHead>Empresa</DetailTableHead>
              <DetailTableHead>Contacto</DetailTableHead>
              <DetailTableHead>Correo</DetailTableHead>
              <DetailTableHead>Estado</DetailTableHead>
              <DetailTableHead>Fuente</DetailTableHead>
              <DetailTableHead>Duplicado</DetailTableHead>
              <DetailTableHead>Error</DetailTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
              <TableRow key={i} className={r.__error ? "bg-destructive/10" : ""}>
                <TableCell>{r.empresa || "—"}</TableCell>
                <TableCell>{r.contacto || "—"}</TableCell>
                <TableCell>{r.email || "—"}</TableCell>
                <TableCell>{r.estado}</TableCell>
                <TableCell>{r.fuente}</TableCell>
                <TableCell><DuplicadoCelda c={duplicados?.[i]} revisionFallo={duplicadosError} /></TableCell>
                <TableCell className="text-destructive">{r.__error ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > PREVIEW_LIMIT && (
          <p className="text-center p-2 text-muted-foreground">
            … {rows.length - PREVIEW_LIMIT} filas más
          </p>
        )}
      </div>
    </div>
  );
}
