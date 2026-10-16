import { Button } from "@/components/ui/button";
import type { OrigenEmpresaConsulta } from "@/features/crm/hooks/useOrigenEmpresaConsulta";

export function OrigenEmpresaEstado({ consulta }: { consulta: OrigenEmpresaConsulta }) {
  if (!consulta.mensaje) return null;
  return (
    <div className="sm:col-span-2 space-y-1">
      <p role={consulta.error ? "alert" : "status"} aria-live="polite" className="text-body-sm">
        {consulta.mensaje}
      </p>
      {consulta.error && (
        <Button type="button" variant="outline" size="sm" onClick={consulta.reintentar}>
          Reintentar consulta de origen
        </Button>
      )}
    </div>
  );
}
