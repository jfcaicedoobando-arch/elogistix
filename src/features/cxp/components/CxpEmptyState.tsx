/**
 * Vista vacía de la bandeja CxP.
 * Extraído de `Cxp.tsx` (v13.317.9) — sólo presentación.
 */
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  canEdit: boolean;
  onCapturar: () => void;
}

export function CxpEmptyState({ canEdit, onCapturar }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold">Aún no hay facturas de proveedor</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Captura la primera factura recibida para abrir su saldo en Cuentas por Pagar
        y empezar a registrar pagos.
      </p>
      {canEdit && (
        <Button className="mt-4" onClick={onCapturar}>
          <Plus className="h-4 w-4 mr-2" /> Capturar primera factura
        </Button>
      )}
    </div>
  );
}
