/**
 * Vista vacía de la bandeja CxP.
 * Extraído de `Cxp.tsx` (v13.317.9) — sólo presentación.
 */
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/empty/EmptyState";

interface Props {
  canEdit: boolean;
  onCapturar: () => void;
}

export function CxpEmptyState({ canEdit, onCapturar }: Props) {
  return (
    <EmptyState
      icon={Inbox}
      title="Aún no hay facturas de proveedor"
      description="Captura la primera factura recibida para abrir su saldo en Cuentas por Pagar y empezar a registrar pagos."
      primaryAction={canEdit ? { label: "Capturar primera factura", onClick: onCapturar } : undefined}
    />
  );
}
