/**
 * Cuerpo del diálogo de bloqueo cuando un embarque tiene dependencias
 * financieras. Extraído de `DialogEliminarEmbarque.tsx` en 12.61.18
 * (Sprint 2.1, Power-of-10 #1: ≤200 líneas).
 */
import { AlertTriangle } from "lucide-react";
import type { EmbarqueDependenciasFinancieras, FacturaLigada } from "@/features/embarques/hooks";

interface Props {
  expediente: string;
  deps: EmbarqueDependenciasFinancieras;
}

function formatoFolio(f: FacturaLigada): string {
  return f.folio ?? f.id.slice(0, 8);
}

export default function DialogEliminarEmbarqueBloqueado({ expediente, deps }: Props) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        El embarque <strong>{expediente}</strong> tiene documentos financieros asociados.
        Cancela primero los siguientes documentos antes de eliminarlo:
      </p>

      {deps.cxc.count > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="font-semibold text-foreground">
            Facturas a clientes (CxC): {deps.cxc.count}
          </p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {deps.cxc.facturas.map((f) => (
              <li key={f.id}>
                {formatoFolio(f)}{f.estado ? ` — ${f.estado}` : ''}
              </li>
            ))}
            {deps.cxc.count > deps.cxc.facturas.length && (
              <li>… y {deps.cxc.count - deps.cxc.facturas.length} más</li>
            )}
          </ul>
        </div>
      )}

      {deps.cxp.count > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="font-semibold text-foreground">
            Facturas de proveedores (CxP): {deps.cxp.count}
          </p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {deps.cxp.facturas.map((f) => (
              <li key={f.id}>
                {formatoFolio(f)}{f.estado ? ` — ${f.estado}` : ''}
              </li>
            ))}
            {deps.cxp.count > deps.cxp.facturas.length && (
              <li>… y {deps.cxp.count - deps.cxp.facturas.length} más</li>
            )}
          </ul>
        </div>
      )}

      {(deps.notasCredito > 0 || deps.pagos > 0 || deps.proformas > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div>
            {deps.proformas > 0 && (
              <p>Proformas listas para facturar: <strong>{deps.proformas}</strong></p>
            )}
            {deps.notasCredito > 0 && <p>Notas de crédito ligadas: <strong>{deps.notasCredito}</strong></p>}
            {deps.pagos > 0 && <p>Pagos registrados: <strong>{deps.pagos}</strong></p>}
          </div>
        </div>
      )}


      <p className="text-xs text-muted-foreground">
        Una vez que canceles o desliges estos documentos del embarque, podrás intentar la eliminación nuevamente.
      </p>
    </div>
  );
}
