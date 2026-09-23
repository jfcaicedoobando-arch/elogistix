import { Button } from "@/components/ui/button";
import { CartaGarantiaBadge } from "@/components/shared/CartaGarantiaBadge";
import { Settings2 } from "lucide-react";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

export function CosteoNavieraMobileCard({ fila, onConfigurar }: {
  fila: FilaNaviera;
  onConfigurar: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-body break-words">{fila.naviera_nombre}</p>
          <p className="font-mono text-label text-muted-foreground">SCAC {fila.naviera_code}</p>
        </div>
        <CartaGarantiaBadge
          tieneCarta={fila.condicion?.tiene_carta_garantia ?? false}
          vigenteHasta={fila.condicion?.carta_garantia_vigente_hasta ?? null}
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <span className="text-body-sm text-muted-foreground">
          Días libres: <strong className="text-foreground">{fila.condicion?.dias_libres_demoras_default ?? "—"}</strong>
        </span>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onConfigurar(); }}>
          <Settings2 className="mr-1 size-4" /> Configurar
        </Button>
      </div>
    </div>
  );
}