/**
 * Preview de filas parseadas para importación CSV de leads.
 * Sub-componente extraído de `ImportarLeadsCsvDialog` en 11.60.0 (Bloque B2).
 * v13.630.0 (Ola A): muestra duplicados detectados contra la base y el archivo.
 */
import { FileText, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ParsedLeadRow } from "@/lib/csv/leadsCsv";
import type { Coincidencia } from "@/features/crm/domain/leadsDedupe";

interface Props {
  rows: ParsedLeadRow[];
  validCount: number;
  errorCount: number;
  /** Una coincidencia por fila, en el mismo orden que `rows`. */
  duplicados?: Coincidencia[];
  duplicadosCargando?: boolean;
}

const PREVIEW_LIMIT = 50;

function DuplicadoCelda({ c }: { c?: Coincidencia }) {
  if (!c || c.nivel === "nuevo") return <span className="text-muted-foreground">Nuevo</span>;
  return (
    <Badge variant={c.nivel === "exacto" ? "destructive" : "secondary"} className="gap-1">
      <Copy className="h-3 w-3" />
      {c.nivel === "exacto" ? "Duplicado" : "Posible"} · {c.campos.join(", ")}
    </Badge>
  );
}

export function ImportarLeadsCsvPreview({
  rows, validCount, errorCount, duplicados, duplicadosCargando,
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
        <table className="w-full">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2 text-left">Empresa</th>
              <th className="p-2 text-left">Contacto</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Fuente</th>
              <th className="p-2 text-left">Duplicado</th>
              <th className="p-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
              <tr key={i} className={r.__error ? "bg-destructive/10" : ""}>
                <td className="p-2">{r.empresa || "—"}</td>
                <td className="p-2">{r.contacto || "—"}</td>
                <td className="p-2">{r.email || "—"}</td>
                <td className="p-2">{r.estado}</td>
                <td className="p-2">{r.fuente}</td>
                <td className="p-2"><DuplicadoCelda c={duplicados?.[i]} /></td>
                <td className="p-2 text-destructive">{r.__error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > PREVIEW_LIMIT && (
          <p className="text-center p-2 text-muted-foreground">
            … {rows.length - PREVIEW_LIMIT} filas más
          </p>
        )}
      </div>
    </div>
  );
}
