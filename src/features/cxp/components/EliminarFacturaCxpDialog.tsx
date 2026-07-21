import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { FacturaContextoBand } from "./FacturaContextoBand";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP | null;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onConfirm: () => void | Promise<void>;
}

export function EliminarFacturaCxpDialog({ factura, onOpenChange, isPending, onConfirm }: Props) {
  return (
    <DoubleConfirmDeleteDialog
      open={!!factura}
      onOpenChange={onOpenChange}
      entityName={factura ? `la factura ${factura.folio_proveedor}` : "la factura"}
      description={factura ? (
        <div className="space-y-3">
          <FacturaContextoBand factura={factura} variant="compact" emphasis="total" />
          <p className="text-xs text-muted-foreground">
            La factura será enviada a la papelera. Puedes restaurarla si fue un error.
          </p>
        </div>
      ) : undefined}
      finalDescription="Puedes restaurarla desde la papelera si fue un error."
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
