/**
 * FacturaNotasCreditoSeccion — lista las NCs ligadas a una factura y
 * permite crear, timbrar, descargar, reenviar y cancelar cada una.
 */
import { useMemo, useState } from "react";
import { FileMinus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotasCreditoDeFactura } from "@/features/facturacion/hooks/useNotasCreditoDeFactura";
import { DialogCrearNotaCredito } from "@/features/facturacion/components/DialogCrearNotaCredito";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { DialogCancelarNotaCredito } from "@/features/facturacion/components/DialogCancelarNotaCredito";
import { useTimbrarNotaCredito, useCancelarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { FacturaNotasCreditoTable } from "./FacturaNotasCreditoTable";
import type { Moneda } from "@/features/facturacion/types";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ClaimPendingBanner } from "./ClaimPendingBanner";
import { parseConceptosSugeridos } from "./facturaNotasCreditoConceptos";

interface Props {
  facturaId: string;
  facturaNumero: string;
  /** B-24: fecha de emisión de la factura (cota inferior de la fecha de NC). */
  fechaFactura?: string | null;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  /** P1: el saldo no es confiable (falló la lectura de pagos o NC aplicadas). */
  saldoError?: boolean;
  uuidFacturaOriginal: string | null;
  snapshotEmision: unknown;
  canEdit: boolean;
}

export function FacturaNotasCreditoSeccion(props: Props) {
  const { facturaId, facturaNumero, fechaFactura, monedaFactura, tipoCambioFactura, saldoFactura, saldoError, uuidFacturaOriginal, snapshotEmision, canEdit } = props;
  const [openCrear, setOpenCrear] = useState(false);
  const [emailNcId, setEmailNcId] = useState<string | null>(null);
  const [cancelarNcId, setCancelarNcId] = useState<string | null>(null);

  const timbrar = useTimbrarNotaCredito(facturaId);
  const cancelar = useCancelarNotaCredito(facturaId);

  const { data: notas = [], isLoading } = useNotasCreditoDeFactura(facturaId);

  const conceptosSugeridos = useMemo(
    () => parseConceptosSugeridos(snapshotEmision),
    [snapshotEmision],
  );

  // Fail-closed: sin saldo confiable no se emiten NC (evita acreditar de más).
  const facturaLiquidada = saldoFactura <= 0.01;
  const bloqueado = facturaLiquidada || Boolean(saldoError);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileMinus className="h-4 w-4 text-muted-foreground" /> Notas de crédito
          <span className="text-body-sm text-muted-foreground font-normal">({notas.length})</span>
        </CardTitle>
        {canEdit && (
          bloqueado ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button size="sm" disabled>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                {saldoError
                  ? "No pudimos verificar el saldo de la factura (falló la lectura de pagos o notas de crédito). Reintenta desde el aviso superior antes de emitir una nota de crédito."
                  : "La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente."}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" onClick={() => setOpenCrear(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
            </Button>
          )
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" className="py-2" />
        ) : notas.length === 0 ? (
          <p className="text-body text-muted-foreground">Esta factura no tiene notas de crédito.</p>
        ) : (
          <>
            {/* Ola 5 · RG4-4: una NC con claim PENDING atascado se recupera
                con el mismo flujo que las facturas. */}
            {notas
              .filter((nc) => nc.facturapi_id?.startsWith("PENDING:"))
              .map((nc) => (
                <ClaimPendingBanner
                  key={nc.id}
                  facturaId={facturaId}
                  notaCreditoId={nc.id}
                  facturapiId={nc.facturapi_id}
                  facturapiClaimAt={nc.facturapi_claim_at}
                />
              ))}
            <FacturaNotasCreditoTable
              notas={notas}
              canEdit={canEdit}
              uuidFacturaOriginal={uuidFacturaOriginal}
              timbrando={timbrar.isPending}
              onTimbrar={(id) => timbrar.mutate(id)}
              onEmail={setEmailNcId}
              onCancelar={setCancelarNcId}
            />
          </>
        )}
      </CardContent>

      <DialogCrearNotaCredito
        open={openCrear}
        onOpenChange={setOpenCrear}
        facturaId={facturaId}
        facturaNumero={facturaNumero}
        fechaFactura={fechaFactura}
        monedaFactura={monedaFactura}
        tipoCambioFactura={tipoCambioFactura}
        saldoFactura={saldoFactura}
        uuidFacturaOriginal={uuidFacturaOriginal}
        conceptosSugeridos={conceptosSugeridos}
      />

      <DialogEnviarCfdi
        open={!!emailNcId}
        onOpenChange={(o) => !o && setEmailNcId(null)}
        notaCreditoId={emailNcId ?? undefined}
        titulo="Reenviar nota de crédito"
      />

      <DialogCancelarNotaCredito
        open={!!cancelarNcId}
        onOpenChange={(o) => !o && setCancelarNcId(null)}
        loading={cancelar.isPending}
        onConfirm={(motivo, sustituyeUuid) => {
          if (!cancelarNcId) return;
          cancelar.mutate(
            { notaCreditoId: cancelarNcId, motivo, sustituyeUuid },
            { onSuccess: () => setCancelarNcId(null) },
          );
        }}
      />
    </Card>
  );
}
