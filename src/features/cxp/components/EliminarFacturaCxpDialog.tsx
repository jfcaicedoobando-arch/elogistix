import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
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
      description={factura
        ? `La factura ${factura.folio_proveedor} de ${factura.proveedor_nombre} será enviada a la papelera.`
        : undefined}
      finalDescription="Puedes restaurarla desde la papelera si fue un error."
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
