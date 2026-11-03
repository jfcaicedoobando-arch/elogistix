import { AlertTriangle } from "lucide-react";
import type { EmbarqueDependenciasFinancieras, FacturaLigada } from "@/features/embarques/hooks";

interface Props {
  expediente: string;
  deps: EmbarqueDependenciasFinancieras;
}

function FacturasBloqueantes({ label, count, ejemplos }: { label: string; count: number; ejemplos: FacturaLigada[] }) {
  if (count === 0) return null;
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="font-semibold text-foreground">{label}: {count}</p>
      {ejemplos.length > 0 ? (
        <>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {ejemplos.map((f) => (
              <li key={f.id}>{f.folio || f.id.slice(0, 8)}{f.estado ? ` — ${f.estado}` : ""}</li>
            ))}
          </ul>
          {count > ejemplos.length && <p className="mt-1 text-body-sm text-muted-foreground">Se muestran {ejemplos.length} de {count} facturas. El conteo incluye todas.</p>}
        </>
      ) : <p className="mt-1 text-body-sm text-muted-foreground">Los folios no están disponibles en esta verificación.</p>}
    </div>
  );
}

export default function DialogEliminarEmbarqueBloqueado({ expediente, deps }: Props) {
  const otrosMotivos = deps.notasCredito > 0 || deps.pagos > 0 || deps.proformas > 0 || deps.comisionesDefinitivas > 0 || deps.cerrado;
  return (
    <div className="space-y-3 text-body">
      <p>
        La eliminación del embarque <strong>{expediente}</strong> está bloqueada.
        Revisa estos motivos con Contabilidad para decidir el procedimiento que corresponda.
      </p>
      <FacturasBloqueantes label="Facturas a clientes (CxC)" count={deps.cxc.count} ejemplos={deps.cxc.facturas} />
      <FacturasBloqueantes label="Facturas de proveedores (CxP)" count={deps.cxp.count} ejemplos={deps.cxp.facturas} />
      {otrosMotivos && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" aria-hidden />
          <div>
            {deps.cerrado && <p>El embarque está cerrado.</p>}
            {deps.comisionesDefinitivas > 0 && <p>Comisiones definitivas: <strong>{deps.comisionesDefinitivas}</strong></p>}
            {deps.proformas > 0 && <p>Proformas asociadas: <strong>{deps.proformas}</strong></p>}
            {deps.notasCredito > 0 && <p>Notas de crédito ligadas: <strong>{deps.notasCredito}</strong></p>}
            {deps.pagos > 0 && <p>Pagos registrados: <strong>{deps.pagos}</strong></p>}
          </div>
        </div>
      )}
      <p className="text-body-sm text-muted-foreground">
        Cada intento vuelve a comprobar los vínculos y el estado del embarque. La Papelera no evita estos bloqueos.
      </p>
    </div>
  );
}
