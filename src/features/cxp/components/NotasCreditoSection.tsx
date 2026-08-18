/**
 * Sección de Notas de Crédito dentro del diálogo de detalle de factura de proveedor.
 * Permite listar, registrar, aplicar y cancelar NCs (cuando hay permisos).
 * UX-06 — cancelar una NC pide confirmación explícita porque mueve el saldo.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import {
  useNotasCreditoFactura, useAplicarNotaCredito, useAprobarNotaCredito, useCancelarNotaCredito,
} from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { DialogNotaCreditoProveedor } from "./DialogNotaCreditoProveedor";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { NotaCreditoFila } from "./NotaCreditoFila";
import { getFacturaSignedUrl } from "@/services/storage/facturas";
import { notifyError } from "@/lib/ui/appFeedback";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"proveedor_notas_credito">["moneda"];

interface Props {
  facturaId: string;
  monedaFactura: Moneda;
  saldoFactura: number;
  canEdit: boolean;
}

async function openStoredFile(path: string | null | undefined) {
  if (!path) return;
  try {
    const url = await getFacturaSignedUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    notifyError(undefined, { message: "No se pudo generar la liga de descarga del archivo.", method: "openStoredFile" });
  }
}

export function NotasCreditoSection({ facturaId, monedaFactura, saldoFactura, canEdit }: Props) {
  const { data: notas = [], isLoading } = useNotasCreditoFactura(facturaId);
  const aplicar = useAplicarNotaCredito(facturaId);
  const aprobar = useAprobarNotaCredito(facturaId);
  const cancelar = useCancelarNotaCredito(facturaId);
  const [openNueva, setOpenNueva] = useState(false);
  const [ncACancelar, setNcACancelar] = useState<{ id: string; folio: string } | null>(null);

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">Notas de crédito</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpenNueva(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar NC
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-3"><ListSkeleton rows={2} /></div>
      ) : notas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin notas de crédito registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-label uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Folio</th>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-center px-3 py-2">Estado</th>
                <th className="text-center px-3 py-2">SAT</th>
                <th className="text-center px-3 py-2">XML</th>
                <th className="text-center px-3 py-2">PDF</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notas.map((n) => (
                <NotaCreditoFila
                  key={n.id}
                  nota={n}
                  facturaId={facturaId}
                  canEdit={canEdit}
                  pendingAprobar={aprobar.isPending}
                  pendingAplicar={aplicar.isPending}
                  pendingCancelar={cancelar.isPending}
                  onAbrirArchivo={openStoredFile}
                  onAprobar={(id) => aprobar.mutate(id)}
                  onAplicar={(id) => aplicar.mutate(id)}
                  onCancelar={setNcACancelar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DialogNotaCreditoProveedor
        open={openNueva}
        onOpenChange={setOpenNueva}
        facturaId={facturaId}
        monedaFactura={monedaFactura}
        saldoFactura={saldoFactura}
      />

      <ConfirmActionDialog
        open={!!ncACancelar}
        onOpenChange={(o) => !o && setNcACancelar(null)}
        title="¿Cancelar la nota de crédito?"
        description={
          <>
            La nota <strong>{ncACancelar?.folio}</strong> dejará de reducir el saldo de esta
            factura. Esta acción no se puede revertir.
          </>
        }
        confirmLabel="Sí, cancelar NC"
        variant="destructive"
        isPending={cancelar.isPending}
        onConfirm={async () => {
          if (!ncACancelar) return;
          await cancelar.mutateAsync(ncACancelar.id);
          setNcACancelar(null);
        }}
      />
    </div>
  );
}
