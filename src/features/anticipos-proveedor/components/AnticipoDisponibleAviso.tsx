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
import { esMismoEmbarque } from "@/features/anticipos-proveedor/domain/ordenAnticiposPorEmbarque";
import { AplicarAnticipoDesdeFacturaDialog } from "./AplicarAnticipoDesdeFacturaDialog";
import type { ImportesFactura } from "./AplicarAnticipoResumen";

interface Props {
  proveedorId: string;
  facturaId: string;
  folioFactura: string;
  /** Desglose completo de importes de la factura. */
  importes: ImportesFactura;
  canEdit: boolean;
  /** Embarque de la factura, para avisar si no coincide con el del anticipo. */
  facturaEmbarqueId?: string | null;
  facturaExpediente?: string | null;
}

export function AnticipoDisponibleAviso({
  proveedorId, facturaId, folioFactura, importes, canEdit,
  facturaEmbarqueId, facturaExpediente,
}: Props) {

  const saldoFactura = importes.saldo;
  const [open, setOpen] = useState(false);
  const { data: anticipos, porMoneda } = useAnticiposDisponibles(proveedorId);

  if (anticipos.length === 0 || saldoFactura <= 0) return null;

  const resumen = porMoneda
    .map((m) => formatCurrency(m.disponible, m.moneda))
    .join(" · ");

  // Cruce directo: anticipos ligados al mismo embarque que esta factura.
  const delMismoEmbarque = anticipos.filter((a) =>
    esMismoEmbarque(a.embarque_id, facturaEmbarqueId ?? null),
  );
  const expediente = facturaExpediente?.trim() || null;

  return (
    <>
      <Alert className="mb-4">
        <HandCoins className="h-4 w-4" />
        <AlertTitle>Este proveedor tiene saldo a favor</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Anticipos disponibles: <span className="font-medium">{resumen}</span>. Puedes aplicarlos a esta
            factura en lugar de registrar un pago nuevo.
            {delMismoEmbarque.length > 0 && (
              <>
                {" "}
                <span className="font-medium">
                  {delMismoEmbarque.length === 1
                    ? "1 anticipo corresponde"
                    : `${delMismoEmbarque.length} anticipos corresponden`}{" "}
                  {expediente ? `al expediente ${expediente}` : "a este mismo embarque"}
                </span>
                .
              </>
            )}
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
        importes={importes}
        anticipos={anticipos}
        facturaEmbarqueId={facturaEmbarqueId}
        facturaExpediente={facturaExpediente}
      />

    </>
  );
}
