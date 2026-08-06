/**
 * Aviso "hay saldo a favor" en el detalle de la factura de proveedor,
 * con acceso directo a aplicar el anticipo sin salir de la factura.
 */
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";
import { useAnticiposDisponibles } from "@/features/anticipos-proveedor/hooks/useAnticiposDisponibles";
import { AplicarAnticipoDesdeFacturaDialog } from "./AplicarAnticipoDesdeFacturaDialog";

interface Props {
  proveedorId: string;
  facturaId: string;
  folioFactura: string;
  saldoFactura: number;
  monedaFactura: string;
  canEdit: boolean;
}

export function AnticipoDisponibleAviso({
  proveedorId, facturaId, folioFactura, saldoFactura, monedaFactura, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: anticipos, porMoneda } = useAnticiposDisponibles(proveedorId);

  if (anticipos.length === 0 || saldoFactura <= 0) return null;

  const resumen = porMoneda
    .map((m) => formatCurrency(m.disponible, m.moneda))
    .join(" · ");

  return (
    <>
      <Alert className="mb-4">
        <HandCoins className="h-4 w-4" />
        <AlertTitle>Este proveedor tiene saldo a favor</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Anticipos disponibles: <span className="font-medium">{resumen}</span>. Puedes aplicarlos a esta
            factura en lugar de registrar un pago nuevo.
          </span>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Aplicar anticipo
            </Button>
          )}
        </AlertDescription>
      </Alert>

      <AplicarAnticipoDesdeFacturaDialog
        open={open}
        onOpenChange={setOpen}
        facturaId={facturaId}
        folioFactura={folioFactura}
        saldoFactura={saldoFactura}
        monedaFactura={monedaFactura}
        anticipos={anticipos}
      />
    </>
  );
}
