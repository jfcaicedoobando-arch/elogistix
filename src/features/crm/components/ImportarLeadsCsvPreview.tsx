/**
 * Preview de filas parseadas para importación CSV de leads.
 * Sub-componente extraído de `ImportarLeadsCsvDialog` en 11.60.0 (Bloque B2).
 */
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ParsedLeadRow } from "@/lib/csv/leadsCsv";

interface Props {
  rows: ParsedLeadRow[];
  validCount: number;
  errorCount: number;
}

const PREVIEW_LIMIT = 50;

export function ImportarLeadsCsvPreview({ rows, validCount, errorCount }: Props) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4" />
        <span>{rows.length} filas leídas</span>
        <Badge variant="default">{validCount} válidas</Badge>
        {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
      </div>
      <div className="border rounded max-h-64 overflow-auto text-xs">
        <table className="w-full">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2 text-left">Empresa</th>
              <th className="p-2 text-left">Contacto</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Fuente</th>
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
